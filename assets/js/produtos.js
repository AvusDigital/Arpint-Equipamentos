let ALL = [];

const params = new URLSearchParams(location.search);

let category = params.get('categoria') || 'Todos';
let subcategory = params.get('subcategoria') || 'Todos';

const $ = s => document.querySelector(s);

const grid = $('#products-grid');
const empty = $('#empty');
const count = $('#count');


// ==========================================
// CATEGORIAS PRINCIPAIS
// (calculadas a partir do catálogo: categoria nova em produtos.json aparece sozinha)
// ==========================================

let CATEGORIES = [];


// ==========================================
// CATEGORIAS
// ==========================================

function cats() {

    return [
        'Todos',
        ...CATEGORIES
    ];

}


// ==========================================
// SUBCATEGORIAS DA CATEGORIA ATUAL
// ==========================================

function subcats() {

    if (category === 'Todos') {
        return [];
    }

    const values = ALL
        .filter(p => p.categoria === category)
        .map(p => p.subcategoria)
        .filter(Boolean);

    return [
        'Todos',
        ...new Set(values)
    ];

}


// ==========================================
// ATUALIZA URL
// ==========================================

function updateURL() {

    const url = new URL(location.href);

    url.searchParams.delete('categoria');
    url.searchParams.delete('subcategoria');

    if (category !== 'Todos') {
        url.searchParams.set('categoria', category);
    }

    if (
        subcategory !== 'Todos' &&
        category !== 'Todos'
    ) {
        url.searchParams.set('subcategoria', subcategory);
    }

    history.replaceState(
        {},
        '',
        url
    );

}


// ==========================================
// RENDER CATEGORIAS
// ==========================================

function renderCats() {

    const make = (wrap, mobile = false) => {

        if (!wrap) return;

        wrap.innerHTML = '';

        cats().forEach(c => {

            const n =
                c === 'Todos'
                    ? ALL.length
                    : ALL.filter(
                        p => p.categoria === c
                    ).length;

            const b =
                document.createElement('button');

            b.className =
                'flex items-center justify-between rounded-lg border border-theme px-3 py-3 text-left text-sm transition hover:border-orange ' +
                (
                    category === c
                        ? 'border-[#ff6a00]/50 bg-[#ff6a00]/10 orange'
                        : ''
                );

            b.innerHTML = `
                <span>${arpint.esc(c)}</span>
                <span class="text-xs text-muted">
                    ${n}
                </span>
            `;

            b.onclick = () => {

                category = c;

                // Ao mudar a categoria,
                // volta para todas as subcategorias
                subcategory = 'Todos';

                updateURL();

                if (mobile) {

                    $('#mobile-filter-modal')
                        ?.classList.add('hidden');

                    $('#mobile-filter-modal')
                        ?.classList.remove('flex');

                }

                renderCats();
                render();

            };

            wrap.appendChild(b);

        });


        // ======================================
        // SUBCATEGORIAS
        // ======================================

        if (
            category !== 'Todos' &&
            subcats().length > 1
        ) {

            const title =
                document.createElement('div');

            title.className =
                'mt-5 border-t border-theme pt-5';

            title.innerHTML = `
                <p class="mb-3 text-xs font-black uppercase tracking-wider orange">
                    Subcategorias
                </p>
            `;

            wrap.appendChild(title);


            subcats().forEach(sc => {

                const n =
                    sc === 'Todos'
                        ? ALL.filter(
                            p => p.categoria === category
                        ).length
                        : ALL.filter(
                            p =>
                                p.categoria === category &&
                                p.subcategoria === sc
                        ).length;

                const b =
                    document.createElement('button');

                b.className =
                    'flex items-center justify-between rounded-lg border border-theme px-3 py-3 text-left text-sm transition hover:border-orange ' +
                    (
                        subcategory === sc
                            ? 'border-[#ff6a00]/50 bg-[#ff6a00]/10 orange'
                            : ''
                    );

                b.innerHTML = `
                    <span>
                        ${sc === 'Todos'
                            ? 'Todas'
                            : arpint.esc(sc)}
                    </span>

                    <span class="text-xs text-muted">
                        ${n}
                    </span>
                `;

                b.onclick = () => {

                    subcategory = sc;

                    updateURL();

                    if (mobile) {

                        $('#mobile-filter-modal')
                            ?.classList.add('hidden');

                        $('#mobile-filter-modal')
                            ?.classList.remove('flex');

                    }

                    renderCats();
                    render();

                };

                wrap.appendChild(b);

            });

        }

    };


    // DESKTOP

    make($('#categories'));


    // MOBILE

    make(
        $('#mobile-categories'),
        true
    );


    // ======================================
    // CHIPS MOBILE
    // ======================================

    const chips = $('#chips');

    if (chips) {

        chips.innerHTML =
            cats()
                .map(c => `
                    <button
                        data-cat="${arpint.esc(c)}"
                        class="
                            rounded-full
                            border
                            border-theme
                            px-3
                            py-2
                            text-xs
                            font-bold
                            ${
                                category === c
                                    ? 'border-[#ff6a00]/50 orange'
                                    : ''
                            }
                        "
                    >
                        ${arpint.esc(c)}
                    </button>
                `)
                .join('');


        chips
            .querySelectorAll('button')
            .forEach(b => {

                b.onclick = () => {

                    category =
                        b.dataset.cat;

                    subcategory = 'Todos';

                    updateURL();

                    renderCats();
                    render();

                };

            });

    }

}


