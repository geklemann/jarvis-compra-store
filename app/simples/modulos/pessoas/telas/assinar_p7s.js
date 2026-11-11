// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
// Assinatura eletrônica do AFD e do AEJ com o certificado ICP-Brasil A1 (.pfx/.p12) do empregador, no próprio navegador
// (Portaria 671/2021: assinatura CAdES destacada, arquivo .p7s ao lado do .txt). O arquivo e a senha do certificado
// NUNCA saem do aparelho: a biblioteca node-forge (carregada do cdnjs, com o jsDelivr de reserva) só abre o .pfx; o
// SignedData do CMS é montado pelo motor (rep_p.js › assinaturaDestacada). Certificado A3 (token/cartão) não abre no
// navegador: assine o .txt baixado no assinador ICP-Brasil do certificado (ex.: Assinador SERPRO), gerando o .p7s
// destacado — passo a passo em docs/ponto/CONFORMIDADE-671.md. Usado pelo Jarvis ERP e pelo Jarvis E-Commerce.
import * as REP from '../../../motor/rep_p.js';

const FONTES = ['https://cdnjs.cloudflare.com/ajax/libs/forge/1.3.1/forge.min.js', 'https://cdn.jsdelivr.net/npm/node-forge@1.3.1/dist/forge.min.js'];
const script = (src) => new Promise((ok, er) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => { s.remove(); er(new Error(src)); }; document.head.append(s); });
export async function carregarForge() {
  if (globalThis.forge?.pkcs12) return globalThis.forge;
  for (const f of FONTES) { try { await script(f); if (globalThis.forge?.pkcs12) return globalThis.forge; } catch { /* tenta a próxima */ } }
  throw new Error('Não foi possível carregar a biblioteca do certificado (sem internet?).');
}
const binario = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return s; };
const bytes = (bin) => Uint8Array.from(bin, (c) => c.charCodeAt(0));

/** Abre o certificado A1: { titular, validade, certDer, cadeia, assinar(bytes) }. Senha errada → erro em português. */
export async function abrirCertificado(pfx, senha) {
  const forge = await carregarForge();
  let p12;
  try { p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(binario(new Uint8Array(pfx))), false, String(senha ?? '')); }
  catch { throw new Error('Não foi possível abrir o certificado: confira o arquivo (.pfx ou .p12) e a senha.'); }
  const sacos = (t) => p12.getBags({ bagType: t })[t] || [];
  const chave = (sacos(forge.pki.oids.pkcs8ShroudedKeyBag)[0] || sacos(forge.pki.oids.keyBag)[0])?.key;
  const certs = sacos(forge.pki.oids.certBag).map((x) => x.cert).filter(Boolean);
  if (!chave || !certs.length) throw new Error('O arquivo não tem a chave e o certificado (use o A1 exportado com a chave privada).');
  const folha = certs.find((c) => c.publicKey?.n?.equals?.(chave.n)) || certs[0];
  const der = (c) => bytes(forge.asn1.toDer(forge.pki.certificateToAsn1(c)).getBytes());
  const validade = folha.validity.notAfter;
  if (validade < new Date()) throw new Error(`Certificado vencido em ${validade.toLocaleDateString('pt-BR')}.`);
  return {
    titular: folha.subject.getField('CN')?.value || '', validade, certDer: der(folha), cadeia: certs.filter((c) => c !== folha).map(der),
    assinar: async (dados) => { const md = forge.md.sha256.create(); md.update(binario(dados)); return bytes(chave.sign(md)); },
  };
}
/** Assina o arquivo (bytes ISO-8859-1 do AFD/AEJ): devolve { p7s (bytes DER), titular, validade }. */
export async function assinarArquivo({ conteudo, pfx, senha }) {
  const c = await abrirCertificado(pfx, senha);
  const p7s = await REP.assinaturaDestacada({ conteudo, certDer: c.certDer, cadeia: c.cadeia, assinar: c.assinar });
  return { p7s, titular: c.titular, validade: c.validade };
}
/** Baixa bytes como arquivo. */
export function baixarBytes(nome, dados, tipo = 'application/octet-stream') {
  if (typeof document === 'undefined' || typeof URL?.createObjectURL !== 'function') return false;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([dados], { type: tipo }));
  a.download = nome;
  document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  return true;
}
