// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
// Montagem do Jarvis E-Commerce de uma instância (uma empresa com Supabase e Cloudflare próprios; docs/INSTANCIAS.md).
// O mesmo arquivo roda no jarvis (fontes em web/, configuração em instancias/<id>.json) e no repositório das telas do
// cliente (fontes em app/, configuração em instancia.json), que recebe uma cópia dele por ops/instancia/exportar-repo.mjs.
//
// O que sai em _inst/<id>/ (para o Cloudflare Pages):
//   • só os arquivos do E-Commerce: o que app/index.html, cliente.html e ponto.html usam, vendor/, brand/, os manifestos,
//     o sw.js, a autoria e os 2 módulos que o ponto importa (nada dos outros produtos
//     nem do site institucional; sem CNAME, .nojekyll nem o robots.txt da GK);
//   • config.js da instância (endereço e chave anon do projeto dela, chave pública dos alertas); sem projeto (rascunho),
//     config vazio = modo local;
//   • app/index.html com o preconnect do projeto dela, os og: com o domínio dela e a versão carimbada nos ?v=;
//   • os textos com "jaarvis.com.br" que o cliente vê trocados pelo domínio dele (ou tirados, nos planos e na compra);
//     os links da Academia e da política de privacidade continuam no site público do Jarvis;
//   • index.html na raiz levando para /app/, robots.txt e _headers com noindex e _redirects do Cloudflare Pages.
// Cada .js e .css é compactado pela mesma regra do site da GK (ops/compactar.mjs), com o aviso de direitos autorais.
// A montagem recusa: instância incompleta (sem --rascunho), autoria alterada, qualquer resto do projeto da GK
// (czimvcsktxkplmvtjrpu) ou "jaarvis.com.br" fora dos links permitidos, e referência do app/index.html que não exista.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { carregarEsbuild, carregarOfuscador, compactar, deveCompactar } from '../compactar.mjs';
import { lerInstancia, validarInstancia, listarInstancias, REF_GK, DOMINIO_GK } from './instancia.mjs';
import { blocoDe, sha256, RESUMO_BLOCO, conferirSite } from './autoria.mjs';
import { carimbar, hostsDaInstancia, commitDoBuild } from '../trava-build.mjs';
// As variantes da autoria (ferramenta da GK, só no jarvis; o repositório das telas não a recebe): no jarvis, o LICENSE e o
// AUTORIA.md são os canônicos e o build da instância recebe a variante 'instancia'; no repositório das telas, tudo já
// vem nela (exportar-repo.mjs).
const GK = await import('../autoria/variantes.mjs').catch(() => null);

export const SITE_GK = `https://${DOMINIO_GK}`;
/** Os 2 módulos do Jarvis ERP que o Jarvis Ponto (ponto.js e ponto.html) importa. */
export const SIMPLES_PERMITIDOS = Object.freeze(['simples/motor/rep_p.js', 'simples/modulos/pessoas/telas/assinar_p7s.js']);
/** Pastas inteiras do E-Commerce. */
export const PASTAS = Object.freeze(['app', 'vendor', 'brand']);
/** Arquivos da raiz que são do site institucional da GK (gerados por site/gerar.mjs) ou da hospedagem dela. */
export const FORA_DA_RAIZ = Object.freeze(['index.html', 'privacidade.html', 'termos.html', 'sitemap.xml', 'CNAME', '.nojekyll', 'robots.txt']);
const TIPOS_RAIZ = /\.(js|css|html|webmanifest)$/;
const TEXTO = /\.(js|mjs|css|html|webmanifest|json|txt)$/;

