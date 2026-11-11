// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
// Motor do REP-P do Jarvis (registrador eletrônico de ponto por programa, Portaria MTP 671/2021, arts. 74 a 96). PURO:
// sem DOM e sem rede, igual no navegador (Jarvis ERP e Jarvis E-Commerce) e no Node (testes).
// • AFD (Arquivo-Fonte de Dados, Anexo V): cabeçalho (tipo 1), empresa (2), ajuste do relógio (4), empregado (5),
//   eventos sensíveis (6), marcação do REP-P (7, com o SHA-256 encadeado) e trailer (9); CRC-16 nos registros que têm
//   o campo; conferência do arquivo (tamanhos, CRC, cadeia, NSR e trailer).
// • AEJ (Arquivo Eletrônico de Jornada, Anexo VI): registros 01 a 08 e o trailer 99, separados por "|", gerados pelo
//   programa de tratamento (as marcações originais, as incluídas e as desconsideradas, com o motivo).
// • Comprovante de registro de ponto do trabalhador (NSR, data, hora, CPF, empregador, identificação do REP-P, SHA-256).
// • Assinatura eletrônica CAdES destacada (.p7s) do AFD e do AEJ: o arquivo PKCS#7/CMS é montado aqui (DER) e a
//   assinatura RSA-SHA256 é feita por quem chama (certificado ICP-Brasil do empregador; telas › assinar_p7s.js).
// O leiaute segue o Anexo V/VI como o conhecemos; onde não há certeza está marcado "conferir no Anexo" (o proxy desta
// sessão bloqueia o gov.br). Tabela completa em docs/ponto/CONFORMIDADE-671.md.

// ───────────────────────── identificação do programa (preencher depois do registro no INPI) ─────────────────────────
/**
 * Identificação do Jarvis como REP-P e como programa de tratamento (PTRP). O número de registro no INPI e o CNPJ/CPF do
 * desenvolvedor dependem do dono (docs/ponto/CONFORMIDADE-671.md › "Depende do dono"): enquanto estiverem vazios, o AFD
 * e o AEJ saem com os campos em branco/zerados e com o aviso.
 */
export const PROGRAMA = Object.freeze({
  nome: 'Jarvis',
  versao: '1.0',
  inpi: '',                                                  // número do registro do programa no INPI (17 posições)
  desenvolvedor: Object.freeze({ tipo: '', documento: '', razao: '', email: '' }), // tipo '1' CNPJ | '2' CPF
});
export const VERSAO_AFD = '003';
export const VERSAO_AEJ = '001';
/** Identificador do coletor da marcação (tipo 7, campo 6) — conferir no Anexo V. */
export const COLETOR = Object.freeze({ aplicativo: '01', navegador: '02', desktop: '03', dispositivo: '04', outro: '05' });
/** Eventos sensíveis (tipo 6, campo 4) — conferir no Anexo V (os do REP-P são a disponibilidade do serviço). */
export const EVENTO_SENSIVEL = Object.freeze({ disponivel: '07', indisponivel: '08' });
export const FUSO_PADRAO = 'America/Sao_Paulo';

// ───────────────────────── texto de largura fixa (ISO-8859-1) ─────────────────────────
/** Texto só com caracteres do ISO-8859-1 (o que não couber vira "?"), sem quebras de linha nem "|". */
export const latin1Texto = (s) => String(s ?? '').replace(/[\r\n|]+/g, ' ').replace(/[^\x20-\x7e\xa0-\xff]/g, '?');
/** Bytes ISO-8859-1 do texto (é assim que o arquivo é gravado e que o CRC e o SHA-256 são calculados — conferir). */
export function latin1(s) {
  const t = String(s ?? ''), u = new Uint8Array(t.length);
  for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); u[i] = c < 256 ? c : 0x3f; }
  return u;
}
const alfa = (s, n) => latin1Texto(s).slice(0, n).padEnd(n, ' ');
const num = (s, n) => String(s ?? '').replace(/\D/g, '').slice(-n).padStart(n, '0');
const dois = (n) => String(n).padStart(2, '0');
const so = (s) => String(s ?? '').replace(/\D/g, '');

// ───────────────────────── CRC-16 e SHA-256 ─────────────────────────
/**
 * CRC-16/KERMIT (polinômio 0x1021 refletido, início 0, sem XOR final) em 4 dígitos hexadecimais maiúsculos — o CRC
 * citado no Anexo V para os registros do REP ("conferir no Anexo" o algoritmo e a ordem dos bytes). "123456789" → 2189.
 */
