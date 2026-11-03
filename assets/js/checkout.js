const $ = s => document.querySelector(s);
let PRODUTOS = [];
let opcoes = [];
let frete = null;
let cotacaoCep = '';

const modoWhats = (window.ARPINT?.pagamento || 'whatsapp') === 'whatsapp';
const digits = v => String(v || '').replace(/\D/g, '');
const cart = () => arpintCart.get();

function totais() {
  let sub = 0;
  const html = cart().map(i => {
    const p = PRODUTOS.find(x => +x.id === +i.id);
    if (!p || p.preco == null) return '';
    sub += p.preco * i.quantidade;
    return `<div class="flex justify-between gap-3 text-sm"><span class="text-muted">${i.quantidade}× ${arpint.esc(p.nome)}</span><b>${arpint.money(p.preco * i.quantidade)}</b></div>`;
  }).join('');
  return { sub, html };
}

function render() {
  const { sub, html } = totais();
  $('#summary').innerHTML = html + (frete
    ? `<div class="flex justify-between text-sm"><span class="text-muted">Frete (${arpint.esc(frete.empresa)} ${arpint.esc(frete.servico)})</span><b>${arpint.freteTexto(frete)}</b></div>`
    : '<div class="flex justify-between text-sm"><span class="text-muted">Frete</span><b>a calcular</b></div>');
  $('#checkout-total').textContent = arpint.money(sub + (frete ? frete.preco : 0));
}

function erro(msg) {
  const el = $('#form-error');
  el.textContent = msg || '';
  el.classList.toggle('hidden', !msg);
}

