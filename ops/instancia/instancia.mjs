// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
// Configuração de uma instância do Jarvis E-Commerce (instancias/<id>.json no jarvis; instancia.json no repositório do
// cliente): leitura e validação pelo esquema (ops/instancia/esquema.json, um subconjunto simples do JSON Schema) mais as
// regras que um esquema não diz (endereço do Supabase igual ao ref, nada da base da GK, funções que existem).
// Sem segredo nenhum: a configuração só tem o que é público.
//
// Uso: node ops/instancia/instancia.mjs <id> [--rascunho]   (sai com 1 e lista os problemas)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const ESQUEMA = JSON.parse(fs.readFileSync(path.join(AQUI, 'esquema.json'), 'utf8'));
/** O projeto e o site da GK: uma instância nunca aponta para eles. */
export const REF_GK = 'czimvcsktxkplmvtjrpu';
export const DOMINIO_GK = 'jaarvis.com.br';

const tipoDe = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
const tipoOk = (v, t) => [].concat(t).some((x) => x === tipoDe(v) || (x === 'number' && typeof v === 'number'));

/** Valida um valor contra o subconjunto do JSON Schema usado aqui. Devolve a lista de problemas. */
export function validarEsquema(valor, esq = ESQUEMA, onde = '') {
  const p = [], nome = onde || 'instância';
  if (esq.type && !tipoOk(valor, esq.type)) return [`${nome}: esperado ${[].concat(esq.type).join(' ou ')}, veio ${tipoDe(valor)}.`];
  if (valor === null) return p;
  if (esq.enum && !esq.enum.includes(valor)) p.push(`${nome}: valor fora da lista (${esq.enum.join(', ')}).`);
  if (typeof valor === 'string') {
    if (esq.minLength != null && valor.length < esq.minLength) p.push(`${nome}: curto demais.`);
    if (esq.pattern && !new RegExp(esq.pattern).test(valor)) p.push(`${nome}: formato inválido ("${valor.length > 40 ? valor.slice(0, 12) + '…' : valor}").`);
  }
  if (Array.isArray(valor)) {
    if (esq.minItems != null && valor.length < esq.minItems) p.push(`${nome}: precisa de ${esq.minItems} item(ns) ou mais.`);
    if (esq.uniqueItems && new Set(valor.map((x) => JSON.stringify(x))).size !== valor.length) p.push(`${nome}: itens repetidos.`);
    if (esq.items) valor.forEach((x, i) => p.push(...validarEsquema(x, esq.items, `${nome}[${i}]`)));
  }
  if (tipoDe(valor) === 'object') {
    for (const k of esq.required || []) if (!(k in valor)) p.push(`${onde ? onde + '.' : ''}${k}: campo obrigatório ausente.`);
    for (const [k, v] of Object.entries(valor)) {
      const sub = esq.properties?.[k];
      if (!sub) { if (esq.additionalProperties === false) p.push(`${onde ? onde + '.' : ''}${k}: campo desconhecido.`); continue; }
      p.push(...validarEsquema(v, sub, onde ? `${onde}.${k}` : k));
    }
  }
  return p;
}

const pegar = (obj, campo) => campo.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

/** O "ref" de dentro de uma chave anon (JWT), ou null quando não dá para ler (chave publishable nova). */
export function refDaChave(chave) {
  const m = /^eyJ[^.]+\.([^.]+)\./.exec(String(chave || ''));
  if (!m) return null;
  try { return JSON.parse(Buffer.from(m[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).ref ?? null; } catch { return null; }
}

/**
 * Valida a instância. `rascunho`: os campos de publicar podem faltar (prévia sem base). `funcoesExistentes`: a lista
 * das pastas de supabase/functions, quando disponível (no jarvis). Devolve { problemas, faltando } — `faltando` são os
 * campos de publicar que estão null (problema só sem rascunho).
 */
export function validarInstancia(inst, { rascunho = false, funcoesExistentes = null } = {}) {
  const problemas = validarEsquema(inst);
  if (tipoDe(inst) !== 'object') return { problemas, faltando: [] };
  const faltando = ESQUEMA['x-obrigatorios-para-publicar'].filter((c) => pegar(inst, c) == null || pegar(inst, c) === '');
  if (!rascunho) for (const c of faltando) problemas.push(`${c}: obrigatório para publicar (use --rascunho só para prévia).`);
  if (inst.project_ref === REF_GK || String(inst.supabase_url || '').includes(REF_GK)) problemas.push('project_ref/supabase_url: é o projeto da GK; a instância usa o projeto da própria empresa.');
  if (inst.project_ref && inst.supabase_url && inst.supabase_url !== `https://${inst.project_ref}.supabase.co`) problemas.push('supabase_url: não bate com o project_ref.');
  if ((inst.supabase_url || inst.anon_key) && !(inst.supabase_url && inst.anon_key)) problemas.push('supabase_url e anon_key: informe os dois ou nenhum.');
  const ref = refDaChave(inst.anon_key);
  if (ref && inst.project_ref && ref !== inst.project_ref) problemas.push(`anon_key: a chave é do projeto ${ref}, não do ${inst.project_ref}.`);
  if (ref === REF_GK) problemas.push('anon_key: é a chave do projeto da GK.');
  if (inst.dominio && (inst.dominio === DOMINIO_GK || inst.dominio.endsWith(`.${DOMINIO_GK}`))) problemas.push('dominio: é o domínio da GK; a instância usa o domínio da empresa.');
  if (funcoesExistentes && Array.isArray(inst.funcoes)) for (const f of inst.funcoes) if (!funcoesExistentes.includes(f)) problemas.push(`funcoes: "${f}" não existe em supabase/functions.`);
  return { problemas, faltando };
}

/** Lê e valida um arquivo de instância. Lança um erro com a lista de problemas. */
export function lerInstancia(arquivo, opc = {}) {
  if (!fs.existsSync(arquivo)) throw new Error(`Instância não encontrada: ${arquivo}`);
  let inst;
  try { inst = JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch (e) { throw new Error(`${arquivo}: JSON inválido (${e.message}).`); }
  const { problemas, faltando } = validarInstancia(inst, opc);
  if (problemas.length) {
    const e = new Error(`Instância ${path.basename(arquivo)} com problema:\n${problemas.map((x) => `  • ${x}`).join('\n')}`);
    e.problemas = problemas;
    throw e;
  }
  return { inst, faltando };
}

/** As instâncias do jarvis (ids). */
export function listarInstancias(raiz) {
  const d = path.join(raiz, 'instancias');
  return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort() : [];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raiz = path.join(AQUI, '..', '..');
  const id = process.argv[2];
  const rascunho = process.argv.includes('--rascunho');
  if (!id) { console.error('Uso: node ops/instancia/instancia.mjs <id> [--rascunho]'); process.exit(2); }
  const fn = path.join(raiz, 'supabase', 'functions');
  const funcoesExistentes = fs.existsSync(fn) ? fs.readdirSync(fn).filter((f) => fs.existsSync(path.join(fn, f, 'index.ts'))) : null;
  const arq = fs.existsSync(path.join(raiz, 'instancias', `${id}.json`)) ? path.join(raiz, 'instancias', `${id}.json`) : path.join(raiz, 'instancia.json');
  try {
    const { inst, faltando } = lerInstancia(arq, { rascunho, funcoesExistentes });
    console.log(`Instância ${inst.id} (${inst.nome}) válida${faltando.length ? `; para publicar ainda faltam: ${faltando.join(', ')}` : ''}.`);
  } catch (e) { console.error(e.message); process.exit(1); }
}
