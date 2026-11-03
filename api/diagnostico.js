// GET /api/diagnostico  -> mostra se o frete está configurado e se a SuperFrete responde.
// Não mostra nenhuma chave. Para descobrir os IDs das transportadoras da sua conta:
//   defina DIAGNOSTICO_KEY na Vercel e abra /api/diagnostico?probe=1&key=O_VALOR
'use strict';
const { cfg, send, normalizar, chamarSuperFrete, SERVICOS_CORREIOS } = require('./_lib');

module.exports = async (req, res) => {
  const c = cfg();
  const url = new URL(req.url, 'http://x');
  const out = {
    variaveis: {
      SUPERFRETE_TOKEN: !!c.sfToken,
      ORIGEM_CEP: c.origemCep.length === 8 ? 'ok' : 'faltando ou inválido (precisa de 8 números)',
      SUPERFRETE_ENV: c.sfBase.includes('sandbox') ? 'sandbox' : 'production',
      SUPERFRETE_SERVICOS: c.sfServicos,
      FRETE_CAIXA: `${c.caixa.comprimento}x${c.caixa.largura}x${c.caixa.altura}`,
      provedor_pagamento: c.provedor
    }
  };
  if (!c.sfToken || c.origemCep.length !== 8) {
    out.resultado = 'FALTAM variáveis do frete. Crie na Vercel (Settings > Environment Variables) e faça um novo deploy.';
    return send(res, 200, out);
  }

  const corpo = (servicos, cep) => ({
    from: { postal_code: c.origemCep }, to: { postal_code: cep }, services: servicos,
    options: { own_hand: false, receipt: false, insurance_value: 0, use_insurance_value: false },
    package: { height: c.caixa.altura, width: c.caixa.largura, length: c.caixa.comprimento, weight: 1 }
  });

  const teste = await chamarSuperFrete(c, corpo(c.sfServicos, '20020050'));
  out.teste_cotacao = {
    http: teste.status,
    opcoes: Array.isArray(teste.data) ? normalizar(teste.data).map(o => `${o.empresa} ${o.servico} R$ ${o.preco} (${o.prazoTexto})`) : undefined,
    resposta_bruta: Array.isArray(teste.data) ? undefined : JSON.stringify(teste.data)?.slice(0, 300)
  };
  out.resultado = teste.ok && out.teste_cotacao.opcoes?.length ? 'OK: o frete está funcionando.'
    : (teste.status === 401 || teste.status === 403) ? 'TOKEN RECUSADO: o token não é do ambiente em SUPERFRETE_ENV (production x sandbox) ou foi gerado errado.'
    : 'A SuperFrete respondeu com erro; veja teste_cotacao.';

  // Descobre quais IDs de serviço a sua conta enxerga (1 requisição por ID).
  const key = process.env.DIAGNOSTICO_KEY;
  if (url.searchParams.get('probe') === '1' && key && url.searchParams.get('key') === key) {
    const ids = Array.from({ length: 40 }, (_, i) => i + 1);
    const rs = await Promise.all(ids.map(id => chamarSuperFrete(c, corpo(String(id), '20020050')).then(r => ({ id, r }))));
    out.servicos_disponiveis = rs
      .filter(({ r }) => r.ok && Array.isArray(r.data) && normalizar(r.data).length)
      .map(({ id, r }) => { const o = normalizar(r.data)[0]; return `${id} = ${o.empresa} ${o.servico}`; });
    out.dica = 'Coloque os IDs desejados em SUPERFRETE_SERVICOS, separados por vírgula (ex.: 1,2,17,3).';
  }
  send(res, 200, out);
};