/** Onde estão as fontes e a configuração: no jarvis (web/, instancias/<id>.json) ou no repositório do cliente (app/). */
export function localizar(raiz) {
  if (fs.existsSync(path.join(raiz, 'web', 'app', 'index.html'))) {
    const fn = path.join(raiz, 'supabase', 'functions');
    return { modo: 'jarvis', fonte: path.join(raiz, 'web'), arquivo: (id) => path.join(raiz, 'instancias', `${id}.json`),
      funcoes: fs.existsSync(fn) ? fs.readdirSync(fn).filter((f) => fs.existsSync(path.join(fn, f, 'index.ts'))) : null };
  }
  if (fs.existsSync(path.join(raiz, 'app', 'app', 'index.html'))) return { modo: 'cliente', fonte: path.join(raiz, 'app'), arquivo: () => path.join(raiz, 'instancia.json'), funcoes: null };
  throw new Error(`Não achei as fontes do E-Commerce em ${raiz} (web/app/index.html ou app/app/index.html).`);
}

function andar(base, rel, out) {
  const dir = path.join(base, rel);
  if (!fs.existsSync(dir)) return out;
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = `${rel}/${d.name}`;
    if (d.isDirectory()) andar(base, r, out); else out.push(r);
  }
  return out;
}

/** As instâncias que dá para montar aqui: as de instancias/ (jarvis) ou a do instancia.json (cliente). */
export function idsDasInstancias(raiz) {
  const loc = localizar(raiz);
  if (loc.modo === 'jarvis') return listarInstancias(raiz);
  try { return [JSON.parse(fs.readFileSync(loc.arquivo(), 'utf8')).id]; } catch { return []; }
}

/** Os arquivos do E-Commerce na fonte (relativos, com "/"). `demo`: leva a Loja Modelo (demo-*.js e loja-modelo/). */
export function arquivosDoApp(fonte, { demo = false } = {}) {
  const out = [];
  for (const d of fs.readdirSync(fonte, { withFileTypes: true })) {
    if (!d.isFile() || !TIPOS_RAIZ.test(d.name) || FORA_DA_RAIZ.includes(d.name)) continue;
    if (!demo && /^demo-/.test(d.name)) continue;
    out.push(d.name);
  }
  for (const p of [...PASTAS, ...(demo ? ['loja-modelo'] : [])]) andar(fonte, p, out);
  for (const f of SIMPLES_PERMITIDOS) if (fs.existsSync(path.join(fonte, f))) out.push(f);
  return [...new Set(out)].sort();
}