// ---- CPF/CNPJ (mesma regra do servidor; o servidor valida de novo) ----
function cpfOk(d) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +d[9] && dv(10) === +d[10];
}
function cnpjOk(d) {
  if (!/^\d{14}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const dv = n => { const w = n === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]; let s = 0; for (let i = 0; i < n; i++) s += +d[i] * w[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === +d[12] && dv(13) === +d[13];
}
function maskDoc(v) {
  v = digits(v).slice(0, 14);
  if (v.length <= 11) return v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return v.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}
function maskPhone(v) {
  v = digits(v).slice(0, 11);
  if (v.length > 6) return v.replace(/(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
  if (v.length > 2) return v.replace(/(\d{2})(\d+)/, '($1) $2');
  return v;
}

// ---- CEP: preenche o endereço (ViaCEP) e cota o frete ----
function abasIniciais() {
  $('#ship-hint').textContent = 'Retire na loja ou digite o CEP para ver Correios e transportadoras.';
  arpint.renderShipping($('#ship-options'), [], frete?.id === 'retirada' ? 'retirada' : null, o => { frete = o; render(); }, { semCep: true });
}

async function aoDigitarCep() {
  const cep = digits($('#cep').value);
  if (cep.length !== 8) { if (cotacaoCep) { cotacaoCep = ''; if (frete && frete.id !== 'retirada' && frete.id !== 'combinar') frete = null; abasIniciais(); render(); } return; }
  if (cep === cotacaoCep) return;
  cotacaoCep = cep;
  if (!frete || (frete.id !== 'retirada' && frete.id !== 'combinar')) frete = null;
  opcoes = []; render();
  $('#ship-options').innerHTML = '';
  $('#ship-hint').textContent = 'Consultando CEP e transportadoras...';

  try {   // endereço automático (se o ViaCEP falhar, o cliente digita e segue normalmente)
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const a = await r.json();
    if (!a.erro) {
      if (!$('#street').value) $('#street').value = a.logradouro || '';
      if (!$('#district').value) $('#district').value = a.bairro || '';
      $('#city').value = a.localidade || $('#city').value;
      $('#uf').value = a.uf || $('#uf').value;
    }
  } catch { }

  try {
    const r = await arpint.api('frete', { cep, itens: cart().map(i => ({ id: i.id, quantidade: i.quantidade })) });
    opcoes = r.opcoes;
    const salvo = arpintShip.get();
    const escolhidoAntes = frete && (frete.id === 'retirada') ? frete : null;       // retirada escolhida antes do CEP continua valendo
    frete = escolhidoAntes || opcoes.find(o => o.id === salvo?.id) || opcoes[0];
    $('#ship-hint').textContent = 'Escolha como quer receber:';
    arpint.renderShipping($('#ship-options'), opcoes, frete.id, o => { frete = o; render(); });
    render();
  } catch (e) {
    cotacaoCep = '';
    $('#ship-hint').textContent = 'Não foi possível calcular o frete automaticamente.';
    arpint.renderShippingError($('#ship-options'), e.message, e.codigo, o => { frete = o; render(); });
  }
}

// ---- etapas: 1 = dados pessoais, 2 = entrega + frete + pagamento ----
let passo = 1;
function irPara(n) {
  passo = n;
  $('#step-1').classList.toggle('hidden', n !== 1);
  $('#step-2').classList.toggle('hidden', n !== 2);
  $('#st-1').classList.toggle('active', n === 1);
  $('#st-1').classList.toggle('done', n > 1);
  $('#st-2').classList.toggle('active', n === 2);
  erro('');
  $('.stepper').scrollIntoView({ block: 'start' });
  if (n === 2) { if (!$('#cep').value) $('#cep').focus(); }
}

function validarPasso1(f) {
  if (f.cliente.nome.trim().split(/\s+/).length < 2) return 'Informe seu nome completo.';
  const d = f.cliente.documento;
  if (!(d.length === 11 ? cpfOk(d) : d.length === 14 ? cnpjOk(d) : false)) return 'CPF ou CNPJ inválido.';
  if (!/^\d{10,11}$/.test(f.cliente.telefone)) return 'Telefone inválido. Use DDD + número.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.cliente.email.trim())) return 'E-mail inválido.';
  return '';
}

function avancar() {
  const msg = validarPasso1(lerForm());
  if (msg) { erro(msg); return; }
  irPara(2);
}

function lerForm() {
  return {
    itens: cart().map(i => ({ id: i.id, quantidade: i.quantidade })),
    freteId: frete?.id,
    pagamento: document.querySelector('input[name="pagamento"]:checked')?.value || 'pix',
    cliente: { nome: $('#name').value, email: $('#email').value, telefone: digits($('#phone').value), documento: digits($('#doc').value) },
    endereco: {
      cep: digits($('#cep').value), rua: $('#street').value, numero: $('#number').value, complemento: $('#complement').value,
      bairro: $('#district').value, cidade: $('#city').value, uf: $('#uf').value
    }
  };
}

function validar(f) {
  if (!f.itens.length) return 'Seu carrinho está vazio.';
  if (f.cliente.nome.trim().split(/\s+/).length < 2) return 'Informe seu nome completo.';
  const d = f.cliente.documento;
  if (!(d.length === 11 ? cpfOk(d) : d.length === 14 ? cnpjOk(d) : false)) return 'CPF ou CNPJ inválido.';
  if (!/^\d{10,11}$/.test(f.cliente.telefone)) return 'Telefone inválido. Use DDD + número.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.cliente.email.trim())) return 'E-mail inválido.';
  if (frete?.id === 'retirada') return '';
  if (!frete) return 'Escolha uma opção de frete.';
  const e = f.endereco;
  if (e.cep.length !== 8) return 'CEP inválido.';
  if (!e.rua.trim() || !e.numero.trim() || !e.bairro.trim() || !e.cidade.trim() || e.uf.trim().length !== 2) return 'Preencha o endereço completo.';
  return '';
}

$('#next-btn').addEventListener('click', avancar);
$('#back-btn').addEventListener('click', () => irPara(1));
$('#doc').addEventListener('input', e => { e.target.value = maskDoc(e.target.value); });
$('#phone').addEventListener('input', e => { e.target.value = maskPhone(e.target.value); });
$('#cep').addEventListener('input', e => { e.target.value = arpint.maskCep(e.target.value); aoDigitarCep(); });

// Contingência: se as funções do servidor não responderem (fora do ar / não publicadas), o pedido ainda
// sai pronto para o WhatsApp da loja, montado aqui no navegador. A equipe confere os valores ao atender.
function pedidoContingencia(f) {
  const linhas = [];
  let sub = 0;
  for (const i of cart()) {
    const p = PRODUTOS.find(x => +x.id === +i.id);
    if (!p || p.preco == null) continue;
    sub += p.preco * i.quantidade;
    linhas.push(`• ${i.quantidade}x ${p.nome} — ${arpint.money(p.preco * i.quantidade)}`);
  }
  if (!linhas.length) return null;
  const e = f.endereco, c = f.cliente;
  const retirada = frete?.id === 'retirada';
  const combinar = !frete || frete.id === 'combinar';
  const codigo = 'ARP-' + Date.now().toString(36).toUpperCase();
  const msg = [
    `*Novo pedido ${codigo}*`, '',
    ...linhas, '',
    `Subtotal: ${arpint.money(sub)}`,
    retirada ? '*Retirada na loja* (sem frete)' : combinar ? 'Frete: *a combinar* (será calculado pela equipe)'
      : `Frete (${frete.empresa} ${frete.servico}, ${frete.prazoTexto}): ${arpint.money(frete.preco)}`,
    combinar ? `*Total (sem o frete): ${arpint.money(sub)}*` : `*Total: ${arpint.money(sub + (retirada ? 0 : frete.preco))}*`,
    `Pagamento: ${f.pagamento === 'cartao' ? 'Cartão de crédito' : 'Pix'}`, '',
    `*Cliente:* ${c.nome}`,
    `${c.documento.length === 14 ? 'CNPJ' : 'CPF'}: ${c.documento}`,
    `Tel: ${c.telefone} | ${c.email}`,
    retirada ? '*Entrega:* cliente vai retirar na loja'
      : `*Entrega:* ${e.rua}, ${e.numero}${e.complemento ? ' - ' + e.complemento : ''} - ${e.bairro}, ${e.cidade}/${String(e.uf).toUpperCase()} - CEP ${e.cep}`
  ].join('\n');
  const numero = (window.ARPINT && window.ARPINT.whatsapp) || '5511958700890';
  return { pedido: codigo, url: `https://wa.me/${numero}?text=${encodeURIComponent(msg.slice(0, 3500))}` };
}

$('#checkout-form').addEventListener('submit', async e => {
  e.preventDefault();
  erro('');
  if (passo === 1) { avancar(); return; }       // Enter na etapa 1 = "Próximo passo"
  const f = lerForm();
  const m1 = validarPasso1(f);
  if (m1) { irPara(1); erro(m1); return; }
  const msg = validar(f);
  if (msg) { erro(msg); return; }

  const btn = $('#pay-btn');
  btn.disabled = true; btn.textContent = 'Preparando pagamento...';
  try {
    const r = await arpint.api('checkout', f);
    if (r.modo === 'whatsapp') {      // pedido pronto no WhatsApp da loja
      arpintCart.clear(); arpintShip.clear();
      location.href = './sucesso.html?pedido=' + encodeURIComponent(r.pedido) + '&wa=' + encodeURIComponent(r.url);
    } else {
      location.href = r.url;          // ambiente seguro do gateway
    }
  } catch (err) {
    const servidorFora = !(err.dados && err.dados.erro);      // sem resposta válida do servidor
    if (servidorFora && modoWhats) {
      const c = pedidoContingencia(f);
      if (c) {
        arpintCart.clear(); arpintShip.clear();
        location.href = './sucesso.html?pedido=' + encodeURIComponent(c.pedido) + '&wa=' + encodeURIComponent(c.url);
        return;
      }
    }
    erro(err.message);
    btn.disabled = false; btn.textContent = 'Finalizar pedido';
  }
});

$('#pay-whatsapp').classList.toggle('hidden', !modoWhats);
$('#pay-gateway').classList.toggle('hidden', modoWhats);
document.querySelectorAll('input[name="pagamento"]').forEach(r => r.addEventListener('change', () => {
  $('#pay-pix-label').classList.toggle('selected', r.value === 'pix' && r.checked);
  $('#pay-cartao-label').classList.toggle('selected', r.value === 'cartao' && r.checked);
}));

(async () => {
  try { PRODUTOS = await arpint.products(); } catch { erro('Erro ao carregar os produtos. Atualize a página.'); return; }
  const salvo = arpintShip.get();
  if (salvo?.cep) { $('#cep').value = arpint.maskCep(salvo.cep); }
  if (salvo?.id === 'retirada') frete = arpint.retiradaOpt;
  abasIniciais();
  render();
  if (!cart().length) { erro('Seu carrinho está vazio.'); $('#pay-btn').disabled = true; return; }
  aoDigitarCep();
})();