// ==========================================
// CARD DO PRODUTO
// ==========================================

function card(p) {

    const low =
        p.estoque !== null &&
        p.estoque !== undefined &&
        p.estoque <= 5 &&
        p.estoque > 0;

    const sold =
        p.estoque !== null &&
        p.estoque !== undefined &&
        p.estoque <= 0;


    return `

        <article
            class="product-card overflow-hidden rounded-2xl"
        >


            <!-- IMAGEM -->

            <a
                href="./produto.html?id=${p.id}"
                class="product-image relative block aspect-square"
            >

                <img
                    referrerpolicy="no-referrer" loading="lazy"
                    src="${arpint.esc(p.imagem)}"
                    onerror="this.onerror=null;this.src='./assets/images/produtos/placeholder.svg'"
                    alt="${arpint.esc(p.nome)}"
                    class="h-full w-full object-contain p-7 transition duration-500 hover:scale-105"
                >


                ${
                    low
                        ? `
                            <span
                                class="absolute left-4 top-4 rounded-full bg-[#ff6a00] px-3 py-1 text-xs font-black text-white"
                            >
                                🔥 Últimas unidades
                            </span>
                        `
                        : ''
                }

            </a>


            <!-- INFORMAÇÕES -->

            <div class="p-5">


                <!-- CATEGORIA -->

                <p
                    class="text-xs font-black uppercase tracking-wider orange"
                >
                    ${arpint.esc(p.categoria)}
                </p>


                <!-- SUBCATEGORIA -->

                ${
                    p.subcategoria
                        ? `
                            <p class="mt-1 text-xs text-muted">
                                ${arpint.esc(p.subcategoria)}
                            </p>
                        `
                        : ''
                }


                <!-- NOME -->

                <a
                    href="./produto.html?id=${p.id}"
                    class="mt-2 block text-lg font-black leading-tight hover:orange"
                >
                    ${arpint.esc(p.nome)}
                </a>


                <!-- DESCRIÇÃO -->

                <p
                    class="mt-2 line-clamp-2 text-sm leading-6 text-muted"
                >
                    ${arpint.esc(p.descricao || '')}
                </p>


                <!-- PREÇO -->

                ${
                    p.preco !== null &&
                    p.preco !== undefined
                        ? `
                            <div class="mt-5">

                                <p class="text-xs text-muted">
                                    Por
                                </p>

                                <strong class="price text-2xl">
                                    ${arpint.money(p.preco)}
                                </strong>

                            </div>
                        `
                        : `
                            <div class="mt-5">

                                <p class="text-xs text-muted">
                                    Preço
                                </p>

                                <strong class="text-xl">
                                    Consulte-nos
                                </strong>

                            </div>
                        `
                }


                <!-- BOTÃO -->

                ${
                    p.preco !== null &&
                    p.preco !== undefined
                        ? `
                            <button
                                ${sold ? 'disabled' : ''}
                                data-add="${p.id}"
                                class="btn-orange mt-5 w-full rounded-xl py-3 font-black disabled:opacity-40"
                            >
                                ${
                                    sold
                                        ? 'Esgotado'
                                        : 'Adicionar ao carrinho'
                                }
                            </button>
                        `
                        : `
                            <a
                                href="./produto.html?id=${p.id}"
                                class="mt-5 block w-full rounded-xl border border-theme py-3 text-center font-black transition hover:border-orange hover:orange"
                            >
                                Ver produto
                            </a>
                        `
                }

            </div>

        </article>

    `;

}


