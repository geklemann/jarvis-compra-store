// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
// Senhas vazadas (comum a todos os produtos do Jarvis) pelo Pwned Passwords (gratuito, sem chave), com k-anonimato: a
// senha vira o resumo SHA-1 NO NAVEGADOR e só os 5 primeiros caracteres do resumo saem; a lista que volta (com os finais
// dos resumos vazados e quantas vezes cada um apareceu) é comparada aqui. A senha e o resumo inteiro nunca saem do
// aparelho. Usado ao criar ou trocar a senha em todos os apps (entrada dos apps em ES modules, Minha conta do ERP com a
// política da empresa em Regras de acesso e senha, Segurança da conta e cadastro do E-Commerce). Sem rede (a API fora do
// ar), não trava: avisa e segue. Puro com a rede e o SHA-1 injetáveis: testado em testes/senhas_vazadas.test.mjs.

export const API_PWNED = 'https://api.pwnedpasswords.com/range/';

/** O SHA-1 do texto, em hexadecimal maiúsculo (crypto.subtle do navegador, do Node ou do Deno). */
export async function sha1Hex(texto, subtle = globalThis.crypto?.subtle) {
  if (!subtle) throw new Error('Este navegador não calcula o resumo da senha.');
  const b = await subtle.digest('SHA-1', new TextEncoder().encode(String(texto)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}
/** O que sai (os 5 primeiros) e o que fica (o resto) do resumo. */
export const dividir = (hash) => ({ prefixo: String(hash).slice(0, 5).toUpperCase(), sufixo: String(hash).slice(5).toUpperCase() });

/** Quantas vezes o sufixo aparece na resposta do intervalo ("SUFIXO:N" por linha; o preenchimento vem com N = 0). */
export function contarNoIntervalo(resposta, sufixo) {
  const alvo = String(sufixo).toUpperCase();
  for (const linha of String(resposta || '').split(/\r?\n/)) {
    const [s, n] = linha.trim().split(':');
    if (s && s.toUpperCase() === alvo) return Number(n) || 0;
  }
  return 0;
}

/** As políticas: padrão (bloqueia a muito vazada, avisa a pouco vazada), bloquear (qualquer vazada) e avisar (só avisa). */
export const POLITICAS = Object.freeze({
  padrao: 'Bloqueia a senha que apareceu 100 vezes ou mais em vazamentos e avisa nas outras vazadas',
  bloquear: 'Bloqueia qualquer senha que já apareceu em vazamento',
  avisar: 'Só avisa: a pessoa decide se usa a senha vazada',
});
/** A decisão pela contagem: { nivel: 'ok'|'aviso'|'bloqueio', mensagem }. */
export function decidir(vezes, politica = 'padrao') {
  const n = Number(vezes) || 0;
  if (n <= 0) return { nivel: 'ok', vezes: 0, mensagem: 'Esta senha não aparece nos vazamentos conhecidos.' };
  const txt = n === 1 ? 'uma vez' : `${n.toLocaleString('pt-BR')} vezes`;
  const bloqueia = politica === 'bloquear' || (politica !== 'avisar' && n >= 100);
  return bloqueia
    ? { nivel: 'bloqueio', vezes: n, mensagem: `Esta senha já apareceu ${txt} em vazamentos de dados. Escolha outra: quem ataca contas testa primeiro as senhas vazadas.` }
    : { nivel: 'aviso', vezes: n, mensagem: `Atenção: esta senha já apareceu ${txt} em vazamentos de dados. O recomendado é escolher outra.` };
}

/**
 * Confere a senha: { nivel: 'ok'|'aviso'|'bloqueio'|'indisponivel', vezes, mensagem, prefixo }. Só o `prefixo` sai pela
 * rede (o teste confere a URL). `fetch` e `subtle` vêm do ambiente; `prazoMs` limita a espera (a pessoa não fica presa).
 */
export async function verificarSenha(senha, { politica = 'padrao', fetch: buscar = globalThis.fetch, subtle = globalThis.crypto?.subtle, prazoMs = 4000 } = {}) {
  if (!senha) return { nivel: 'ok', vezes: 0, mensagem: '' };
  let prefixo;
  try {
    const { prefixo: p, sufixo } = dividir(await sha1Hex(senha, subtle));
    prefixo = p;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctrl ? setTimeout(() => ctrl.abort(), prazoMs) : null;
    let r;
    try { r = await buscar(`${API_PWNED}${p}`, { headers: { 'Add-Padding': 'true' }, signal: ctrl?.signal, cache: 'no-store', referrerPolicy: 'no-referrer' }); } finally { if (t) clearTimeout(t); }
    if (!r?.ok) throw new Error(`HTTP ${r?.status}`);
    return { ...decidir(contarNoIntervalo(await r.text(), sufixo), politica), prefixo };
  } catch {
    return { nivel: 'indisponivel', vezes: null, prefixo, mensagem: 'Não foi possível conferir agora se a senha já vazou (a consulta não respondeu). Você pode seguir.' };
  }
}

/** Força da senha, simples e explicável (tamanho e variedade): 0 a 4 e o que falta. */
export function forca(senha) {
  const s = String(senha || '');
  const tipos = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(s)).length;
  let n = s.length >= 16 ? 3 : s.length >= 12 ? 2 : s.length >= 10 ? 1 : 0;
  if (tipos >= 3) n += 1;
  if (/^(.)\1+$/.test(s) || /^(?:0123|1234|abcd|qwer|senha|password)/i.test(s)) n = 0;
  const falta = [];
  if (s.length < 12) falta.push('12 caracteres ou mais (uma frase curta serve)');
  if (tipos < 3) falta.push('misturar letras, números e símbolos');
  return { nivel: Math.min(4, n), falta };
}

/**
 * A conferência da senha NOVA nas telas do Jarvis (criar a conta, trocar a senha): { segue, mensagem, aviso, marca }.
 * Bloqueio: não segue. Aviso: não segue na primeira vez (mostra o aviso); se a pessoa insistir com a MESMA senha
 * (`jaAvisada` = a marca devolvida antes, o prefixo do resumo — nunca a senha), segue. Indisponível: segue.
 */
export async function conferirSenhaNova(senha, { politica = 'padrao', jaAvisada = null, ...opcoes } = {}) {
  const r = await verificarSenha(senha, { politica, ...opcoes });
  const marca = r.prefixo && r.vezes != null ? `${r.prefixo}:${r.vezes}` : null;
  if (r.nivel === 'bloqueio') return { segue: false, mensagem: r.mensagem, aviso: false, marca };
  if (r.nivel === 'aviso') return marca && marca === jaAvisada ? { segue: true, mensagem: '', aviso: true, marca } : { segue: false, mensagem: `${r.mensagem} Para usar mesmo assim, confirme de novo.`, aviso: true, marca };
  return { segue: true, mensagem: r.nivel === 'indisponivel' ? r.mensagem : '', aviso: false, marca };
}
