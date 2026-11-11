// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
// Apoio das travas no build (trava 2 de endereço e trava 3 de marca d'água).
// Usado por ops/montar-site.mjs (GK) e por ops/instancia/nucleo.mjs (instâncias): carimba a lista de endereços
// autorizados e a marca d'água nos arquivos que têm os marcadores (JARVIS_TRAVA_HOSTS e JARVIS_MARCA), antes de compactar.
import { execFileSync } from 'node:child_process';

/** Endereços sempre permitidos (desenvolvimento e site da GK). */
export const HOSTS_GK = Object.freeze(['jaarvis.com.br', 'www.jaarvis.com.br', 'localhost', '127.0.0.1']);

/** Os arquivos (relativos a web/) que recebem a trava de endereço, carimbados antes de compactar. */
export const ARQUIVOS_TRAVA = Object.freeze(['trava-local.js', 'erp.js', 'escritorio/comum/nucleo.js']);

/** Os endereços de uma instância: os da GK mais o domínio da instância e o <projeto>.pages.dev do Pages dela. */
export function hostsDaInstancia(inst) {
  const extra = [];
  if (inst && inst.dominio) extra.push(String(inst.dominio).toLowerCase());
  if (inst && inst.cloudflare_pages) extra.push(`${String(inst.cloudflare_pages).toLowerCase()}.pages.dev`);
  return [...new Set([...HOSTS_GK, ...extra])];
}

/** O commit curto (para a marca d'água), ou JARVIS_COMMIT, ou "local". */
export function commitDoBuild(raiz) {
  if (process.env.JARVIS_COMMIT) return String(process.env.JARVIS_COMMIT).replace(/[^0-9a-f]/gi, '').slice(0, 12) || 'local';
  try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || 'local'; }
  catch { return 'local'; }
}

/**
 * Carimba a lista de endereços e a marca d'água num texto-fonte (antes de compactar). Troca o conteúdo dos marcadores:
 *   [...]; // JARVIS_TRAVA_HOSTS   →  a lista dada
 *   '...'; // JARVIS_MARCA         →  a marca dada
 * `rel` é o caminho relativo do arquivo (só os de ARQUIVOS_TRAVA são carimbados); textos sem o marcador ficam iguais.
 */
export function carimbar(rel, texto, { hosts, marca } = {}) {
  if (!ARQUIVOS_TRAVA.includes(rel)) return texto;
  let t = texto;
  if (hosts) t = t.replace(/\[[^\]]*\];\s*\/\/\s*JARVIS_TRAVA_HOSTS/g, `${JSON.stringify(hosts)}; // JARVIS_TRAVA_HOSTS`);
  if (marca != null) t = t.replace(/'[^']*';\s*\/\/\s*JARVIS_MARCA/g, `'${String(marca).replace(/'/g, '')}'; // JARVIS_MARCA`);
  return t;
}
