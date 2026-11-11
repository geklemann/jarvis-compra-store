// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Perfis de acesso: o banco já bloqueia leitura/gravação por área (RLS); aqui o menu mostra só o que cada
// perfil usa, e a troca de perfil de quem já está na equipe (só o administrador).
// Permissões por tela: o administrador pode liberar, pessoa a pessoa, cada menu e submenu (workspace_members.paginas).
(()=>{
window.PERFIS=[['member','Equipe completa'],['owner','Administrador'],['financeiro','Financeiro'],['contador','Contabilidade (escritório)'],['atendimento','Atendimento e CRM'],['estoque','Estoque e expedição']];
const MODULOS={owner:null,member:null,
 financeiro:['ini','atd','ven','est','imp','fin','orc','crm','cad','res','pre','rel'],
 contador:['ini','fin','fis','orc','cad','res','rel'],
 atendimento:['ini','atd','ven','crm','est'],
 estoque:['ini','atd','est','imp','ven']};
// Áreas de dados que cada módulo lê (para avisar quando uma tela liberada fica fora do que o perfil pode ver no banco).
const AREA={orc:'financeiro',ini:null,atd:'vendas',ven:'vendas',est:'estoque',imp:'estoque',fin:'financeiro',fis:'contabil',cx:null,crm:'vendas',cad:'config',res:'contabil',pre:'precos',pes:'financeiro',rel:'financeiro',ger:null};
const LE={owner:null,member:null,financeiro:['financeiro','contabil','vendas','precos','config','estoque'],contador:['contabil','config','financeiro','vendas','precos','estoque'],atendimento:['vendas','estoque','precos','config'],estoque:['estoque','vendas','precos','config']};
const SEMPRE=['suporte','mapa','central','bolso','resumo','comecar','plano','painel'];// ajuda, primeiros passos, plano e painel da TV ficam sempre disponíveis
const INICIO={contador:'parametros',atendimento:'atendimento',estoque:'estoque'};
const papel=()=>window.Cloud?.role||'owner';
const lista=()=>papel()==='owner'?null:(Array.isArray(window.Cloud?.paginas)?window.Cloud.paginas:null);
const menu=()=>window.ERP_MENU||{MODS:[],GERAL:[]};
function moduloDe(id){return menu().MODS.find(m=>m.grupos.some(([,l])=>l.includes(id)))?.id||(menu().GERAL.includes(id)?'ger':null)}
// Telas liberadas só para consulta (aviso no topo; o banco bloqueia a gravação nas áreas sem edição).
const leitura=()=>papel()==='owner'||!lista()?null:(Array.isArray(window.Cloud?.leitura)?window.Cloud.leitura:[]);
function somenteLeitura(id){const l=leitura();return !!l&&l.includes(id)}
function paginaVisivel(id){if(SEMPRE.includes(id))return true;const l=lista();if(l){if(l.includes(id)||(id==='precos'&&l.includes('formacao')))return true;const conh=window.Cloud?.telasConhecidas;if(Array.isArray(conh)&&!conh.includes(id)){const mid=moduloDe(id);return !!mid&&mid!=='ger'&&l.some(x=>moduloDe(x)===mid)}return false}return true} // tela criada depois da liberação aparece para quem já tem o módulo // Regras e simulador abre pela Formação de preço
function moduloVisivel(mid){const l=lista();if(l){const m=menu().MODS.find(x=>x.id===mid);return !!m&&m.grupos.some(([,ids])=>ids.some(i=>l.includes(i)))}const p=MODULOS[papel()];return !p||p.includes(mid)}
function inicio(){const l=lista();if(l){const pref=INICIO[papel()]||'resumo';return l.includes(pref)?pref:(l.find(i=>moduloDe(i))||'suporte')}return INICIO[papel()]||'resumo'}
// Telas que o perfil vê por padrão (sem lista personalizada).
function padrao(role){const p=MODULOS[role];return menu().MODS.filter(m=>!p||p.includes(m.id)).flatMap(m=>m.grupos.flatMap(([,l])=>l)).concat(role==='owner'?menu().GERAL:menu().GERAL.filter(g=>!['equipe','auditoria','integracoes'].includes(g)))}
window.Perfis={moduloVisivel,paginaVisivel,somenteLeitura,inicio,padrao,nome:()=>window.PERFIS.find(p=>p[0]===papel())?.[1]||papel()};

// ─────────── Janela de permissões (Equipe e acessos › Telas) ───────────
// Cada tela marcada é "Editar" ou "Só ver". Os dados liberados no banco saem das telas: a área principal de cada tela
// (ler ou gravar, conforme o nível) mais as áreas que o módulo só consulta. Cadastros (config) sempre para leitura.
const AREA_TELA={reconcile:'financeiro',pending:'financeiro',closing:'contabil',anuncios:'financeiro',metas:'financeiro',difal:'financeiro',nfrecebidas:'financeiro',catalogo:'estoque',cadprodutos:'estoque',margem:'precos',raiox:'precos',concorrencia:'precos',pedcompra:'estoque',compras:'financeiro',imppag:'financeiro'};
const LE_MODULO={atd:['estoque','precos'],ven:['vendas','financeiro','precos','estoque'],est:['vendas','precos'],imp:['estoque'],fin:['vendas','contabil','estoque'],orc:['vendas','contabil'],fis:['vendas','estoque','financeiro'],crm:['estoque'],cad:['estoque'],res:['vendas','financeiro','precos','estoque'],pre:['vendas','estoque'],rel:['vendas','contabil','estoque','precos']};
const NOME_AREA={vendas:'Vendas e atendimento',estoque:'Estoque e produtos',financeiro:'Financeiro e repasses',contabil:'Contabilidade e fiscal',precos:'Preços',config:'Cadastros'};
function areasDe(sel,leit){const a={config:'ler'},sobe=(k,v)=>{if(!k)return;if(v==='gravar'||!a[k])a[k]=v};
 for(const id of sel){const mid=moduloDe(id);if(!mid||mid==='ger')continue;sobe(AREA_TELA[id]||AREA[mid],leit.has(id)?'ler':'gravar');for(const x of LE_MODULO[mid]||[])sobe(x,'ler')}
 return a}
// Modelos prontos: módulo → 'e' (editar) ou 'v' (só ver). null = todos os módulos só para ver.
const MODELOS=[['atd','Atendimento',{atd:'e',crm:'v'}],['venatd','Vendas + Atendimento',{atd:'e',ven:'e',crm:'e'}],['venatdres','Vendas + Atendimento + Resultado',{atd:'e',ven:'e',crm:'e',res:'v'}],['fin','Financeiro',{fin:'e',orc:'e',ven:'v',rel:'v'}],['cont','Contabilidade',{res:'e',fis:'v',fin:'v',rel:'v'}],['est','Estoque e expedição',{est:'e',atd:'v',cad:'v'}],['ver','Só consulta (todos os módulos)',null]];
const titulo=id=>(typeof navItems!=='undefined'&&navItems.find(n=>n[0]===id)?.[2])||id;
const existe=i=>typeof navItems==='undefined'||navItems.some(n=>n[0]===i);
let edit=null,acessosEquipe=null;
async function abrirPermissoes(uid,email,role){let atual=null;try{const {data}=await Cloud.client.rpc('list_acessos',{ws:Cloud.ws});acessosEquipe=data||[];atual=acessosEquipe.find(r=>r.user_id===uid)||null}catch{acessosEquipe=[]}
 edit={uid,email,role,sel:new Set(atual?.paginas||padrao(role)),leit:new Set(atual?.leitura||[]),personalizado:!!atual?.paginas};desenhar()}
function aplicarModelo(k){const m=MODELOS.find(x=>x[0]===k);if(!m)return;const {MODS}=menu();edit.sel.clear();edit.leit.clear();
 for(const mod of MODS){const nivel=m[2]?m[2][mod.id]:'v';if(!nivel)continue;for(const [,l] of mod.grupos)for(const i of l){if(!existe(i))continue;edit.sel.add(i);if(nivel==='v')edit.leit.add(i)}}
 edit.personalizado=true;edit.modelo=m[1]}
function desenhar(){if(!edit)return;const {MODS,GERAL}=menu(),areas=areasDe(edit.sel,edit.leit);
 const tela=i=>{const on=edit.sel.has(i),ver=edit.leit.has(i);return `<div class="pm-tela ${on?'on':''}"><label><input type="checkbox" class="check" data-pm-tela="${esc(i)}" ${on?'checked':''}> ${esc(titulo(i))}</label>${on?`<select class="pm-nivel" data-pm-nivel="${esc(i)}" aria-label="Nível em ${esc(titulo(i))}"><option value="e" ${!ver?'selected':''}>Editar</option><option value="v" ${ver?'selected':''}>Só ver</option></select>`:''}</div>`};
 const grupoHtml=(t,ids)=>{ids=ids.filter(existe);if(!ids.length)return '';const n=ids.filter(i=>edit.sel.has(i)).length;
  return `<div class="pm-grupo"><label class="pm-sub"><input type="checkbox" class="check" data-pm-grupo="${esc(ids.join(','))}" ${n===ids.length?'checked':''} ${n&&n<ids.length?'data-meio="1"':''}> ${esc(t)}</label><div class="pm-telas">${ids.map(tela).join('')}</div></div>`};
 const modHtml=m=>{const ids=m.grupos.flatMap(([,l])=>l).filter(existe);if(!ids.length)return '';const n=ids.filter(i=>edit.sel.has(i)).length,ed=ids.filter(i=>edit.sel.has(i)&&!edit.leit.has(i)).length;
  return `<section class="pm-mod ${n?'tem':''}"><div class="pm-head"><label><input type="checkbox" class="check" data-pm-grupo="${esc(ids.join(','))}" ${n===ids.length?'checked':''} ${n&&n<ids.length?'data-meio="1"':''}> <strong>${esc(m.t)}</strong></label><span class="row" style="gap:8px"><span class="caption">${n}/${ids.length}${n?` · ${ed===n?'edita':ed?`edita ${ed}, só vê ${n-ed}`:'só vê'}`:''}</span>${n?`<select class="pm-nivel" data-pm-modnivel="${esc(ids.join(','))}" aria-label="Nível do módulo ${esc(m.t)}"><option value="">Nível do módulo…</option><option value="e">Editar tudo</option><option value="v">Só ver tudo</option></select>`:''}</span></div>${m.grupos.map(([t,l])=>grupoHtml(t,l)).join('')}</section>`};
 const outros=(acessosEquipe||[]).filter(r=>r.user_id!==edit.uid&&r.paginas),equipe=window.Integrations?.state?.team||[];
 modal(`Acesso de ${esc(edit.email)}`,`${edit.role==='owner'?`<div class="notice warnbox" style="margin-bottom:10px"><b>${esc(edit.email.split('@')[0])} é Administrador(a)</b> e vê tudo. Ao salvar uma liberação personalizada, o perfil passa para <b>Equipe completa</b> e ela verá só os menus e telas marcados aqui (e deixa de liberar acessos para os outros).</div>`:''}<p class="caption">Escolha módulo por módulo e tela por tela o que ${esc(edit.email.split('@')[0])} acessa, e se só <b>vê</b> ou também <b>edita</b>. Os dados liberados no banco seguem as telas marcadas. ${edit.personalizado?'<span class="badge info">personalizado</span>':`<span class="badge">padrão do perfil ${esc(window.PERFIS.find(p=>p[0]===edit.role)?.[1]||edit.role)}</span>`}</p>
 <div class="row wrap" style="gap:6px;margin:10px 0 6px"><span class="caption">Modelos prontos:</span>${MODELOS.map(([k,t])=>`<button class="small ${edit.modelo===t?'primary':''}" data-pm-modelo="${k}">${esc(t)}</button>`).join('')}${outros.length?`<select data-pm-copiar aria-label="Copiar o acesso de outra pessoa"><option value="">Copiar de…</option>${outros.map(r=>`<option value="${esc(r.user_id)}">${esc(equipe.find(t=>t.user_id===r.user_id)?.email||r.user_id)}</option>`).join('')}</select>`:''}</div>
 <div class="row wrap" style="gap:8px;margin:6px 0 12px"><input type="search" id="pmBusca" placeholder="Buscar tela…" style="min-width:200px;flex:1"><button class="small" data-pm="tudo">Marcar tudo</button><button class="small" data-pm="nada">Desmarcar tudo</button><button class="small quiet" data-pm="padrao">Voltar ao padrão do perfil</button></div>
 <div class="pm-arvore">${MODS.map(modHtml).join('')}${modHtml({id:'ger',t:'Menu do usuário (conta, integrações, auditoria…)',grupos:[['Geral',GERAL]]})}</div>
 <div class="notice" style="margin-top:10px;padding:8px 12px"><b>Dados liberados:</b> ${edit.personalizado?Object.entries(areas).map(([k,v])=>`${NOME_AREA[k]} (${v==='gravar'?'edita':'só vê'})`).join(' · '):'os do perfil'}. Ações feitas no servidor (emitir nota, enviar GNRE, conectar integrações) seguem o perfil.</div>
 <div class="modalfoot"><span class="caption" style="margin-right:auto">${edit.sel.size} tela(s) · ${[...edit.sel].filter(i=>edit.leit.has(i)).length} só para ver · Ajuda e manual ficam sempre disponíveis.</span><button class="quiet" data-pm="cancelar">Cancelar</button><button class="primary" data-pm="salvar">Salvar acesso</button></div>`);
 document.querySelectorAll('[data-meio]').forEach(c=>c.indeterminate=true);
 const b=document.getElementById('pmBusca');if(b){b.value=edit.busca||'';b.oninput=()=>{edit.busca=b.value;filtrar()};filtrar();if(edit.busca){b.focus()}}}
function filtrar(){const q=normalized(edit.busca||'');document.querySelectorAll('.pm-tela').forEach(l=>{l.hidden=!!q&&!normalized(l.textContent).includes(q)});document.querySelectorAll('.pm-grupo').forEach(g=>{g.hidden=!!q&&![...g.querySelectorAll('.pm-tela')].some(l=>!l.hidden)});document.querySelectorAll('.pm-mod').forEach(m=>{m.hidden=!!q&&![...m.querySelectorAll('.pm-grupo')].some(g=>!g.hidden)})}
document.addEventListener('change',e=>{if(!edit)return;const t=e.target,mudou=()=>{edit.personalizado=true;edit.modelo=null;desenhar()};
 if(t.dataset.pmTela){if(t.checked)edit.sel.add(t.dataset.pmTela);else{edit.sel.delete(t.dataset.pmTela);edit.leit.delete(t.dataset.pmTela)}return mudou()}
 if(t.dataset.pmNivel){t.value==='v'?edit.leit.add(t.dataset.pmNivel):edit.leit.delete(t.dataset.pmNivel);return mudou()}
 if(t.dataset.pmModnivel){if(!t.value)return;for(const i of t.dataset.pmModnivel.split(','))if(edit.sel.has(i))t.value==='v'?edit.leit.add(i):edit.leit.delete(i);return mudou()}
 if(t.dataset.pmGrupo){for(const i of t.dataset.pmGrupo.split(','))if(t.checked)edit.sel.add(i);else{edit.sel.delete(i);edit.leit.delete(i)}return mudou()}
 if(t.matches('[data-pm-copiar]')&&t.value){const r=(acessosEquipe||[]).find(x=>x.user_id===t.value);if(r){edit.sel=new Set(r.paginas||[]);edit.leit=new Set(r.leitura||[]);edit.personalizado=true;edit.modelo=null;desenhar()}}});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-pm],[data-pm-modelo],[data-acc-telas]');if(!b)return;
 if(b.dataset.accTelas){abrirPermissoes(b.dataset.accTelas,b.dataset.email||'',b.dataset.role||'member');return}
 if(b.dataset.pmModelo){aplicarModelo(b.dataset.pmModelo);desenhar();return}
 const k=b.dataset.pm,{MODS,GERAL}=menu();
 if(k==='tudo'){MODS.forEach(m=>m.grupos.forEach(([,l])=>l.filter(existe).forEach(i=>edit.sel.add(i))));GERAL.filter(existe).forEach(i=>edit.sel.add(i));edit.personalizado=true;edit.modelo=null;desenhar();return}
 if(k==='nada'){edit.sel.clear();edit.leit.clear();edit.personalizado=true;edit.modelo=null;desenhar();return}
 if(k==='padrao'){edit.sel=new Set(padrao(edit.role));edit.leit.clear();edit.personalizado=false;edit.modelo=null;desenhar();return}
 if(k==='cancelar'){edit=null;closeModal();return}
 if(k==='salvar'){if(edit.personalizado&&!edit.sel.size){toast('Marque ao menos uma tela.');return}b.disabled=true;
  const leit=[...edit.leit].filter(i=>edit.sel.has(i));
  if(edit.personalizado&&edit.role==='owner'){const r0=await Cloud.client.rpc('set_role',{ws:Cloud.ws,uid:edit.uid,papel:'member'});if(r0.error){b.disabled=false;toast(r0.error.message);return}edit.role='member'}
  const todas=[...new Set([...menu().MODS.flatMap(m=>m.grupos.flatMap(([,l])=>l)),...menu().GERAL])];
  const {data,error}=await Cloud.client.rpc('set_acesso',{ws:Cloud.ws,uid:edit.uid,paginas:edit.personalizado?[...edit.sel]:null,leitura:edit.personalizado?leit:null,acessos:edit.personalizado?areasDe(edit.sel,edit.leit):null,conhecidas:edit.personalizado?todas:null});
  b.disabled=false;if(error){toast(error.message);return}toast(data);edit=null;closeModal();window.EquipeTelas?.recarregar();render()}});
window.PerfisAcesso={areasDe,MODELOS,abrir:(u,e,r)=>abrirPermissoes(u,e,r)};
document.addEventListener('change',async e=>{const s=e.target.closest('[data-acc-perfil]');if(!s)return;const uid=s.dataset.accPerfil;
 if(!confirm(`Trocar o perfil para "${s.selectedOptions[0].textContent}"?`)){render();return}
 const {data,error}=await Cloud.client.rpc('set_role',{ws:Cloud.ws,uid,papel:s.value});toast(error?error.message:data);render()});
})();
