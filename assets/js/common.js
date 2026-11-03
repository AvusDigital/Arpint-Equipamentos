(function () {
  const root = document.documentElement;
  const safeStorage = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* modo privado / storage cheio */ } },
    remove(k) { try { localStorage.removeItem(k); } catch { } }
  };

  const saved = safeStorage.get('arpint-theme', 'dark');
  root.classList.toggle('light', saved === 'light');
  root.classList.toggle('dark', saved !== 'light');

  window.arpintTheme = {
    toggle() {
      const light = !root.classList.contains('light');
      root.classList.toggle('light', light);
      root.classList.toggle('dark', !light);
      safeStorage.set('arpint-theme', light ? 'light' : 'dark');
      this.init();
    },
    init() {
      const light = root.classList.contains('light');
      document.querySelectorAll('[data-theme-icon]').forEach(e => { e.textContent = light ? '☀' : '☾'; });
      document.querySelectorAll('[data-theme-label]').forEach(e => { e.textContent = light ? 'Modo escuro' : 'Modo claro'; });
    }
  };

  // Carrinho. A chave mudou para "v2" porque os IDs dos produtos agora são os IDs reais
  // do catálogo (antes era a posição na lista, que muda sempre que um produto sai).
  const CART_KEY = 'arpint-cart-v2';
  safeStorage.remove('arpint-cart');
  safeStorage.remove('arpint-shipping');

  window.arpintCart = {
    get() {
      try {
        const v = JSON.parse(safeStorage.get(CART_KEY, '[]'));
        return Array.isArray(v) ? v.filter(i => i && +i.id > 0 && +i.quantidade > 0) : [];
      } catch { return []; }
    },
    set(v) { safeStorage.set(CART_KEY, JSON.stringify(v)); },
    count() { return this.get().reduce((s, i) => s + (+i.quantidade || 0), 0); },
    add(id, qty = 1) {
      qty = Math.max(1, Math.min(99, Math.floor(+qty) || 1));
      const c = this.get();
      const found = c.find(i => +i.id === +id);
      if (found) found.quantidade = Math.min(99, found.quantidade + qty);
      else c.push({ id: +id, quantidade: qty });
      this.set(c);
      this.update();
    },
    remove(id) { this.set(this.get().filter(i => +i.id !== +id)); this.update(); },
    clear() { safeStorage.remove(CART_KEY); this.update(); },
    update() {
      document.querySelectorAll('[data-cart-count]').forEach(e => { e.textContent = this.count(); });
    }
  };

  // Frete escolhido pelo cliente (só para exibição; o servidor recalcula tudo no checkout).
  window.arpintShip = {
    get() { try { return JSON.parse(safeStorage.get('arpint-ship', 'null')); } catch { return null; } },
    set(v) { safeStorage.set('arpint-ship', JSON.stringify(v)); },
    clear() { safeStorage.remove('arpint-ship'); }
  };

  let productsCache = null;

  window.arpint = {
    storage: safeStorage,

    // texto do frete escolhido (retirada = grátis, combinar = a combinar)
    freteTexto(f) {
      if (!f) return 'Informe o CEP';
      if (f.id === 'retirada') return 'Grátis (retirada)';
      if (f.id === 'combinar') return 'A combinar';
      return this.money(f.preco);
    },

    money(v) {
      return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },

    // escapa texto antes de colocar em innerHTML
    esc(s) {
      return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    // minúsculas sem acento (busca "pistola" acha "Pistôla", "eletrico" acha "Elétrico")
    norm(s) {
      return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    },

    maskCep(v) {
      v = String(v || '').replace(/\D/g, '').slice(0, 8);
      return v.length > 5 ? v.slice(0, 5) + '-' + v.slice(5) : v;
    },

    toast(msg, type = 'ok') {
      const t = document.createElement('div');
      t.setAttribute('role', 'status');
      t.className = 'toast fixed bottom-24 right-5 z-[999] max-w-sm rounded-xl border border-white/10 bg-panel px-5 py-4 text-sm font-bold text-white shadow-2xl';
      t.innerHTML = `<span class="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full ${type === 'error' ? 'bg-red-500/15 text-red-400' : 'bg-[#ff6a00]/15 text-[#ff6a00]'}">${type === 'error' ? '!' : '✓'}</span>${this.esc(msg)}`;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 3500);
    },

    async products() {
      if (productsCache) return productsCache;
      const r = await fetch('./data/produtos.json');
      if (!r.ok) throw Error('produtos');
      productsCache = await r.json();   // usa o "id" real de cada produto
      return productsCache;
    },

    async product(id) {
      const products = await this.products();
      return products.find(p => +p.id === +id);
    },

    // chamadas às funções do servidor (/api/...)
    async api(path, body) {
      let r;
      try {
        r = await fetch('/api/' + path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      } catch {
        throw new Error('Sem conexão com o servidor. Tente de novo.');
      }
      let data = {};
      try { data = await r.json(); } catch { }
      if (!r.ok) { const e = new Error(data.erro || 'Não foi possível concluir agora. Tente novamente em instantes.');
        e.codigo = data.codigo || ('HTTP-' + r.status); e.dados = data; throw e; }
      return data;
    },

    // Opções especiais de frete (resolvidas no servidor, que confere se são permitidas)
    retiradaOpt: { id: 'retirada', grupo: 'retirada', empresa: 'Retirada', servico: 'na loja', preco: 0, prazoTexto: 'sem custo de frete' },
    combinarOpt: { id: 'combinar', grupo: 'combinar', empresa: 'Frete', servico: 'a combinar', preco: 0, prazoTexto: 'valor combinado pelo WhatsApp' },

    // Desenha as 3 abas (Retirada | Correios | Transportadora) e a lista da aba escolhida.
    // opcoes = cotações do servidor; onPick(opcao) é chamado ao escolher.
    renderShipping(box, opcoes, selectedId, onPick, opts = {}) {
      const rc = (window.ARPINT && window.ARPINT.retirada) || {};
      const temRetirada = opts.retirada !== false && rc.ativa !== false;
      const grupos = {
        correios: opcoes.filter(o => o.grupo === 'correios'),
        transportadora: opcoes.filter(o => o.grupo !== 'correios')
      };
      let sel = selectedId || null;
      let ativa = sel === 'retirada' ? 'retirada'
        : (opcoes.find(o => o.id === sel)?.grupo === 'correios' ? 'correios'
          : opcoes.find(o => o.id === sel) ? 'transportadora'
            : grupos.correios.length ? 'correios' : grupos.transportadora.length ? 'transportadora' : (temRetirada ? 'retirada' : 'correios'));
      const menor = arr => arr.length ? 'a partir de ' + this.money(Math.min(...arr.map(o => o.preco))) : (opts.semCep ? 'informe o CEP' : 'indisponível');

      const desenhar = () => {
        const tab = (id, nome, sub, off) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${ativa === id}" class="ship-tab ${ativa === id ? 'active' : ''}" ${off ? 'disabled' : ''}>${nome}<small>${sub}</small></button>`;
        let painel = '';
        if (ativa === 'retirada') {
          painel = `<div class="rounded-xl border border-theme p-4 text-sm"><b>Retirada na loja — grátis</b>
            <p class="mt-1 text-muted">${rc.endereco ? this.esc(rc.endereco) : 'Nossa equipe passa o endereço e o horário pelo WhatsApp.'}${rc.horario ? '<br>' + this.esc(rc.horario) : ''}</p></div>`;
        } else {
          const lista = grupos[ativa] || [];
          painel = lista.length ? lista.map((o, i) => `
            <button type="button" data-ship="${this.esc(o.id)}" class="ship-option ${o.id === sel ? 'selected' : ''}">
              <div><b>${this.esc(o.empresa)} <span class="font-normal text-muted">${this.esc(o.servico)}</span></b>
                <p class="text-xs text-muted">${this.esc(o.prazoTexto)}</p></div>
              <div class="flex items-center gap-2">${i === 0 ? '<span class="rounded-full bg-[#ff6a00]/15 px-2 py-0.5 text-[10px] font-black orange">MAIS BARATO</span>' : ''}<strong>${this.money(o.preco)}</strong></div>
            </button>`).join('')
            : `<p class="text-sm text-muted">${opts.semCep ? 'Digite o CEP para ver as opções.' : 'Nenhuma opção disponível para esse CEP.'}</p>`;
        }
        box.innerHTML = `<div class="ship-tabs" role="tablist">
            ${temRetirada ? tab('retirada', 'Retirada', 'grátis', false) : ''}
            ${tab('correios', 'Correios', menor(grupos.correios), !grupos.correios.length)}
            ${tab('transportadora', 'Transportadora', menor(grupos.transportadora), !grupos.transportadora.length)}
          </div><div class="mt-3 grid gap-3">${painel}</div>`;

        box.querySelectorAll('[data-tab]').forEach(btn => btn.onclick = () => {
          ativa = btn.dataset.tab;
          const escolha = ativa === 'retirada' ? this.retiradaOpt : (grupos[ativa] || [])[0];   // já seleciona a mais barata da aba
          sel = escolha ? escolha.id : sel;
          desenhar();
          if (escolha) onPick(escolha);
        });
        box.querySelectorAll('[data-ship]').forEach(btn => btn.onclick = () => {
          const o = opcoes.find(x => x.id === btn.dataset.ship);
          sel = o.id; desenhar(); onPick(o);
        });
      };
      desenhar();
    },

    // Quando a cotação falha: mostra o motivo e ainda deixa o cliente concluir (retirada / combinar no WhatsApp)
    renderShippingError(box, msg, codigo, onPick, opts = {}) {
      const rc = (window.ARPINT && window.ARPINT.retirada) || {};
      const whats = (window.ARPINT?.pagamento || 'whatsapp') === 'whatsapp';
      box.innerHTML = `<p class="text-sm text-red-400">${this.esc(msg)}${codigo ? ` <span class="text-xs text-muted">(${this.esc(codigo)})</span>` : ''}</p>
        <div class="grid gap-3">
          ${rc.ativa !== false && opts.retirada !== false ? '<button type="button" data-alt="retirada" class="ship-option"><b>Retirada na loja</b><strong>Grátis</strong></button>' : ''}
          ${whats ? '<button type="button" data-alt="combinar" class="ship-option"><span><b>Combinar o frete pelo WhatsApp</b><br><span class="text-xs text-muted">Nossa equipe calcula e te passa o valor</span></span></button>' : ''}
        </div>`;
      box.querySelectorAll('[data-alt]').forEach(b => b.onclick = () => {
        box.querySelectorAll('[data-alt]').forEach(x => x.classList.remove('selected'));
        b.classList.add('selected');
        onPick(b.dataset.alt === 'retirada' ? this.retiradaOpt : this.combinarOpt);
      });
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    arpintTheme.init();
    arpintCart.update();
    document.querySelectorAll('[data-theme-toggle]').forEach(b => b.addEventListener('click', () => arpintTheme.toggle()));
    document.querySelectorAll('[data-mobile-toggle]').forEach(b =>
      b.addEventListener('click', () => document.getElementById('mobile-menu')?.classList.toggle('hidden')));
  });
})();
