import json
import re
import shutil
import unicodedata
from pathlib import Path
from datetime import datetime
from difflib import SequenceMatcher


# ============================================================
# CONFIGURAÇÃO
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

PRODUTOS_FILE = BASE_DIR / "data" / "produtos.json"
TABELA_FILE = BASE_DIR / "data" / "tabela_wimpel.txt"
BACKUP_DIR = BASE_DIR / "data" / "backups"


# ============================================================
# MAPA MANUAL WIMPEL -> ID ARPINT
# ============================================================
#
# Correspondências confirmadas manualmente.
#
# Se o código estiver aqui, ele SEMPRE terá prioridade
# sobre a correspondência automática.
#
# ============================================================

CODIGO_PARA_ID = {

    # --------------------------------------------------------
    # PREMIUM
    # --------------------------------------------------------

    "02298": 102,   # MP-560
    "02409": 105,   # MP-610
    "02407": 106,   # MP-610 Caixa Black

    "01797": 100,   # MP-260 HVLP - MALETA
    "02477": 97,    # MP-700 Plus
    "01795": 99,    # MP-260 HVLP - CAIXA
    "03415": 103,   # MP-570


    # --------------------------------------------------------
    # STANDARD
    # --------------------------------------------------------

    "02098": 108,   # MP-410 LVLP

    "03417": 65,    # VD-250
    "03418": 65,    # VD-250

    "01886": 94,    # MP-269
    "01885": 94,    # MP-269
    "01881": 94,    # MP-269

    "01511": 93,    # MP-2011

    "01481": 68,    # MP-2000

    "01417": 82,    # MP-105
    "03435": 63,    # VD-201

    "01489": 92,    # MP-2010
    "01498": 92,    # MP-2010


    # --------------------------------------------------------
    # AR DIRETO
    # --------------------------------------------------------

    "01677": 79,    # MP-21

    "01655": 78,    # MP-201AD
    "01656": 78,    # MP-201AD

    "01698": 80,    # MP-22


    # --------------------------------------------------------
    # SUCÇÃO
    # --------------------------------------------------------

    "00279": 73,    # CP-10
    "02129": 74,    # MP-410 S


    # --------------------------------------------------------
    # TANQUE
    # --------------------------------------------------------

    "00714": 85,    # K-591
    "00716": 85,    # K-591

    "02164": 86,    # MP-410 T
    "00330": 84,    # CP-10 T


    # --------------------------------------------------------
    # BAIXA / MÉDIA PRODUÇÃO
    # --------------------------------------------------------

    "02605": 76,    # MP-781
    "02567": 110,   # MP-741

    "03419": 66,    # VD-61
    "03420": 66,    # VD-61


    # --------------------------------------------------------
    # EMBORRACHAR
    # --------------------------------------------------------

    "01468": 89,    # MP-19
    "01451": 88,    # MP-18


    # --------------------------------------------------------
    # AIRLESS
    # --------------------------------------------------------

    "00333": 29,    # CW-10


    # --------------------------------------------------------
    # WIMLED
    # --------------------------------------------------------

    "03291": 53,
    "03292": 53,


    # --------------------------------------------------------
    # BICOS DE LIMPEZA
    # --------------------------------------------------------

    "00120": 114,
    "00121": 115,
    "00122": 116,
    "00123": 117,


    # --------------------------------------------------------
    # PULVERIZADORES
    # --------------------------------------------------------

    "02833": 118,
    "02834": 119,


    # --------------------------------------------------------
    # LIXADEIRAS
    # --------------------------------------------------------

    "00943": 57,
    "00835": 56,
    "00991": 58,


    # --------------------------------------------------------
    # FILTROS
    # --------------------------------------------------------

    "00577": 49,
    "00618": 50,
    "00658": 51,

    "00446": 47,
    "00470": 48,


    # --------------------------------------------------------
    # MISTURADOR
    # --------------------------------------------------------

    "03332": 60,


    # --------------------------------------------------------
    # AERÓGRAFOS
    # --------------------------------------------------------

    "01205": 23,
    "01237": 24,
    "01304": 25,
    "01305": 26,
    "01309": 27,    # MP-1005


    # --------------------------------------------------------
    # COMPRESSORES
    # --------------------------------------------------------

    "00178": 40,
    "00210": 38,
    "00239": 41,
    "00253": 70,
    "00262": 39,
    "00265": 71,
    "00267": 71,


    # --------------------------------------------------------
    # TANQUE DE PRESSÃO
    # --------------------------------------------------------

    "02870": 123,


    # --------------------------------------------------------
    # EPIs
    # --------------------------------------------------------

    "02806": 43,
    "03395": 45,
    "03382": 44,


    # --------------------------------------------------------
    # OUTROS PRODUTOS CONFIRMADOS
    # --------------------------------------------------------

    "03416": 101,   # MP-350 Standard HVLP
}


