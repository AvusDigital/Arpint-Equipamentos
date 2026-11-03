# Arpint — loja online de equipamentos para pintura

Loja virtual da **Arpint** (pistolas, aerógrafos, compressores, cabines e acessórios para pintura automotiva e industrial). O cliente navega pelo catálogo, monta o carrinho, **cota o frete real** (Correios e transportadoras via SuperFrete) e finaliza o pedido.

- **Site:** HTML + Tailwind CSS + JavaScript puro (sem framework e sem banco de dados)
- **Servidor:** funções serverless da Vercel na pasta `api/` (Node.js)
- **Catálogo:** um único arquivo, `data/produtos.json`
- **Hospedagem:** Vercel

---

## Checklist de entrega

Faça nesta ordem:

1. **Vercel > projeto > Settings > Environments > Production > Environment Variables** — crie `SUPERFRETE_TOKEN`, `SUPERFRETE_ENV`, `ORIGEM_CEP` e `SUPERFRETE_CONTATO` (modelo em `.env.example`). Depois faça **Redeploy**.
2. Abra `https://SEU-SITE/api/diagnostico`. Deve aparecer **"OK: o frete está funcionando."**
3. Em `assets/js/config.js`, preencha `razaoSocial`, `cnpj`, `endereco` e, se houver retirada, `retirada.endereco` e `retirada.horario`.
4. Faça uma compra de teste completa (produto → carrinho → frete → finalizar) e confira a mensagem que chega no WhatsApp.
5. Revise os textos de `politicas.html` com o dono da loja.

> Variável de ambiente nova só vale depois de um **novo deploy**.

---

## Como a compra funciona

1. O cliente escolhe produtos (`produtos.html`, `produto.html`) e vai ao **carrinho**, onde digita o CEP e vê o frete (`POST /api/frete`).
2. No **checkout** (`checkout.html`), em 2 etapas:
   - **Etapa 1 — Dados pessoais:** nome, CPF/CNPJ, WhatsApp e e-mail.
   - **Etapa 2 — Pagamento:** endereço (o CEP preenche rua e cidade pelo ViaCEP), frete e forma de pagamento (Pix ou cartão).
3. `POST /api/checkout` **recalcula preços e frete no servidor** (o que vem do navegador é ignorado) e finaliza de um de dois jeitos:
   - **Modo WhatsApp (padrão):** abre o WhatsApp da loja com o pedido pronto (itens, frete, total, cliente, endereço). A equipe envia o Pix ou o link do cartão. Não exige nenhuma credencial de pagamento.
   - **Modo gateway (Pagar.me):** cria o pedido no Pagar.me e leva o cliente ao checkout seguro deles.
4. `sucesso.html` (etapa 3, "Obrigado") mostra o número do pedido e esvazia o carrinho.

**Contingência:** se as funções do servidor (`/api`) estiverem fora do ar, o site continua fechando pedidos: o frete vira "combinar pelo WhatsApp" e o pedido é montado no navegador e enviado ao WhatsApp da loja.

### Frete

No carrinho e no checkout aparecem 3 botões:

| Botão | O que mostra |
|---|---|
| **Retirada** | Grátis. Não exige endereço. |
| **Correios** | PAC, SEDEX e demais serviços dos Correios, com preço e prazo. |
| **Transportadora** | Jadlog e outras que a SuperFrete devolver. |

Ao clicar em uma aba, a opção mais barata já fica marcada. Se a cotação falhar, o cliente ainda pode escolher "Retirada" ou "Combinar o frete pelo WhatsApp", e o erro mostra um código (ex.: `SF-401`) para suporte.

Enquanto os produtos não têm medidas, toda compra é cotada como **uma caixa 50×50×50 cm** (`FRETE_CAIXA`). Os Correios cobram pelo maior entre o peso real e o peso cúbico (C × L × A ÷ 6000), então essa caixa vira cerca de **20,8 kg cobrados** mesmo com 1 kg dentro — o frete sai caro. Quando tiver as caixas reais, preencha em `data/produtos.json`, para cada produto:

```json
"peso": 1200,
"dimensoes": { "comprimento": 30, "largura": 20, "altura": 15 }
```

(`peso` em gramas; medidas em cm.) Quando **todos** os itens do carrinho tiverem peso e medidas, o site manda os produtos e a SuperFrete escolhe a caixa ideal; se algum item estiver sem medidas, usa a caixa padrão.

