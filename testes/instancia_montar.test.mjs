// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
// Build do Jarvis E-Commerce de uma instância (ops/instancia/montar.mjs, regra em ops/instancia/nucleo.mjs). Roda igual
// no jarvis (web/ + instancias/) e no repositório das telas do cliente (app/ + instancia.json), que recebe este teste:
//   • só o E-Commerce: nada de escritorio/, normas/, reforma/, auditor/, academia/, site/ nem de simples/ além dos 2
//     módulos do ponto; sem CNAME, .nojekyll e o robots.txt da GK;
//   • nada com o projeto da GK (czimvcsktxkplmvtjrpu); "jaarvis.com.br" só nos links da Academia, da privacidade e na
//     autoria; toda referência de app/index.html, cliente.html e ponto.html existe no build;
//   • autoria preservada (módulo, metas, aviso em cada .js e .css compactado);
//   • instância incompleta só monta com --rascunho (config vazio = modo local, faixa RASCUNHO visível);
//   • completa: config, preconnect, og: e textos com o projeto e o domínio dela; raiz → /app/, _headers e _redirects.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { montarInstancia, idsDasInstancias, localizar, referenciasDoHtml, conferirBlocoAutoria, SIMPLES_PERMITIDOS } from '../ops/instancia/nucleo.mjs';
import { conferirSite, IMPRESSAO } from '../ops/instancia/autoria.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOC = localizar(RAIZ);
const IDS = idsDasInstancias(RAIZ);
let esbuild = true;
try { await import('esbuild'); } catch { esbuild = false; }
const skip = esbuild ? false : 'esbuild não instalado (rode npm install)';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-inst-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function todos(dir, rel = '') {
  const out = [];
  for (const d of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${d.name}` : d.name;
    if (d.isDirectory()) out.push(...todos(dir, r)); else out.push(r);
  }
  return out;
}
const ler = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
const configDe = (dir) => { const ctx = { window: {} }; vm.runInNewContext(ler(dir, 'config.js'), ctx); return ctx.window.CONCILIA_CONFIG; };
const jwt = (ref) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ iss: 'supabase', ref, role: 'anon' })).toString('base64url')}.assinatura_de_teste`;

function conferirSoEcommerce(dir) {
  const arqs = todos(dir);
  const proibidos = arqs.filter((f) => /^(escritorio|normas|reforma|auditor|academia|site|ajuda|planos|contato|ecommerce|erp|sobre|recursos|parceiros|contabilidade|reforma-tributaria|normas-contabeis)\//.test(f)
    || (f.startsWith('simples/') && !SIMPLES_PERMITIDOS.includes(f)) || ['CNAME', '.nojekyll', 'privacidade.html', 'termos.html', 'sitemap.xml'].includes(f));
  assert.deepEqual(proibidos, [], 'só arquivos do E-Commerce');
  for (const f of SIMPLES_PERMITIDOS) assert.ok(arqs.includes(f), `${f} (o ponto importa)`);
  for (const f of ['app/index.html', 'cliente.html', 'ponto.html', 'ponto.webmanifest', 'manifest.webmanifest', 'sw.js', 'config.js', 'autoria.js', 'autoria-classico.js', 'vendor/supabase.js', 'vendor/xlsx.full.min.js', 'vendor/pdf.mjs', 'vendor/pdf.worker.mjs', 'brand/jarvis-192.png', 'index.html', 'robots.txt', '_headers', '_redirects']) assert.ok(arqs.includes(f), f);
  for (const f of arqs) {
    const b = fs.readFileSync(path.join(dir, f));
    assert.ok(!b.includes('czimvcsktxkplmvtjrpu'), `${f} tem o projeto da GK`);
  }
  for (const p of ['app/index.html', 'cliente.html', 'ponto.html']) {
    const refs = referenciasDoHtml(ler(dir, p));
    assert.ok(refs.length > (p === 'app/index.html' ? 90 : 2), `${p}: referências lidas`);
    for (const r of refs) assert.ok(fs.existsSync(path.join(dir, r)), `${p} referencia ${r}`);
  }
  // o manifesto: ícones e capturas
  const man = JSON.parse(ler(dir, 'manifest.webmanifest'));
  for (const x of [...man.icons, ...(man.screenshots || [])]) assert.ok(fs.existsSync(path.join(dir, x.src)), x.src);
  // autoria
  assert.deepEqual(conferirSite(dir, { web: LOC.fonte }), []);
  // a variante da instância (só o Jarvis E-Commerce): o nome do produto interno da GK não vai para a instância
  for (const f of ['autoria.js', 'autoria-classico.js']) {
    const t = ler(dir, f);
    assert.match(t, new RegExp(IMPRESSAO), f);
    // (a fonte ou a versão compactada: aspas simples ou duplas)
    assert.match(t, /["']PROGRAMA: Jarvis \(Jarvis E-Commerce\)["']/, f);
    assert.match(t, /produtos: ?Object\.freeze\(\[["']Jarvis E-Commerce["']\]\)/, f);
  }
  assert.match(ler(dir, 'app.js').slice(0, 300), /© 2026 GK Soluções Empresariais LTDA \(CNPJ 60\.180\.675\/0001-91\)/);
  // hospedagem
  assert.equal(ler(dir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  assert.match(ler(dir, '_redirects'), /^\/ \/app\/ 302$/m);
  assert.match(ler(dir, '_headers'), /X-Robots-Tag: noindex/);
  assert.match(ler(dir, 'index.html'), /location\.replace\('\/app\/'/);
  return arqs;
}

test('as fontes e as instâncias são achadas', () => {
  assert.ok(['jarvis', 'cliente'].includes(LOC.modo));
  assert.ok(IDS.length >= 1);
  assert.deepEqual(conferirBlocoAutoria(RAIZ), []);
});

for (const id of IDS) {
  test(`${id}: rascunho só com o E-Commerce, config vazio (modo local) e a faixa RASCUNHO`, { skip }, async () => {
    const saida = path.join(tmp, `${id}-rascunho`);
    const r = await montarInstancia({ raiz: RAIZ, id, rascunho: true, saida, versao: '20261111000000' });
    conferirSoEcommerce(saida);
    const idx = ler(saida, 'app/index.html');
    assert.match(idx, /id="instancia-rascunho"/);
    assert.match(idx, /<title>RASCUNHO · Jarvis · /);
    assert.doesNotMatch(idx, /\?v=(?!20261111000000")\d+/, 'versão carimbada em todos os ?v=');
    const cfg = configDe(saida);
    if (!r.inst.supabase_url) assert.deepEqual([cfg.supabaseUrl, cfg.supabaseAnonKey], ['', '']);
    assert.equal(cfg.instancia.rascunho, true);
    if (!r.inst.demo) {
      assert.doesNotMatch(idx, /demo-loja\.js/);
      assert.ok(!fs.existsSync(path.join(saida, 'demo-loja.js')) && !fs.existsSync(path.join(saida, 'loja-modelo')));
    }
  });
}

test('instância incompleta não monta sem --rascunho; autoria alterada não monta', { skip }, async () => {
  const id = IDS[0];
  const inst = JSON.parse(fs.readFileSync(LOC.arquivo(id), 'utf8'));
  await assert.rejects(montarInstancia({ raiz: RAIZ, id, saida: path.join(tmp, 'x'), instancia: { ...inst, dominio: null } }), /dominio: obrigatório para publicar/);
  // LICENSE com o bloco alterado: nada é montado
  const falsa = path.join(tmp, 'raiz-falsa');
  fs.mkdirSync(falsa);
  fs.writeFileSync(path.join(falsa, 'LICENSE'), fs.readFileSync(path.join(RAIZ, 'LICENSE'), 'utf8').replace('-----FIM DO BLOCO DE AUTORIA-----', 'Linha a mais\n-----FIM DO BLOCO DE AUTORIA-----'));
  fs.copyFileSync(path.join(RAIZ, 'AUTORIA.md'), path.join(falsa, 'AUTORIA.md'));
  assert.match(conferirBlocoAutoria(falsa).join('\n'), /LICENSE: falta ou o bloco de autoria foi alterado/);
});

test('instância completa: projeto, chaves e domínio dela em config, preconnect, og: e textos', { skip }, async () => {
  const id = IDS[0];
  const base = JSON.parse(fs.readFileSync(LOC.arquivo(id), 'utf8'));
  const inst = { ...base, dominio: 'jarvis.lojateste.com.br', project_ref: 'abcdefghijklmnopqrst', supabase_url: 'https://abcdefghijklmnopqrst.supabase.co',
    anon_key: jwt('abcdefghijklmnopqrst'), vapid_publico: 'B'.repeat(87), suporte: { email: 'ti@lojateste.com.br', whatsapp: null } };
  const saida = path.join(tmp, `${id}-completa`);
  const r = await montarInstancia({ raiz: RAIZ, id, saida, instancia: inst, versao: '1' });
  conferirSoEcommerce(saida);
  const cfg = configDe(saida);
  assert.deepEqual([cfg.supabaseUrl, cfg.supabaseAnonKey, cfg.vapidPublicKey, cfg.instancia.dominio, cfg.instancia.rascunho],
    [inst.supabase_url, inst.anon_key, inst.vapid_publico, inst.dominio, false]);
  const idx = ler(saida, 'app/index.html');
  assert.match(idx, /<link rel="preconnect" href="https:\/\/abcdefghijklmnopqrst\.supabase\.co" crossorigin>/);
  assert.match(idx, /<meta property="og:url" content="https:\/\/jarvis\.lojateste\.com\.br\/app\/">/);
  assert.match(idx, /<meta property="og:image" content="https:\/\/jarvis\.lojateste\.com\.br\/brand\/jarvis-1024\.png">/);
  assert.doesNotMatch(idx, /instancia-rascunho|RASCUNHO/);
  // As trocas de texto (TROCAS) são conferidas no texto LEGÍVEL (r.textos), porque o arquivo publicado sai ofuscado
  // (trava 1) — a ofuscação move as strings para o string array e esconde o texto literal. cliente.html é .html (não
  // ofuscado), então a conferência é no arquivo em disco.
  const texto = (f) => r.textos.get(f);
  assert.match(texto('features.js'), /criar a conta em jarvis\.lojateste\.com\.br\/app com/);
  assert.match(texto('diagnostico.js'), /contabilidade\. · jarvis\.lojateste\.com\.br<\/footer>/);
  assert.doesNotMatch(texto('empresa.js'), /jaarvis|Compare tudo em/);
  assert.match(texto('suporte.js'), /https:\/\/jaarvis\.com\.br\/academia\/ecommerce\//);
  assert.match(ler(saida, 'cliente.html'), /href="https:\/\/jaarvis\.com\.br\/privacidade\.html" target="_blank"/);
  // Ofuscação de fato: features.js em disco NÃO tem mais o texto literal (foi para o string array).
  assert.doesNotMatch(ler(saida, 'features.js'), /criar a conta em jarvis\.lojateste\.com\.br\/app com/, 'o arquivo publicado está ofuscado');
  // Marca d'água (trava 3) presente no build.
  assert.match(ler(saida, 'features.js'), /JM1:[A-Za-z0-9_-]+/, 'marca d’água no build');
});
