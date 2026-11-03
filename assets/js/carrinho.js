let PRODUTOS = [];
const $ = s => document.querySelector(s);
const itemsBox = $('#cart-items'), empty = $('#cart-empty');
const subtotalEl = $('#subtotal'), shipEl = $('#shipping'), totalEl = $('#total');
const resultsBox = $('#shipping-results'), cepInput = $('#cep'), calcBtn = $('#calc-shipping');
let opcoes = [];      // opções devolvidas pelo servidor para o carrinho atual
let frete = null;     // opção escolhida

const linhas = () => arpintCart.get()
  .map(i => ({ item: i, p: PRODUTOS.find(x => +x.id === +i.id) }))
  .filter(l => l.p);

// só vende o que tem preço; itens "Consulte-nos" não entram no carrinho de compra
const comprável = p => p.preco !== null && p.preco !== undefined;

function subtotal() {
  return linhas().reduce((s, { item, p }) => s + (comprável(p) ? p.preco * item.quantidade : 0), 0);
}

function render() {
  const c = linhas();
  const link = $('#checkout-link');
  if (!c.length) {
    itemsBox.innerHTML = '';
    empty.classList.remove('hidden');
    link.classList.add('pointer-events-none', 'opacity-40');
    subtotalEl.textContent = arpint.money(0);
    shipEl.textContent = 'Informe o CEP';
    totalEl.textContent = arpint.money(0);
    return;
  }
  empty.classList.add('hidden');
  link.classList.remove('pointer-events-none', 'opacity-40');

  itemsBox.innerHTML = c.map(({ item, p }) => `
    <div class="flex gap-4 rounded-2xl border border-theme bg-panel p-4">
      <div class="product-image h-28 w-28 shrink-0 overflow-hidden rounded-xl">
        <img referrerpolicy="no-referrer" src="${arpint.esc(p.imagem)}" alt="${arpint.esc(p.nome)}" loading="lazy" onerror="this.onerror=null;this.src='./assets/images/produtos/placeholder.svg'" class="h-full w-full object-contain p-2">
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex justify-between gap-3">
          <div>
            <a href="./produto.html?id=${p.id}" class="font-black hover:orange">${arpint.esc(p.nome)}</a>
            ${p.sku ? `<p class="mt-1 text-xs text-muted">SKU ${arpint.esc(p.sku)}</p>` : ''}
          </div>
          <button data-remove="${p.id}" class="text-xl text-muted hover:text-red-400" aria-label="Remover ${arpint.esc(p.nome)}">×</button>
        </div>
        <div class="mt-5 flex items-center justify-between">
          <div class="flex items-center rounded-lg border border-theme">
            <button data-minus="${p.id}" class="px-3 py-2" aria-label="Diminuir">−</button>
            <span class="min-w-8 text-center text-sm font-bold">${item.quantidade}</span>
            <button data-plus="${p.id}" class="px-3 py-2" aria-label="Aumentar">+</button>
          </div>
          <b class="text-lg">${comprável(p) ? arpint.money(p.preco * item.quantidade) : 'Consulte-nos'}</b>
        </div>
        ${comprável(p) ? '' : '<p class="mt-2 text-xs text-yellow-500">Este item é vendido sob consulta. Remova-o para finalizar pelo site.</p>'}
      </div>
    </div>`).join('');

  const sub = subtotal();
  subtotalEl.textContent = arpint.money(sub);
  shipEl.textContent = arpint.freteTexto(frete);
  totalEl.textContent = arpint.money(sub + (frete ? frete.preco : 0));

  const bloqueado = c.some(({ p }) => !comprável(p));
  link.classList.toggle('pointer-events-none', bloqueado);
  link.classList.toggle('opacity-40', bloqueado);

  itemsBox.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => { arpintCart.remove(+b.dataset.remove); invalidarFrete(); render(); });
  itemsBox.querySelectorAll('[data-minus]').forEach(b => b.onclick = () => change(+b.dataset.minus, -1));
  itemsBox.querySelectorAll('[data-plus]').forEach(b => b.onclick = () => change(+b.dataset.plus, 1));
}

// quantidades/itens mudaram => o frete calculado antes deixou de valer
function invalidarFrete() {
  opcoes = []; frete = null; arpintShip.clear();
  resultsBox.innerHTML = '';
  if (cepInput.value.replace(/\D/g, '').length === 8 && arpintCart.get().length) {
    resultsBox.innerHTML = '<p class="text-sm text-muted">O carrinho mudou. Clique em Calcular para atualizar o frete.</p>';
  }
}

function change(id, d) {
  let c = arpintCart.get();
  const i = c.find(x => +x.id === id);
  if (!i) return;
  i.quantidade = Math.min(99, i.quantidade + d);
  if (i.quantidade <= 0) c = c.filter(x => +x.id !== id);
  arpintCart.set(c);
  arpintCart.update();
  invalidarFrete();
  render();
}

async function calcular() {
  const cep = cepInput.value.replace(/\D/g, '');
  if (cep.length !== 8) { arpint.toast('Digite um CEP válido com 8 números.', 'error'); return; }
  const itens = arpintCart.get();
  if (!itens.length) { arpint.toast('Seu carrinho está vazio.', 'error'); return; }

  calcBtn.disabled = true;
  resultsBox.innerHTML = '<div class="text-sm text-muted">Consultando Correios e transportadoras...</div>';
  try {
    const r = await arpint.api('frete', { cep, itens: itens.map(i => ({ id: i.id, quantidade: i.quantidade })) });
    opcoes = r.opcoes;
    frete = opcoes[0];                       // já seleciona a mais barata
    arpintShip.set({ cep, id: frete.id, preco: frete.preco });
    arpint.renderShipping(resultsBox, opcoes, frete.id, o => {
      frete = o; arpintShip.set({ cep, id: o.id, preco: o.preco }); render();
    });
    resultsBox.insertAdjacentHTML('beforeend', '<p class="text-[11px] leading-5 text-muted">O valor final do frete é confirmado novamente na hora de pagar.</p>');
    render();
  } catch (e) {
    frete = null; arpintShip.clear();
    arpint.renderShippingError(resultsBox, e.message, e.codigo, o => {
      frete = o; arpintShip.set({ cep, id: o.id, preco: 0 }); render();
    });
    render();
  } finally { calcBtn.disabled = false; }
}

calcBtn.onclick = calcular;
cepInput.addEventListener('keydown', e => { if (e.key === 'Enter') calcular(); });
cepInput.addEventListener('input', e => {
  e.target.value = arpint.maskCep(e.target.value);
  if (frete) invalidarFrete();
});

(async () => {
  try { PRODUTOS = await arpint.products(); }
  catch { itemsBox.innerHTML = '<p class="text-red-400">Erro ao carregar o carrinho. Atualize a página.</p>'; return; }
  // remove do carrinho produtos que não existem mais no catálogo
  const validos = arpintCart.get().filter(i => PRODUTOS.some(p => +p.id === +i.id));
  if (validos.length !== arpintCart.get().length) { arpintCart.set(validos); arpintCart.update(); }
  const salvo = arpintShip.get();
  if (salvo?.cep) cepInput.value = arpint.maskCep(salvo.cep);
  arpintShip.clear();
  render();
})();
