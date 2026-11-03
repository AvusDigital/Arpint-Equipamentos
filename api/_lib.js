// Funções compartilhadas pelas rotas /api (arquivos que começam com "_" não viram rota na Vercel).
'use strict';

const PRODUTOS = require('../data/produtos.json');

// ---------------------------------------------------------------------------
// Configuração (tudo vem de variáveis de ambiente — veja .env.example)
// ---------------------------------------------------------------------------
function cfg() {
  const [c, l, a] = String(process.env.FRETE_CAIXA || '50x50x50').split('x').map(Number);
  return {
    siteUrl: String(process.env.SITE_URL || '').replace(/\/$/, ''),
    origemCep: String(process.env.ORIGEM_CEP || '').replace(/\D/g, ''),
    sfToken: process.env.SUPERFRETE_TOKEN || '',
    sfBase: process.env.SUPERFRETE_ENV === 'sandbox' ? 'https://sandbox.superfrete.com' : 'https://api.superfrete.com',
    sfContato: process.env.SUPERFRETE_CONTATO || 'contato@arpint.com.br',
    // 1 = PAC, 2 = SEDEX, 17 = Mini Envios. Outras transportadoras: coloque aqui os IDs
    // que a SuperFrete liberar na sua conta (ex.: "1,2,17,3,31").
    sfServicos: process.env.SUPERFRETE_SERVICOS || '1,2,17',
    caixa: { comprimento: c || 50, largura: l || 50, altura: a || 50 },
    pesoEmbalagemG: Number(process.env.FRETE_PESO_EMBALAGEM_G ?? 500),
    seguro: process.env.FRETE_SEGURO !== '0',
    retirada: process.env.RETIRADA !== '0',
    pgBase: process.env.PAGARME_BASE_URL || 'https://api.pagar.me/core/v5',
    pgKey: process.env.PAGARME_SECRET_KEY || '',
    pgMetodos: String(process.env.PAGARME_METODOS || 'credit_card,pix').split(',').map(s => s.trim()).filter(Boolean),
    pgWebhookToken: process.env.PAGARME_WEBHOOK_TOKEN || '',
    whatsapp: String(process.env.WHATSAPP || '5511958700890').replace(/\D/g, ''),
    // 'whatsapp' (padrão se não houver chave do Pagar.me): o pedido vai pronto para o WhatsApp da loja.
    // 'pagarme': cria o pedido no Pagar.me e manda o cliente para o checkout deles.
    provedor: process.env.PAGAMENTO_PROVEDOR || (process.env.PAGARME_SECRET_KEY ? 'pagarme' : 'whatsapp')
  };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra || {}; }
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { throw new HttpError(400, 'Requisição inválida.'); } }
  const chunks = [];
  let size = 0;
  for await (const ch of req) { size += ch.length; if (size > 100_000) throw new HttpError(413, 'Requisição grande demais.'); chunks.push(ch); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new HttpError(400, 'Requisição inválida.'); }
}

// Limite simples por IP (vale por instância da função; é só uma proteção básica contra abuso).
const hits = new Map();
function rateLimit(req, max = 30, windowMs = 60_000) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'ip').split(',')[0].trim();
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  if (arr.length > max) throw new HttpError(429, 'Muitas tentativas. Aguarde um minuto e tente de novo.');
}

function handler(fn) {
  return async (req, res) => {
    try {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); throw new HttpError(405, 'Método não permitido.'); }
      await fn(req, res);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { erro: e.message, ...e.extra });
      console.error('[api] erro inesperado:', e);
      send(res, 500, { erro: 'Erro interno. Tente novamente em instantes.' });
    }
  };
}