// ==========================================
// RENDER PRODUTOS
// ==========================================

function render() {

    const q = arpint.norm($('#search')?.value.trim() || '');


    let arr =
        ALL.filter(p => {

            // Categoria

            const matchCategory =
                category === 'Todos' ||
                p.categoria === category;


            // Subcategoria

            const matchSubcategory =
                subcategory === 'Todos' ||
                p.subcategoria === subcategory;


            // Busca

            const searchText = arpint.norm(`
                ${p.nome || ''}
                ${arpint.esc(p.descricao || '')}
                ${p.categoria || ''}
                ${p.subcategoria || ''}
                ${p.sku || ''}
            `);


            const matchSearch =
                searchText.includes(q);


            return (
                matchCategory &&
                matchSubcategory &&
                matchSearch
            );

        });


    // ======================================
    // ORDENAÇÃO
    // ======================================

    const s =
        $('#sort')?.value || 'relevance';


    if (s === 'low') {

        arr.sort(
            (a, b) =>
                (a.preco ?? Infinity) -
                (b.preco ?? Infinity)
        );

    }


    if (s === 'high') {

        arr.sort(
            (a, b) =>
                (b.preco ?? -Infinity) -
                (a.preco ?? -Infinity)
        );

    }


    if (s === 'name') {

        arr.sort(
            (a, b) =>
                a.nome.localeCompare(
                    b.nome,
                    'pt-BR'
                )
        );

    }


    // ======================================
    // CONTADOR
    // ======================================

    count.textContent =
        `${arr.length} produto${arr.length === 1 ? '' : 's'} encontrado${arr.length === 1 ? '' : 's'}`;


    // ======================================
    // EMPTY
    // ======================================

    empty.classList.toggle(
        'hidden',
        arr.length > 0
    );


    // ======================================
    // GRID
    // ======================================

    grid.innerHTML =
        arr.map(card).join('');


    // ======================================
    // CARRINHO
    // ======================================

    grid
        .querySelectorAll('[data-add]')
        .forEach(button => {

            button.onclick = () => {

                arpintCart.add(
                    +button.dataset.add
                );

                arpint.toast(
                    'Produto adicionado ao carrinho.'
                );

            };

        });

}


// ==========================================
// CARREGAR PRODUTOS
// ==========================================

(async () => {

    try {

        ALL =
            await arpint.products();

        CATEGORIES = [...new Set(ALL.map(p => p.categoria).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'pt-BR'));


        // Se a URL tiver uma subcategoria
        // que não pertence à categoria,
        // evita deixar a página vazia por erro.

        if (
            category !== 'Todos' &&
            !CATEGORIES.includes(category)
        ) {

            category = 'Todos';
            subcategory = 'Todos';

            updateURL();

        }


        if (
            category === 'Todos'
        ) {

            subcategory = 'Todos';

        }


        renderCats();
        render();

    } catch (e) {

        console.error(e);

        grid.innerHTML = `
            <p class="text-red-400">
                Erro ao carregar produtos.
            </p>
        `;

    }

})();


// ==========================================
// BUSCA
// ==========================================

$('#search')
    ?.addEventListener(
        'input',
        render
    );


// ==========================================
// ORDENAÇÃO
// ==========================================

$('#sort')
    ?.addEventListener(
        'change',
        render
    );


// ==========================================
// LIMPAR FILTRO
// ==========================================

$('#clear-filter').onclick = () => {

    category = 'Todos';

    subcategory = 'Todos';

    $('#search').value = '';

    updateURL();

    renderCats();
    render();

};


// ==========================================
// FILTRO MOBILE
// ==========================================

$('#mobile-filter').onclick = () => {

    $('#mobile-filter-modal')
        .classList.remove('hidden');

    $('#mobile-filter-modal')
        .classList.add('flex');

};


// ==========================================
// FECHAR FILTRO
// ==========================================

$('#close-filter').onclick = () => {

    $('#mobile-filter-modal')
        .classList.add('hidden');

    $('#mobile-filter-modal')
        .classList.remove('flex');

};


// ==========================================
// APLICAR FILTRO
// ==========================================

$('#apply-filter').onclick = () => {

    $('#mobile-filter-modal')
        .classList.add('hidden');

    $('#mobile-filter-modal')
        .classList.remove('flex');

};