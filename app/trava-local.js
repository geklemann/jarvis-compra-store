// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Trava de endereço (trava 2, docs/seguranca/PROTECAO-DO-CODIGO.md): o Jarvis só roda nos endereços autorizados. Fora
// deles, mostra um aviso de cópia não autorizada e PARA de carregar — nada destrutivo (não apaga nem envia dados).
// Carregado por cada index.html de app, logo antes do app.js. A lista de endereços e a marca d'água vêm do build
// (ops/trava-build.mjs carimba os marcadores abaixo): a GK no _site, cada instância no build dela. Em desenvolvimento
// (fonte), a lista é a da GK. A verificação é reforçada, de forma independente, no núcleo comum das telas em ES modules
// (escritorio/comum/nucleo.js) e no E-Commerce clássico (erp.js) — tirar daqui não desliga as outras.
(function () {
  var HOSTS = ['jaarvis.com.br', 'www.jaarvis.com.br', 'localhost', '127.0.0.1']; // JARVIS_TRAVA_HOSTS
  var MARCA = ''; // JARVIS_MARCA
  // Contextos de desenvolvimento/teste tratados como permitidos, de forma explícita e segura: sem location, host vazio
  // (linkedom/jsdom), ou protocolo file:/about: (abrir o arquivo direto). A demonstração local roda em localhost/127.
  function contextoSeguro() {
    try {
      if (typeof location === 'undefined' || !location) return true;
      var p = String(location.protocol || '');
      if (p === 'file:' || p === 'about:' || p === 'blob:') return true;
      if (!location.hostname) return true;
      return false;
    } catch (e) { return true; }
  }
  function hostPermitido() {
    if (contextoSeguro()) return true;
    var h = String(location.hostname || '').toLowerCase();
    for (var i = 0; i < HOSTS.length; i++) if (h === HOSTS[i]) return true;
    return false;
  }
  var permitido = hostPermitido();
  // Exposto para as outras telas poderem olhar (mas elas têm a própria verificação, independente desta).
  try {
    Object.defineProperty(window, 'JARVIS_TRAVA', {
      value: Object.freeze({ hosts: HOSTS.slice(), marca: MARCA, permitido: permitido, hostPermitido: hostPermitido }),
      configurable: false, enumerable: false, writable: false,
    });
  } catch (e) { try { window.JARVIS_TRAVA = { hosts: HOSTS.slice(), marca: MARCA, permitido: permitido, hostPermitido: hostPermitido }; } catch (e2) {} }

  if (permitido) return;
  // Fora dos endereços autorizados: avisa e para. Nada destrutivo.
  window.__jarvisTravado = true;
  function barrar() {
    try {
      var d = document;
      if (d && d.getElementById && !d.getElementById('jarvis-trava-aviso')) {
        var box = d.createElement('div');
        box.id = 'jarvis-trava-aviso';
        box.setAttribute('role', 'alert');
        box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#0c0e13;color:#e5e7eb;display:flex;align-items:center;justify-content:center;padding:24px;font:500 15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;text-align:center';
        box.innerHTML = '<div style="max-width:520px"><div style="font-size:40px;line-height:1;margin-bottom:14px">⛔</div>' +
          '<h1 style="font-size:20px;margin:0 0 10px">Cópia não autorizada do Jarvis</h1>' +
          '<p style="margin:0 0 8px;color:#9aa4b2">Este sistema só pode ser executado nos endereços autorizados pela titular.</p>' +
          '<p style="margin:0;color:#6b7280;font-size:13px">© 2026 GK Soluções Empresariais LTDA · Todos os direitos reservados (Lei 9.609/1998 e 9.610/1998).</p></div>';
        if (d.body) { d.body.appendChild(box); } else { d.addEventListener('DOMContentLoaded', function () { d.body && d.body.appendChild(box); }); }
      }
    } catch (e) {}
  }
  barrar();
})();
