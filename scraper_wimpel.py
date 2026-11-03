import json
import re
import time
from urllib.parse import urljoin, urlparse

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError


BASE_URL = "https://www.wimpel.com.br"
PRODUCTS_URL = f"{BASE_URL}/produtos"

OUTPUT_FILE = "products_wimpel.json"
PROGRESS_FILE = "scraper_progress.json"


# Páginas que o site da Wimpel lista como se fossem produto, mas são categorias vazias.
CATEGORIAS_SEM_PRODUTO = {
    "tanques-de-pressao/tanque-de-pressao-manual",
    "tanques-de-pressao/tanque-de-pressao-pneumatico",
    "pistolas/pistolas-para-spray/pistola-para-spray",
}


def clean_text(text):
    if not text:
        return ""

    return re.sub(r"\s+", " ", text).strip()


def normalize_url(url):
    if not url:
        return None

    return urljoin(BASE_URL, url)


def is_product_url(url):
    if not url:
        return False

    parsed = urlparse(url)

    if parsed.netloc and "wimpel.com.br" not in parsed.netloc:
        return False

    path = parsed.path.lower()

    if "/produtos/" not in path:
        return False

    # A página principal de produtos não é um produto
    if path.rstrip("/") == "/produtos":
        return False

    return True


def extract_category_from_url(url):
    """
    Exemplo:

    /produtos/acessorios/canecas/produto-x

    Categoria:
    Acessórios

    Subcategoria:
    Canecas
    """

    path = urlparse(url).path.strip("/")
    parts = path.split("/")

    try:
        index = parts.index("produtos")
    except ValueError:
        return None, None

    parts = parts[index + 1:]

    if not parts:
        return None, None

    categoria = parts[0].replace("-", " ").strip()

    subcategoria = None

    if len(parts) >= 3:
        subcategoria = parts[1].replace("-", " ").strip()

    # Capitalização
    categoria = categoria.title()

    if subcategoria:
        subcategoria = subcategoria.title()

    return categoria, subcategoria


def find_product_links(page):
    print()
    print("=" * 70)
    print("PROCURANDO PRODUTOS")
    print("=" * 70)

    page.goto(
        PRODUCTS_URL,
        wait_until="domcontentloaded",
        timeout=60000
    )

    # Dá tempo para o site terminar de carregar
    page.wait_for_timeout(3000)

    print("Página carregada.")

    links = page.locator("a[href]").evaluate_all(
        """
        elements => elements.map(a => ({
            href: a.href,
            text: a.innerText
        }))
        """
    )

    urls = []

    for link in links:

        url = normalize_url(link.get("href"))

        if not url:
            continue

        if not is_product_url(url):
            continue

        urls.append(url)

    # Remove duplicados mantendo ordem
    urls = list(dict.fromkeys(urls))

    # Páginas de CATEGORIA / SUBCATEGORIA também ficam sob /produtos/ e passavam como produto.
    # Se um link é o "pai" de outro (ex.: /produtos/pistolas/linha-vd é pai de
    # /produtos/pistolas/linha-vd/vd-201), ele é uma categoria e não um produto.
    sem_barra = [u.rstrip("/") for u in urls]
    categorias = {
        u for u in sem_barra
        if any(outro != u and outro.startswith(u + "/") for outro in sem_barra)
    }
    # Categorias vazias (sem nenhum produto dentro) não têm "filho" para detectar; ficam aqui.
    categorias |= {u for u in sem_barra if u.split("/produtos/")[-1] in CATEGORIAS_SEM_PRODUTO}
    ignoradas = [u for u in urls if u.rstrip("/") in categorias]
    urls = [u for u in urls if u.rstrip("/") not in categorias]

    if ignoradas:
        print(f"Páginas de categoria ignoradas: {len(ignoradas)}")

    print(f"Produtos encontrados: {len(urls)}")

    return urls


def get_text_by_selectors(page, selectors):
    for selector in selectors:

        try:
            locator = page.locator(selector)

            if locator.count() == 0:
                continue

            text = locator.first.inner_text()

            text = clean_text(text)

            if text:
                return text

        except Exception:
            continue

    return ""


