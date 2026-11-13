<!-- © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md. -->
# Jarvis E-Commerce · Compra Store

As telas do **Jarvis E-Commerce** da Compra Store, publicadas no Cloudflare Pages da própria empresa. O Jarvis é
software da GK Soluções Empresariais LTDA (veja [LICENSE](LICENSE) e [AUTORIA.md](AUTORIA.md)); este repositório tem só
as telas do E-Commerce, sob licença de uso. Banco e funções ficam no Supabase da empresa e são publicados pela GK.

## Como as mudanças entram

1. Crie uma branch a partir da `main` e faça a mudança em `app/`.
2. Abra um PR. A checagem roda os testes e monta o site.
3. Com a checagem verde, junte o PR (o TI da empresa junta sem precisar de aprovação; o dono do Jarvis é avisado).
4. Juntou na `main`: o workflow **Publicar** monta e publica no Cloudflare Pages.
5. A GK traz a mudança de volta para o Jarvis (workflow *Instância: devolver*), para ela não se perder na próxima
   atualização.

As atualizações do Jarvis chegam como um PR chamado **Atualização do Jarvis**, aberto pela GK. Antes de juntar, confira
que as mudanças da empresa já foram devolvidas (o PR avisa quando há alguma pendente).

## Rodar no computador

```sh
npm ci
npm run previa        # monta em _inst/compra-store/ em modo prévia (sem base: dados só no navegador, faixa RASCUNHO)
npx http-server _inst/compra-store -p 3471   # abra http://127.0.0.1:3471/app/
npm test              # os mesmos testes da checagem
```

`npm run montar` monta a versão de publicação e recusa a instância incompleta (sem domínio, projeto ou chaves).

## Onde fica cada coisa

| O quê | Onde |
|---|---|
| Telas (fontes) | `app/` (o app abre em `/app/`; `app/app/index.html` lista os scripts, na ordem) |
| Telas exclusivas da empresa | `exclusivas/` (telas só desta instância, nunca no Jarvis compartilhado; veja `exclusivas/LEIAME.md`) |
| Configuração | `instancia.json` (endereço do Supabase, chave anon e chave pública dos alertas: são públicas) |
| Montagem | `ops/instancia/montar.mjs` (só o E-Commerce, compactado, com o config da empresa) |
| Publicação | `.github/workflows/publicar.yml` (Cloudflare Pages, só da `main`) |

## Regras

- Nunca coloque senha, token ou chave secreta no código. Os segredos ficam no GitHub (Cloudflare) e no Supabase da
  empresa (funções).
- Não remova nem altere `LICENSE`, `AUTORIA.md`, `app/autoria.js`, `app/autoria-classico.js` nem os avisos de direitos
  autorais no topo dos arquivos: sem eles a montagem para.
- Arquivo novo em `app/` nasce com o mesmo aviso no topo dos outros.
- `app/config.js` é gerado da instância: mude o `instancia.json` (com a GK), não o arquivo.
- Textos em português do Brasil; teste em 375 px de largura e nos temas claro e escuro.