> Os pesos atuais do catálogo (250 g / 550 g / 6000 g) são valores padrão do scraper, não pesos reais.

---

## Estrutura do projeto

```
├── index.html              Página inicial
├── produtos.html           Catálogo com busca, categorias e filtros
├── produto.html            Detalhe do produto + cálculo de frete
├── carrinho.html           Carrinho + cotação de frete
├── checkout.html           Checkout em 2 etapas
├── sucesso.html            Etapa final ("Obrigado")
├── politicas.html          Entrega, pagamento, trocas e privacidade
├── robots.txt
├── vercel.json             Cabeçalhos de segurança e cache
├── package.json
├── .env.example            Modelo das variáveis de ambiente
│
├── api/                    Funções serverless (Vercel)
│   ├── _lib.js             Código compartilhado (cálculo do carrinho, SuperFrete, validações)
│   ├── frete.js            POST /api/frete        — cota o frete
│   ├── checkout.js         POST /api/checkout     — valida e finaliza o pedido
│   ├── diagnostico.js      GET  /api/diagnostico  — mostra se o frete está configurado
│   └── webhook-pagarme.js  POST /api/webhook-pagarme (só no modo gateway)
│
├── assets/
│   ├── css/                input.css (Tailwind) → output.css; style.css (tema e componentes)
│   ├── js/
│   │   ├── config.js       Dados da loja (WhatsApp, CNPJ, retirada, modo de pagamento)
│   │   ├── common.js       Tema, carrinho, helpers e componente de frete
│   │   ├── produtos.js     Catálogo (busca sem acento, categorias automáticas)
│   │   ├── produto.js      Página do produto
│   │   ├── carrinho.js     Carrinho
│   │   ├── checkout.js     Checkout em etapas + contingência
│   │   ├── rodape.js       Selos de segurança, links e CNPJ no rodapé
│   │   └── suporte.js      Botão de WhatsApp
│   └── images/             Logos e fotos dos produtos
│
├── data/
│   ├── produtos.json       Catálogo (fonte única)
│   └── tabela_wimpel.txt   Tabela de preços usada na atualização
│
└── scripts/
    ├── testar-api.js       Testes das funções /api (sem chamar serviços reais)
    ├── baixar_imagens.py   Baixa as fotos dos produtos para dentro do projeto
    └── atualizar_precos.py Atualiza preços a partir da tabela
```

Também na raiz: `scraper_wimpel.py` (baixa o catálogo da Wimpel), `atualizar-precos.js` e `testar-precos.js` (utilitários de preços).

---

## Configuração

### Variáveis de ambiente (Vercel)

Detalhes e comentários em `.env.example`. Nunca coloque chaves dentro do código nem suba um `.env` para o GitHub.

