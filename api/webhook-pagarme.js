// Webhook do Pagar.me. Cadastre no painel a URL:
//   https://SEU-SITE/api/webhook-pagarme?token=O_MESMO_VALOR_DE_PAGARME_WEBHOOK_TOKEN
// O Pagar.me não assina o webhook, então: (1) exigimos o token na URL e (2) NÃO confiamos no corpo —
// confirmamos o status do pedido direto na API do Pagar.me antes de agir.
'use strict';
const crypto = require('crypto');
const { cfg, HttpError, handler, readJson, send } = require('./_lib');

function igual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

module.exports = handler(async (req, res) => {
  const c = cfg();
  const token = new URL(req.url, 'http://x').searchParams.get('token') || '';
  if (!c.pgWebhookToken || !igual(token, c.pgWebhookToken)) throw new HttpError(401, 'Não autorizado.');

  const evento = await readJson(req);
  const tipo = String(evento?.type || '');
  const orderId = evento?.data?.id && String(evento.data.id).startsWith('or_') ? evento.data.id : evento?.data?.order?.id;
  console.log('[webhook]', tipo, orderId || '(sem id de pedido)');

  if (tipo === 'order.paid' && orderId && c.pgKey) {
    const r = await fetch(`${c.pgBase}/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: 'Basic ' + Buffer.from(c.pgKey + ':').toString('base64'), 'User-Agent': 'arpint-site/1.0' }
    });
    const pedido = await r.json().catch(() => null);
    if (r.ok && pedido?.status === 'paid') {
      // PAGAMENTO CONFIRMADO. O pedido (itens, endereço, frete) já fica no painel do Pagar.me.
      // Aqui é o lugar para avisar a loja (e-mail, WhatsApp, planilha...) — veja o README.
      console.log(`[webhook] PEDIDO PAGO ${pedido.code} — ${pedido.customer?.name} — ${(pedido.amount || 0) / 100}`);
    } else {
      console.error('[webhook] não consegui confirmar o pedido', orderId, r.status);
    }
  }
  send(res, 200, { ok: true });
});
