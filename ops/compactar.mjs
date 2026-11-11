// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
// Compactação de um .js ou .css do site (esbuild) e ofuscação dos .js próprios (javascript-obfuscator), com o aviso de
// direitos autorais preservado no topo. Uma só regra, usada pela montagem do site da GK (ops/montar-site.mjs) e pela das
// instâncias (ops/instancia/nucleo.mjs), que também vai junto para o repositório de cada cliente. Os arquivos continuam
// separados e na mesma ordem: a compactação e a ofuscação não mudam o comportamento.
//
// Ofuscação (trava 1): só os .js PRÓPRIOS (os que têm o cabeçalho de autoria);
// vendor/, .min. e os .js de terceiros/gerados (sem cabeçalho) ficam só minificados.
// Configuração moderada: renomeia variáveis locais e embaralha strings (base64), MAS não mexe em nomes globais, exports
// nem propriedades (renameGlobals/transformObjectKeys desligados) — os ES modules com import/export continuam válidos.
// Nada de self-defending nem debug protection (travam o navegador). Escape para depurar: JARVIS_SEM_OFUSCAR=1.
import path from 'node:path';
import crypto from 'node:crypto';

/** O aviso procurado nas primeiras linhas da fonte (o cabeçalho de ops/autoria/cabecalho.mjs). */
export const MARCA_AUTORIA = '© 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91)';
/** O aviso que vai no topo do arquivo compactado. */
export const BANNER_AUTORIA = '/*! © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md. */';

/** O esbuild (devDependency), ou null quando não está instalado. */
export async function carregarEsbuild() {
  try { return (await import('esbuild')).default; } catch { return null; }
}

/** O javascript-obfuscator (devDependency), ou null quando não está instalado ou com JARVIS_SEM_OFUSCAR=1. */
export async function carregarOfuscador() {
  if (process.env.JARVIS_SEM_OFUSCAR === '1') return null;
  try { return (await import('javascript-obfuscator')).default; } catch { return null; }
}

/** Opções moderadas do javascript-obfuscator (não quebram os ES modules nem travam o navegador). Veja o topo. */
export const OPCOES_OFUSCACAO = Object.freeze({
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'mangled',
  numbersToExpressions: false,
  renameGlobals: false,        // mantém nomes globais e módulos (não renomeia o que atravessa arquivos)
  renameProperties: false,     // mantém propriedades usadas entre arquivos
  selfDefending: false,        // desligado de propósito (trava o navegador)
  simplify: true,
  splitStrings: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  reservedStrings: ['^JarvisAutoria'], // os ganchos da autoria (JarvisAutoria, JarvisAutoriaRodape) ficam legíveis e verificáveis
  transformObjectKeys: false,  // mantém as chaves de objeto (importmap, APIs entre arquivos)
  unicodeEscapeSequence: false,
  target: 'browser',
});

/** Este arquivo (caminho relativo à fonte) é compactado? Bibliotecas de terceiros (vendor/) e .min. ficam como estão. */
export const deveCompactar = (rel) => /\.(js|css)$/.test(rel) && !rel.split(/[\\/]/).includes('vendor') && !/\.min\./.test(path.basename(rel));

/** O módulo de autoria NÃO é ofuscado: precisa ficar verificável (ops/autoria/conferir.mjs confere as strings literais). */
export const NAO_OFUSCAR = Object.freeze(['autoria.js', 'autoria-classico.js']);

/** Prefixo único dos identificadores gerados pela ofuscação de um arquivo (evita colisão entre os scripts clássicos do
 * E-Commerce, que dividem o mesmo escopo global: cada arquivo recebe nomes próprios para o decodificador do string array). */
export const prefixoDe = (caminho) => `_j${crypto.createHash('sha1').update(String(caminho)).digest('hex').slice(0, 6)}`;

/** Semente fixa por arquivo: a mesma fonte sai sempre igual (build reproduzível, cache do navegador estável e teste sem
 * sorteio — com o stringArrayThreshold < 1, sem semente o ofuscador sorteia quais strings vão para o array). */
export const sementeDe = (caminho) => parseInt(crypto.createHash('sha1').update(`semente:${caminho}`).digest('hex').slice(0, 7), 16);

/**
 * O texto compactado, com o aviso no topo quando a fonte o tem (menos no CSS com @charset, que vem antes).
 * `ofuscador`: quando passado, os .js PRÓPRIOS (com o cabeçalho) também são ofuscados. `marca`: token da marca d'água
 * (trava 3), colocado no fim de cada .js próprio como comentário discreto (depois da ofuscação, para sobreviver a ela).
 * `caminho`: o caminho do arquivo (único), usado para o prefixo dos identificadores gerados; sem ele, usa o nome.
 */
export function compactar(esbuild, nome, fonte, { ofuscador = null, marca = '', caminho = '' } = {}) {
  const css = nome.endsWith('.css');
  const proprio = fonte.split('\n', 6).some((l) => l.includes(MARCA_AUTORIA));
  const banner = proprio ? BANNER_AUTORIA : '';
  let { code } = esbuild.transformSync(fonte, { loader: css ? 'css' : 'js', minify: true, target: css ? ['chrome100', 'safari15', 'firefox100'] : 'es2020', charset: 'utf8', legalComments: 'none' });
  // Ofuscação: só os .js próprios (com o cabeçalho). Terceiros e gerados (catálogo/acervo) ficam só minificados; o
  // módulo de autoria fica legível (precisa ser verificável).
  if (!css && proprio && ofuscador && !NAO_OFUSCAR.includes(nome)) {
    // Os ganchos da autoria (window.JarvisAutoria*) ficam legíveis: o acesso com ponto vira colchete com a string, que
    // reservedStrings mantém fora do string array (o mesmo comportamento; a conferência acha o nome no arquivo publicado).
    code = code.replace(/(?<=[\w$)\]])(\?\.|\.)(JarvisAutoria[A-Za-z]*)\b/g, (_, op, nome) => `${op === '?.' ? '?.' : ''}["${nome}"]`);
    code = ofuscador.obfuscate(code, { ...OPCOES_OFUSCACAO, identifiersPrefix: prefixoDe(caminho || nome), seed: sementeDe(caminho || nome) }).getObfuscatedCode();
    if (marca) code = `${code}\n/*${marca}*/`;
  }
  if (banner) code = /^@charset "[^"]*";/.test(code) ? code.replace(/^(@charset "[^"]*";)/, `$1${banner}\n`) : `${banner}\n${code}`;
  return code;
}
