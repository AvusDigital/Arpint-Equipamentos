const fs = require("fs");

const caminho = "./data/produtos.json";
const backup = "./data/produtos.backup-precos.json";

const produtos = JSON.parse(fs.readFileSync(caminho, "utf8"));

// Backup antes de qualquer alteração
fs.copyFileSync(caminho, backup);

const precos = {
  "MP-1001": 220,
  "MP-1002": 220,
  "MP-1003": 220,
  "MP-1004": 220,
  "MP-1005": 220,

  "CW-10 Airless": 2000,

  "Compressor de Ar Direto COMP-2": 650,
  "Compressor de Ar Direto COMP-5": 650,
  "Compressor para Aerógrafo COMP-1": 1150,
  "Compressor para Aerógrafo COMP-3": 550,

  "Máscara Respiratória PFF1": 420,
  "Respirador Semi Facial Duplo MASTT 2402": 95,
  "Respirador Semi Facial MASTT 2401": 75,

  "FRLMP-4": 320,
  "FRLMP-5": 380,
  "FRMP-4": 250,
  "FRMP-5": 350,
  "FRMP-6": 350,

  "WIMLED": 250,

  "Aspirador de Pó MP-506": 1700,
  "LXMP-3000": 1500,
  "LXMP-5": 420,
  "LXMP-700": 900,

  "MP-207": 650,

  "VD-201": 190,
  "VD-22": null,
  "VD-250": 180,
  "VD-61": 160,

  "MP-2000": 250,

  "Pistola Pulverizadora - COMP-4": 450,
  "Pistola Pulverizadora COMP-6": 450,

  "CP-10": 380,
  "MP-410 S": null,

  "MP-781": 380,

  "MP-201 AD": 180,
  "MP-21": 180,
  "MP-22": 120,

  "MP 105": 320,

  "CP-10 T": 380,
  "K-591": 2200,
  "MP-410 T": null,

  "MP-18": 100,
  "MP-19": 150,

  "MP 791": 233,

  "MP-2010": 130,
  "MP-2011": 150,

  "MP-269": 650,

  "MP-61": null,

  "MP 700 Plus": 800,
  "MP-201 HVLP": null,

  "MP-260 HVLP - CAIXA": 750,
  "MP-260 HVLP - MALETA": 850,

  "MP-350 Standard HVLP": 275,
  "MP-560": 190,
  "MP-570 HVLP": 520,
  "MP-600 Plus": 130,
  "MP-610": 175,
  "MP-610 - CAIXA BLACK": 155,

  "MP-410 LVLP": 480,

  "MP-741": 420,

  "BLMP-1": 38,
  "BLMP-2": 26,
  "BLMP-2L": 30,
  "BLMP-3": 22,
  "PVMP-1": 55,
  "PVMP-2": 37,

  "TPMP-10-CH": 1250,
  "TPMP-2P": null
};

let alterados = 0;
let mantidos = 0;
let naoMapeados = 0;

for (const produto of produtos) {
  if (!Object.prototype.hasOwnProperty.call(precos, produto.nome)) {
    mantidos++;
    continue;
  }

  const novoPreco = precos[produto.nome];

  if (novoPreco === null) {
    mantidos++;
    continue;
  }

  if (produto.preco !== novoPreco) {
    console.log(
      `${produto.id} | ${produto.nome} | ${produto.preco ?? "null"} → ${novoPreco}`
    );

    produto.preco = novoPreco;
    alterados++;
  } else {
    mantidos++;
  }
}

fs.writeFileSync(
  caminho,
  JSON.stringify(produtos, null, 2) + "\n",
  "utf8"
);

console.log("\n==============================================");
console.log(" ATUALIZAÇÃO DE PREÇOS — ARPINT");
console.log("==============================================");
console.log(`Alterados:       ${alterados}`);
console.log(`Mantidos:        ${mantidos}`);
console.log(`Backup criado:   ${backup}`);
console.log("==============================================");