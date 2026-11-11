// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
// Autoria e direitos autorais do Jarvis num lugar só (ES module, sem dependências). Os produtos leem daqui o aviso que
// mostram (os apps em ES modules pela casca, via comum/nucleo.js; o Jarvis E-Commerce pela
// cópia clássica web/autoria-classico.js, que testes/autoria.test.mjs confere letra a letra com este arquivo), e o site
// (site/gerar.mjs) lê as metas e o rodapé. O BLOCO é o mesmo de LICENSE e AUTORIA.md; o resumo SHA-256 dele é conferido
// em vários pontos independentes (lista em AUTORIA.md › "Onde a autoria é conferida"). Não remova nem altere.

/** O bloco canônico (o mesmo texto, linha a linha, em LICENSE e AUTORIA.md). */
const BLOCO = [
  'TITULAR: GK Soluções Empresariais LTDA',
  'CNPJ: 60.180.675/0001-91',
  'AUTORIA: GK Soluções Empresariais LTDA',
  'ANO: 2026',
  'PROGRAMA: Jarvis (Jarvis E-Commerce)',
  'DIREITOS: Todos os direitos reservados (Lei 9.609/1998 e Lei 9.610/1998)',
].join('\n');

export const AUTORIA = Object.freeze({
  titular: 'GK Soluções Empresariais LTDA',
  cnpj: '60.180.675/0001-91',
  autor: 'GK Soluções Empresariais LTDA',
  ano: 2026,
  programa: 'Jarvis',
  produtos: Object.freeze(['Jarvis E-Commerce']),
  aviso: '© 2026 GK Soluções Empresariais LTDA · Todos os direitos reservados',
  licenca: 'Software proprietário. Todos os direitos reservados (Lei 9.609/1998 e Lei 9.610/1998). Veja LICENSE e AUTORIA.md.',
  site: 'https://jaarvis.com.br/',
  // 'JARVIS-GK-' + os 16 primeiros caracteres (maiúsculos) do SHA-256 do BLOCO.
  impressao: 'JARVIS-GK-ED98E5BE0B2D28CA',
  bloco: BLOCO,
});

/** Texto das metas author e copyright. */
export const METAS = Object.freeze({ author: AUTORIA.titular, copyright: AUTORIA.aviso });

/**
 * Registra a autoria na página: define <meta name="author"> e <meta name="copyright"> quando faltarem e escreve uma
 * linha no console (uma vez por página). Tolerante: sem document (Node, testes) só devolve o objeto.
 */
export function registrarAutoria({ documento = globalThis.document, saida = globalThis.console } = {}) {
  try {
    const head = documento?.head;
    if (head && typeof documento.createElement === 'function') {
      for (const [nome, conteudo] of Object.entries(METAS)) {
        if (documento.querySelector?.(`meta[name="${nome}"]`)) continue;
        const m = documento.createElement('meta');
        m.setAttribute('name', nome);
        m.setAttribute('content', conteudo);
        head.appendChild(m);
      }
    }
    if (!globalThis.JarvisAutoria) {
      try { Object.defineProperty(globalThis, 'JarvisAutoria', { value: AUTORIA, enumerable: false }); } catch { /* já definido */ }
      if (documento?.head) saida?.info?.(`Jarvis · ${AUTORIA.aviso} · CNPJ ${AUTORIA.cnpj} · ${AUTORIA.impressao}`);
    }
  } catch { /* nunca atrapalha a abertura */ }
  return AUTORIA;
}

export default AUTORIA;