/** O que uma página referencia (src e href locais), sem a versão "?v=". */
export function referenciasDoHtml(html) {
  const out = new Set();
  for (const m of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
    const u = m[1];
    if (/^(https?:|data:|mailto:|tel:|#|javascript:|\$\{)/.test(u) || u.startsWith('//')) continue;
    out.add(u.replace(/^\.?\//, '').replace(/[?#].*$/, ''));
  }
  return [...out].filter(Boolean).sort();
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const js = (s) => JSON.stringify(s ?? '');
const CABECALHO = '© 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.';
const METAS = '<meta name="author" content="GK Soluções Empresariais LTDA"><meta name="copyright" content="© 2026 GK Soluções Empresariais LTDA · Todos os direitos reservados">';

/** config.js da instância. Sem projeto (rascunho): vazio = modo local, dados só no navegador. */
export function gerarConfig(inst, { rascunho = false, licencaPublica = '' } = {}) {
  return `// ${CABECALHO}
// Configuração da instância ${inst.nome} (${inst.id}), gerada por ops/instancia/montar.mjs. Não edite: mude a instância.
// A chave anon é pública por natureza; a proteção dos dados vem do login e do RLS do projeto da empresa.
// licenca_publica: a chave pública (ECDSA P-256, SPKI base64) que o app usa para conferir a licença (trava 4). Vem do
// segredo do build LICENCA_PUBLICA; vazia = sem verificação de licença (modo local, rascunho ou sem o segredo).
window.CONCILIA_CONFIG = {
  supabaseUrl: ${js(inst.supabase_url)},
  supabaseAnonKey: ${js(inst.anon_key)},
  vapidPublicKey: ${js(inst.vapid_publico)},
  licenca_publica: ${js(licencaPublica)},
  instancia: { id: ${js(inst.id)}, nome: ${js(inst.nome)}, dominio: ${js(inst.dominio)}, rascunho: ${rascunho ? 'true' : 'false'} }
};
`;
}

/**
 * Trocas de texto nos arquivos que o cliente vê. `de` sumido na fonte não é erro (o arquivo mudou); a conferência final
 * ainda recusa qualquer "jaarvis.com.br" que tenha sobrado fora dos links permitidos.
 */
export const TROCAS = Object.freeze([
  // Planos e compra: a instância é de uso interno (sem cobrança), o comparativo do site da GK não faz sentido.
  { arquivo: 'empresa.js', de: ' Compare tudo em jaarvis.com.br/planos.', para: () => '' },
  { arquivo: 'diagnostico.js', de: 'para conferência com a contabilidade. · jaarvis.com.br</footer>', para: (i) => `para conferência com a contabilidade.${i.dominio ? ` · ${i.dominio}` : ''}</footer>` },
  { arquivo: 'features.js', de: 'criar a conta em jaarvis.com.br/app com', para: (i) => (i.dominio ? `criar a conta em ${i.dominio}/app com` : 'criar a conta no endereço do Jarvis da empresa com') },
  // A Academia é pública e fica no site do Jarvis.
  { arquivo: 'suporte.js', de: 'href="/academia/ecommerce/', para: () => `href="${SITE_GK}/academia/ecommerce/` },
  { arquivo: 'cliente.html', de: '<a href="privacidade.html">', para: (i) => `<a href="${esc(i.privacidade_url || `${SITE_GK}/privacidade.html`)}" target="_blank" rel="noopener">` },
]);
/** "jaarvis.com.br" que pode ficar no build: Academia, privacidade e o registro da autoria. */
// Permitidos: Academia e privacidade (links do site público da GK) e os endereços da GK na lista da trava de endereço
// (trava 2): os apps também rodam em jaarvis.com.br, então a lista carimbada traz "jaarvis.com.br"/"www.jaarvis.com.br"
// entre aspas. Um resto real (ex.: https://jaarvis.com.br/app) não casa com a forma entre aspas e continua barrado.
const JAARVIS_PERMITIDO = [/https:\/\/jaarvis\.com\.br\/academia\//g, /https:\/\/jaarvis\.com\.br\/privacidade\.html/g, /"www\.jaarvis\.com\.br"/g, /"jaarvis\.com\.br"/g];
const AUTORIA_ARQ = ['autoria.js', 'autoria-classico.js'];

/** app/index.html da instância. */
export function transformarIndex(html, inst, { rascunho = false, versao }) {
  let h = html;
  const pre = /<link rel="preconnect" href="https:\/\/[a-z]{20}\.supabase\.co" crossorigin>/;
  if (!pre.test(h)) throw new Error('app/index.html: não achei o preconnect do Supabase.');
  h = h.replace(pre, inst.supabase_url ? `<link rel="preconnect" href="${esc(inst.supabase_url)}" crossorigin>` : '');
  const meta = (prop, valor) => { const re = new RegExp(`<meta property="${prop}" content="[^"]*">`); h = valor == null ? h.replace(re, '') : h.replace(re, `<meta property="${prop}" content="${esc(valor)}">`); };
  const url = inst.dominio ? `https://${inst.dominio}` : null;
  meta('og:title', `Jarvis E-Commerce · ${inst.nome}`);
  meta('og:description', `O Jarvis E-Commerce da ${inst.nome}: conciliação dos marketplaces, margem real, financeiro, estoque e atendimento.`);
  meta('og:url', url && `${url}/app/`);
  meta('og:image', url && `${url}/brand/jarvis-1024.png`);
  meta('og:image:type', url && 'image/png');
  meta('og:image:width', url && '1024');
  meta('og:image:height', url && '1024');
  h = h.replace(/<meta name="twitter:card" content="[^"]*">/, url ? '<meta name="twitter:card" content="summary">' : '');
  h = h.replace(/<title>[^<]*<\/title>/, `<title>${rascunho ? 'RASCUNHO · ' : ''}Jarvis · ${esc(inst.nome)}</title>`);
  if (!inst.demo) h = h.replace(/<script src="demo-[a-z-]+\.js\?v=\d+"><\/script>/g, '');
  h = h.replace(/\?v=\d+"/g, `?v=${versao}"`);
  if (rascunho) h = h.replace('<div id="app"></div>', `<div id="app"></div><div id="instancia-rascunho" role="note" style="position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:2147483647;pointer-events:none;background:#b42318;color:#fff;font:600 12px/1.3 system-ui,sans-serif;padding:6px 12px;border-radius:999px;box-shadow:0 2px 8px rgb(0 0 0 / 35%);max-width:calc(100% - 120px);text-align:center">RASCUNHO · prévia da instância ${esc(inst.nome)}, sem base de dados</div>`);
  return h;
}

/** Página da raiz: leva para /app/ (o _redirects faz o mesmo no Cloudflare). */
export const paginaRaiz = (inst) => `<!doctype html>
<!-- ${CABECALHO} -->
<html lang="pt-BR"><head><meta charset="utf-8">${METAS}<meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0; url=/app/"><title>Jarvis · ${esc(inst.nome)}</title><script>location.replace('/app/'+location.search+location.hash)</script></head><body><p><a href="/app/">Abrir o Jarvis</a></p></body></html>
`;
export const ROBOTS = 'User-agent: *\nDisallow: /\n';
export const REDIRECTS = '/ /app/ 302\n/index.html /app/ 302\n/app /app/ 301\n';
export const HEADERS = `/*
  X-Robots-Tag: noindex, nofollow
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Strict-Transport-Security: max-age=31536000
/sw.js
  Cache-Control: no-cache
/config.js
  Cache-Control: no-cache
`;

/** Confere a autoria da raiz antes de montar: o bloco de LICENSE e AUTORIA.md é o da instância (repositório das telas) ou, no jarvis, o canônico. */
export function conferirBlocoAutoria(raiz) {
  const p = [];
  const aceitos = [RESUMO_BLOCO, ...(GK ? [GK.RESUMO_GK] : [])];
  for (const arq of ['LICENSE', 'AUTORIA.md']) {
    const f = path.join(raiz, arq);
    const b = fs.existsSync(f) ? blocoDe(fs.readFileSync(f, 'utf8')) : null;
    if (!b || !aceitos.includes(sha256(b))) p.push(`${arq}: falta ou o bloco de autoria foi alterado.`);
  }
  return p;
}

/** Problemas do build pronto: restos da GK e referências do app/index.html que faltam.
 * `textos`: os textos LEGÍVEIS (antes da ofuscação) por rel — a conferência de restos da GK roda neles, não no arquivo
 * ofuscado em disco (a ofuscação esconde strings no string array e tornaria a conferência não confiável). Sem o mapa,
 * confere o disco (compatível com quem não ofusca). */
export function conferirBuild(saida, { textos = null } = {}) {
  const p = [];
  for (const rel of andar(saida, '.', []).map((r) => r.replace(/^\.\//, ''))) {
    if (!TEXTO.test(rel)) continue;
    const t = textos?.get(rel) ?? fs.readFileSync(path.join(saida, rel), 'utf8');
    if (t.includes(REF_GK)) p.push(`${rel}: tem o projeto da GK (${REF_GK}).`);
    if (AUTORIA_ARQ.includes(rel)) continue;
    let resto = t;
    for (const re of JAARVIS_PERMITIDO) resto = resto.replace(re, '');
    if (resto.includes(DOMINIO_GK)) p.push(`${rel}: ainda mostra "${DOMINIO_GK}" (veja TROCAS em ops/instancia/nucleo.mjs).`);
  }
  for (const pagina of ['app/index.html', 'cliente.html', 'ponto.html']) {
    const f = path.join(saida, pagina);
    if (!fs.existsSync(f)) { p.push(`${pagina}: não foi para o build.`); continue; }
    for (const r of referenciasDoHtml(fs.readFileSync(f, 'utf8'))) if (!fs.existsSync(path.join(saida, r))) p.push(`${pagina}: referencia ${r}, que não está no build.`);
  }
  return p;
}

const carimbo = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14);

/** Onde fica, no repositório do cliente, a marca d'água da instância (gravada pela exportação: exportar-repo.mjs). */
export const MARCA_CLIENTE = 'ops/instancia/marca.txt';
/**
 * A marca d'água do build (trava 3). No jarvis, calculada pela ferramenta da GK (ops/autoria/marca.mjs, com o segredo
 * JARVIS_MARCA_SEGREDO). No repositório do cliente, que não recebe essa ferramenta, a que a GK gravou na exportação
 * (MARCA_CLIENTE); sem ela, nenhuma.
 */
export async function marcaDoBuild(raiz, loc, inst) {
  if (loc.modo === 'jarvis') {
    const { calcularMarca } = await import('../autoria/marca.mjs');
    return calcularMarca({ id: inst.id, commit: commitDoBuild(raiz) });
  }
  const f = path.join(raiz, MARCA_CLIENTE);
  const t = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim() : '';
  return /^JM1:[A-Za-z0-9_-]+$/.test(t) ? t : '';
}

/** Arquivos críticos do manifesto (trava 4): os que, mexidos à mão no Cloudflare, o app detecta. */
export const CRITICOS_MANIFESTO = Object.freeze(['app/index.html', 'app.js', 'cloud.js', 'erp.js', 'trava-local.js', 'licenca.js', 'config.js']);
const hashArquivo = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

/** Escreve manifest-hashes.json com o hash dos arquivos críticos publicados e um id do conjunto. */
export function escreverManifesto(saida) {
  const arquivos = {};
  for (const rel of CRITICOS_MANIFESTO) { const f = path.join(saida, rel); if (fs.existsSync(f)) arquivos[rel] = hashArquivo(f); }
  const id = crypto.createHash('sha256').update(Object.keys(arquivos).sort().map((k) => `${k}:${arquivos[k]}`).join('\n')).digest('hex');
  const man = { gerado_em: new Date().toISOString(), id, arquivos };
  fs.writeFileSync(path.join(saida, 'manifest-hashes.json'), `${JSON.stringify(man, null, 2)}\n`);
  return man;
}

/**
 * Monta a instância. Devolve { inst, saida, arquivos, compactados, faltando }. Lança erro com a lista de problemas.
 * `saida`: padrão <raiz>/_inst/<id>. `versao`: o carimbo dos ?v= (padrão JARVIS_VERSAO ou a data e hora).
 * `instancia`: a configuração já lida (testes), validada do mesmo jeito; sem ela, lê o arquivo da instância.
 */
export async function montarInstancia({ raiz, id, rascunho = false, saida, versao, instancia } = {}) {
  const loc = localizar(raiz);
  const autoria = conferirBlocoAutoria(raiz);
  if (autoria.length) throw Object.assign(new Error(`Autoria do Jarvis com problema: a instância não foi montada (veja AUTORIA.md).\n${autoria.map((x) => `  • ${x}`).join('\n')}`), { problemas: autoria });
  let inst, faltando;
  if (instancia) {
    const v = validarInstancia(instancia, { rascunho, funcoesExistentes: loc.funcoes });
    if (v.problemas.length) throw Object.assign(new Error(`Instância ${id} com problema:\n${v.problemas.map((x) => `  • ${x}`).join('\n')}`), { problemas: v.problemas });
    inst = instancia; faltando = v.faltando;
  } else ({ inst, faltando } = lerInstancia(loc.arquivo(id), { rascunho, funcoesExistentes: loc.funcoes }));
  if (inst.id !== id) throw new Error(`A configuração é da instância "${inst.id}", não de "${id}".`);
  const esbuild = await carregarEsbuild();
  if (!esbuild) throw new Error('esbuild não instalado (npm install): a instância só é montada compactada.');
  // Travas 1, 2 e 3: ofuscação, trava de endereço (GK + domínio e pages.dev da
  // instância) e marca d'água derivada do id da instância, do commit e do segredo de build.
  const ofuscador = await carregarOfuscador();
  const hostsInst = hostsDaInstancia(inst);
  const marca = await marcaDoBuild(raiz, loc, inst);
  // Trava 4: a chave pública da licença (segredo do build LICENCA_PUBLICA) vai no config.js; sem ela, sem verificação.
  const licencaPublica = process.env.LICENCA_PUBLICA || '';
  versao = String(versao || process.env.JARVIS_VERSAO || carimbo()).replace(/\D/g, '') || carimbo();
  saida = saida || path.join(raiz, '_inst', id);
  fs.rmSync(saida, { recursive: true, force: true });
  const arquivos = arquivosDoApp(loc.fonte, { demo: inst.demo });
  let compactados = 0;
  // Guarda o texto LEGÍVEL (antes da ofuscação) de cada arquivo processado: a conferência de restos da GK roda nele
  // (a ofuscação esconde strings e tornaria a conferência não confiável), e os testes conferem as trocas nele.
  const textos = new Map();
  for (const rel of arquivos) {
    const de = path.join(loc.fonte, rel), para = path.join(saida, rel);
    fs.mkdirSync(path.dirname(para), { recursive: true });
    const troca = TROCAS.filter((t) => t.arquivo === rel);
    const gerado = rel === 'config.js' || rel === 'app/index.html' || troca.length;
    if (!gerado && !deveCompactar(rel)) { fs.copyFileSync(de, para); continue; }
    let texto = fs.readFileSync(de, 'utf8');
    if (rel === 'config.js') texto = gerarConfig(inst, { rascunho, licencaPublica });
    if (rel === 'app/index.html') texto = transformarIndex(texto, inst, { rascunho, versao });
    for (const t of troca) texto = texto.split(t.de).join(t.para(inst));
    texto = carimbar(rel, texto, { hosts: hostsInst, marca });
    // Texto legível para a conferência e os testes: minificado (comentários fora, como o build sem ofuscar gravava),
    // mas NÃO ofuscado — as strings continuam legíveis. O arquivo gravado em disco é o ofuscado.
    const legivel = deveCompactar(rel) ? compactar(esbuild, path.basename(rel), texto, {}) : texto;
    textos.set(rel, legivel);
    if (deveCompactar(rel)) { fs.writeFileSync(para, compactar(esbuild, path.basename(rel), texto, { ofuscador, marca, caminho: rel })); compactados++; }
    else fs.writeFileSync(para, texto);
  }
  fs.writeFileSync(path.join(saida, 'index.html'), paginaRaiz(inst));
  fs.writeFileSync(path.join(saida, 'robots.txt'), ROBOTS);
  fs.writeFileSync(path.join(saida, '_redirects'), REDIRECTS);
  fs.writeFileSync(path.join(saida, '_headers'), HEADERS);
  // Trava 4 (aviso de alteração): manifesto dos hashes dos arquivos críticos PUBLICADOS (já ofuscados). O build legítimo
  // do repositório gera um manifesto novo; o que o app detecta é o arquivo publicado mexido à mão (hash fora do manifesto).
  // A autoria da instância é a variante 'instancia' (só o Jarvis E-Commerce): no jarvis, o build reescreve os módulos de
  // autoria nela; no repositório das telas, eles já vêm nela.
  if (GK && loc.modo === 'jarvis') {
    GK.aplicarNoBuild(saida, 'instancia', { raiz });
    for (const f of AUTORIA_ARQ) if (fs.existsSync(path.join(saida, f))) textos.set(f, fs.readFileSync(path.join(saida, f), 'utf8'));
  }
  escreverManifesto(saida);
  const problemas = [...conferirSite(saida, { web: loc.fonte }), ...conferirBuild(saida, { textos })];
  if (problemas.length) {
    fs.rmSync(saida, { recursive: true, force: true });
    throw Object.assign(new Error(`A instância ${id} não foi montada:\n${problemas.map((x) => `  • ${x}`).join('\n')}`), { problemas });
  }
  return { inst, saida, arquivos: arquivos.length + 4, compactados, faltando, versao, modo: loc.modo, textos, marca };
}
