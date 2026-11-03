const fs = require("fs");

const produtos = JSON.parse(
  fs.readFileSync("./data/produtos.json", "utf8")
);

const linhas = fs
  .readFileSync("./data/tabela_wimpel.txt", "utf8")
  .split(/\r?\n/)
  .map(l => l.trim())
  .filter(Boolean);

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function extrairModelo(nome) {
  const texto = normalizar(nome);

  const match = texto.match(
    /\b(?:MP|VD|LXMP|BLMP|PVMP|TPMP|FRMP|FRLMP|COMP|CP|K|CABMP|CW)-?\s*\d+[A-Z0-9-]*\b/
  );

  if (!match) return null;

  return match[0]
    .replace(/\s+/g, "")
    .toUpperCase();
}

function extrairSku(linha) {
  const match = linha.match(/^(\d{5})\b/);
  return match ? match[1] : null;
}

function extrairPreco(linha) {
  const match = linha.match(
    /R\$\s*([\d.]+(?:,\d{1,2})?)/
  );

  if (!match) return null;

  return Number(
    match[1]
      .replace(/\./g, "")
      .replace(",", ".")
  );
}

const registros = linhas
  .map(linha => ({
    linha,
    sku: extrairSku(linha),
    preco: extrairPreco(linha),
    texto: normalizar(linha)
  }))
  .filter(item => item.preco !== null);

function contemModeloIsolado(texto, modelo) {
  const escaped = modelo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return new RegExp(
    `(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`
  ).test(texto);
}

function ehProdutoPrincipal(linha) {
  const texto = normalizar(linha);

  const proibidos = [
    "KIT REPARO",
    "KIT BICO",
    "KIT CAPA",
    "KIT 2",
    "KIT C/",
    "KIT COM",
    "GUARNIÇÃO",
    "GUARNICAO",
    "VÁLVULA",
    "VALVULA",
    "CANECA",
    "TAMPA",
    "PESCADOR"
  ];

  return !proibidos.some(p => texto.includes(p));
}

function encontrar(produto) {
  const nome = normalizar(produto.nome);
  const modelo = extrairModelo(produto.nome);

  if (!modelo) {
    return {
      tipo: "SEM_MODELO"
    };
  }

  let candidatos = registros.filter(item =>
    contemModeloIsolado(item.texto, modelo) &&
    ehProdutoPrincipal(item.linha)
  );

  // ---------------------------------------------
  // VARIANTES ESPECÍFICAS
  // ---------------------------------------------

  const querCaixa =
    nome.includes("CAIXA") ||
    nome.includes("BLACK");

  const querMaleta =
    nome.includes("MALETA");

  if (querCaixa) {
    const filtrados = candidatos.filter(item =>
      item.texto.includes("CAIXA BLACK") ||
      item.texto.includes("CAIXA")
    );

    if (filtrados.length > 0) {
      candidatos = filtrados;
    }
  }

  if (querMaleta) {
    const filtrados = candidatos.filter(item =>
      item.texto.includes("MALETA")
    );

    if (filtrados.length > 0) {
      candidatos = filtrados;
    }
  }

  // ---------------------------------------------
  // TENTA DIFERENCIAR PELO TAMANHO / BITOLA
  // ---------------------------------------------

  const medidas = nome.match(
    /\b\d+(?:[.,]\d+)?\s*(?:MM|ML|L)\b/g
  );

  if (medidas?.length) {
    const filtrados = candidatos.filter(item =>
      medidas.every(m =>
        item.texto.includes(normalizar(m))
      )
    );

    if (filtrados.length > 0) {
      candidatos = filtrados;
    }
  }

  // ---------------------------------------------
  // RESULTADO
  // ---------------------------------------------

  if (candidatos.length === 1) {
    return {
      tipo: "OK",
      item: candidatos[0]
    };
  }

  if (candidatos.length > 1) {
    return {
      tipo: "AMBIGUO",
      candidatos
    };
  }

  return {
    tipo: "NAO_ENCONTRADO"
  };
}

// ------------------------------------------------
// RELATÓRIO
// ------------------------------------------------

console.log("");
console.log("==============================================");
console.log(" TESTE DE PREÇOS — ARPINT");
console.log("==============================================");
console.log("");

console.log(`Produtos no JSON: ${produtos.length}`);
console.log(`Linhas com preço: ${registros.length}`);
console.log("");

let ok = 0;
let ambiguos = 0;
let semModelo = 0;
let naoEncontrados = 0;

for (const produto of produtos) {
  const resultado = encontrar(produto);

  if (resultado.tipo === "SEM_MODELO") {
    console.log(`? SEM MODELO ${produto.nome}`);
    semModelo++;
    continue;
  }

  if (resultado.tipo === "NAO_ENCONTRADO") {
    console.log(`? NÃO ENCONTRADO ${produto.nome}`);
    naoEncontrados++;
    continue;
  }

  if (resultado.tipo === "AMBIGUO") {
    console.log(`⚠ AMBÍGUO ${produto.nome}`);

    for (const item of resultado.candidatos) {
      console.log(
        `    ${item.sku || "SEM SKU"} → R$ ${item.preco.toFixed(2)} | ${item.linha}`
      );
    }

    console.log("");
    ambiguos++;
    continue;
  }

  const item = resultado.item;

  console.log(`OK ${produto.nome}`);
  console.log(
    `    ${item.sku || "SEM SKU"} → R$ ${item.preco.toFixed(2)}`
  );

  ok++;
}

console.log("");
console.log("==============================================");
console.log(" RESUMO");
console.log("==============================================");
console.log("");

console.log(`Encontrados:       ${ok}`);
console.log(`Ambíguos:          ${ambiguos}`);
console.log(`Sem modelo:        ${semModelo}`);
console.log(`Não encontrados:   ${naoEncontrados}`);

console.log("");
console.log("==============================================");
console.log(" NENHUM ARQUIVO FOI ALTERADO");
console.log("==============================================");
console.log("");