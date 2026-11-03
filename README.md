# Arpint — loja online

## Checklist de entrega (faça nesta ordem)

1. **Vercel > projeto > Settings > Environments > Production > Environment Variables**: `SUPERFRETE_TOKEN`, `SUPERFRETE_ENV`, `ORIGEM_CEP`, `SUPERFRETE_CONTATO` (detalhes em `.env.example`). Depois **Redeploy**.
2. Abra `https://SEU-SITE/api/diagnostico`: deve aparecer "OK: o frete está funcionando.".
3. Em `assets/js/config.js`, preencha `razaoSocial`, `cnpj`, `endereco` e, se houver retirada, `retirada.endereco` e `retirada.horario`.
4. Faça uma compra de teste completa (produto → carrinho → frete → finalizar) e confira a mensagem que chega no WhatsApp.
5. Revise os textos de `politicas.html` com o dono da loja.

**Se as funções do servidor (`/api`) estiverem fora do ar**, o site continua fechando pedidos: o frete vira "combinar pelo WhatsApp" e o pedido é montado no navegador e enviado ao WhatsApp da loja.

Site estático (HTML + Tailwind + JS puro) com funções serverless na Vercel (`/api`) para **cotação de frete** (SuperFrete: Correios PAC/SEDEX e demais transportadoras) e **pagamento** (Pagar.me / Stone).

## Como funciona a compra

1. O cliente monta o carrinho (`carrinho.html`) e calcula o frete pelo CEP → `POST /api/frete` (SuperFrete).
2. No `checkout.html` preenche dados e endereço (o CEP preenche rua/cidade pelo ViaCEP), escolhe o frete e se prefere Pix ou cartão.
3. `POST /api/checkout` **recalcula preços e frete no servidor** (o que vem do navegador é ignorado) e finaliza de um de dois jeitos:
   - **Modo WhatsApp (padrão hoje):** abre o WhatsApp da loja com o pedido pronto (itens, frete, total, cliente, endereço). A equipe manda o Pix ou o link do cartão. Não precisa de nenhuma credencial de pagamento.
   - **Modo gateway (Pagar.me):** cria o pedido no Pagar.me e leva o cliente ao checkout seguro deles. Ative com `pagamento: 'gateway'` em `assets/js/config.js` + variáveis do Pagar.me na Vercel (`.env.example`) + webhook (`/api/webhook-pagarme?token=...`).
4. `sucesso.html` mostra o número do pedido e esvazia o carrinho.

## Dados da loja (rodapé)

Edite `assets/js/config.js`: `razaoSocial`, `cnpj`, `endereco` (aparecem no rodapé de todas as páginas; se ficarem vazios, a linha não aparece) e o número do WhatsApp.

## Pagamento online com Pix + cartão (quando for a hora)

Pix e cartão automáticos precisam de um gateway/banco com API. Opções: (a) API Pix do Inter Empresas, só Pix (conta PJ: Internet Banking > Integrações/APIs > Nova integração com "API Cobrança (Boleto + Pix)" → Client ID, Client Secret e o par `.crt`/`.key`, que vale 1 ano); (b) um gateway que faça Pix + cartão (Mercado Pago, Pagar.me com outra conta, Asaas...). Hoje o código está pronto para o Pagar.me; trocar de gateway mexe só em `api/checkout.js` e no webhook.

## Colocar no ar (checklist)

1. Vercel → Settings → Environment Variables: `SUPERFRETE_TOKEN`, `ORIGEM_CEP`, `SUPERFRETE_CONTATO` (veja `.env.example`). Faça novo deploy.
2. Preencha CNPJ/razão social em `assets/js/config.js`.
3. Teste uma compra completa (carrinho → frete → finalizar → mensagem no WhatsApp).

## Frete (SuperFrete)

No carrinho e no checkout o cliente vê 3 botões: **Retirada** (grátis), **Correios** (PAC, SEDEX...) e **Transportadora** (Jadlog etc., o que a SuperFrete devolver). Ao clicar numa aba, a lista com preço e prazo aparece e a opção mais barata já fica marcada.