def extract_main_image(page):
    """
    Tenta encontrar a imagem principal do produto.
    """

    selectors = [
        "main img",
        ".product img",
        ".produto img",
        "[class*='product'] img",
        "[class*='produto'] img",
    ]

    for selector in selectors:

        try:

            images = page.locator(selector)

            total = images.count()

            for i in range(total):

                img = images.nth(i)

                src = (
                    img.get_attribute("src")
                    or img.get_attribute("data-src")
                    or img.get_attribute("data-lazy-src")
                )

                if not src:
                    continue

                src = normalize_url(src)

                if not src:
                    continue

                # Normalmente as imagens reais estão em uploads
                if "/uploads/" in src:
                    return src

        except Exception:
            continue

    # Fallback: qualquer imagem
    try:

        images = page.locator("img")

        for i in range(images.count()):

            img = images.nth(i)

            src = (
                img.get_attribute("src")
                or img.get_attribute("data-src")
                or img.get_attribute("data-lazy-src")
            )

            if src:
                return normalize_url(src)

    except Exception:
        pass

    return None


def extract_description(page):
    selectors = [
        ".product-description",
        ".produto-description",
        ".description",
        ".descricao",
        "#descricao",
        "[class*='descricao']",
        "[class*='description']",
    ]

    result = get_text_by_selectors(page, selectors)

    if result:
        return result

    # Procura heading "Descrição"
    try:

        headings = page.locator("h1, h2, h3, h4")

        for i in range(headings.count()):

            heading = headings.nth(i)

            text = clean_text(heading.inner_text())

            if "descrição" not in text.lower():
                continue

            parent = heading.locator("..")

            parent_text = clean_text(
                parent.inner_text()
            )

            if len(parent_text) > 30:
                return parent_text

    except Exception:
        pass

    return ""


def extract_technical_information(page):
    items = []

    keywords = [
        "informações técnicas",
        "informações tecnica",
        "especificações",
        "especificação",
        "características",
        "componentes",
    ]

    try:

        headings = page.locator("h1, h2, h3, h4")

        for i in range(headings.count()):

            heading = headings.nth(i)

            title = clean_text(
                heading.inner_text()
            )

            if not any(
                keyword in title.lower()
                for keyword in keywords
            ):
                continue

            # Tenta listas próximas
            parent = heading.locator("..")

            lists = parent.locator("li")

            for j in range(lists.count()):

                text = clean_text(
                    lists.nth(j).inner_text()
                )

                if text and text not in items:
                    items.append(text)

            # Tenta tabela
            rows = parent.locator("tr")

            for j in range(rows.count()):

                cells = rows.nth(j).locator(
                    "th, td"
                )

                values = []

                for k in range(cells.count()):

                    value = clean_text(
                        cells.nth(k).inner_text()
                    )

                    if value:
                        values.append(value)

                if values:

                    text = " — ".join(values)

                    if text not in items:
                        items.append(text)

    except Exception:
        pass

    return items


def extract_sku(page):
    try:

        body_text = clean_text(
            page.locator("body").inner_text()
        )

        patterns = [
            r"SKU[:\s]+([A-Z0-9\-]+)",
            r"Código[:\s]+([A-Z0-9\-]+)",
            r"Modelo[:\s]+([A-Z0-9\-]+)",
        ]

        for pattern in patterns:

            match = re.search(
                pattern,
                body_text,
                flags=re.IGNORECASE
            )

            if match:
                return match.group(1)

    except Exception:
        pass

    return None


def extract_product_name(page):
    try:

        h1 = page.locator("h1")

        if h1.count():

            name = clean_text(
                h1.first.inner_text()
            )

            if name:
                return name

    except Exception:
        pass

    try:

        title = page.title()

        title = clean_text(title)

        title = re.sub(
            r"\s*\|\s*Wimpel.*$",
            "",
            title,
            flags=re.IGNORECASE
        )

        return title

    except Exception:
        return "Produto Wimpel"


