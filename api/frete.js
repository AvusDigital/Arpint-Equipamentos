// POST /api/frete   { cep, itens:[{id, quantidade}] }
'use strict';
const { handler, readJson, rateLimit, priceCart, quoteShipping, send, cfg } = require('./_lib');

module.exports = handler(async (req, res) => {
  rateLimit(req, 30);
  const { cep, itens } = await readJson(req);
  const { lines, subtotalCent } = priceCart(itens);
  const opcoes = await quoteShipping(cep, lines, subtotalCent);
  send(res, 200, { subtotal: subtotalCent / 100, opcoes });
});
