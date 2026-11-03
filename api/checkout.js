// POST /api/checkout  -> recalcula tudo no servidor, cria o pedido no Pagar.me e devolve a URL do checkout.
'use strict';
const { cfg, brl, HttpError, handler, readJson, rateLimit, priceCart, quoteShipping, send, validCpf, validCnpj } = require('./_lib');

const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
const clean = (s, max = 120) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const digits = s => String(s ?? '').replace(/\D/g, '');

function validarCliente(body, exigeEndereco = true) {
  const nome = clean(body.cliente?.nome, 100);
  const email = clean(body.cliente?.email, 120).toLowerCase();
  let fone = digits(body.cliente?.telefone);
  if (fone.length > 11 && fone.startsWith('55')) fone = fone.slice(2);
  const doc = digits(body.cliente?.documento);

  if (nome.split(' ').length < 2 || nome.length < 5) throw new HttpError(400, 'Informe seu nome completo.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, 'E-mail inválido.');
  if (!/^\d{10,11}$/.test(fone)) throw new HttpError(400, 'Telefone inválido. Use DDD + número.');
  const tipoDoc = doc.length === 11 ? 'CPF' : doc.length === 14 ? 'CNPJ' : null;
  if (!tipoDoc || !(tipoDoc === 'CPF' ? validCpf(doc) : validCnpj(doc))) throw new HttpError(400, 'CPF/CNPJ inválido.');

  if (!exigeEndereco) return { nome, email, fone, doc, tipoDoc, end: null };   // retirada na loja

  const e = body.endereco || {};
  const end = {
    cep: digits(e.cep), rua: clean(e.rua), numero: clean(e.numero, 20), complemento: clean(e.complemento, 60),
    bairro: clean(e.bairro, 60), cidade: clean(e.cidade, 60), uf: clean(e.uf, 2).toUpperCase()
  };
  if (end.cep.length !== 8) throw new HttpError(400, 'CEP inválido.');
  if (!end.rua || !end.numero || !end.bairro || !end.cidade) throw new HttpError(400, 'Preencha rua, número, bairro e cidade.');
  if (!UFS.has(end.uf)) throw new HttpError(400, 'UF inválida.');

  return { nome, email, fone, doc, tipoDoc, end };
}

module.exports = handler(async (req, res) => {
  rateLimit(req, 10);
  const c = cfg();
  if (c.provedor === 'pagarme' && (!c.pgKey || !c.siteUrl)) {
    console.error('[checkout] faltam PAGARME_SECRET_KEY e/ou SITE_URL');
    throw new HttpError(503, 'Pagamento indisponível no momento. Fale com a gente pelo WhatsApp.');
  }

  const body = await readJson(req);
  const freteId = String(body.freteId || '');
  const retirada = freteId === 'retirada';
  const combinar = freteId === 'combinar';
  if (retirada && !c.retirada) throw new HttpError(400, 'Retirada na loja indisponível.');
  if (combinar && c.provedor !== 'whatsapp') throw new HttpError(400, 'Escolha uma opção de frete.');

  const cli = validarCliente(body, !retirada);
  const { lines, subtotalCent } = priceCart(body.itens);

  // O frete é cotado de novo AQUI; o preço que veio do navegador é ignorado.
  let frete;
  if (retirada) frete = { id: 'retirada', empresa: 'Retirada', servico: 'na loja', preco: 0, prazoTexto: 'retirada sem custo de frete' };
  else if (combinar) frete = { id: 'combinar', empresa: 'Frete', servico: 'a combinar', preco: 0, prazoTexto: 'valor combinado pelo WhatsApp' };
  else {
    const opcoes = await quoteShipping(cli.end.cep, lines, subtotalCent);
    frete = opcoes.find(o => o.id === freteId);
    if (!frete) throw new HttpError(409, 'O frete mudou ou não está mais disponível. Escolha o frete de novo.', { opcoes });
  }
  const freteCent = Math.round(frete.preco * 100);

  const codigo = 'ARP-' + Date.now().toString(36).toUpperCase();

  // --- Modo WhatsApp: o pedido (já com preço e frete conferidos aqui) vai pronto para o WhatsApp da loja ---
  if (c.provedor === 'whatsapp') {
    const pref = body.pagamento === 'cartao' ? 'Cartão de crédito' : 'Pix';
    const e = cli.end;
    const linhaFrete = retirada ? '*Retirada na loja* (sem frete)'
      : combinar ? 'Frete: *a combinar* (será calculado pela equipe)'
      : `Frete (${frete.empresa} ${frete.servico}, ${frete.prazoTexto}): ${brl(freteCent)}`;
    const linhaEntrega = e
      ? `*Entrega:* ${e.rua}, ${e.numero}${e.complemento ? ' - ' + e.complemento : ''} - ${e.bairro}, ${e.cidade}/${e.uf} - CEP ${e.cep}`
      : '*Entrega:* cliente vai retirar na loja';
    const msg = [
      `*Novo pedido ${codigo}*`,
      '',
      ...lines.map(l => `• ${l.quantidade}x ${l.produto.nome} — ${brl(l.precoCent * l.quantidade)}`),
      '',
      `Subtotal: ${brl(subtotalCent)}`,
      linhaFrete,
      combinar ? `*Total (sem o frete): ${brl(subtotalCent)}*` : `*Total: ${brl(subtotalCent + freteCent)}*`,
      `Pagamento: ${pref}`,
      '',
      `*Cliente:* ${cli.nome}`,
      `${cli.tipoDoc}: ${cli.doc}`,
      `Tel: ${cli.fone} | ${cli.email}`,
      linhaEntrega
    ].join('\n');
    console.log(`[checkout] pedido ${codigo} (whatsapp) total=${(subtotalCent + freteCent) / 100}`);
    return send(res, 200, {
      modo: 'whatsapp', pedido: codigo,
      url: `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(msg.slice(0, 3500))}`
    });
  }
  const endereco = cli.end ? {
    line_1: `${cli.end.numero}, ${cli.end.rua}, ${cli.end.bairro}`,
    line_2: cli.end.complemento || undefined,
    zip_code: cli.end.cep, city: cli.end.cidade, state: cli.end.uf, country: 'BR'
  } : undefined;
  const phone = { country_code: '55', area_code: cli.fone.slice(0, 2), number: cli.fone.slice(2) };

  const pedido = {
    code: codigo,
    items: lines.map(l => ({
      amount: l.precoCent, description: String(l.produto.nome).slice(0, 256),
      quantity: l.quantidade, code: String(l.produto.id)
    })),
    customer: {
      name: cli.nome, email: cli.email, document: cli.doc, document_type: cli.tipoDoc,
      type: cli.tipoDoc === 'CPF' ? 'individual' : 'company',
      phones: { mobile_phone: phone }, ...(endereco ? { address: endereco } : {})
    },
    shipping: {
      amount: freteCent, description: `${frete.empresa} ${frete.servico}`,
      recipient_name: cli.nome, recipient_phone: `55${cli.fone}`, ...(endereco ? { address: endereco } : {})
    },
    payments: [{
      payment_method: 'checkout',
      checkout: {
        accepted_payment_methods: c.pgMetodos,
        success_url: `${c.siteUrl}/sucesso.html?pedido=${codigo}`
      }
    }],
    metadata: { site: 'arpint', frete_servico: `${frete.empresa} ${frete.servico}`, frete_prazo: frete.prazoTexto }
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9_000);
  let r, data;
  try {
    r = await fetch(`${c.pgBase}/orders`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(c.pgKey + ':').toString('base64'),
        'Content-Type': 'application/json',
        'User-Agent': 'arpint-site/1.0'
      },
      body: JSON.stringify(pedido),
      signal: ctrl.signal
    });
    data = await r.json().catch(() => null);
  } catch (e) {
    console.error('[checkout] falha ao falar com o Pagar.me:', e.name);
    throw new HttpError(502, 'Não conseguimos iniciar o pagamento agora. Tente de novo em instantes.');
  } finally { clearTimeout(timer); }

  const url = data?.checkouts?.[0]?.payment_url;
  if (!r.ok || !url) {
    console.error('[checkout] Pagar.me respondeu', r.status, JSON.stringify(data)?.slice(0, 600));
    throw new HttpError(502, 'Não conseguimos iniciar o pagamento agora. Tente de novo ou fale com a gente pelo WhatsApp.');
  }

  console.log(`[checkout] pedido ${codigo} criado (${data.id}) total=${(subtotalCent + freteCent) / 100}`);
  send(res, 200, { url, pedido: codigo });
});
