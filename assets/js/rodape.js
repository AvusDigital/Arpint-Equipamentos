(function () {
  const cfg = window.ARPINT || {};
  const footer = document.querySelector('footer');
  if (!footer) return;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const selo = (icone, titulo, texto) => `
    <div class="flex items-center gap-3 rounded-xl border border-theme bg-panel px-4 py-3">
      <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ff6a00]/15 orange" aria-hidden="true">${icone}</span>
      <div class="leading-tight"><b class="block text-sm">${titulo}</b><span class="text-xs text-muted">${texto}</span></div>
    </div>`;

  const svg = d => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const icones = {
    cadeado: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    escudo: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
    cartao: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>'),
    pix: svg('<path d="M12 3l4 4-4 4-4-4z"/><path d="M12 13l4 4-4 4-4-4z"/><path d="M3 12l4-4M3 12l4 4M21 12l-4-4M21 12l-4 4"/>'),
    caixa: svg('<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>')
  };

  const dados = [
    cfg.razaoSocial ? esc(cfg.razaoSocial) : '',
    cfg.cnpj ? 'CNPJ ' + esc(cfg.cnpj) : '',
    cfg.endereco ? esc(cfg.endereco) : ''
  ].filter(Boolean).join(' · ');

  const bloco = document.createElement('div');
  bloco.className = 'border-t border-theme';
  bloco.innerHTML = `
    <div class="mx-auto max-w-7xl px-5 py-8 md:px-8">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        ${selo(icones.cadeado, 'Site seguro', 'Conexão protegida (HTTPS)')}
        ${selo(icones.escudo, 'Compra protegida', 'Seus dados não são compartilhados')}
        ${selo(icones.pix + '', 'Pix e cartão', 'Pague do jeito que preferir')}
        ${selo(icones.caixa, 'Envio para todo o Brasil', 'Correios e transportadoras')}
      </div>
      <p class="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs font-bold text-muted">
        <a class="hover:orange" href="./politicas.html#entrega">Entrega e frete</a>
        <a class="hover:orange" href="./politicas.html#pagamento">Pagamento</a>
        <a class="hover:orange" href="./politicas.html#trocas">Trocas e devoluções</a>
        <a class="hover:orange" href="./politicas.html#privacidade">Privacidade</a>
      </p>
      ${dados ? `<p class="mt-3 text-center text-xs leading-6 text-muted">${dados}</p>` : ''}
    </div>`;
  footer.appendChild(bloco);
})();