// ---------------------------------------------------------------------------
// Carrinho — SEMPRE recalculado aqui, com os preços do catálogo (nunca confie no navegador)
// ---------------------------------------------------------------------------
function priceCart(itens) {
  if (!Array.isArray(itens) || !itens.length) throw new HttpError(400, 'Seu carrinho está vazio.');
  if (itens.length > 50) throw new HttpError(400, 'Itens demais no carrinho.');
  const merged = new Map();
  for (const it of itens) {
    const id = Number(it?.id);
    const q = Math.floor(Number(it?.quantidade));
    if (!Number.isInteger(id) || !(q >= 1 && q <= 99)) throw new HttpError(400, 'Item inválido no carrinho.');
    merged.set(id, Math.min(99, (merged.get(id) || 0) + q));
  }
  const lines = [];
  for (const [id, quantidade] of merged) {
    const p = PRODUTOS.find(x => Number(x.id) === id);
    if (!p) throw new HttpError(400, 'Um produto do carrinho não existe mais. Atualize o carrinho.');
    if (p.preco === null || p.preco === undefined) throw new HttpError(400, `"${p.nome}" está sob consulta e não pode ser comprado pelo site.`);
    if (typeof p.estoque === 'number' && p.estoque <= 0) throw new HttpError(400, `"${p.nome}" está esgotado.`);
    lines.push({ produto: p, quantidade, precoCent: Math.round(Number(p.preco) * 100) });
  }
  const subtotalCent = lines.reduce((s, l) => s + l.precoCent * l.quantidade, 0);
  return { lines, subtotalCent };
}

// ---------------------------------------------------------------------------
// Frete — SuperFrete (Correios PAC/SEDEX/Mini Envios e as demais transportadoras da plataforma)
// ---------------------------------------------------------------------------
function buildVolume(lines, c) {
  // Quando TODOS os produtos tiverem peso e medidas preenchidos em data/produtos.json, mandamos
  // os produtos e a SuperFrete escolhe a caixa. Enquanto isso, usamos a caixa padrão (50x50x50).
  const complete = lines.every(({ produto: p }) => {
    const d = p.dimensoes || {};
    return p.peso > 0 && d.comprimento > 0 && d.largura > 0 && d.altura > 0;
  });
  if (complete) {
    return {
      products: lines.map(({ produto: p, quantidade }) => ({
        quantity: quantidade,
        height: p.dimensoes.altura, width: p.dimensoes.largura, length: p.dimensoes.comprimento,
        weight: +(p.peso / 1000).toFixed(3)
      }))
    };
  }
  const gramas = lines.reduce((s, { produto: p, quantidade }) => s + (Number(p.peso) || 0) * quantidade, 0) + c.pesoEmbalagemG;
  return {
    package: {
      height: c.caixa.altura, width: c.caixa.largura, length: c.caixa.comprimento,
      weight: +Math.max(0.3, gramas / 1000).toFixed(3)
    }
  };
}

const SERVICOS_CORREIOS = '1,2,17';   // PAC, SEDEX, Mini Envios (IDs documentados pela SuperFrete)

function normalizar(lista) {
  return lista
    .filter(o => o && !o.has_error && !o.error && Number(o.price ?? o.custom_price) > 0)
    .map(o => {
      const min = o.delivery_range?.min, max = o.delivery_range?.max, dias = o.delivery_time;
      const prazoTexto = (min && max && min !== max) ? `entrega em ${min} a ${max} dias úteis`
        : `entrega em ${max || min || dias || '?'} dias úteis`;
      const empresa = o.company?.name || 'Correios';
      const correios = /correios/i.test(empresa) || [1, 2, 17].includes(Number(o.id));
      return {
        id: String(o.id),
        grupo: correios ? 'correios' : 'transportadora',
        empresa,
        servico: o.name || `Serviço ${o.id}`,
        preco: Number(o.price ?? o.custom_price),
        prazoTexto
      };
    })
    .sort((a, b) => a.preco - b.preco);
}