# ============================================================
# PALAVRAS QUE INDICAM PEÇA / ACESSÓRIO / REPARO
# ============================================================

PALAVRAS_PECAS = {
    "KIT",
    "REPARO",
    "REPOSICAO",
    "REPOSICAO",
    "GUARNICAO",
    "GUARNICOES",
    "AGULHA",
    "BICO",
    "BICOS",
    "ANEL",
    "MOLA",
    "PARAFUSO",
    "PORCA",
    "ARRUELA",
    "JOGO",
    "PINO",
    "ESPIGAO",
    "ENGATE",
    "ABRACADEIRA",
    "MANGUEIRA",
    "FILTRO",
    "MANOMETRO",
    "SUPORTE",
    "TAMPA",
    "TAMPAO",
    "CANECA",
    "CANECA",
}


# ============================================================
# PALAVRAS QUE INDICAM CATEGORIA
# ============================================================

PALAVRAS_CATEGORIA = {
    "ACESSORIOS",
    "CANECAS",
    "KITS",
    "COMPRESSORES",
    "PISTOLAS",
    "AEROGRAFOS",
    "LIXADEIRAS",
    "FILTROS",
    "EPIS",
    "AIRLESS",
    "CABINES",
    "ILUMINACAO",
    "MISTURADOR",
    "TANQUES",
    "PULVERIZADORES",
}


# ============================================================
# LEITURA
# ============================================================

def carregar_produtos():

    if not PRODUTOS_FILE.exists():

        raise FileNotFoundError(
            f"Arquivo não encontrado: {PRODUTOS_FILE}"
        )

    with open(
        PRODUTOS_FILE,
        "r",
        encoding="utf-8"
    ) as f:

        return json.load(f)


def carregar_tabela():

    if not TABELA_FILE.exists():

        raise FileNotFoundError(
            f"Arquivo não encontrado: {TABELA_FILE}"
        )

    return TABELA_FILE.read_text(
        encoding="utf-8"
    )


# ============================================================
# PREÇO
# ============================================================

def converter_preco(valor):

    if not valor:
        return None

    valor = valor.strip()

    if valor in ("—", "-", ""):
        return None

    valor = valor.replace("R$", "")
    valor = valor.replace(" ", "")

    try:

        # Formato brasileiro com centavos:
        # 1.250,50 -> 1250.50
        # 420,00   -> 420.00
        if "," in valor:

            valor = valor.replace(".", "")
            valor = valor.replace(",", ".")

        # Sem vírgula:
        # 2.200 -> 2200
        # 1.500 -> 1500
        # 650   -> 650
        #
        # Neste arquivo da Wimpel, ponto sem vírgula
        # representa separador de milhar.
        else:

            valor = valor.replace(".", "")

        return float(valor)

    except ValueError:

        return None


# ============================================================
# EXTRAÇÃO DOS PREÇOS
# ============================================================

def extrair_precos(texto):

    precos = {}

    linhas = texto.splitlines()

    codigo_atual = None

    for linha in linhas:

        linha_limpa = linha.strip()

        if not linha_limpa:

            continue

        codigo_match = re.search(
            r"\b(\d{5})\b",
            linha_limpa
        )

        if codigo_match:

            codigo_atual = codigo_match.group(1)

        preco_match = re.search(
            r"R\$\s*([\d.]+(?:,\d{1,2})?)",
            linha_limpa
        )

        if preco_match and codigo_atual:

            preco = converter_preco(
                preco_match.group(1)
            )

            if preco is not None:

                precos[codigo_atual] = preco

                codigo_atual = None

    return precos


# ============================================================
# EXTRAÇÃO COMPLETA DOS ITENS WIMPEL
# ============================================================

