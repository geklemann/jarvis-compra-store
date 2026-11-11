// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
// Monta o Jarvis E-Commerce de uma instância em _inst/<id>/ (fora do git), pronto para o Cloudflare Pages da empresa.
// A regra está em ops/instancia/nucleo.mjs (o mesmo arquivo vai para o repositório das telas do cliente).
//
// Uso: node ops/instancia/montar.mjs <id> [--rascunho] [--saida <pasta>]
//   --rascunho  prévia: aceita domínio, projeto e chaves em branco (config vazio = modo local) e mostra a faixa RASCUNHO.
//               Nunca publique um rascunho.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { montarInstancia } from './nucleo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const id = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--saida');
const i = args.indexOf('--saida');
if (!id) { console.error('Uso: node ops/instancia/montar.mjs <id> [--rascunho] [--saida <pasta>]'); process.exit(2); }
try {
  const r = await montarInstancia({ raiz: RAIZ, id, rascunho: args.includes('--rascunho'), saida: i >= 0 ? path.resolve(args[i + 1]) : undefined });
  console.log(`Instância ${r.inst.id} (${r.inst.nome}) montada em ${path.relative(process.cwd(), r.saida) || '.'}: ${r.arquivos} arquivo(s), ${r.compactados} compactado(s), versão ${r.versao}.`);
  if (r.faltando.length) console.log(`RASCUNHO: para publicar ainda faltam ${r.faltando.join(', ')}.`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
