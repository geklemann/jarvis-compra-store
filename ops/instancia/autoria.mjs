// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
// A conferência da autoria que o build de uma instância precisa (ops/instancia/nucleo.mjs), sozinha: vai para o
// repositório das telas do cliente no lugar das ferramentas de autoria da GK (ops/autoria/*, que ficam só no jarvis).
// A autoria de uma instância é a VARIANTE 'instancia' (só o Jarvis E-Commerce), gerada no jarvis por
// ops/autoria/variantes.mjs: o LICENSE e o AUTORIA.md do repositório das telas, o app/autoria.js e o app/autoria-classico.js
// e o módulo de autoria de todo build de instância. Confere o bloco dela e o site montado: o módulo de autoria com
// titular, CNPJ, aviso e a impressão digital da variante, as metas author e copyright em toda página e o aviso de
// direitos autorais no topo dos .js e .css que o têm na fonte. Os valores são os de ops/autoria/conferir.mjs ›
// RESUMOS_VARIANTES.instancia (testes/instancia_exportar.test.mjs confere que batem, no jarvis).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const TITULAR = 'GK Soluções Empresariais LTDA';
export const CNPJ = '60.180.675/0001-91';
export const AVISO = '© 2026 GK Soluções Empresariais LTDA · Todos os direitos reservados';
/** O aviso procurado nas primeiras linhas de cada arquivo-fonte. */
export const MARCA = '© 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91)';
/** SHA-256 do bloco da variante 'instancia' (as linhas entre os marcadores de LICENSE e AUTORIA.md, separadas por \n). */
export const RESUMO_BLOCO = 'ed98e5be0b2d28cabf9672c80252915f7caee1f8dca7c901c9302928c099cb42';
export const IMPRESSAO = `JARVIS-GK-${RESUMO_BLOCO.slice(0, 16).toUpperCase()}`;
const INICIO = '-----INÍCIO DO BLOCO DE AUTORIA-----', FIM = '-----FIM DO BLOCO DE AUTORIA-----';

/** O bloco de autoria de um texto (ou null). */
export function blocoDe(texto) {
  const t = String(texto || '').replace(/\r\n/g, '\n');
  const i = t.indexOf(INICIO), f = t.indexOf(FIM);
  if (i < 0 || f < i) return null;
  return t.slice(i + INICIO.length, f).split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
}
export const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

const metaOk = (html) => html.includes(`<meta name="author" content="${TITULAR}">`) && html.includes(`<meta name="copyright" content="${AVISO}">`);
function arquivosDe(dir, filtro, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, d.name);
    if (d.isDirectory()) arquivosDe(f, filtro, out); else if (filtro(f)) out.push(f);
  }
  return out;
}

/** Confere o site montado. `web` é a fonte, para saber quais .js/.css têm o aviso. Devolve a lista de problemas. */
export function conferirSite(dir, { web } = {}) {
  const p = [];
  if (!fs.existsSync(dir)) return [`${dir} não existe.`];
  for (const f of ['autoria.js', 'autoria-classico.js']) {
    const t = fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), 'utf8') : '';
    for (const x of [TITULAR, CNPJ, AVISO, IMPRESSAO]) if (!t.includes(x)) { p.push(`site: ${f} sem "${x}".`); break; }
  }
  for (const f of arquivosDe(dir, (x) => x.endsWith('.html'))) {
    if (!metaOk(fs.readFileSync(f, 'utf8'))) p.push(`site: ${path.relative(dir, f)} sem as metas author e copyright.`);
  }
  for (const f of arquivosDe(dir, (x) => /\.(js|mjs|css)$/.test(x))) {
    const rel = path.relative(dir, f), fonte = path.join(web, rel);
    if (!fs.existsSync(fonte) || !fs.readFileSync(fonte, 'utf8').split('\n', 6).some((l) => l.includes(MARCA))) continue;
    if (!fs.readFileSync(f, 'utf8').slice(0, 400).includes(MARCA)) p.push(`site: ${rel} perdeu o aviso de direitos autorais.`);
  }
  return p;
}
