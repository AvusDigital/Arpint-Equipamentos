// Teste local das funções /api SEM chamar SuperFrete/Pagar.me de verdade (fetch é simulado).
// Rode com:  node scripts/testar-api.js
'use strict';
const assert = require('assert');
process.env.ORIGEM_CEP = '01153000';
process.env.SUPERFRETE_TOKEN = 'token-teste';
process.env.PAGARME_SECRET_KEY = 'sk_test_xxx';
process.env.SITE_URL = 'https://arpint.exemplo.com.br';
process.env.PAGARME_WEBHOOK_TOKEN = 'segredo';
process.env.PAGAMENTO_PROVEDOR = 'pagarme';

const chamadas = [];
global.fetch = async (url, opts = {}) => {
  chamadas.push({ url: String(url), opts, body: opts.body ? JSON.parse(opts.body) : null });
  const ok = (j, status = 200) => ({ ok: status < 400, status, json: async () => j });
  if (String(url).includes('/api/v0/calculator')) {
    if (global.__sfFalhar) return ok({ error: 'x' }, global.__sfFalhar);
    if (String(opts.body).includes('"services":"1,2,17,99"')) return ok({ error: 'servico invalido' }, 400);   // ID que a conta não tem
    const lista = [
      { id: 2, name: 'SEDEX', price: 48.9, delivery_range: { min: 2, max: 3 }, company: { name: 'Correios' } },
      { id: 1, name: 'PAC', price: 31.2, delivery_range: { min: 5, max: 7 }, company: { name: 'Correios' } },
      { id: 17, name: 'Mini Envios', has_error: true, error: 'excede o peso' }
    ];
    if (String(opts.body).includes('"services":"1,2,17,3"')) lista.push({ id: 3, name: '.Package', price: 39.5, delivery_range: { min: 4, max: 6 }, company: { name: 'Jadlog' } });
    return ok(lista);
  }
  if (String(url).endsWith('/orders')) return ok({ id: 'or_123', checkouts: [{ payment_url: 'https://api.pagar.me/checkout/v5/orders/chk_1' }] });
  if (String(url).includes('/orders/or_')) return ok({ id: 'or_123', code: 'ARP-X', status: 'paid', amount: 10000, customer: { name: 'Fulano' } });
  throw new Error('url inesperada ' + url);
};

const frete = require('../api/frete');
const checkout = require('../api/checkout');
const webhook = require('../api/webhook-pagarme');
const { PRODUTOS } = require('../api/_lib');

function call(fn, body, { method = 'POST', url = '/x' } = {}) {
  return new Promise(resolve => {
    const req = { method, url, headers: { 'x-forwarded-for': String(Math.random()) }, body };
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(txt) { resolve({ status: this.statusCode, json: JSON.parse(txt) }); } };
    fn(req, res);
  });
}