def extrair_itens_wimpel(texto):

    itens = []

    linhas = texto.splitlines()

    codigo_atual = None
    descricao_atual = None

    for linha in linhas:

        linha_limpa = linha.strip()

        if not linha_limpa:

            continue

        codigo_match = re.search(
            r"\b(\d{5})\b",
            linha_limpa
        )

        if codigo_match:

            codigo_atual = codigo_match.group(1)

            descricao_atual = linha_limpa

        preco_match = re.search(
            r"R\$\s*([\d.]+(?:,\d{1,2})?)",
            linha_limpa
        )

        if (
            preco_match
            and codigo_atual
        ):

            preco = converter_preco(
                preco_match.group(1)
            )

            if preco is not None:

                itens.append(
                    {
                        "codigo": codigo_atual,
                        "descricao": descricao_atual or linha_limpa,
                        "preco": preco
                    }
                )

                codigo_atual = None
                descricao_atual = None

    return itens


# ============================================================
# NORMALIZAÇÃO
# ============================================================

def normalizar(texto):

    if not texto:

        return ""

    texto = str(texto)

    texto = unicodedata.normalize(
        "NFKD",
        texto
    )

    texto = "".join(
        c
        for c in texto
        if not unicodedata.combining(c)
    )

    texto = texto.upper()

    texto = texto.replace('"', "")
    texto = texto.replace("'", "")

    texto = texto.replace("/", " ")
    texto = texto.replace("-", " ")

    texto = re.sub(
        r"[^A-Z0-9]+",
        " ",
        texto
    )

    texto = re.sub(
        r"\s+",
        " ",
        texto
    )

    return texto.strip()


# ============================================================
# EXTRAÇÃO DE MODELOS
# ============================================================

def extrair_modelos(texto):

    texto = normalizar(texto)

    modelos = []

    padroes = [

        r"\bMP\s*\d{2,5}[A-Z]?\b",

        r"\bVD\s*\d{2,5}\b",

        r"\bCP\s*\d{1,5}\b",

        r"\bK\s*\d{1,5}\b",

        r"\bCW\s*\d{1,5}\b",

        r"\bLXMP\s*\d{1,5}\b",

        r"\bCOMP\s*\d{1,5}\b",

        r"\bFRMP\s*\d{1,5}\b",

        r"\bFRLMP\s*\d{1,5}\b",

        r"\bBLMP\s*\d{1,5}[A-Z]?\b",

        r"\bPVMP\s*\d{1,5}\b",

        r"\bTPMP\s*\d{1,5}[A-Z]?\b",

        r"\bWIMLED\b",
    ]

    for padrao in padroes:

        encontrados = re.findall(
            padrao,
            texto
        )

        for modelo in encontrados:

            modelo = modelo.replace(
                " ",
                "-"
            )

            if modelo not in modelos:

                modelos.append(modelo)

    return modelos


# ============================================================
# NORMALIZA MODELO
# ============================================================

def normalizar_modelo(modelo):

    modelo = normalizar(modelo)

    modelo = modelo.replace(
        " ",
        ""
    )

    modelo = modelo.replace(
        "-",
        ""
    )

    return modelo


# ============================================================
# IDENTIFICA SE É PEÇA / ACESSÓRIO
# ============================================================

def eh_peca_ou_acessorio(texto):

    texto_normalizado = normalizar(
        texto
    )

    tokens = set(
        texto_normalizado.split()
    )

    return bool(
        tokens &
        PALAVRAS_PECAS
    )


# ============================================================
# IDENTIFICA SE É CATEGORIA
# ============================================================

def eh_categoria(texto):

    texto_normalizado = normalizar(
        texto
    )

    tokens = set(
        texto_normalizado.split()
    )

    return bool(
        tokens &
        PALAVRAS_CATEGORIA
    )


# ============================================================
# TOKENS IMPORTANTES
# ============================================================

def tokens_importantes(texto):

    tokens = set(
        normalizar(texto).split()
    )

    ignorados = {
        "DE",
        "DA",
        "DO",
        "DAS",
        "DOS",
        "PARA",
        "COM",
        "SEM",
        "EM",
        "E",
        "A",
        "O",
        "AS",
        "OS",
        "AR",
        "PISTOLA",
        "PINTURA",
        "PRODUTO",
        "PROMOCAO",
        "WIMPEL",
        "BIVOLT",
        "UN",
        "UNIDADE",
        "CAIXA",
    }

    return tokens - ignorados