async function chamarSuperFrete(c, corpo) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const r = await fetch(`${c.sfBase}/api/v0/calculator`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.sfToken}`,
        'User-Agent': `Arpint Site (${c.sfContato})`,
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify(corpo),
      signal: ctrl.signal
    });
    const data = await r.json().catch(() => null);
    return { status: r.status, ok: r.ok, data };
  } catch (e) {
    return { status: 0, ok: false, data: null, erroRede: e.name };
  } finally { clearTimeout(timer); }
}

async function quoteShipping(cepDestino, lines, subtotalCent) {
  const c = cfg();
  const cep = String(cepDestino || '').replace(/\D/g, '');
  if (cep.length !== 8) throw new HttpError(400, 'Digite um CEP válido com 8 números.', { codigo: 'cep' });
  if (!c.sfToken || c.origemCep.length !== 8) {
    console.error('[frete] faltam SUPERFRETE_TOKEN e/ou ORIGEM_CEP nas variáveis de ambiente (Vercel > Settings > Environment Variables) — e é preciso fazer novo deploy depois de criar.');
    throw new HttpError(503, 'Cálculo de frete indisponível no momento.', { codigo: 'SF-CONFIG' });
  }

  const base = {
    from: { postal_code: c.origemCep },
    to: { postal_code: cep },
    options: {
      own_hand: false,
      receipt: false,
      insurance_value: c.seguro ? +(subtotalCent / 100).toFixed(2) : 0,
      use_insurance_value: c.seguro
    },
    ...buildVolume(lines, c)
  };

  // 1ª tentativa com todos os serviços configurados; se a SuperFrete recusar (ex.: ID de transportadora
  // que a conta não tem), tenta só com PAC/SEDEX/Mini Envios para o cliente nunca ficar sem frete.
  let resp = await chamarSuperFrete(c, { ...base, services: c.sfServicos });
  if (!resp.ok && resp.status >= 400 && resp.status < 500 && ![401, 403].includes(resp.status) && c.sfServicos !== SERVICOS_CORREIOS) {
    console.error('[frete] SuperFrete recusou os serviços', c.sfServicos, '->', resp.status, JSON.stringify(resp.data)?.slice(0, 300), '| tentando só os Correios');
    resp = await chamarSuperFrete(c, { ...base, services: SERVICOS_CORREIOS });
  }

  if (resp.erroRede) {
    console.error('[frete] falha de rede/tempo com a SuperFrete:', resp.erroRede);
    throw new HttpError(502, 'Não conseguimos consultar o frete agora. Tente de novo em instantes.', { codigo: 'SF-REDE' });
  }
  if (!resp.ok) {
    console.error('[frete] SuperFrete respondeu', resp.status, JSON.stringify(resp.data)?.slice(0, 400));
    if (resp.status === 401 || resp.status === 403) {
      console.error('[frete] token recusado: confira se o token é do mesmo ambiente de SUPERFRETE_ENV (production x sandbox).');
      throw new HttpError(503, 'Cálculo de frete indisponível no momento.', { codigo: 'SF-' + resp.status });
    }
    throw new HttpError(502, 'Não foi possível calcular o frete para esse CEP agora.', { codigo: 'SF-' + resp.status });
  }

  const data = resp.data;
  const lista = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
  const options = normalizar(lista);
  if (!options.length) {
    console.error('[frete] SuperFrete respondeu 200 mas sem opções válidas:', JSON.stringify(data)?.slice(0, 400));
    throw new HttpError(404, 'Nenhuma transportadora atende esse CEP com esse pedido.', { codigo: 'SF-VAZIO' });
  }
  return options;
}

// ---------------------------------------------------------------------------
// Validações
// ---------------------------------------------------------------------------
function validCpf(d) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +d[9] && dv(10) === +d[10];
}
function validCnpj(d) {
  if (!/^\d{14}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const dv = n => { const w = n === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]; let s = 0; for (let i = 0; i < n; i++) s += +d[i] * w[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === +d[12] && dv(13) === +d[13];
}

const brl = cents => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

module.exports = { cfg, HttpError, normalizar, chamarSuperFrete, SERVICOS_CORREIOS, send, readJson, rateLimit, handler, priceCart, quoteShipping, buildVolume, validCpf, validCnpj, brl, PRODUTOS };