(async () => {
  const comPreco = PRODUTOS.filter(p => p.preco > 0);
  const p1 = comPreco[0], p2 = comPreco[1];
  const semPreco = PRODUTOS.find(p => p.preco == null);
  const itens = [{ id: p1.id, quantidade: 2 }, { id: p2.id, quantidade: 1 }];

  // 1) frete: ordenado por preço, serviço com erro descartado, caixa 50x50x50
  let r = await call(frete, { cep: '20020-050', itens });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.opcoes.map(o => o.servico), ['PAC', 'SEDEX']);
  const sf = chamadas.at(-1);
  assert.deepEqual([sf.body.package.length, sf.body.package.width, sf.body.package.height], [50, 50, 50]);
  assert.equal(sf.body.services, '1,2,17');
  assert.equal(sf.body.to.postal_code, '20020050');
  assert.equal(sf.opts.headers.Authorization, 'Bearer token-teste');
  console.log('ok frete (caixa 50x50x50, PAC/SEDEX, filtra erro)  peso enviado:', sf.body.package.weight, 'kg');

  // 2) validações
  assert.equal((await call(frete, { cep: '123', itens })).status, 400);
  assert.equal((await call(frete, { cep: '20020050', itens: [] })).status, 400);
  assert.equal((await call(frete, { cep: '20020050', itens: [{ id: 99999, quantidade: 1 }] })).status, 400);
  assert.equal((await call(frete, { cep: '20020050', itens: [{ id: p1.id, quantidade: 0 }] })).status, 400);
  if (semPreco) assert.equal((await call(frete, { cep: '20020050', itens: [{ id: semPreco.id, quantidade: 1 }] })).status, 400);
  assert.equal((await call(frete, {}, { method: 'GET' })).status, 405);
  console.log('ok validações (CEP, carrinho vazio, produto inexistente, qtd inválida, sob consulta, GET)');

  // 3) checkout: preço do navegador é ignorado, total = itens + frete recalculado no servidor
  const cliente = { nome: 'Maria da Silva', email: 'maria@exemplo.com', telefone: '(11) 98765-4321', documento: '529.982.247-25' };
  const endereco = { cep: '20020-050', rua: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'Rio de Janeiro', uf: 'rj' };
  r = await call(checkout, { itens, cliente, endereco, freteId: '1', freteValor: 0.01, precos: [1] });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.match(r.json.url, /^https:\/\/api\.pagar\.me\//);
  const ped = chamadas.at(-1).body;
  assert.equal(ped.items[0].amount, Math.round(p1.preco * 100));
  assert.equal(ped.shipping.amount, 3120);           // PAC, vindo da SuperFrete, não do navegador
  assert.equal(ped.shipping.description, 'Correios PAC');
  assert.equal(ped.payments[0].payment_method, 'checkout');
  assert.equal(ped.customer.document_type, 'CPF');
  assert.equal(ped.customer.address.state, 'RJ');
  assert.match(chamadas.at(-1).opts.headers.Authorization, /^Basic /);
  console.log('ok checkout (preço e frete recalculados no servidor)');

  // 4) checkout: frete inexistente -> 409 com opções novas; CPF inválido -> 400
  r = await call(checkout, { itens, cliente, endereco, freteId: '999' });
  assert.equal(r.status, 409); assert.ok(r.json.opcoes.length);
  r = await call(checkout, { itens, cliente: { ...cliente, documento: '111.111.111-11' }, endereco, freteId: '1' });
  assert.equal(r.status, 400);
  console.log('ok checkout (frete inválido -> 409, CPF inválido -> 400)');

  // 5) webhook: sem token -> 401; com token e pedido pago -> 200
  r = await call(webhook, { type: 'order.paid', data: { id: 'or_123' } }, { url: '/api/webhook-pagarme?token=errado' });
  assert.equal(r.status, 401);
  r = await call(webhook, { type: 'order.paid', data: { id: 'or_123' } }, { url: '/api/webhook-pagarme?token=segredo' });
  assert.equal(r.status, 200);
  console.log('ok webhook (token + confirmação do pedido na API)');

  // 5b) modo WhatsApp: sem gateway, devolve o link wa.me com o pedido já conferido no servidor
  process.env.PAGAMENTO_PROVEDOR = 'whatsapp';
  r = await call(checkout, { itens, cliente, endereco, freteId: '1', pagamento: 'cartao' });
  assert.equal(r.status, 200); assert.equal(r.json.modo, 'whatsapp');
  const msg = decodeURIComponent(r.json.url.split('text=')[1]);
  assert.match(r.json.url, /^https:\/\/wa\.me\/5511958700890\?text=/);
  assert.match(msg, /Frete \(Correios PAC/); assert.match(msg, /Cartão de crédito/); assert.match(msg, /Maria da Silva/);
  assert.equal(chamadas.filter(c => c.url.endsWith('/orders')).length, 1);   // não criou pedido no Pagar.me
  console.log('ok checkout modo WhatsApp (mensagem com itens, frete, total, cliente e endereço)');

  // 5c) retirada na loja: sem endereço, sem chamar a SuperFrete
  const antes = chamadas.length;
  r = await call(checkout, { itens, cliente, freteId: 'retirada' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.match(decodeURIComponent(r.json.url.split('text=')[1]), /Retirada na loja/);
  assert.equal(chamadas.length, antes);
  console.log('ok retirada na loja (sem endereço e sem cotação)');

  // 5d) "frete a combinar" (usado quando a SuperFrete cai) só no modo WhatsApp
  r = await call(checkout, { itens, cliente, endereco, freteId: 'combinar' });
  assert.equal(r.status, 200);
  assert.match(decodeURIComponent(r.json.url.split('text=')[1]), /a combinar/);
  console.log('ok frete a combinar');

  // 5e) transportadoras: Jadlog entra como "transportadora"; Correios como "correios"
  process.env.SUPERFRETE_SERVICOS = '1,2,17,3';
  r = await call(frete, { cep: '20020050', itens });
  assert.deepEqual(r.json.opcoes.map(o => o.grupo + ':' + o.servico), ['correios:PAC', 'transportadora:.Package', 'correios:SEDEX']);
  console.log('ok grupos correios/transportadora:', r.json.opcoes.map(o => o.empresa + ' ' + o.servico + ' R$' + o.preco).join(' | '));

  // 5f) ID inválido nos serviços configurados -> refaz só com os Correios (nunca deixa o cliente sem frete)
  process.env.SUPERFRETE_SERVICOS = '1,2,17,99';
  r = await call(frete, { cep: '20020050', itens });
  assert.equal(r.status, 200); assert.equal(r.json.opcoes.length, 2);
  console.log('ok fallback para PAC/SEDEX quando a SuperFrete recusa um ID');
  process.env.SUPERFRETE_SERVICOS = '1,2,17';

  // 5g) token recusado -> 503 com código SF-401 para diagnóstico
  global.__sfFalhar = 401;
  r = await call(frete, { cep: '20020050', itens });
  assert.equal(r.status, 503); assert.equal(r.json.codigo, 'SF-401');
  global.__sfFalhar = 0;
  console.log('ok token recusado -> SF-401');

  // 5h) endpoint de diagnóstico
  const diag = require('../api/diagnostico');
  r = await new Promise(resolve => diag({ method: 'GET', url: '/api/diagnostico', headers: {} }, { setHeader() {}, end(t) { resolve(JSON.parse(t)); } }));
  assert.match(r.resultado, /^OK/); assert.equal(r.variaveis.SUPERFRETE_TOKEN, true);
  console.log('ok /api/diagnostico:', r.resultado);

  // 6) sem credenciais -> 503 (nunca inventa preço de frete)
  delete process.env.SUPERFRETE_TOKEN;
  r = await call(frete, { cep: '20020050', itens });
  assert.equal(r.status, 503);
  console.log('ok sem token da SuperFrete -> 503');
  console.log('\nTODOS OS TESTES PASSARAM');
})().catch(e => { console.error('FALHOU:', e); process.exit(1); });
