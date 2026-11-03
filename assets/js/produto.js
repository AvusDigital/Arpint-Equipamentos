const id = new URLSearchParams(location.search).get('id');
const box = document.querySelector('#detail');

(async () => {

    try {

        const p = await arpint.product(id);

        // ==========================================
        // PRODUTO NÃO ENCONTRADO
        // ==========================================

        if (!p) {

            box.innerHTML = `
                <div class="py-24 text-center">

                    <h1 class="text-3xl font-black">
                        Produto não encontrado
                    </h1>

                    <a
                        class="mt-5 inline-block orange hover:underline"
                        href="./produtos.html"
                    >
                        Voltar ao catálogo
                    </a>

                </div>
            `;

            return;
        }


        // ==========================================
        // CONFIGURAÇÕES
        // ==========================================

        document.title = `${arpint.esc(p.nome)} | Arpint`;

        const low =
            p.estoque !== null &&
            p.estoque !== undefined &&
            p.estoque <= 5 &&
            p.estoque > 0;

        const sold =
            p.estoque !== null &&
            p.estoque !== undefined &&
            p.estoque <= 0;

        const technicalItems =
            p.informacoesTecnicas?.itens || [];


        // ==========================================
        // LINKS DO BREADCRUMB
        // ==========================================

        const categoryUrl =
            p.categoria
                ? `./produtos.html?categoria=${encodeURIComponent(p.categoria)}`
                : './produtos.html';

        const subcategoryUrl =
            p.categoria && p.subcategoria
                ? `./produtos.html?categoria=${encodeURIComponent(p.categoria)}&subcategoria=${encodeURIComponent(p.subcategoria)}`
                : categoryUrl;


        // ==========================================
        // PÁGINA
        // ==========================================

        box.innerHTML = `

            <!-- ===================================== -->
            <!-- BREADCRUMB -->
            <!-- ===================================== -->

            <div class="mb-7 flex flex-wrap items-center gap-2 text-sm text-muted">

                <a
                    href="./produtos.html"
                    class="orange transition hover:underline"
                >
                    Produtos
                </a>

                ${p.categoria
                ? `
                            <span class="text-muted/50">/</span>

                            <a
                                href="${categoryUrl}"
                                class="orange transition hover:underline"
                            >
                                ${arpint.esc(p.categoria)}
                            </a>
                        `
                : ''
            }

                ${p.subcategoria
                ? `
                            <span class="text-muted/50">/</span>

                            <a
                                href="${subcategoryUrl}"
                                class="orange transition hover:underline"
                            >
                                ${arpint.esc(p.subcategoria)}
                            </a>
                        `
                : ''
            }

                <span class="text-muted/50">/</span>

                <span>
                    ${arpint.esc(p.nome)}
                </span>

            </div>


            <!-- ===================================== -->
            <!-- PRODUTO -->
            <!-- ===================================== -->

            <div class="grid gap-10 lg:grid-cols-2">


                <!-- ================================= -->
                <!-- IMAGEM -->
                <!-- ================================= -->

                <div
                    class="product-image relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-3xl border border-theme"
                >

                    <img
                        referrerpolicy="no-referrer" src="${arpint.esc(p.imagem)}"
                        onerror="this.onerror=null;this.src='./assets/images/produtos/placeholder.svg'"
                        alt="${arpint.esc(p.nome)}"
                        class="max-h-[560px] w-full object-contain p-8"
                    >

                    ${low
                ? `
                                <span
                                    class="absolute left-5 top-5 rounded-full bg-[#ff6a00] px-4 py-2 text-sm font-black text-white"
                                >
                                    🔥 Está acabando — garanta já o seu
                                </span>
                            `
                : ''
            }

                </div>


                <!-- ================================= -->
                <!-- INFORMAÇÕES -->
                <!-- ================================= -->

                <div class="py-2">


                    <!-- CATEGORIA / SUBCATEGORIA -->

                    <div class="flex flex-wrap gap-2">

                        ${p.categoria
                ? `
                                    <a
                                        href="${categoryUrl}"
                                        class="badge inline-flex rounded-full px-3 py-1 text-xs font-black uppercase transition hover:brightness-110"
                                    >
                                        ${arpint.esc(p.categoria)}
                                    </a>
                                `
                : ''
            }

                        ${p.subcategoria
                ? `
                                    <a
                                        href="${subcategoryUrl}"
                                        class="rounded-full border border-theme px-3 py-1 text-xs font-black uppercase text-muted transition hover:border-orange hover:orange"
                                    >
                                        ${arpint.esc(p.subcategoria)}
                                    </a>
                                `
                : ''
            }

                    </div>


                    <!-- NOME -->

                    <h1
                        class="mt-5 text-4xl font-black leading-tight md:text-5xl"
                    >
                        ${arpint.esc(p.nome)}
                    </h1>


                    <!-- DESCRIÇÃO CURTA -->

                    <p class="mt-4 text-muted">
                        ${p.descricao || ''}
                    </p>


                    <!-- ================================= -->
                    <!-- PREÇO -->
                    <!-- ================================= -->

                    ${p.preco !== null &&
                p.preco !== undefined
                ? `
                                <div class="mt-7">

                                    <span class="text-sm text-muted">
                                        Preço
                                    </span>

                                    <div class="price text-4xl font-black">
                                        ${arpint.money(p.preco)}
                                    </div>

                                    <p class="mt-1 text-sm text-muted">
                                        Pagamento por cartão ou Pix em ambiente seguro.
                                    </p>

                                </div>
                            `
                : `
                                <div class="mt-7">

                                    <span class="text-sm text-muted">
                                        Preço
                                    </span>

                                    <div class="mt-1 text-2xl font-black">
                                        Consulte-nos
                                    </div>

                                    <p class="mt-1 text-sm text-muted">
                                        Entre em contato para consultar disponibilidade e valores.
                                    </p>

                                </div>
                            `
            }


                    <!-- ================================= -->
                    <!-- ESTOQUE / SKU -->
                    <!-- ================================= -->

                    <div class="mt-6 flex flex-wrap items-center gap-3">

                        ${p.estoque === null ||
                p.estoque === undefined
                ? `
                                    <span
                                        class="rounded-lg bg-yellow-500/10 px-3 py-2 text-sm font-bold text-yellow-500"
                                    >
                                        Consulte a disponibilidade
                                    </span>
                                `
                : sold
                    ? `
                                        <span
                                            class="rounded-lg bg-red-500/10 px-3 py-2 text-sm font-bold text-red-500"
                                        >
                                            Esgotado
                                        </span>
                                    `
                    : `
                                        <span
                                            class="rounded-lg bg-green-500/10 px-3 py-2 text-sm font-bold text-green-500"
                                        >
                                            ✓ Em estoque
                                        </span>
                                    `
            }

                        ${p.sku
                ? `
                                    <span class="text-sm text-muted">
                                        SKU: ${arpint.esc(p.sku)}
                                    </span>
                                `
                : ''
            }

                    </div>


                    <!-- ================================= -->
                    <!-- CARRINHO -->
                    <!-- ================================= -->

                    ${p.preco !== null &&
                p.preco !== undefined &&
                p.estoque !== null &&
                p.estoque !== undefined
                ? `
                                <div class="mt-7 flex gap-3">

                                    <input
                                        id="qty"
                                        type="number"
                                        min="1"
                                        max="${p.estoque}"
                                        value="1"
                                        class="input-theme w-24 text-center"
                                    >

                                    <button
                                        id="add"
                                        ${sold ? 'disabled' : ''}
                                        class="btn-orange flex-1 rounded-xl py-4 font-black disabled:opacity-40"
                                    >
                                        ${sold
                    ? 'Esgotado'
                    : 'Adicionar ao carrinho'
                }
                                    </button>

                                </div>
                            `
                : ''
            }


                    <!-- ================================= -->
                    <!-- CARDS -->
                    <!-- ================================= -->

<!-- CÁLCULO DE FRETE -->
<div id="ship-panel" class="mt-8 hidden rounded-xl border border-theme bg-panel p-4">
    <p class="font-black">📦 Calcule o frete</p>
    <div class="mt-3 flex gap-2">
        <input id="ship-cep" class="input-theme min-w-0 flex-1" inputmode="numeric" maxlength="9" placeholder="00000-000" aria-label="CEP">
        <button id="ship-go" type="button" class="btn-orange rounded-xl px-4 font-black">Calcular</button>
    </div>
    <div id="ship-result" class="mt-4 grid gap-3" aria-live="polite"></div>
</div>

<div class="mt-8 grid gap-3 sm:grid-cols-3">

    <!-- ENVIO -->
<button
    type="button"
    id="shipping-card"
    class="group w-full rounded-xl border border-theme bg-panel p-4 text-left transition hover:-translate-y-1 hover:border-orange"
>
    <div class="flex items-center justify-between">
        <b>📦 Envio</b>
        <span class="text-muted transition group-hover:translate-x-1 group-hover:orange">→</span>
    </div>

    <p class="mt-1 text-xs text-muted">
        Simule o frete pelo CEP
    </p>
</button>


    <!-- COMPRA -->
    <a
        href="./carrinho.html"
        id="buy-card"
        class="group rounded-xl border border-theme bg-panel p-4 transition hover:-translate-y-1 hover:border-orange"
    >
        <div class="flex items-center justify-between">
            <b>🛒 Compra</b>
            <span class="text-muted transition group-hover:translate-x-1 group-hover:orange">→</span>
        </div>

        <p class="mt-1 text-xs text-muted">
            Adicione ao carrinho e finalize
        </p>
    </a>


    <!-- SUPORTE -->
    <a
        href="https://wa.me/5511958700890?text=Ol%C3%A1!%20Estou%20no%20site%20da%20Arpint%20e%20gostaria%20de%20tirar%20uma%20d%C3%BAvida."
        target="_blank"
        rel="noopener noreferrer"
        class="group rounded-xl border border-theme bg-panel p-4 transition hover:-translate-y-1 hover:border-[#25D366]"
    >
        <div class="flex items-center justify-between">
            <b>💬 Suporte</b>
            <span class="text-muted transition group-hover:translate-x-1">→</span>
        </div>

        <p class="mt-1 text-xs text-muted">
            Fale diretamente pelo WhatsApp
        </p>
    </a>

</div>

                </div>

            </div>


            <!-- ===================================== -->
            <!-- ABAS -->
            <!-- ===================================== -->

            <section class="mt-16">


                <!-- BOTÕES -->

                <div class="flex border-b border-theme">

                    <button
                        id="tab-description"
                        class="product-tab active px-5 py-4 text-sm font-black"
                    >
                        Descrição
                    </button>


                    <button
                        id="tab-technical"
                        class="product-tab px-5 py-4 text-sm font-black"
                    >
                        Informações Técnicas
                    </button>

                </div>


                <!-- CONTEÚDO -->

                <div
                    class="rounded-b-2xl border border-t-0 border-theme bg-panel p-7"
                >


                    <!-- ================================= -->
                    <!-- DESCRIÇÃO -->
                    <!-- ================================= -->

                    <div id="content-description">

                        <h2 class="text-2xl font-black">
                            Descrição
                        </h2>

                        <p
                            class="mt-4 max-w-4xl leading-8 text-muted"
                        >
                            ${arpint.esc(p.descricaoDetalhada ||
            p.descricao ||
            'Descrição não disponível.')
            }
                        </p>

                    </div>


                    <!-- ================================= -->
                    <!-- INFORMAÇÕES TÉCNICAS -->
                    <!-- ================================= -->

                    <div
                        id="content-technical"
                        class="hidden"
                    >

                        <h2 class="text-2xl font-black">
                            ${p.informacoesTecnicas?.titulo ||
            'Informações Técnicas'
            }
                        </h2>


                        ${technicalItems.length
                ? `
                                    <ul class="mt-5 grid gap-3">

                                        ${technicalItems
                    .map(
                        item => `
                                                    <li class="flex gap-3 text-muted">

                                                        <span class="orange font-black">
                                                            •
                                                        </span>

                                                        <span>
                                                            ${arpint.esc(item)}
                                                        </span>

                                                    </li>
                                                `
                    )
                    .join('')}

                                    </ul>
                                `
                : `
                                    <p class="mt-4 text-muted">
                                        Informações técnicas não disponíveis.
                                    </p>
                                `
            }


                        <!-- ================================= -->
                        <!-- DADOS EXTRAS -->
                        <!-- ================================= -->

                        <div class="mt-8 grid gap-4 sm:grid-cols-3">


                            ${p.marca
                ? `
                                        <div
                                            class="rounded-xl border border-theme bg-panel2 p-4"
                                        >

                                            <span class="text-xs text-muted">
                                                Marca
                                            </span>

                                            <p class="mt-1 font-bold">
                                                ${arpint.esc(p.marca)}
                                            </p>

                                        </div>
                                    `
                : ''
            }


                            ${p.peso !== null &&
                p.peso !== undefined
                ? `
                                        <div
                                            class="rounded-xl border border-theme bg-panel2 p-4"
                                        >

                                            <span class="text-xs text-muted">
                                                Peso
                                            </span>

                                            <p class="mt-1 font-bold">
                                                ${p.peso} g
                                            </p>

                                        </div>
                                    `
                : ''
            }


                            ${p.dimensoes &&
                p.dimensoes.comprimento !== null &&
                p.dimensoes.comprimento !== undefined
                ? `
                                        <div
                                            class="rounded-xl border border-theme bg-panel2 p-4"
                                        >

                                            <span class="text-xs text-muted">
                                                Dimensões
                                            </span>

                                            <p class="mt-1 font-bold">
                                                ${p.dimensoes.comprimento}
                                                ×
                                                ${p.dimensoes.largura}
                                                ×
                                                ${p.dimensoes.altura}
                                                cm
                                            </p>

                                        </div>
                                    `
                : ''
            }

                        </div>

                    </div>

                </div>

            </section>

        `;


        // ==========================================
        // ABAS
        // ==========================================

        const tabDescription =
            document.querySelector('#tab-description');

        const tabTechnical =
            document.querySelector('#tab-technical');

        const contentDescription =
            document.querySelector('#content-description');

        const contentTechnical =
            document.querySelector('#content-technical');


        tabDescription?.addEventListener('click', () => {

            contentDescription.classList.remove('hidden');

            contentTechnical.classList.add('hidden');

            tabDescription.classList.add('active');

            tabTechnical.classList.remove('active');

        });


        tabTechnical?.addEventListener('click', () => {

            contentTechnical.classList.remove('hidden');

            contentDescription.classList.add('hidden');

            tabTechnical.classList.add('active');

            tabDescription.classList.remove('active');

        });


        // ==========================================
        // CÁLCULO DE FRETE (consulta real: Correios e transportadoras)
        // ==========================================

        const shipPanel = document.querySelector('#ship-panel');
        const shipCep = document.querySelector('#ship-cep');
        const shipGo = document.querySelector('#ship-go');
        const shipResult = document.querySelector('#ship-result');

        document.querySelector('#shipping-card')?.addEventListener('click', () => {
            if (p.preco === null || p.preco === undefined) {
                arpint.toast('Produto sob consulta. Fale com a gente pelo WhatsApp.', 'error');
                return;
            }
            shipPanel.classList.toggle('hidden');
            if (!shipPanel.classList.contains('hidden')) shipCep.focus();
        });

        shipCep?.addEventListener('input', e => { e.target.value = arpint.maskCep(e.target.value); });
        shipCep?.addEventListener('keydown', e => { if (e.key === 'Enter') shipGo.click(); });

        shipGo?.addEventListener('click', async () => {
            const cep = shipCep.value.replace(/\D/g, '');
            if (cep.length !== 8) { arpint.toast('Digite um CEP válido com 8 números.', 'error'); return; }
            const quantidade = Math.max(1, Math.min(99, +document.querySelector('#qty')?.value || 1));
            shipGo.disabled = true;
            shipResult.innerHTML = '<div class="text-sm text-muted">Consultando Correios e transportadoras...</div>';
            try {
                const r = await arpint.api('frete', { cep, itens: [{ id: p.id, quantidade }] });
                arpint.renderShipping(shipResult, r.opcoes, null, () => { }, { retirada: false });
                shipResult.insertAdjacentHTML('beforeend', '<p class="text-[11px] leading-5 text-muted">Valores para este produto. No carrinho o frete considera todos os itens.</p>');
            } catch (e) {
                shipResult.innerHTML = `<p class="text-sm text-red-400">${arpint.esc(e.message)}${e.codigo ? ` <span class="text-xs text-muted">(${arpint.esc(e.codigo)})</span>` : ''}</p>`;
            } finally { shipGo.disabled = false; }
        });


        // ==========================================
        // ADICIONAR AO CARRINHO
        // ==========================================

        document
            .querySelector('#add')
            ?.addEventListener('click', () => {

                const quantity =
                    +document.querySelector('#qty').value || 1;

                arpintCart.add(
                    p.id,
                    quantity
                );

                arpint.toast(
                    'Produto adicionado ao carrinho.'
                );

            });


    } catch (e) {

        console.error(e);

        box.innerHTML = `
            <div class="py-24 text-center text-red-400">

                Erro ao carregar o produto.

            </div>
        `;

    }

})();