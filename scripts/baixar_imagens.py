"""
Baixa as fotos dos produtos do site da Wimpel para dentro do projeto (assets/images/produtos/)
e troca o campo "imagem" de cada produto em data/produtos.json pelo caminho local.

Por que: assim o site não depende do site da Wimpel estar no ar (nem de eles bloquearem o
carregamento das fotos em outros sites) e as imagens carregam mais rápido.

Uso:   python scripts/baixar_imagens.py            (baixa tudo e atualiza o JSON)
       python scripts/baixar_imagens.py --teste    (só mostra o que faria)
Pode rodar de novo: o que já foi baixado é pulado. A URL original fica em "imagemOriginal".
"""
import json, os, shutil, sys, time, urllib.request, urllib.error
from urllib.parse import urlparse

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(RAIZ, "data", "produtos.json")
PASTA = os.path.join(RAIZ, "assets", "images", "produtos")
TESTE = "--teste" in sys.argv

os.makedirs(PASTA, exist_ok=True)
with open(JSON_PATH, encoding="utf-8") as f:
    produtos = json.load(f)

if not TESTE:
    shutil.copyfile(JSON_PATH, JSON_PATH + ".bak")   # cópia de segurança

ok = pulados = falhas = 0
for p in produtos:
    url = p.get("imagemOriginal") or p.get("imagem") or ""
    if not url.startswith("http"):
        if url:
            pulados += 1          # já é local
        continue

    ext = os.path.splitext(urlparse(url).path)[1].lower() or ".png"
    if ext not in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
        ext = ".png"
    arquivo = f"{p['id']}{ext}"
    destino = os.path.join(PASTA, arquivo)

    if not os.path.exists(destino):
        print(f"[{p['id']}] baixando {url}")
        if TESTE:
            continue
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Arpint site)"})
            with urllib.request.urlopen(req, timeout=30) as r, open(destino, "wb") as out:
                out.write(r.read())
            time.sleep(0.3)       # sem sobrecarregar o servidor deles
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            print(f"   FALHOU: {e}")
            falhas += 1
            continue

    p["imagemOriginal"] = url
    p["imagem"] = f"./assets/images/produtos/{arquivo}"
    ok += 1

if not TESTE:
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(produtos, f, ensure_ascii=False, indent=2)
        f.write("\n")

print(f"\nprontas: {ok} | já locais: {pulados} | falhas: {falhas}")
if falhas:
    print("Rode de novo para tentar as que falharam (as falhas continuam apontando para a Wimpel).")
