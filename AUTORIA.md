# Autoria e titularidade do Jarvis E-Commerce

**© 2026 GK Soluções Empresariais LTDA · Todos os direitos reservados.**
Software proprietário (veja [`LICENSE`](LICENSE)), protegido pela Lei 9.609/1998 (Lei do Software) e pela
Lei 9.610/1998 (Lei de Direitos Autorais).

```
-----INÍCIO DO BLOCO DE AUTORIA-----
TITULAR: GK Soluções Empresariais LTDA
CNPJ: 60.180.675/0001-91
AUTORIA: GK Soluções Empresariais LTDA
ANO: 2026
PROGRAMA: Jarvis (Jarvis E-Commerce)
DIREITOS: Todos os direitos reservados (Lei 9.609/1998 e Lei 9.610/1998)
-----FIM DO BLOCO DE AUTORIA-----
```

Impressão digital da autoria: **`JARVIS-GK-ED98E5BE0B2D28CA`**
(SHA-256 do bloco acima: `ed98e5be0b2d28cabf9672c80252915f7caee1f8dca7c901c9302928c099cb42`).

## Declaração

- **Titular e autora:** GK Soluções Empresariais LTDA, CNPJ 60.180.675/0001-91.
- **Obra:** o programa de computador Jarvis E-Commerce: as telas, a configuração e a montagem deste repositório.
- **Origem:** o código chega aqui pelas "Atualizações do Jarvis" da titular; o registro datado da autoria é o histórico
  do repositório de origem, que fica com a titular.
- **Como foi feito:** o Jarvis foi concebido, especificado e dirigido pela GK Soluções Empresariais LTDA, que definiu
  o que cada produto faz, as regras de negócio, a arquitetura, o texto e o visual, e escolheu e aprovou cada mudança.
  Ferramentas de inteligência artificial (como o Claude Code) foram usadas como **instrumento** de escrita do código, a
  pedido e sob a direção da titular. Os commits marcados "Claude" foram feitos pela ferramenta a pedido da titular; a
  titularidade de tudo o que eles contêm é integral da GK Soluções Empresariais LTDA.
- **Uso:** este repositório é entregue à empresa sob licença de uso (veja `LICENSE` e o contrato). A licença não
  transfere a titularidade nem dá direito a copiar, repassar ou usar o código fora da própria empresa.

## O produto e onde está

| Produto | Endereço | Pastas |
|---|---|---|
| Jarvis E-Commerce | `/app/` | `app/` (telas), `instancia.json` (configuração), `ops/instancia/` e `ops/*.mjs` (montagem), `testes/` |

## O que NÃO é da GK (componentes de terceiros)

Continuam com as licenças e os direitos dos seus titulares; a `LICENSE` deste repositório não se aplica a eles.

| Componente | Onde | Titular e licença |
|---|---|---|
| supabase-js | `app/vendor/supabase.js` | Supabase, MIT (`app/vendor/Supabase-LICENSE.txt`) |
| SheetJS (xlsx) | `app/vendor/xlsx.full.min.js` | SheetJS, Apache-2.0 (`app/vendor/SheetJS-LICENSE.txt`) |
| PDF.js | `app/vendor/pdf.mjs`, `app/vendor/pdf.worker.mjs` | Mozilla Foundation, Apache-2.0 (`app/vendor/LICENSE`) |
| jsPDF 2.5.1, QRCode.js 1.0.0, JSZip 3.10.1, node-forge 1.3.1 | carregados por CDN (cdnjs, jsDelivr) em algumas telas | seus autores, licenças MIT (JSZip: MIT ou GPLv3; node-forge: BSD-3-Clause ou GPL-2.0) |
| esbuild, javascript-obfuscator (e dependências) | `package.json` (só para montar) | seus autores (MIT, BSD-2-Clause) |

## Onde a autoria aparece

- `LICENSE` e este `AUTORIA.md`, com o bloco acima.
- `app/autoria.js` e `app/autoria-classico.js` (gerados pela titular; não se editam aqui).
- O cabeçalho de direitos autorais no topo de cada arquivo-fonte, preservado na versão publicada.
- No aplicativo: o aviso na tela, as metas `author` e `copyright` de cada página e uma linha no console.
- No banco da empresa: a função `public.jarvis_autoria()`.

## Regras

Não remova nem altere `LICENSE`, este `AUTORIA.md`, `app/autoria.js`, `app/autoria-classico.js` nem os cabeçalhos de
direitos autorais. A checagem (`npm test`) e a montagem (`ops/instancia/montar.mjs`) conferem o bloco e a impressão
digital acima e recusam publicar se algo faltar ou mudar.
