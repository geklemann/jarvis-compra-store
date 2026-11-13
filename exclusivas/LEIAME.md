<!-- © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md. -->
# Telas exclusivas da Compra Store

Esta pasta é só da **Compra Store**. As telas aqui dentro **ficam só neste repositório**: não vão para o Jarvis
compartilhado (geklemann/jarvis) nem para outros clientes. A atualização do Jarvis **nunca apaga** esta pasta, e a
devolução das telas **não** a leva de volta. Então aqui você cria telas próprias, sem depender da GK.

## Como criar uma tela

1. Crie um arquivo `exclusivas/<nome>.js` que registra a tela com `addPage(...)`, do mesmo jeito que as telas de
   `app/` (abra uma delas de exemplo, como `app/resumo.js`, para ver o padrão). Um `.css` é opcional:
   `exclusivas/<nome>.css`.
2. **Não** edite o `app/index.html`: o build acha os arquivos desta pasta sozinho e injeta os `<script>`/`<link>`
   automaticamente (os `.js` carregam depois do app, então `addPage` já existe).
3. Abra um PR como qualquer outra mudança. Com a checagem verde, junte na `main`: o Cloudflare publica.

## Regras

- Comece cada arquivo com o mesmo **aviso de direitos autorais** do topo das telas de `app/` (recomendado).
- **Nunca** coloque senha, token ou chave secreta no código.
- Estas telas usam os **dados que já existem** no E-Commerce (tabelas e funções da sua base). Precisar de **tabela
  nova** é mudança de banco — fale com a GK.
- Arquivos `.md` (como este) ficam só no repositório; não vão para o site publicado.
- Teste em 375 px de largura e nos temas claro e escuro.
