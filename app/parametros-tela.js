// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Configurações › Parâmetros: a tela única que calibra os números do E-Commerce (decisão do dono em 19/11/2026). Mostra o
// catálogo de web/parametros-base.js por área — cada parâmetro com rótulo, unidade, ajuda, o padrão, a faixa aceita e
// "voltar ao padrão" (no item e na área) — e o histórico das mudanças (quem, quando, antes → depois), que fica no
// Histórico e auditoria (audit_log). Todas as telas leem daqui (Parametros.get); os canais de venda têm cadastro próprio
// (Cadastros › Canais de venda) e os dados da NF-e continuam em Fiscal › Regras fiscais.
(()=>{
const P=()=>window.Parametros;
const ui={g:'precos',busca:'',conf:null};
window.Reiniciar?.registrar(ui,['busca','conf']);
const v2=x=>String(x).replace('.',',');
const faixa=it=>it.tipo==='num'&&(it.min!=null||it.max!=null)?`de ${v2(it.min)} a ${v2(it.max)}${it.un?' '+esc(it.un):''}`:it.tipo==='lista'?`limites de ${v2(it.min)} a ${v2(it.max)}`:'';
const ACOES=['Parâmetro alterado','Parâmetro voltou ao padrão','Canal de venda alterado','Canal de venda incluído','Canal de venda removido','Canais de venda voltaram ao padrão','Regra de venda criada para o canal'];
const quem=a=>typeof quemFez==='function'?quemFez(a):(a.actor||'—');
function opcoes(it){if(it.ops==='regras'){const R=window.Preco?.regras?.().canais||{};return Object.keys(R).map(k=>[k,window.Preco.rotulo(k)])}return it.ops||[]}
function entrada(it){const v=P().get(it.k),k=esc(it.k);
 if(it.tipo==='bool')return `<label class="row" style="gap:6px;font-weight:400"><input type="checkbox" class="check" data-pa="${k}" ${v?'checked':''}> ${v?'ligado':'desligado'}</label>`;
 if(it.tipo==='sel')return `<select data-pa="${k}">${opcoes(it).map(([o,t])=>`<option value="${esc(o)}" ${o===v?'selected':''}>${esc(t)}</option>`).join('')}</select>`;
 if(it.tipo==='lista')return `<input class="pmin" style="width:150px" data-pa="${k}" value="${esc(v.join(', '))}" aria-label="${esc(it.t)}">`;
 if(it.tipo==='texto')return `<textarea data-pa="${k}" rows="${Math.min(6,v.length+1)}" style="min-width:150px" aria-label="${esc(it.t)}">${esc(v.join('\n'))}</textarea>`;
 if(it.tipo==='datas')return datas(it,v);
 return `<span class="row" style="gap:4px;justify-content:flex-end;flex-wrap:nowrap"><input class="pmin" style="width:90px" data-pa="${k}" value="${esc(v2(v))}" inputmode="decimal" aria-label="${esc(it.t)}">${it.un?`<span class="caption">${esc(it.un)}</span>`:''}</span>`}
function datas(it,l){const cel=(i,c,v,w=60,extra='')=>`<input class="pmin" style="width:${w}px" data-pa-data="${i}|${c}" value="${esc(v??'')}" ${extra}>`;
 return `<div class="tablewrap" style="margin:0"><table><thead><tr><th>Data</th><th class="num">Dia</th><th class="num">Mês</th><th class="num">Pico (dias antes)</th><th class="num">Fator</th><th>Dica</th><th></th></tr></thead><tbody>
 ${l.map((d,i)=>`<tr><td>${cel(i,'nome',d.nome,150)}</td>${d.regra==='blackfriday'?'<td colspan="2" class="caption">última sexta de novembro</td>':`<td class="num">${cel(i,'dia',d.dia,48,'inputmode="numeric"')}</td><td class="num">${cel(i,'mes',d.mes,48,'inputmode="numeric"')}</td>`}<td class="num">${cel(i,'pico',d.pico,56,'inputmode="numeric"')}</td><td class="num">${cel(i,'fator',v2(d.fator),56,'inputmode="decimal"')}</td><td>${cel(i,'dica',d.dica,220)}</td><td><button class="small quiet" data-pa-datadel="${i}" aria-label="Tirar ${esc(d.nome)}">×</button></td></tr>`).join('')}
 </tbody></table></div><button class="small" data-pa-dataadd="1" style="margin-top:8px">${icon('plus')} Nova data</button>`}
function linha(it){const meu=P().proprio(it.k),pad=P().padrao(it.k),bloco=it.tipo==='datas';
 const padTxt=it.tipo==='datas'?pad.map(d=>esc(d.nome)).join(', '):esc(P().fmt(it.k,pad));
 return bloco?`<tr><td colspan="4"><b>${esc(it.t)}</b>${meu?' <span class="badge info">alterado</span>':''}<br><span class="caption">${esc(it.ajuda)}</span><div style="margin-top:10px">${entrada(it)}</div><span class="caption">Padrão: ${padTxt}</span> ${meu?`<button class="fplink" data-pa-reset="${esc(it.k)}">voltar ao padrão</button>`:''}</td></tr>`
  :`<tr data-pa-linha="${esc(it.k)}"><td><b>${esc(it.t)}</b>${meu?' <span class="badge info">alterado</span>':''}${it.ajuda?`<br><span class="caption">${esc(it.ajuda)}</span>`:''}</td><td class="num">${entrada(it)}</td><td class="caption">${padTxt}${faixa(it)?`<br>${faixa(it)}`:''}</td><td>${meu?`<button class="small quiet" data-pa-reset="${esc(it.k)}">Voltar ao padrão</button>`:''}</td></tr>`}
const casa=(it,q)=>!q||normalized(it.t+' '+it.ajuda+' '+it.k+' '+(it.un||'')).includes(q);
function grupoHtml(g,q){const itens=g.itens.filter(it=>casa(it,q));if(!itens.length)return '';const n=g.itens.filter(it=>P().proprio(it.k)).length;
 return `<section class="tablebox"><div class="tabletop"><div><h2>${icon(g.ic)} ${esc(g.t)}</h2><p class="caption">${esc(g.d)}</p></div>${n?`<button class="small ${ui.conf===g.id?'danger':''}" data-pa-resetg="${esc(g.id)}">${ui.conf===g.id?`Confirmar: voltar ${n} ao padrão`:`Voltar a área ao padrão (${n})`}</button>`:'<span class="badge ok">tudo no padrão</span>'}</div>
 <div class="tablewrap"><table class="pmtab"><thead><tr><th>Parâmetro</th><th class="num">Valor da empresa</th><th>Padrão e faixa</th><th></th></tr></thead><tbody>${itens.map(linha).join('')}</tbody></table></div></section>`}
function historico(){const l=(db.audit||[]).filter(a=>ACOES.includes(a.action)).slice(0,40);
 return `<section class="tablebox"><div class="tabletop"><div><h2>${icon('clock')} Histórico das mudanças</h2><p class="caption">Quem mudou, quando e o valor de antes → o de agora. Também no Histórico e auditoria.</p></div></div>
 ${l.length?`<div class="tablewrap"><table><thead><tr><th>Quando</th><th>Quem</th><th>O quê</th></tr></thead><tbody>${l.map(a=>`<tr><td class="caption">${new Date(a.time).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</td><td>${esc(quem(a))}</td><td>${esc(a.action==='Parâmetro alterado'?'':a.action+' · ')}${esc(a.detail)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Nenhuma mudança ainda: tudo está nos valores de fábrica.</div>'}</section>`}
// O certificado digital da empresa (pedido do dono em 19/11/2026: nos Parâmetros, porque ele vai servir a mais coisas que a
// GNRE, como a emissão das notas). O quadro é o de web/gnre-certificado.js, o mesmo da aba Configuração do DIFAL e GNRE.
function certificadoHtml(){const D=window.Difal,C=window.GnreCertificado;
 if(!D||!C)return '<div class="empty">O certificado digital fica disponível com o módulo Fiscal.</div>';
 const d=D.diag?.();if(!d){D.carregarDiag?.().then(()=>{if(page==='ajustes'&&ui.g==='certificado')render()});}
 return `<section class="tablebox"><div class="tabletop"><div><h2>${icon('shield')} Certificado digital da empresa</h2><p class="caption">O e-CNPJ A1 da empresa, instalado uma vez para o Jarvis usar onde a lei pede o certificado: o envio das guias da GNRE (DIFAL e FCP), a emissão das notas pela Focus NFe (e as notas de compra da SEFAZ) e a captura de documentos. Em “Onde é usado”, a situação de cada um. O arquivo e a senha ficam só no cofre do banco.</p></div></div>
 ${d?C.html(d):'<div class="empty">Conferindo o certificado no servidor…</div>'}</section>`}
function view(){const G=P().GRUPOS,q=normalized(ui.busca),alt=G.reduce((s,g)=>s+g.itens.filter(it=>P().proprio(it.k)).length,0),tot=G.reduce((s,g)=>s+g.itens.length,0);
 const cert=!q&&ui.g==='certificado',g=G.find(x=>x.id===ui.g)||G[0],corpo=cert?certificadoHtml():q?G.map(x=>grupoHtml(x,q)).join('')||'<div class="empty">Nenhum parâmetro com essa palavra.</div>':grupoHtml(g,'');
 return `<div class="pfhero"><div><h2>Parâmetros</h2><p class="caption">Os números que calibram as contas do Jarvis: metas, janelas, limites dos alertas, prazos e regras de cada área. Cada um nasce com o padrão (o que o Jarvis sempre usou) e muda só quando a empresa muda aqui. Os canais de venda têm cadastro próprio; os dados da NF-e ficam em Regras fiscais.</p>
  <div class="row wrap" style="margin-top:10px"><input type="search" id="paBusca" name="paBusca" autocomplete="off" data-lpignore="true" data-1p-ignore placeholder="Procurar parâmetro…" value="${esc(ui.busca)}" style="max-width:280px"><button class="small" data-nav="canais">${icon('link')} Canais de venda</button><button class="small" data-nav="regrasvenda">${icon('tag')} Regras de venda</button><button class="small" data-nav="parametros">${icon('sliders')} Regras fiscais</button></div></div>
  <div class="pfprog"><strong>${alt}</strong><small>de ${tot} parâmetros mudados pela empresa</small><span class="bartrack"><i style="width:${tot?alt/tot*100:0}%"></i></span></div></div>
 <div class="pfgrid pagrid" style="margin-top:16px"><nav class="card pfnav">${G.map(x=>{const n=x.itens.filter(it=>P().proprio(it.k)).length;return `<button class="${!q&&!cert&&x.id===g.id?'active':''}" data-pa-g="${esc(x.id)}">${icon(x.ic)}<span>${esc(x.t)}</span>${n?`<em class="navcount">${n}</em>`:''}</button>`}).join('')}<button class="${cert?'active':''}" data-pa-g="certificado">${icon('shield')}<span>Certificado digital</span></button></nav>
 <div class="pfmain">${corpo}${historico()}</div></div>`}
// ─── Eventos ───
const gravar=(k,v)=>{const e=P().set(k,v);if(e){toast(e);render();return false}render();return true};
function lerDatas(){const it=P().item('sazonal.datas'),l=P().get('sazonal.datas');$$('[data-pa-data]').forEach(x=>{const [i,c]=x.dataset.paData.split('|');const d=l[Number(i)];if(!d)return;d[c]=['dia','mes','pico'].includes(c)?Number(x.value):c==='fator'?P().num(x.value):x.value});return it?l:[]}
document.addEventListener('change',e=>{const x=e.target;if(!x.closest)return;
 const a=x.closest('[data-pa]');if(a){const k=a.dataset.pa,it=P().item(k);gravar(k,it.tipo==='bool'?a.checked:it.tipo==='texto'?a.value.split('\n'):a.value);return}
 if(x.closest('[data-pa-data]')){gravar('sazonal.datas',lerDatas())}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-pa-g],[data-pa-reset],[data-pa-resetg],[data-pa-dataadd],[data-pa-datadel]');if(!b)return;const d=b.dataset;
 if(d.paG){ui.g=d.paG;ui.busca='';ui.conf=null;render();return}
 if(d.paReset){P().reset(d.paReset);toast('Voltou ao padrão.');render();return}
 if(d.paResetg){if(ui.conf!==d.paResetg){ui.conf=d.paResetg;render();return}ui.conf=null;const n=P().resetGrupo(d.paResetg);toast(`${n} parâmetro(s) de volta ao padrão.`);render();return}
 if(d.paDataadd){const l=lerDatas();l.push({id:'data'+Date.now().toString(36),nome:'Nova data',dia:15,mes:6,pico:14,fator:1.5,dica:''});gravar('sazonal.datas',l);return}
 if(d.paDatadel!=null){const l=lerDatas();l.splice(Number(d.paDatadel),1);if(!l.length)return toast('Fica pelo menos uma data (ou volte ao padrão).');gravar('sazonal.datas',l)}});
// só a digitação de quem está no campo vira busca: o navegador que preenche o e-mail salvo sozinho (por causa do campo de
// senha do certificado) não troca a tela nem puxa o cursor
document.addEventListener('input',e=>{const x=e.target;if(x.id!=='paBusca')return;if(document.activeElement!==x){x.value=ui.busca;return}ui.busca=x.value;const p=x.selectionStart;render();const n=document.getElementById('paBusca');if(n){n.focus();try{n.setSelectionRange(p,p)}catch{}}});
addPage('ajustes','sliders','Parâmetros',view,'Os números que calibram as contas: metas, janelas, limites dos alertas, prazos e regras de cada área, com o padrão, a faixa aceita e o histórico das mudanças.','',()=>{});
})();
