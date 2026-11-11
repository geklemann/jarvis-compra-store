// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Licença da instância (trava 4, docs/seguranca/PROTECAO-DO-CODIGO.md). Só age numa instância (quando o build embute a
// chave pública da licença no config): confere a licença na função `licenca` do projeto da GK, com a resposta ASSINADA
// (ECDSA P-256) e verificada aqui com a chave pública embutida no build. No site da GK e em modo local, fica inerte.
//   • Tolerância: se a GK não responder, o app funciona por 15 dias (do último "ok" guardado) e depois mostra só um aviso.
//   • Revogada/suspensa/inválida: aviso claro e o app para de abrir TELAS NOVAS (hashchange barrado). Nada é apagado.
//   • Aviso de alteração: compara o hash de alguns arquivos críticos com o manifesto do build (manifest-hashes.json) e,
//     se mudaram fora do fluxo do repositório, avisa a GK (evento de alteração). Build legítimo do repo = manifesto novo.
(function () {
  var cfg = (typeof window !== 'undefined' && window.CONCILIA_CONFIG) || {};
  var inst = cfg.instancia, pub = cfg.licenca_publica, base = cfg.supabaseUrl, key = cfg.supabaseAnonKey;
  if (!inst || !inst.id || !pub || !base) return; // site da GK, modo local ou rascunho: nada a fazer
  var TOLERANCIA_DIAS = 15, CHAVE = 'jarvis-licenca-' + inst.id;
  var CRITICOS = ['app/index.html', 'app.js', 'cloud.js', 'erp.js', 'trava-local.js', 'licenca.js', 'config.js'];

  function lerCache() { try { return JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { return null; } }
  function gravarCache(v) { try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch (e) {} }
  function diasDesde(iso) { return (Date.now() - new Date(iso).getTime()) / 864e5; }

  function aviso(titulo, texto, bloquear) {
    try {
      var d = document, id = 'jarvis-licenca-aviso';
      var el = d.getElementById(id);
      if (!el) { el = d.createElement('div'); el.id = id; el.setAttribute('role', 'alert'); (d.body || d.documentElement).appendChild(el); }
      el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483646;background:' + (bloquear ? '#b42318' : '#9a6700') + ';color:#fff;padding:10px 16px;font:600 13px/1.4 system-ui,sans-serif;text-align:center;box-shadow:0 -2px 10px rgb(0 0 0 / 30%)';
      el.innerHTML = '<b>' + titulo + '</b> ' + texto;
    } catch (e) {}
  }

  // Bloqueio "não abre telas novas": barra a troca de hash (rota) e mantém onde está. Nada é apagado.
  var bloqueado = false;
  function bloquear() {
    if (bloqueado) return; bloqueado = true;
    window.__jarvisLicencaBloqueada = true;
    try {
      var travarHash = function () { try { if (bloqueado && location.hash && location.hash !== '#' ) { history.replaceState(null, '', location.pathname + location.search); } } catch (e) {} };
      window.addEventListener('hashchange', travarHash, true);
    } catch (e) {}
  }

  async function verificarAssinatura(payload, assinaturaB64) {
    try {
      var spki = Uint8Array.from(atob(pub), function (c) { return c.charCodeAt(0); });
      var chave = await crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      var sig = Uint8Array.from(atob(assinaturaB64), function (c) { return c.charCodeAt(0); });
      var dados = new TextEncoder().encode(JSON.stringify(payload));
      return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, chave, sig, dados);
    } catch (e) { return false; }
  }

  async function sha256Hex(buf) {
    var h = await crypto.subtle.digest('SHA-256', buf);
    return [].map.call(new Uint8Array(h), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  // Compara os arquivos críticos com o manifesto do build. Devolve { id, alteracoes }.
  async function conferirManifesto() {
    try {
      var r = await fetch('manifest-hashes.json?cache=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return { id: '', alteracoes: [] };
      var man = await r.json();
      var esperados = (man && man.arquivos) || {};
      var alteracoes = [];
      for (var i = 0; i < CRITICOS.length; i++) {
        var arq = CRITICOS[i], esp = esperados[arq];
        if (!esp) continue;
        try {
          var rr = await fetch(arq + '?cache=' + Date.now(), { cache: 'no-store' });
          if (!rr.ok) continue;
          var achado = await sha256Hex(await rr.arrayBuffer());
          if (achado !== esp) alteracoes.push({ arquivo: arq, esperado: esp, achado: achado });
        } catch (e) {}
      }
      return { id: (man && man.id) || '', alteracoes: alteracoes };
    } catch (e) { return { id: '', alteracoes: [] }; }
  }

  function aplicarStatus(status) {
    if (status === 'revogada' || status === 'suspensa') {
      bloquear();
      aviso('Licença ' + (status === 'revogada' ? 'revogada' : 'suspensa') + '.', 'Fale com o Jarvis (GK Soluções Empresariais) para regularizar. Seus dados estão preservados.', true);
    } else if (status === 'desconhecida') {
      aviso('Licença não encontrada.', 'Esta instância não tem licença ativa registrada no Jarvis. Fale com a GK.', false);
    }
  }

  async function verificar() {
    var man = await conferirManifesto();
    var corpo = { instancia: inst.id, dominio: inst.dominio || (typeof location !== 'undefined' ? location.hostname : ''), manifesto_id: man.id, alteracoes: man.alteracoes };
    var r = await fetch(base + '/functions/v1/licenca', {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: 'Bearer ' + key }, body: JSON.stringify(corpo),
    });
    if (!r.ok) throw new Error('sem resposta');
    var j = await r.json();
    if (!j || !j.payload || j.payload.instancia !== inst.id) throw new Error('resposta inválida');
    var ok = await verificarAssinatura(j.payload, j.assinatura);
    if (!ok) throw new Error('assinatura inválida');
    gravarCache({ status: j.payload.status, verificadoEm: new Date().toISOString() });
    aplicarStatus(j.payload.status);
    if (man.alteracoes.length) aviso('Arquivos alterados.', 'Alguns arquivos do app foram modificados fora do fluxo do repositório. A GK foi avisada.', false);
  }

  // Na carga: respeita a tolerância a partir do último "ok" guardado; depois reconfere em segundo plano.
  var cache = lerCache();
  if (cache && cache.status) aplicarStatus(cache.status);
  verificar().catch(function () {
    // GK não respondeu: dentro da tolerância, segue; passou de 15 dias sem confirmar, avisa (sem bloquear).
    if (!cache || !cache.verificadoEm) { aviso('Licença não confirmada.', 'Não foi possível confirmar a licença com o Jarvis. Verifique a conexão.', false); return; }
    if (diasDesde(cache.verificadoEm) > TOLERANCIA_DIAS) aviso('Licença não confirmada há mais de ' + TOLERANCIA_DIAS + ' dias.', 'Reconecte à internet para o Jarvis confirmar a licença desta instância.', false);
  });
})();
