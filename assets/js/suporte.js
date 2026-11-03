(function () {
    const whatsapp = (window.ARPINT && window.ARPINT.whatsapp) || '5511958700890';

    const mensagem = encodeURIComponent(
        'Olá! Estou no site da Arpint e gostaria de tirar uma dúvida.'
    );

    const button = document.createElement('a');

    button.href = `https://wa.me/${whatsapp}?text=${mensagem}`;
    button.target = '_blank';
    button.rel = 'noopener noreferrer';

    button.innerHTML = `
        <span class="text-2xl">💬</span>
        <span class="hidden sm:inline">Falar com suporte</span>
    `;

    button.className = `
        fixed bottom-6 right-6 z-[999]
        flex items-center gap-2
        rounded-full
        bg-[#25D366]
        px-5 py-4
        font-black text-white
        shadow-2xl
        transition
        hover:scale-105
    `;

    document.body.appendChild(button);
})();