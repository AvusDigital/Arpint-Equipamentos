// Dados da loja que aparecem no site. Edite aqui — não precisa mexer em mais nada.
window.ARPINT = {
  // Como o pedido é finalizado:
  //  'whatsapp' = o pedido (itens, frete, endereço) vai pronto para o WhatsApp da loja e o pagamento (Pix/cartão) é combinado lá.
  //  'gateway'  = vai direto para o checkout do Pagar.me (precisa das variáveis do Pagar.me na Vercel).
  pagamento: 'whatsapp',

  whatsapp: '5511958700890',       // só números, com 55 + DDD

  // Retirada na loja (botão "Retirada" no frete). Para desligar: ativa: false (e RETIRADA=0 na Vercel).
  retirada: {
    ativa: true,
    endereco: '',                  // ex.: 'Rua Tal, 123 - Bairro - São Paulo/SP'
    horario: ''                    // ex.: 'Seg a Sex, 8h às 18h'
  },

  // Aparecem no rodapé (se ficar vazio, a linha não é exibida):
  razaoSocial: '',                 // ex.: 'ARPINT COMERCIO LTDA'
  cnpj: '',                        // ex.: '00.000.000/0001-00'
  endereco: ''                     // ex.: 'Rua Tal, 123 - Bairro - São Paulo/SP'
};