export function crc16(texto) {
  const b = typeof texto === 'string' ? latin1(texto) : texto;
  let c = 0;
  for (const x of b) { c ^= x; for (let i = 0; i < 8; i++) c = c & 1 ? (c >>> 1) ^ 0x8408 : c >>> 1; }
  return c.toString(16).toUpperCase().padStart(4, '0');
}
const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
/** SHA-256 (FIPS 180-4) dos bytes; devolve os 32 bytes. Texto entra como UTF-8. */
export function sha256Bytes(entrada) {
  const b = typeof entrada === 'string' ? new TextEncoder().encode(entrada) : entrada;
  const len = b.length, total = ((len + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(total); m.set(b); m[len] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(total - 4, (len * 8) >>> 0); dv.setUint32(total - 8, Math.floor((len * 8) / 2 ** 32));
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64), ror = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const s0 = ror(w[i - 15], 7) ^ ror(w[i - 15], 18) ^ (w[i - 15] >>> 3); const s1 = ror(w[i - 2], 17) ^ ror(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0; }
    let [a, bb, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = ror(e, 6) ^ ror(e, 11) ^ ror(e, 25), ch = (e & f) ^ (~e & g), t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = ror(a, 2) ^ ror(a, 13) ^ ror(a, 22), maj = (a & bb) ^ (a & c) ^ (bb & c), t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = bb; bb = a; a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += bb; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  const out = new Uint8Array(32), ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, h[i]);
  return out;
}
export const hex = (u8) => Array.from(u8, (x) => x.toString(16).padStart(2, '0')).join('');
export const sha256Hex = (entrada) => hex(sha256Bytes(entrada));

// ───────────────────────── data e hora com o fuso ─────────────────────────
/** Diferença do fuso (minutos, com sinal) no instante: zona IANA (America/Manaus) ou deslocamento fixo ("-0300"). */
export function deslocamento(ts, fuso = FUSO_PADRAO) {
  const f = String(fuso || FUSO_PADRAO);
  const fixo = /^([+-])(\d{2}):?(\d{2})$/.exec(f);
  if (fixo) return (fixo[1] === '-' ? -1 : 1) * (Number(fixo[2]) * 60 + Number(fixo[3]));
  const d = new Date(ts), p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: f, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(d).map((x) => [x.type, x.value]));
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}
/** "AAAA-MM-DDThh:mm:00-0300" (24 posições) no fuso do local de trabalho — o formato de data e hora do Anexo V. */
export function dataHoraAfd(ts, fuso = FUSO_PADRAO) {
  const off = deslocamento(ts, fuso), l = new Date(new Date(ts).getTime() + off * 60000), a = Math.abs(off);
  return `${l.toISOString().slice(0, 16)}:00${off < 0 ? '-' : '+'}${dois(Math.floor(a / 60))}${dois(a % 60)}`;
}
/** Data local (AAAA-MM-DD) do instante no fuso. */
export const dataLocal = (ts, fuso = FUSO_PADRAO) => dataHoraAfd(ts, fuso).slice(0, 10);
/** Hora local (hh:mm) do instante no fuso. */
export const horaLocal = (ts, fuso = FUSO_PADRAO) => dataHoraAfd(ts, fuso).slice(11, 16);
/** Fusos do Brasil (para o local da prestação do serviço). */
export const FUSOS_BRASIL = Object.freeze([['America/Noronha', 'Fernando de Noronha (−2 h)'], ['America/Sao_Paulo', 'Brasília (−3 h)'], ['America/Bahia', 'Bahia (−3 h)'], ['America/Fortaleza', 'Nordeste (−3 h)'], ['America/Recife', 'Pernambuco (−3 h)'], ['America/Belem', 'Pará/Amapá (−3 h)'], ['America/Araguaina', 'Tocantins (−3 h)'], ['America/Manaus', 'Amazonas (−4 h)'], ['America/Cuiaba', 'Mato Grosso (−4 h)'], ['America/Campo_Grande', 'Mato Grosso do Sul (−4 h)'], ['America/Porto_Velho', 'Rondônia (−4 h)'], ['America/Boa_Vista', 'Roraima (−4 h)'], ['America/Rio_Branco', 'Acre (−5 h)']]);