# ============================================================
# COMPARAÇÃO DE MODELOS
# ============================================================

def modelos_em_comum(nome_site, descricao_wimpel):

    modelos_site = {
        normalizar_modelo(m)
        for m in extrair_modelos(nome_site)
    }

    modelos_wimpel = {
        normalizar_modelo(m)
        for m in extrair_modelos(descricao_wimpel)
    }

    return (
        modelos_site &
        modelos_wimpel
    )


# ============================================================
# SCORE
# ============================================================

def calcular_score(nome_site, descricao_wimpel):

    nome = normalizar(
        nome_site
    )

    descricao = normalizar(
        descricao_wimpel
    )

    if not nome or not descricao:

        return 0

    # --------------------------------------------------------
    # PROTEÇÃO CONTRA CATEGORIAS
    # --------------------------------------------------------

    if eh_categoria(nome):

        return 0

    # --------------------------------------------------------
    # PROTEÇÃO CONTRA PEÇAS
    # --------------------------------------------------------

    produto_eh_peca = eh_peca_ou_acessorio(
        nome
    )

    wimpel_eh_peca = eh_peca_ou_acessorio(
        descricao
    )

    # Se um é peça e outro não é,
    # não são correspondentes.
    if produto_eh_peca != wimpel_eh_peca:

        return 0

    score = 0

    # --------------------------------------------------------
    # MODELO
    # --------------------------------------------------------

    modelos_comuns = modelos_em_comum(
        nome,
        descricao
    )

    if modelos_comuns:

        score += 100

    # --------------------------------------------------------
    # NOME EXATO
    # --------------------------------------------------------

    if nome == descricao:

        score += 100

    # --------------------------------------------------------
    # TOKENS
    # --------------------------------------------------------

    tokens_site = tokens_importantes(
        nome
    )

    tokens_wimpel = tokens_importantes(
        descricao
    )

    tokens_comuns = (
        tokens_site &
        tokens_wimpel
    )

    score += (
        len(tokens_comuns) * 5
    )

    # --------------------------------------------------------
    # SIMILARIDADE
    # --------------------------------------------------------

    similaridade = SequenceMatcher(
        None,
        nome,
        descricao
    ).ratio()

    score += int(
        similaridade * 20
    )

    return score


# ============================================================
# ENCONTRA CORRESPONDÊNCIA
# ============================================================

def encontrar_correspondencia(
    produto,
    itens_wimpel,
    codigos_ja_usados
):

    nome_produto = produto.get(
        "nome",
        ""
    )

    # Categorias nunca recebem preço.
    if eh_categoria(nome_produto):

        return None, []

    melhores = []

    for item in itens_wimpel:

        codigo = item["codigo"]

        # Um código Wimpel só pode ser usado
        # para um produto.
        if codigo in codigos_ja_usados:

            continue

        descricao = item["descricao"]

        score = calcular_score(
            nome_produto,
            descricao
        )

        if score <= 0:

            continue

        melhores.append(
            {
                "codigo": codigo,
                "descricao": descricao,
                "preco": item["preco"],
                "score": score
            }
        )

    melhores.sort(
        key=lambda x: x["score"],
        reverse=True
    )

    if not melhores:

        return None, []

    melhor = melhores[0]

    segundo = (
        melhores[1]
        if len(melhores) > 1
        else None
    )

    # --------------------------------------------------------
    # PRECISA TER MODELO EM COMUM
    # --------------------------------------------------------

    modelos = modelos_em_comum(
        nome_produto,
        melhor["descricao"]
    )

    if not modelos:

        return None, melhores[:3]

    # --------------------------------------------------------
    # SCORE MÍNIMO
    # --------------------------------------------------------

    if melhor["score"] < 105:

        return None, melhores[:3]

    # --------------------------------------------------------
    # DIFERENÇA MÍNIMA ENTRE CANDIDATOS
    # --------------------------------------------------------

    if segundo:

        diferenca = (
            melhor["score"]
            - segundo["score"]
        )

        if diferenca < 15:

            return None, melhores[:3]

    return melhor, melhores[:3]


