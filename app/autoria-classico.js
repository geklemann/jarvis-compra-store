// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
// Autoria do Jarvis para o Jarvis E-Commerce (web/app/index.html carrega scripts clássicos, sem ES modules): os MESMOS
// dados de web/autoria.js, em window.JarvisAutoria. testes/autoria.test.mjs confere que os dois batem campo a campo e
// testes/ambiente.mjs recusa carregar o E-Commerce sem ele. O rodapé da barra lateral (erp.js › shell) mostra o aviso.
(function () {
  var BLOCO = [
    'TITULAR: GK Soluções Empresariais LTDA',
    'CNPJ: 60.180.675/0001-91',
    'AUTORIA: GK Soluções Empresariais LTDA',
    'ANO: 2026',
    'PROGRAMA: Jarvis (Jarvis E-Commerce)',
    'DIREITOS: Todos os direitos reservados (Lei 9.609/1998 e Lei 9.610/1998)',
  ].join('\n');
  var A = Object.freeze({
    titular: 'GK Soluções Empresariais LTDA',
    cnpj: '60.180.675/0001-91',
    autor: 'GK Soluções Empresariais LTDA',
    ano: 2026,
    programa: 'Jarvis',
    produtos: Object.freeze(['Jarvis E-Commerce']),
    aviso: '© 2026 GK Soluções Empresariais LTDA · Todos os direitos reservados',
    licenca: 'Software proprietário. Todos os direitos reservados (Lei 9.609/1998 e Lei 9.610/1998). Veja LICENSE e AUTORIA.md.',
    site: 'https://jaarvis.com.br/',
    impressao: 'JARVIS-GK-ED98E5BE0B2D28CA',
    bloco: BLOCO,
  });
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  /** Linha discreta do rodapé da barra lateral. */
  var rodape = function () { return '<p class="side-autoria" title="' + esc(A.licenca) + '">' + esc(A.aviso) + '</p>'; };
  window.JarvisAutoria = A;
  window.JarvisAutoriaRodape = rodape;
  try {
    var d = window.document, h = d && d.head;
    if (h && typeof h.appendChild === 'function' && typeof d.querySelector === 'function') {
      [['author', A.titular], ['copyright', A.aviso]].forEach(function (p) {
        if (d.querySelector('meta[name="' + p[0] + '"]')) return;
        var m = d.createElement('meta'); m.setAttribute('name', p[0]); m.setAttribute('content', p[1]); h.appendChild(m);
      });
    }
    if (window.addEventListener) window.addEventListener('load', function () { if (window.console) console.info('Jarvis · ' + A.aviso + ' · CNPJ ' + A.cnpj + ' · ' + A.impressao); });
  } catch (e) { /* nunca atrapalha a abertura */ }
})();