// ───────────────────────── CPF e CNPJ ─────────────────────────
export function cpfValido(v) {
  const c = so(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}
export function cnpjValido(v) {
  const c = so(v);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (n) => { const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; const s = pesos.reduce((a, p, i) => a + Number(c[i]) * p, 0) % 11; return s < 2 ? 0 : 11 - s; };
  return dv(12) === Number(c[12]) && dv(13) === Number(c[13]);
}
/** Tipo de identificador: '1' CNPJ (14 dígitos), '2' CPF (11). */
export const tipoDocumento = (doc, tipo) => String(tipo || (so(doc).length === 11 ? '2' : '1'));
export const cpfFormatado = (v) => { const c = so(v).padStart(11, '0'); return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`; };
export const cnpjFormatado = (v) => { const c = so(v); return c.length === 14 ? `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}` : c.length === 11 ? cpfFormatado(c) : c; };

// ───────────────────────── AFD (Anexo V) ─────────────────────────
/** Tamanho de cada tipo de registro do AFD (Portaria 671/2021, leiaute 003) — conferir no Anexo V. */
export const TAMANHO_AFD = Object.freeze({ 1: 302, 2: 331, 3: 50, 4: 73, 5: 118, 6: 36, 7: 137, 9: 64 });
const comCrc = (corpo, crc) => (crc ? corpo + crc16(corpo) : corpo + '    ');

/** Registro tipo 1 (cabeçalho). */
export function registroCabecalho({ empregador = {}, rep = {}, de, ate, geradoEm, fuso, crc = true }) {
  const dev = rep.desenvolvedor || PROGRAMA.desenvolvedor;
  const corpo = `000000000` + '1' + tipoDocumento(empregador.documento, empregador.tipo_doc) + num(empregador.documento, 14) + num(empregador.cno_caepf, 14)
    + alfa(empregador.razao, 150) + alfa(rep.inpi ?? PROGRAMA.inpi, 17) + String(de || '').slice(0, 10).padEnd(10, ' ') + String(ate || '').slice(0, 10).padEnd(10, ' ')
    + dataHoraAfd(geradoEm, fuso) + VERSAO_AFD + (so(dev.documento) ? tipoDocumento(dev.documento, dev.tipo) : ' ') + num(dev.documento, 14) + alfa('', 30);
  return comCrc(corpo, crc);
}
/** Registro tipo 2 (inclusão ou alteração da identificação do empregador no REP). */
export function registroEmpresa(r, { fuso, crc = true } = {}) {
  const e = r.empregador || {};
  return comCrc(num(r.nsr, 9) + '2' + dataHoraAfd(r.gravado_em, fuso) + num(r.cpf_responsavel, 14) + tipoDocumento(e.documento, e.tipo_doc) + num(e.documento, 14) + num(e.cno_caepf, 14) + alfa(e.razao, 150) + alfa(e.local, 100), crc);
}
/** Registro tipo 4 (ajuste do relógio). */
export function registroAjusteRelogio(r, { fuso, crc = true } = {}) {
  return comCrc(num(r.nsr, 9) + '4' + dataHoraAfd(r.antes, fuso) + dataHoraAfd(r.depois, fuso) + num(r.cpf_responsavel, 11), crc);
}
/** Registro tipo 5 (inclusão "I", alteração "A" ou exclusão "E" de empregado no REP). */
export function registroEmpregado(r, { fuso, crc = true } = {}) {
  const op = ['I', 'A', 'E'].includes(r.operacao) ? r.operacao : 'I';
  return comCrc(num(r.nsr, 9) + '5' + dataHoraAfd(r.gravado_em, fuso) + op + num(r.cpf, 12) + alfa(r.nome, 52) + alfa(r.demais, 4) + num(r.cpf_responsavel, 11), crc);
}
/** Registro tipo 6 (evento sensível do REP). */
export function registroEvento(r, { fuso } = {}) {
  return num(r.nsr, 9) + '6' + dataHoraAfd(r.gravado_em, fuso) + num(r.evento, 2);
}
/** Campos 1 a 7 do registro tipo 7 (marcação do REP-P), sem o SHA-256. */
export function corpoMarcacao(r, { fuso } = {}) {
  return num(r.nsr, 9) + '7' + dataHoraAfd(r.marcado_em, fuso) + num(r.cpf, 12) + dataHoraAfd(r.gravado_em || r.marcado_em, fuso)
    + num(r.coletor || COLETOR.navegador, 2) + (r.online === false ? '1' : '0');
}
/**
 * SHA-256 do registro tipo 7: os campos 1 a 7 concatenados ao SHA-256 do registro tipo 7 anterior (no primeiro, vazio),
 * em hexadecimal minúsculo — conferir no Anexo V a ordem da concatenação e a caixa do hexadecimal.
 */
export const hashRegistro7 = (corpo, anterior = '') => sha256Hex(latin1(corpo + (anterior || '')));

/**
 * Gera o AFD do REP-P.
 *  empregador: { tipo_doc?, documento (CNPJ/CPF), cno_caepf?, razao, local? }
 *  rep: { inpi?, desenvolvedor?: { tipo, documento } } (padrão: PROGRAMA)
 *  registros: [{ tipo: 2|4|5|6|7, nsr, ... }] — TODOS desde o NSR 1 (a cadeia do SHA-256 começa no primeiro tipo 7);
 *    só os do período [de, ate] (na data local do fuso) vão para o arquivo.
 *  fuso: zona do local de trabalho (padrão Brasília). crcRepP: preencher o CRC-16 nos registros do REP-P (conferir).
 * Devolve { texto, bytes (ISO-8859-1), nome, totais: { 2, 3, 4, 5, 6, 7 }, avisos, hashAnterior } — hashAnterior é o
 * SHA-256 do último tipo 7 ANTES do período (vazio se o arquivo começa no NSR 1): quem confere um AFD de período precisa
 * dele (conferirAfd(texto, { hashAnterior })).
 */
export function gerarAfd({ empregador = {}, rep = {}, registros = [], de, ate, geradoEm = new Date().toISOString(), fuso = FUSO_PADRAO, crcRepP = true } = {}) {
  const op = { fuso, crc: crcRepP };
  const avisos = [];
  const inpi = String(rep.inpi ?? PROGRAMA.inpi ?? '').trim();
  const dev = rep.desenvolvedor || PROGRAMA.desenvolvedor;
  if (!inpi) avisos.push('Sem o número de registro do programa no INPI: o campo 7 do cabeçalho sai em branco (depende do dono).');
  if (!so(dev.documento)) avisos.push('Sem o CNPJ/CPF do desenvolvedor do programa: os campos 12 e 13 do cabeçalho saem em branco (depende do dono).');
  if (!so(empregador.documento)) avisos.push('Sem o CNPJ/CPF do empregador.');
  else if (!(cnpjValido(empregador.documento) || cpfValido(empregador.documento))) avisos.push('O CNPJ/CPF do empregador não confere (dígitos verificadores).');
  const ordem = [...registros].sort((a, b) => Number(a.nsr) - Number(b.nsr));
  const vistos = new Set();
  for (const r of ordem) { if (vistos.has(Number(r.nsr))) avisos.push(`NSR ${r.nsr} repetido.`); vistos.add(Number(r.nsr)); }
  const instante = (r) => (Number(r.tipo) === 7 ? r.marcado_em : Number(r.tipo) === 4 ? r.depois : r.gravado_em);
  const noPeriodo = (r) => { const d = dataLocal(instante(r), fuso); return (!de || d >= de) && (!ate || d <= ate); };
  const linhas = [], totais = { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
  let anterior = '', hashAnterior = null;
  for (const r of ordem) {
    const t = Number(r.tipo);
    let l;
    if (t === 7) {
      const corpo = corpoMarcacao(r, op);
      if (hashAnterior === null && noPeriodo(r)) hashAnterior = anterior; // o resumo que abre a cadeia do arquivo
      anterior = hashRegistro7(corpo, anterior);
      if (!so(r.cpf)) avisos.push(`NSR ${r.nsr}: marcação sem o CPF do empregado.`);
      l = corpo + anterior;
    } else if (t === 2) l = registroEmpresa(r, op);
    else if (t === 4) l = registroAjusteRelogio(r, op);
    else if (t === 5) l = registroEmpregado(r, op);
    else if (t === 6) l = registroEvento(r, op);
    else continue;
    if (!noPeriodo(r)) continue;
    linhas.push(l); totais[t]++;
  }
  const cab = registroCabecalho({ empregador, rep: { inpi, desenvolvedor: dev }, de, ate, geradoEm, fuso, crc: crcRepP });
  const trailer = '999999999' + [2, 3, 4, 5, 6, 7].map((t) => num(totais[t], 9)).join('') + '9';
  const texto = `${[cab, ...linhas, trailer].join('\r\n')}\r\n`;
  return { texto, bytes: latin1(texto), nome: nomeAfd({ inpi, documento: empregador.documento }), totais, avisos, hashAnterior: hashAnterior || '' };
}
/**
 * Registros do AFD a partir das tabelas do Jarvis: as marcações (erp_rh_marcacoes / ponto_marcacoes) viram tipo 7 e os
 * demais registros (erp_rh_rep_registros / ponto_rep_registros) viram 2, 4, 5 e 6. O CPF da marcação é o gravado nela
 * (E-Commerce); senão, o do último registro tipo 5 do empregado antes dela; senão, o do cadastro (cpfDe(id)).
 */
export function registrosDoBanco({ marcacoes = [], registros = [], cpfDe = () => '', coletor = COLETOR.navegador } = {}) {
  const idDe = (x) => x.empregado_id ?? x.colaborador_id ?? null;
  const t5 = registros.filter((r) => Number(r.tipo) === 5).sort((a, b) => Number(a.nsr) - Number(b.nsr));
  const cpfNaHora = (id, nsr) => { let c = ''; for (const r of t5) { if (Number(r.nsr) > nsr) break; if (idDe(r) === id && so(r.dados?.cpf)) c = so(r.dados.cpf); } return c; };
  const out = registros.map((r) => {
    const d = r.dados || {}, base = { tipo: Number(r.tipo), nsr: Number(r.nsr), gravado_em: r.gravado_em, cpf_responsavel: d.cpf_responsavel };
    if (base.tipo === 2) return { ...base, empregador: { documento: d.documento, cno_caepf: d.cno_caepf, razao: d.razao, local: d.local } };
    if (base.tipo === 4) return { ...base, antes: d.antes, depois: d.depois };
    if (base.tipo === 5) return { ...base, operacao: d.operacao, cpf: d.cpf, nome: d.nome };
    return { ...base, evento: d.evento };
  });
  for (const m of marcacoes) {
    const id = idDe(m), n = Number(m.nsr);
    out.push({ tipo: 7, nsr: n, marcado_em: m.marcado_em, gravado_em: m.gravado_em || m.marcado_em, cpf: so(m.cpf) || cpfNaHora(id, n) || so(cpfDe(id)), coletor: m.coletor || coletor, online: m.online !== false });
  }
  return out.sort((a, b) => a.nsr - b.nsr);
}
/** Nome do arquivo: "AFD" + número do REP (17) + CNPJ/CPF do empregador (14) + "REP_P.txt" — conferir no Anexo V. */
export const nomeAfd = ({ inpi = PROGRAMA.inpi, documento = '' } = {}) => `AFD${(String(inpi || '').replace(/[^0-9A-Za-z]/g, '') || '0').padStart(17, '0').slice(-17)}${num(documento, 14)}REP_P.txt`;

/**
 * Confere um AFD gerado por um REP-P: tamanho de cada registro, CRC-16, NSR crescente, cadeia do SHA-256 dos tipos 7
 * (a partir do primeiro do arquivo, ou de `hashAnterior`) e as quantidades do trailer. Devolve { ok, erros, totais }.
 */
export function conferirAfd(texto, { crcRepP = true, hashAnterior = '' } = {}) {
  const erros = [], totais = { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
  const ls = String(texto || '').split(/\r?\n/).filter((l) => l.length);
  let anterior = hashAnterior, nsrAnt = 0, trailer = null;
  ls.forEach((l, i) => {
    const t = l.startsWith('999999999') ? 9 : Number(l[9]);
    if (i === 0 && t !== 1) erros.push('A primeira linha não é o cabeçalho (tipo 1).');
    if (!TAMANHO_AFD[t]) { erros.push(`Linha ${i + 1}: tipo de registro desconhecido.`); return; }
    if (l.length !== TAMANHO_AFD[t]) erros.push(`Linha ${i + 1} (tipo ${t}): ${l.length} posições, esperadas ${TAMANHO_AFD[t]}.`);
    if ([1, 2, 3, 4, 5].includes(t) && crcRepP) { const c = l.slice(-4), corpo = l.slice(0, -4); if (c !== crc16(corpo)) erros.push(`Linha ${i + 1} (tipo ${t}): CRC-16 não confere.`); }
    if (t === 9) { trailer = l; return; }
    if (t !== 1) {
      const n = Number(l.slice(0, 9));
      if (n <= nsrAnt) erros.push(`Linha ${i + 1}: NSR ${n} fora de ordem.`);
      nsrAnt = n; totais[t]++;
    }
    if (t === 7) {
      const h = hashRegistro7(l.slice(0, 73), anterior);
      if (l.slice(73) !== h) erros.push(`NSR ${Number(l.slice(0, 9))}: o SHA-256 não confere (registro alterado ou cadeia quebrada).`);
      anterior = l.slice(73);
    }
  });
  if (!trailer) erros.push('Sem o trailer (tipo 9).');
  else [2, 3, 4, 5, 6, 7].forEach((t, k) => { const q = Number(trailer.slice(9 + k * 9, 18 + k * 9)); if (q !== totais[t]) erros.push(`Trailer: ${q} registro(s) tipo ${t}, o arquivo tem ${totais[t]}.`); });
  return { ok: !erros.length, erros, totais };
}

// ───────────────────────── AEJ (Anexo VI) ─────────────────────────
/** Tipo do REP no AEJ (registro 02): 1 REP-C, 2 REP-A, 3 REP-P — conferir no Anexo VI. */
export const TIPO_REP = Object.freeze({ 'REP-C': '1', 'REP-A': '2', 'REP-P': '3' });
/** Fonte da marcação (registro 05): O original, I incluída por ajuste, P pré-assinalada, X ponto por exceção, T outra — conferir. */
export const FONTE_MARCACAO = Object.freeze({ original: 'O', incluida: 'I', preassinalada: 'P', excecao: 'X', outra: 'T' });
/** Ausências e banco de horas (registro 07): 1 DSR, 2 falta não justificada, 3 movimento do banco de horas — conferir. */
export const AUSENCIA_AEJ = Object.freeze({ dsr: '1', falta: '2', banco: '3' });
const campo = (s) => latin1Texto(s).trim();
const linhaAej = (...c) => c.map(campo).join('|');
const hhmm = (min) => `${dois(Math.floor(((Number(min) % 1440) + 1440) % 1440 / 60))}${dois((((Number(min) % 1440) + 1440) % 1440) % 60)}`;

/**
 * Marcações do dia para o AEJ: as originais (do REP) que continuam no ponto tratado são "O"; as que o RH incluiu são
 * "I" (com o motivo); as originais do dia que o RH tirou ficam como "D" (desconsideradas, com o motivo). Entrada e
 * saída alternam na ordem do ponto tratado (E1, S1, E2, S2…); hora menor que a anterior = jornada que virou o dia.
 *  originais: [{ id?, data?, hora: 'hh:mm', marcado_em, rep? }] · tratadas: ['hh:mm'] · motivo: justificativa.
 * Devolve [{ data_hora, rep, tipo, seq, fonte, motivo, original (id da original usada, ou null) }].
 */
export function marcacoesDoDia({ data, originais = [], tratadas = [], motivo = '', fuso = FUSO_PADRAO, rep = '1' } = {}) {
  const livres = [...originais], out = [];
  const seguinte = data ? new Date(Date.parse(`${data}T12:00:00Z`) + 864e5).toISOString().slice(0, 10) : data;
  let anterior = null, virou = false;
  tratadas.forEach((h, i) => {
    if (anterior != null && h < anterior) virou = true;
    anterior = h;
    const dia = virou ? seguinte : data;
    const k = livres.findIndex((o) => o.hora === h && (!o.data || String(o.data).slice(0, 10) === dia));
    const o = k >= 0 ? livres.splice(k, 1)[0] : null;
    out.push({ data_hora: o?.marcado_em ? dataHoraAfd(o.marcado_em, fuso) : dataHoraTexto(dia, h, fuso), rep: o?.rep || rep, tipo: i % 2 ? 'S' : 'E', seq: Math.floor(i / 2) + 1, fonte: o ? 'O' : 'I', motivo: o ? '' : (motivo || 'Incluída pelo RH'), original: o?.id ?? null });
  });
  for (const o of livres) {
    if (o.data && String(o.data).slice(0, 10) !== data) continue; // a do dia seguinte fica para o dia dela
    out.push({ data_hora: o.marcado_em ? dataHoraAfd(o.marcado_em, fuso) : dataHoraTexto(data, o.hora, fuso), rep: o.rep || rep, tipo: 'D', seq: '', fonte: 'O', motivo: motivo || 'Desconsiderada pelo RH', original: o.id ?? null });
  }
  return out;
}
/** "AAAA-MM-DDThh:mm:00-0300" de uma data e hora locais (o deslocamento do fuso naquele dia). */
export function dataHoraTexto(data, hora, fuso = FUSO_PADRAO) {
  const meio = new Date(`${data}T12:00:00Z`), off = deslocamento(meio, fuso), a = Math.abs(off);
  return `${data}T${String(hora).slice(0, 5)}:00${off < 0 ? '-' : '+'}${dois(Math.floor(a / 60))}${dois(a % 60)}`;
}

/**
 * Gera o AEJ (programa de tratamento).
 *  empregador: { tipo_doc?, documento, cno_caepf?, razao }
 *  reps: [{ id: '1', tipo: 'REP-P', numero }] (o número é o registro no INPI do REP-P ou o de fabricação do REP-C)
 *  vinculos: [{ id, cpf, nome, matricula? (eSocial) }]
 *  jornadas: [{ vinculo, data, segmentos: [[ini, fim], …] (minutos), previsto, marcacoes: [{ data_hora, rep, tipo, seq, fonte, motivo }] }]
 *  ausencias: [{ vinculo, tipo: AUSENCIA_AEJ.*, data, minutos, movimento?: '1' crédito | '2' débito }]
 *  programa: { nome, versao, desenvolvedor: { tipo, documento, razao, email } } (padrão: PROGRAMA)
 * Devolve { texto, bytes, nome, totais, avisos }.
 */
export function gerarAej({ empregador = {}, reps = [], vinculos = [], jornadas = [], ausencias = [], programa = PROGRAMA, de, ate, geradoEm = new Date().toISOString(), fuso = FUSO_PADRAO } = {}) {
  const avisos = [], L = { '01': [], '02': [], '03': [], '04': [], '05': [], '06': [], '07': [], '08': [] };
  const dev = programa.desenvolvedor || {};
  if (!so(empregador.documento)) avisos.push('Sem o CNPJ/CPF do empregador.');
  if (!so(dev.documento)) avisos.push('Sem o CNPJ/CPF do desenvolvedor do programa de tratamento (registro 08): depende do dono.');
  const rs = reps.length ? reps : [{ id: '1', tipo: 'REP-P', numero: PROGRAMA.inpi }];
  if (rs.some((r) => !String(r.numero || '').trim())) avisos.push('REP sem número (registro 02): o REP-P usa o registro do programa no INPI (depende do dono).');
  const cno = so(empregador.cno_caepf);
  L['01'].push(linhaAej('01', tipoDocumento(empregador.documento, empregador.tipo_doc), so(empregador.documento), cno.length === 14 && empregador.cno_caepf_tipo !== 'cno' ? cno : '', empregador.cno_caepf_tipo === 'cno' ? cno : '', empregador.razao, de, ate, dataHoraAfd(geradoEm, fuso), VERSAO_AEJ));
  for (const r of rs) L['02'].push(linhaAej('02', r.id, TIPO_REP[r.tipo] || r.tipo || '3', r.numero || ''));
  for (const v of vinculos) {
    if (!cpfValido(v.cpf)) avisos.push(`${v.nome || v.id}: CPF ausente ou inválido.`);
    L['03'].push(linhaAej('03', v.id, so(v.cpf), v.nome));
  }
  // horários contratuais: um código para cada desenho de jornada distinto
  const codigos = new Map();
  const codigoDe = (j) => {
    if (!j.segmentos?.length) return '';
    const chave = j.segmentos.map(([a, b]) => `${a}-${b}`).join(',');
    if (!codigos.has(chave)) {
      const cod = String(codigos.size + 1).padStart(3, '0');
      codigos.set(chave, cod);
      L['04'].push(linhaAej('04', cod, Math.round(j.previsto ?? j.segmentos.reduce((s, [a, b]) => s + b - a, 0)), ...j.segmentos.flatMap(([a, b]) => [hhmm(a), hhmm(b)])));
    }
    return codigos.get(chave);
  };
  for (const j of [...jornadas].sort((a, b) => `${a.vinculo}|${a.data}`.localeCompare(`${b.vinculo}|${b.data}`))) {
    const cod = codigoDe(j);
    for (const m of j.marcacoes || []) L['05'].push(linhaAej('05', j.vinculo, m.data_hora, m.rep || '1', m.tipo, m.seq ?? '', m.fonte || 'O', m.tipo === 'D' ? '' : cod, m.motivo || ''));
  }
  for (const v of vinculos) if (String(v.matricula || '').trim()) L['06'].push(linhaAej('06', v.id, v.matricula));
  for (const a of ausencias) L['07'].push(linhaAej('07', a.vinculo, a.tipo, a.data, Math.round(Number(a.minutos) || 0), a.tipo === AUSENCIA_AEJ.banco ? (a.movimento || (Number(a.minutos) < 0 ? '2' : '1')) : ''));
  L['08'].push(linhaAej('08', programa.nome || PROGRAMA.nome, programa.versao || PROGRAMA.versao, so(dev.documento) ? tipoDocumento(dev.documento, dev.tipo) : '', so(dev.documento), dev.razao || '', dev.email || ''));
  const tipos = ['01', '02', '03', '04', '05', '06', '07', '08'];
  const totais = Object.fromEntries(tipos.map((t) => [t, L[t].length]));
  const linhas = [...tipos.flatMap((t) => L[t]), linhaAej('99', ...tipos.map((t) => totais[t]))];
  const texto = `${linhas.join('\r\n')}\r\n`;
  return { texto, bytes: latin1(texto), nome: `AEJ_${so(empregador.documento)}_${String(de || '').replace(/-/g, '')}_${String(ate || '').replace(/-/g, '')}.txt`, totais, avisos };
}
/** Confere a estrutura do AEJ: campos por registro, ordem dos tipos e o trailer 99. */
export const CAMPOS_AEJ = Object.freeze({ '01': 10, '02': 4, '03': 4, '05': 9, '06': 3, '07': 6, '08': 7 });
export function conferirAej(texto) {
  const erros = [], conta = {};
  const ls = String(texto || '').split(/\r?\n/).filter(Boolean);
  let ultimo = '00', trailer = null;
  ls.forEach((l, i) => {
    const c = l.split('|'), t = c[0];
    if (t === '99') { trailer = c; return; }
    if (t < ultimo) erros.push(`Linha ${i + 1}: registro ${t} depois do ${ultimo}.`);
    ultimo = t; conta[t] = (conta[t] || 0) + 1;
    if (CAMPOS_AEJ[t] && c.length !== CAMPOS_AEJ[t]) erros.push(`Linha ${i + 1} (registro ${t}): ${c.length} campos, esperados ${CAMPOS_AEJ[t]}.`);
    if (t === '04' && (c.length < 5 || (c.length - 3) % 2)) erros.push(`Linha ${i + 1} (registro 04): pares de entrada e saída incompletos.`);
  });
  if (!trailer) erros.push('Sem o trailer (99).');
  else ['01', '02', '03', '04', '05', '06', '07', '08'].forEach((t, k) => { if (Number(trailer[k + 1]) !== (conta[t] || 0)) erros.push(`Trailer: ${trailer[k + 1]} registro(s) ${t}, o arquivo tem ${conta[t] || 0}.`); });
  if ((conta['01'] || 0) !== 1) erros.push('O AEJ precisa de um registro 01.');
  return { ok: !erros.length, erros, totais: conta };
}

// ───────────────────────── comprovante do trabalhador ─────────────────────────
/**
 * Comprovante de registro de ponto do trabalhador (REP-P): título, empregador (nome, CNPJ/CPF e CNO/CAEPF), local, o
 * número do REP-P (registro no INPI), o trabalhador (nome e CPF), data e hora da marcação com o fuso, NSR e o SHA-256.
 * Devolve as linhas (o portal mostra, imprime e baixa). Conferir no art. 79/80 e no Anexo da Portaria os campos e o
 * formato (o REP-P entrega o comprovante em meio eletrônico; o PDF assinado é o passo seguinte — conferir).
 */
export function comprovante({ empregador = {}, rep = {}, trabalhador = {}, marcacao = {}, fuso = FUSO_PADRAO } = {}) {
  const inpi = String(rep.inpi ?? PROGRAMA.inpi ?? '').trim();
  const dh = marcacao.marcado_em ? dataHoraAfd(marcacao.marcado_em, fuso) : '';
  const linhas = [
    'COMPROVANTE DE REGISTRO DE PONTO DO TRABALHADOR',
    `Empregador: ${latin1Texto(empregador.razao || '')}`,
    `${tipoDocumento(empregador.documento, empregador.tipo_doc) === '2' ? 'CPF' : 'CNPJ'}: ${cnpjFormatado(empregador.documento)}${so(empregador.cno_caepf) ? ` · CNO/CAEPF: ${so(empregador.cno_caepf)}` : ''}`,
  ];
  if (empregador.local) linhas.push(`Local: ${latin1Texto(empregador.local)}`);
  linhas.push(`REP-P: ${PROGRAMA.nome} ${PROGRAMA.versao} · registro INPI ${inpi || '(pendente)'}`,
    `Trabalhador: ${latin1Texto(trabalhador.nome || '')}`,
    `CPF: ${so(trabalhador.cpf) ? cpfFormatado(trabalhador.cpf) : '(não cadastrado)'}`,
    `Data: ${dh ? `${dh.slice(8, 10)}/${dh.slice(5, 7)}/${dh.slice(0, 4)}` : ''} · Hora: ${dh.slice(11, 16)} (UTC${dh.slice(19, 22)}:${dh.slice(22, 24)})`,
    `NSR: ${num(marcacao.nsr, 9)}`);
  if (marcacao.hash) linhas.push(`SHA-256: ${marcacao.hash}`);
  return linhas;
}

// ───────────────────────── assinatura CAdES destacada (.p7s) ─────────────────────────
// DER mínimo (o necessário para o SignedData do CMS, RFC 5652, e os atributos do CAdES-BES, ETSI EN 319 122).
const concat = (...ps) => { const n = ps.reduce((s, p) => s + p.length, 0), o = new Uint8Array(n); let i = 0; for (const p of ps) { o.set(p, i); i += p.length; } return o; };
const tamanhoDer = (n) => { if (n < 128) return Uint8Array.of(n); const b = []; while (n > 0) { b.unshift(n & 0xff); n = Math.floor(n / 256); } return Uint8Array.of(0x80 | b.length, ...b); };
export const der = (tag, ...partes) => { const c = concat(...partes); return concat(Uint8Array.of(tag), tamanhoDer(c.length), c); };
const seq = (...p) => der(0x30, ...p), set = (...p) => der(0x31, ...p), octet = (b) => der(0x04, b), nulo = () => Uint8Array.of(0x05, 0x00);
const inteiro = (n) => der(0x02, Uint8Array.of(n));
export function oid(texto) {
  const p = texto.split('.').map(Number), b = [40 * p[0] + p[1]];
  for (const v of p.slice(2)) { const t = [v & 0x7f]; let x = Math.floor(v / 128); while (x > 0) { t.unshift(0x80 | (x & 0x7f)); x = Math.floor(x / 128); } b.push(...t); }
  return der(0x06, Uint8Array.from(b));
}
const utcTime = (d) => { const x = new Date(d), s = `${String(x.getUTCFullYear()).slice(2)}${dois(x.getUTCMonth() + 1)}${dois(x.getUTCDate())}${dois(x.getUTCHours())}${dois(x.getUTCMinutes())}${dois(x.getUTCSeconds())}Z`; return der(0x17, latin1(s)); };
export const OID = Object.freeze({ data: '1.2.840.113549.1.7.1', signedData: '1.2.840.113549.1.7.2', sha256: '2.16.840.1.101.3.4.2.1', rsa: '1.2.840.113549.1.1.1', sha256Rsa: '1.2.840.113549.1.1.11',
  contentType: '1.2.840.113549.1.9.3', messageDigest: '1.2.840.113549.1.9.4', signingTime: '1.2.840.113549.1.9.5', signingCertificateV2: '1.2.840.113549.1.9.16.2.47', sigPolicyId: '1.2.840.113549.1.9.16.2.15' });

/** Leitor DER: { tag, inicio, fim, cabecalho } do elemento na posição. */
export function lerDer(b, p = 0) {
  const tag = b[p]; let n = b[p + 1], h = 2;
  if (n & 0x80) { const k = n & 0x7f; n = 0; for (let i = 0; i < k; i++) n = n * 256 + b[p + 2 + i]; h = 2 + k; }
  return { tag, inicio: p, cabecalho: h, fim: p + h + n, conteudo: p + h };
}
const filhos = (b, el) => { const out = []; let p = el.conteudo; while (p < el.fim) { const f = lerDer(b, p); out.push(f); p = f.fim; } return out; };
/** Emissor (Name, DER) e número de série (INTEGER, DER) do certificado X.509 (DER). */
export function emissorESerie(certDer) {
  const c = lerDer(certDer, 0), tbs = filhos(certDer, c)[0], f = filhos(certDer, tbs);
  const i = f[0].tag === 0xa0 ? 1 : 0; // versão explícita [0]
  return { serie: certDer.slice(f[i].inicio, f[i].fim), emissor: certDer.slice(f[i + 2].inicio, f[i + 2].fim) };
}
/** Atributos assinados do CAdES-BES (DER do SET, ordenado como manda o DER). */
export function atributosAssinados({ conteudo, certDer, horario = new Date(), politica = null }) {
  const { serie, emissor } = emissorESerie(certDer);
  const essCertIdV2 = seq(octet(sha256Bytes(certDer)), seq(seq(der(0xa4, emissor)), serie)); // hashAlgorithm omitido = SHA-256
  const attrs = [
    seq(oid(OID.contentType), set(oid(OID.data))),
    seq(oid(OID.signingTime), set(utcTime(horario))),
    seq(oid(OID.messageDigest), set(octet(sha256Bytes(conteudo)))),
    seq(oid(OID.signingCertificateV2), set(seq(seq(essCertIdV2)))),
  ];
  // Política de assinatura ICP-Brasil (AD-RB): { oid, hash (bytes do SHA-256 do documento da política), uri? } — conferir.
  if (politica?.oid && politica?.hash) attrs.push(seq(oid(OID.sigPolicyId), set(seq(oid(politica.oid), seq(seq(oid(OID.sha256)), octet(politica.hash)), ...(politica.uri ? [seq(seq(oid('1.2.840.113549.1.9.16.5.1'), der(0x16, latin1(politica.uri))))] : [])))));
  attrs.sort((a, b) => { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length; });
  return set(...attrs);
}
/**
 * Monta a assinatura CAdES-BES destacada (.p7s, DER) do conteúdo.
 *  conteudo: bytes do arquivo (AFD ou AEJ, ISO-8859-1) · certDer: certificado do signatário (DER) · cadeia: [DER] ·
 *  assinar(bytes) → Promise<Uint8Array>: RSA PKCS#1 v1.5 com SHA-256 sobre os atributos assinados (a chave do
 *  certificado ICP-Brasil do empregador fica com quem chama: WebCrypto, node:crypto ou forge).
 */
export async function assinaturaDestacada({ conteudo, certDer, cadeia = [], assinar, horario = new Date(), politica = null }) {
  if (typeof assinar !== 'function') throw new Error('Sem a função de assinatura (chave do certificado).');
  const attrs = atributosAssinados({ conteudo, certDer, horario, politica });
  const assinatura = await assinar(attrs);
  const { serie, emissor } = emissorESerie(certDer);
  const signerInfo = seq(inteiro(1), seq(emissor, serie), seq(oid(OID.sha256)), der(0xa0, attrs.slice(lerDer(attrs).cabecalho)), seq(oid(OID.rsa), nulo()), octet(new Uint8Array(assinatura)));
  const certs = [certDer, ...cadeia.filter((c) => hex(c) !== hex(certDer))];
  const signedData = seq(inteiro(1), set(seq(oid(OID.sha256))), seq(oid(OID.data)), der(0xa0, ...certs), set(signerInfo));
  return seq(oid(OID.signedData), der(0xa0, signedData));
}
/** Nome do .p7s destacado: o nome do arquivo assinado + ".p7s". */
export const nomeAssinatura = (nome) => `${nome}.p7s`;