# ============================================================
# INDEXAÇÃO
# ============================================================

def indexar_produtos(produtos):

    indice = {}

    for produto in produtos:

        produto_id = produto.get(
            "id"
        )

        if produto_id is not None:

            indice[produto_id] = produto

    return indice


# ============================================================
# BACKUP
# ============================================================

def criar_backup():

    BACKUP_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    timestamp = datetime.now().strftime(
        "%Y%m%d_%H%M%S"
    )

    backup_file = (
        BACKUP_DIR /
        f"produtos_{timestamp}.json"
    )

    shutil.copy2(
        PRODUTOS_FILE,
        backup_file
    )

    return backup_file


# ============================================================
# FORMATA PREÇO
# ============================================================

def formatar_preco(valor):

    if valor is None:

        return "NULL"

    return (
        f"R$ {float(valor):,.2f}"
        .replace(",", "X")
        .replace(".", ",")
        .replace("X", ".")
    )


# ============================================================
# ATUALIZAÇÃO
# ============================================================

def atualizar():

    print()
    print("=" * 70)
    print("        ATUALIZADOR DE PREÇOS - ARPINT")
    print("=" * 70)
    print()

    produtos = carregar_produtos()

    texto = carregar_tabela()

    print(
        f"Produtos no produtos.json: {len(produtos)}"
    )

    precos = extrair_precos(
        texto
    )

    print(
        f"Preços encontrados na tabela Wimpel: {len(precos)}"
    )

    print()

    itens_wimpel = extrair_itens_wimpel(
        texto
    )

    # --------------------------------------------------------
    # INDEXAÇÃO
    # --------------------------------------------------------

    indice = indexar_produtos(
        produtos
    )

    encontrados = []

    nao_encontrados = []

    ids_processados = set()

    codigos_usados = set()

    # ========================================================
    # PRIMEIRO: MAPA MANUAL
    # ========================================================

    for codigo, produto_id in CODIGO_PARA_ID.items():

        if codigo not in precos:

            continue

        produto = indice.get(
            produto_id
        )

        if not produto:

            continue

        if produto_id in ids_processados:

            continue

        item_wimpel = next(
            (
                item
                for item in itens_wimpel
                if item["codigo"] == codigo
            ),
            None
        )

        if item_wimpel:

            descricao = item_wimpel[
                "descricao"
            ]

            preco = item_wimpel[
                "preco"
            ]

        else:

            descricao = codigo
            preco = precos[codigo]

        encontrados.append(
            {
                "produto": produto,
                "codigo": codigo,
                "descricao": descricao,
                "preco": preco,
                "score": 999,
                "origem": "MAPA MANUAL"
            }
        )

        ids_processados.add(
            produto_id
        )

        codigos_usados.add(
            codigo
        )

    # ========================================================
    # SEGUNDO: AUTOMÁTICO
    # ========================================================

    for produto in produtos:

        produto_id = produto.get(
            "id"
        )

        if produto_id in ids_processados:

            continue

        # Categorias não recebem preço.
        if eh_categoria(
            produto.get("nome", "")
        ):

            nao_encontrados.append(
                {
                    "produto": produto,
                    "candidato": None,
                    "motivo": "CATEGORIA"
                }
            )

            continue

        melhor, candidatos = encontrar_correspondencia(
            produto,
            itens_wimpel,
            codigos_usados
        )

        if melhor:

            encontrados.append(
                {
                    "produto": produto,
                    "codigo": melhor["codigo"],
                    "descricao": melhor["descricao"],
                    "preco": melhor["preco"],
                    "score": melhor["score"],
                    "origem": "AUTOMÁTICO"
                }
            )

            ids_processados.add(
                produto_id
            )

            codigos_usados.add(
                melhor["codigo"]
            )

        else:

            melhor_candidato = (
                candidatos[0]
                if candidatos
                else None
            )

            nao_encontrados.append(
                {
                    "produto": produto,
                    "candidato": melhor_candidato,
                    "motivo": "SEM CORRESPONDÊNCIA SEGURA"
                }
            )

    # ========================================================
    # ALTERAÇÕES
    # ========================================================

    alteracoes = []

    for item in encontrados:

        produto = item["produto"]

        antigo = produto.get(
            "preco"
        )

        novo = item["preco"]

        if antigo != novo:

            alteracoes.append(
                {
                    **item,
                    "antigo": antigo,
                    "novo": novo
                }
            )

    # ========================================================
    # RESULTADO
    # ========================================================

    print("=" * 70)
    print("RESULTADO DA ANÁLISE")
    print("=" * 70)
    print()

    print(
        f"Correspondências encontradas: {len(encontrados)}"
    )

    print(
        f"Preços que serão alterados:    {len(alteracoes)}"
    )

    print(
        f"Sem correspondência segura:    "
        f"{len(nao_encontrados)}"
    )

    print()

    # ========================================================
    # ALTERAÇÕES
    # ========================================================

    if alteracoes:

        print("=" * 70)
        print("ALTERAÇÕES PROPOSTAS")
        print("=" * 70)
        print()

        for item in alteracoes:

            produto = item["produto"]

            print(
                f"ID {produto.get('id')} | "
                f"{produto.get('nome', '')}"
            )

            print(
                f"    Wimpel: {item['codigo']} | "
                f"{item['descricao']}"
            )

            print(
                f"    Origem: {item['origem']}"
            )

            print(
                f"    Confiança: {item['score']}"
            )

            print(
                f"    Preço: "
                f"{formatar_preco(item['antigo'])}"
                f" -> "
                f"{formatar_preco(item['novo'])}"
            )

            print()

    # ========================================================
    # NÃO ENCONTRADOS
    # ========================================================

    if nao_encontrados:

        print("=" * 70)
        print("NÃO ENCONTRADOS - NÃO ALTERADOS")
        print("=" * 70)
        print()

        for item in nao_encontrados:

            produto = item["produto"]

            print(
                f"ID {produto.get('id')} | "
                f"{produto.get('nome', '')}"
            )

            if item["motivo"] == "CATEGORIA":

                print(
                    "    Motivo: categoria. "
                    "Não deve possuir preço."
                )

            else:

                candidato = item["candidato"]

                if candidato:

                    print(
                        f"    Melhor candidato: "
                        f"{candidato['codigo']} | "
                        f"{candidato['descricao']} | "
                        f"score={candidato['score']}"
                    )

                else:

                    print(
                        "    Nenhum candidato encontrado."
                    )

            print()

    # ========================================================
    # NADA PARA ALTERAR
    # ========================================================

    if not alteracoes:

        print(
            "Nenhum preço precisa ser alterado."
        )

        return

    # ========================================================
    # CONFIRMAÇÃO
    # ========================================================

    print("=" * 70)
    print()

    resposta = input(
        f"{len(alteracoes)} preços serão atualizados. "
        "Continuar? [s/N]: "
    )

    if resposta.lower() not in (
        "s",
        "sim"
    ):

        print()
        print(
            "Operação cancelada. "
            "Nenhum arquivo foi alterado."
        )

        return

    # ========================================================
    # BACKUP
    # ========================================================

    backup = criar_backup()

    print()
    print(
        "Backup criado em:"
    )

    print(
        backup
    )

    # ========================================================
    # APLICA ALTERAÇÕES
    # ========================================================

    for item in alteracoes:

        produto = item["produto"]

        produto["preco"] = item["novo"]

    # ========================================================
    # SALVA
    # ========================================================

    with open(
        PRODUTOS_FILE,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            produtos,
            f,
            ensure_ascii=False,
            indent=2
        )

    # ========================================================
    # FINAL
    # ========================================================

    print()
    print("=" * 70)
    print("             ATUALIZAÇÃO CONCLUÍDA")
    print("=" * 70)
    print()

    print(
        f"Atualizados:                  "
        f"{len(alteracoes)}"
    )

    print(
        f"Sem correspondência segura:   "
        f"{len(nao_encontrados)}"
    )

    print()

    print(
        "Arquivo atualizado:"
    )

    print(
        PRODUTOS_FILE
    )

    print()


# ============================================================
# EXECUÇÃO
# ============================================================

if __name__ == "__main__":

    try:

        atualizar()

    except KeyboardInterrupt:

        print()
        print(
            "Operação cancelada pelo usuário."
        )

    except Exception as erro:

        print()
        print(
            "ERRO:"
        )

        print(
            erro
        )