| Variável | Para quê |
|---|---|
| `SUPERFRETE_TOKEN` | Token da SuperFrete (web.superfrete.com/#/integrations > "Integrar em Desenvolvedores") |
| `SUPERFRETE_ENV` | `production` ou `sandbox` — precisa ser do mesmo ambiente do token |
| `ORIGEM_CEP` | CEP de onde a mercadoria sai (só números) |
| `SUPERFRETE_CONTATO` | E-mail de contato técnico (a SuperFrete exige no cabeçalho) |
| `SUPERFRETE_SERVICOS` | IDs dos serviços cotados. Padrão `1,2,17` (PAC, SEDEX, Mini Envios) |
| `FRETE_CAIXA` | Caixa padrão `CxLxA` em cm. Padrão `50x50x50` |
| `FRETE_PESO_EMBALAGEM_G` | Peso da embalagem vazia em gramas. Padrão `500` |
| `FRETE_SEGURO` | `1` declara o valor da compra na cotação; `0` não declara |
| `RETIRADA` | `1` mostra o botão "Retirada"; `0` esconde |
| `WHATSAPP` | Número do WhatsApp (modo WhatsApp). Padrão do projeto em `config.js` |
| `DIAGNOSTICO_KEY` | Chave opcional para descobrir os IDs de transportadoras da sua conta |
| `PAGAMENTO_PROVEDOR` | `whatsapp` (padrão) ou `pagarme` |
| `SITE_URL`, `PAGARME_*` | Só se for usar o Pagar.me (veja abaixo) |

### Dados da loja (`assets/js/config.js`)

Edite aqui o que aparece no site: número do WhatsApp, `razaoSocial`, `cnpj` e `endereco` (rodapé e políticas), dados da retirada e o modo de pagamento (`'whatsapp'` ou `'gateway'`). Se um campo ficar vazio, a linha correspondente não aparece.

### Outras transportadoras

A documentação pública da SuperFrete lista só os serviços 1 (PAC), 2 (SEDEX) e 17 (Mini Envios). Para Jadlog, Loggi, J&T etc., descubra os IDs liberados na **sua** conta: defina `DIAGNOSTICO_KEY` na Vercel, faça o deploy e abra `/api/diagnostico?probe=1&key=SUA_CHAVE`. Ele lista os que funcionam; coloque-os em `SUPERFRETE_SERVICOS`. Se a SuperFrete recusar algum ID, o site refaz a cotação só com os Correios, então o cliente nunca fica sem frete por causa disso.

### Pagamento online (quando for a hora)

Pix e cartão automáticos exigem um gateway ou banco com API. O código está pronto para o **Pagar.me**: ative com `pagamento: 'gateway'` em `config.js`, defina `PAGAMENTO_PROVEDOR=pagarme` e as variáveis `PAGARME_SECRET_KEY`, `PAGARME_BASE_URL`, `PAGARME_METODOS`, `PAGARME_WEBHOOK_TOKEN` e `SITE_URL`; cadastre no painel do Pagar.me o webhook `https://SEU-SITE/api/webhook-pagarme?token=SEU_TOKEN`. Teste primeiro com `sk_test_...` e `https://sdx-api.pagar.me/core/v5`. Para outro gateway (Mercado Pago, Asaas etc.), a troca fica restrita a `api/checkout.js` e ao webhook.

---

## Catálogo

- `data/produtos.json` é a fonte única. Cada produto tem um `id` **fixo** — não mude nem reutilize ids, porque o carrinho do cliente usa o id.
- Produto com `preco: null` aparece como "Consulte-nos" e não entra no carrinho.
- As categorias do menu são geradas automaticamente a partir dos produtos.
- `scraper_wimpel.py` baixa o catálogo da Wimpel. Ele ignora as **páginas de categoria** (que ficam sob o mesmo endereço dos produtos e antes apareciam como "produtos").
- `scripts/atualizar_precos.py` atualiza preços a partir de `data/tabela_wimpel.txt`.
- `python scripts/baixar_imagens.py` baixa as fotos para `assets/images/produtos/` e atualiza o JSON sozinho (o original fica em `imagemOriginal`). Use `--teste` para só simular.

## Segurança

- Preços e frete são **sempre recalculados no servidor**; o navegador não consegue alterar valores.
- Dados de cartão nunca passam pelo site.
- Textos vindos do catálogo são escapados antes de entrar no HTML.
- Cabeçalhos de segurança no `vercel.json`; chamadas à API têm limite básico por IP e tempo máximo.
- O token da SuperFrete e as chaves do gateway ficam só nas variáveis de ambiente da Vercel.

---

## Desenvolvimento

```bash
npm install
npm run build:css     # recompila assets/css/output.css (Tailwind)
npm run test:api      # testa as funções /api sem chamar SuperFrete/Pagar.me de verdade
```

As funções `/api` **não rodam** em servidores de arquivos estáticos (como o "Live Server" do VS Code): nesse caso o frete responde `HTTP-405`. Para rodar tudo localmente use `npx vercel dev`, com um `.env` local (que não vai para o GitHub) contendo as variáveis acima.

---

## Pendências conhecidas

- **Estoque** do catálogo: todos os produtos estão com 30 (valor padrão). Ajuste os reais, ou o site vende o que não tem.
- **Pesos e medidas** reais dos produtos (veja a seção de frete).
- **Fotos** ainda carregam do site da Wimpel até você rodar `scripts/baixar_imagens.py`.
- **Aviso de pedido pago** (modo gateway): hoje só aparece no painel do Pagar.me e no log da Vercel; o ponto para ligar e-mail ou WhatsApp está em `api/webhook-pagarme.js`.
- **Tailwind:** as páginas ainda carregam o Tailwind por CDN além do `output.css`. Depois de rodar `npm run build:css` e conferir que o visual está igual, dá para remover a linha do `@tailwindcss/browser` de cada HTML.
- **Plano da Vercel:** o plano grátis (Hobby) é restrito a uso pessoal e não comercial; para a loja em operação, confirme as regras atuais em vercel.com/pricing.

---

Desenvolvido por **Avus Digital**.