def create_product(page, url):
    print()
    print("-" * 70)
    print(f"Produto: {url}")
    print("-" * 70)

    try:

        page.goto(
            url,
            wait_until="domcontentloaded",
            timeout=60000
        )

        page.wait_for_timeout(1500)

    except PlaywrightTimeoutError:

        print("⚠ Timeout. Tentando continuar...")

    except Exception as error:

        print(f"⚠ Erro ao abrir produto: {error}")

        return None

    nome = extract_product_name(page)

    categoria, subcategoria = extract_category_from_url(
        url
    )

    imagem = extract_main_image(page)

    descricao = extract_description(page)

    technical_items = extract_technical_information(
        page
    )

    sku = extract_sku(page)

    product = {
        "nome": nome,
        "categoria": categoria,
        "subcategoria": subcategoria,
        "preco": None,
        "estoque": None,
        "imagem": imagem,
        "descricao": descricao,
        "descricaoDetalhada": descricao,
        "informacoesTecnicas": {
            "titulo": "Informações Técnicas",
            "itens": technical_items
        },
        "peso": None,
        "dimensoes": {
            "comprimento": None,
            "largura": None,
            "altura": None
        },
        "marca": "Wimpel",
        "sku": sku,
        "destaque": False,
        "_url_wimpel": url
    }

    print(f"Nome:         {nome}")
    print(f"Categoria:    {categoria}")
    print(f"Subcategoria: {subcategoria}")
    print(f"Imagem:       {imagem}")
    print(f"SKU:          {sku}")
    print(f"Técnicos:     {len(technical_items)} itens")

    return product


def save_progress(products, urls):
    data = {
        "products": products,
        "urls": urls
    }

    with open(
        PROGRESS_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            data,
            file,
            ensure_ascii=False,
            indent=2
        )


def load_progress():
    try:

        with open(
            PROGRESS_FILE,
            "r",
            encoding="utf-8"
        ) as file:

            return json.load(file)

    except FileNotFoundError:

        return None

    except Exception:

        return None


def save_final(products):
    # IDs sequenciais
    for index, product in enumerate(
        products,
        start=1
    ):
        product["id"] = index

    with open(
        OUTPUT_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            products,
            file,
            ensure_ascii=False,
            indent=2
        )


def main():

    with sync_playwright() as playwright:

        browser = playwright.chromium.launch(
            headless=True
        )

        page = browser.new_page(
            viewport={
                "width": 1440,
                "height": 900
            }
        )

        # =====================================================
        # LINKS
        # =====================================================

        progress = load_progress()

        if progress:

            print()
            print("Progresso anterior encontrado.")

            urls = progress["urls"]
            products = progress["products"]

            processed_urls = {
                product.get("_url_wimpel")
                for product in products
            }

            print(
                f"Produtos já processados: "
                f"{len(products)}"
            )

        else:

            urls = find_product_links(page)

            products = []

            processed_urls = set()

            if not urls:

                print()
                print("❌ Nenhum produto encontrado.")

                browser.close()

                return

        # =====================================================
        # PRODUTOS
        # =====================================================

        for index, url in enumerate(
            urls,
            start=1
        ):

            if url in processed_urls:

                print(
                    f"[{index}/{len(urls)}] "
                    "Já processado. Pulando..."
                )

                continue

            print()
            print(
                f"[{index}/{len(urls)}] "
                "Processando..."
            )

            try:

                product = create_product(
                    page,
                    url
                )

                if product:

                    products.append(product)

                    save_progress(
                        products,
                        urls
                    )

                    print(
                        f"✓ Salvo "
                        f"({len(products)} produtos)"
                    )

            except Exception as error:

                print(
                    f"❌ Erro: {error}"
                )

            # Pequena pausa para não bombardear o servidor
            time.sleep(1)

        # =====================================================
        # FINAL
        # =====================================================

        save_final(products)

        browser.close()

    print()
    print("=" * 70)
    print("🎉 SCRAPER FINALIZADO")
    print("=" * 70)
    print(
        f"Produtos encontrados: {len(products)}"
    )
    print(
        f"Arquivo: {OUTPUT_FILE}"
    )

    print()
    print(
        "IMPORTANTE: seu products.json original "
        "não foi alterado."
    )


if __name__ == "__main__":
    main()