Se o frete não aparecer, abra **`https://SEU-SITE/api/diagnostico`**: ele mostra quais variáveis faltam, se o token foi aceito e as opções de teste. Causas comuns: variável criada na Vercel sem fazer **novo deploy**; token de sandbox com `SUPERFRETE_ENV=production` (ou o contrário); `ORIGEM_CEP` vazio. Quando a cotação falha, o cliente ainda pode fechar com "Retirada" ou "Combinar o frete pelo WhatsApp" (modo WhatsApp), e o erro mostra um código (ex.: `SF-401`) para suporte.

Retirada: preencha `retirada.endereco` e `retirada.horario` em `assets/js/config.js`.

## Medidas e peso (IMPORTANTE para o preço do frete)

Enquanto os produtos não tiverem medidas, toda compra é cotada como **uma caixa 50×50×50 cm** (`FRETE_CAIXA`). Os Correios cobram pelo maior entre peso real e peso cúbico (C×L×A ÷ 6000): essa caixa vira **~20,8 kg cobrados** mesmo com 1 kg dentro — o frete sai caro. Quando tiver as caixas reais, preencha em `data/produtos.json`, para cada produto:

```json
"peso": 1200,
"dimensoes": { "comprimento": 30, "largura": 20, "altura": 15 }
```

(`peso` em gramas, medidas em cm). Quando **todos** os itens do carrinho tiverem peso e medidas, o site passa a mandar os produtos e a SuperFrete escolhe a caixa ideal; se algum item estiver sem medidas, usa a caixa padrão.

> Hoje os pesos do catálogo (250 g / 550 g / 6000 g) são valores padrão do scraper, não pesos reais.

## Outras transportadoras

`SUPERFRETE_SERVICOS` (padrão `1,2,17` = PAC, SEDEX, Mini Envios). Para Jadlog/Loggi/J&T etc., adicione os IDs que a SuperFrete liberar para a sua conta (veja a documentação da API ou pergunte ao suporte deles). Opções que a SuperFrete devolver com erro são descartadas automaticamente.

## Catálogo

- `data/produtos.json` é a fonte única. Cada produto tem `id` fixo (não mude nem reutilize ids: o carrinho do cliente usa o id).
- Produto com `preco: null` aparece como "Consulte-nos" e não entra no carrinho.
- As categorias do menu são geradas sozinhas a partir do catálogo.
- `scraper_wimpel.py` baixa o catálogo da Wimpel. Corrigido para **não tratar páginas de categoria como produto** (era isso que criava "produtos" que na verdade eram categorias).
- `scripts/atualizar_precos.py` atualiza preços a partir de `data/tabela_wimpel.txt` (usa o `id` real do produto).

## Desenvolvimento

```bash
npm install
npm run build:css     # recompila assets/css/output.css (Tailwind)
npm run test:api      # testa as funções /api sem chamar SuperFrete/Pagar.me de verdade
```

Para rodar localmente com as funções: `npx vercel dev` (lê as variáveis de um `.env` local, que não vai para o GitHub).

## Pendências conhecidas

- Os `estoque` do catálogo são todos 30 (valor padrão). Ajuste os reais ou o site vende o que não tem.
- As fotos são carregadas direto do site da Wimpel. Rode `python scripts/baixar_imagens.py` para baixá-las para `assets/images/produtos/` (atualiza o JSON sozinho) e não depender deles.
- Aviso ao lojista quando um pedido é pago: hoje só aparece no painel do Pagar.me e no log da Vercel. O ponto para plugar e-mail/WhatsApp está em `api/webhook-pagarme.js`.
- As páginas ainda carregam o Tailwind pelo CDN além do `output.css`. Depois de rodar `npm run build:css` e conferir que o visual está igual, dá para remover a linha do `@tailwindcss/browser` de cada HTML.
