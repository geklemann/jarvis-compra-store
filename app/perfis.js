// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Acesso por tela (desde 18/11/2026, sem perfis prontos): cada pessoa vê as telas escolhidas em Equipe e acessos ›
// Menus e telas (workspace_members.paginas; null = todas), sempre editável — inclusive para quem administra. O banco
// libera os dados que as telas marcadas usam (acessos) e bloqueia a gravação nas telas só para ver. "Administra" é a
// marca "Pode administrar a equipe e as configurações" (role 'owner' no banco). Os perfis de antes (financeiro,
// contador, atendimento, estoque) viraram as telas equivalentes (migração 20261204090000_equipe_telas_pedir_acesso.sql);
// PERFIS e o padrão de cada um continuam aqui só para quem ainda não foi convertido e para os modelos rápidos.
(()=>{
window.PERFIS=[['owner','Administra a equipe e as configurações'],['member','Telas escolhidas'],['financeiro','Financeiro'],['contador','Contabilidade (escritório)'],['atendimento','Atendimento e CRM'],['estoque','Estoque e expedição']];
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
const lista=()=>Array.isArray(window.Cloud?.paginas)?window.Cloud.paginas:null;
const menu=()=>window.ERP_MENU||{MODS:[],GERAL:[]};
function moduloDe(id){return menu().MODS.find(m=>m.grupos.some(([,l])=>l.includes(id)))?.id||(menu().GERAL.includes(id)?'ger':null)}
// Telas liberadas só para consulta (aviso no topo; o banco bloqueia a gravação nas áreas sem edição).
const leitura=()=>!lista()?null:(Array.isArray(window.Cloud?.leitura)?window.Cloud.leitura:[]);
function somenteLeitura(id){const l=leitura();return !!l&&l.includes(id)}
// Telas de Preços e margem (18/11/2026) para quem já via as telas que elas substituem.
const NOVAS_PRECOS={regrasvenda:['precos','formacao'],custoproduto:['cadprodutos','formacao','precos'],cadprodutos:['custoproduto','formacao']};
// Margem real, Anúncios pagos e Vigia de preços saíram de Vendas para Preços e margem: os perfis de antes que viam Vendas
// (sem Preços) continuam vendo essas três telas, e só elas, no módulo novo.
const VINDAS_DE_VENDAS=['margem','anuncios','concorrencia'];
const legadoVe=(p,id)=>VINDAS_DE_VENDAS.includes(id)&&p.includes('ven');
function paginaVisivel(id){if(SEMPRE.includes(id))return true;const l=lista();if(l){if(l.includes(id)||(id==='precos'&&l.includes('formacao')))return true;if(NOVAS_PRECOS[id])return NOVAS_PRECOS[id].some(x=>l.includes(x));const conh=window.Cloud?.telasConhecidas;if(Array.isArray(conh)&&!conh.includes(id)){const mid=moduloDe(id);return !!mid&&mid!=='ger'&&l.some(x=>moduloDe(x)===mid)}return false}const p=MODULOS[papel()];if(p&&moduloDe(id)==='pre'&&!p.includes('pre'))return legadoVe(p,id);return true} // tela criada depois da liberação aparece para quem já tem o módulo // Regras e simulador abre pela Formação de preço
function moduloVisivel(mid){const l=lista();if(l){const m=menu().MODS.find(x=>x.id===mid);return !!m&&m.grupos.some(([,ids])=>ids.some(i=>l.includes(i)))}const p=MODULOS[papel()];return !p||p.includes(mid)||(mid==='pre'&&p.includes('ven'))}
function inicio(){const l=lista();if(l){const pref=INICIO[papel()]||'resumo';return l.includes(pref)?pref:(l.find(i=>moduloDe(i))||'suporte')}return INICIO[papel()]||'resumo'}
// O que cada pessoa pode fazer nas telas (botões de lançar, emitir…): a mesma regra do banco (membro_pode) e do servidor
// (supabase/functions/_shared/acesso_areas.ts). papeis = quem podia pelos perfis de antes; areas = as alternativas pelas
// telas ("estoque:w" edita, "financeiro:r" vê, "+" junta, "!" nega). Quem administra passa onde 'owner' está.
function papelPode(r,area,g){switch(r){case 'owner':case 'member':return true;
 case 'financeiro':return ['financeiro','contabil','vendas','precos','config'].includes(area)||(area==='estoque'&&!g);
 case 'contador':return ['contabil','config'].includes(area)||(['financeiro','vendas','precos','estoque'].includes(area)&&!g);
 case 'atendimento':return area==='vendas'||(['estoque','precos','config'].includes(area)&&!g);
 case 'estoque':return area==='estoque'||(['vendas','precos','config'].includes(area)&&!g);
 default:return false}}
function membroPode(r,a,area,g){if(r==='owner'||!a||typeof a!=='object')return papelPode(r,area,g);return g?a[area]==='gravar':Object.prototype.hasOwnProperty.call(a,area)}
function permite(papeis,areas,r=window.Cloud?.role||'owner',a=window.Cloud?.acessos){if(r==='owner')return papeis.includes('owner');
 if(areas&&a&&typeof a==='object')return areas.some(alt=>alt.split('+').every(x=>{const nao=x[0]==='!',[k,m]=(nao?x.slice(1):x).split(':'),v=membroPode(r,a,k,m==='w');return nao?!v:v}));
 return papeis.includes(r)}
window.Acesso={permite,membroPode,papelPode,administra:()=>(window.Cloud?.role||'owner')==='owner'};
// Telas que o perfil vê por padrão (sem lista personalizada).
function padrao(role){const p=MODULOS[role];return menu().MODS.filter(m=>!p||p.includes(m.id)||(m.id==='pre'&&p.includes('ven'))).flatMap(m=>m.grupos.flatMap(([,l])=>l).filter(i=>!p||p.includes(m.id)||legadoVe(p,i))).concat(role==='owner'?menu().GERAL:menu().GERAL.filter(g=>!['equipe','auditoria','integracoes'].includes(g)))}
window.Perfis={moduloVisivel,paginaVisivel,somenteLeitura,inicio,padrao,nome:()=>papel()==='owner'?'Administra':'Telas escolhidas'};

// ─────────── Janela de permissões (Equipe e acessos › Telas) ───────────
// Cada tela marcada é "Editar" ou "Só ver". Os dados liberados no banco saem das telas: a área principal de cada tela
// (ler ou gravar, conforme o nível) mais as áreas que o módulo só consulta. Cadastros (config) sempre para leitura.
const AREA_TELA={custoproduto:'precos',regrasvenda:'precos',reconcile:'financeiro',pending:'financeiro',closing:'contabil',anuncios:'financeiro',metas:'financeiro',difal:'financeiro',nfrecebidas:'financeiro',catalogo:'estoque',cadprodutos:'estoque',margem:'precos',raiox:'precos',concorrencia:'precos',pedcompra:'estoque',compras:'financeiro',imppag:'financeiro'};
const LE_MODULO={atd:['estoque','precos'],ven:['vendas','financeiro','precos','estoque'],est:['vendas','precos'],imp:['estoque'],fin:['vendas','contabil','estoque'],orc:['vendas','contabil'],fis:['vendas','estoque','financeiro'],crm:['estoque'],cad:['estoque'],res:['vendas','financeiro','precos','estoque'],pre:['vendas','estoque'],rel:['vendas','contabil','estoque','precos']};
const NOME_AREA={vendas:'Vendas e atendimento',estoque:'Estoque e produtos',financeiro:'Financeiro e repasses',contabil:'Contabilidade e fiscal',precos:'Preços',config:'Cadastros'};
function areasDe(sel,leit){const a={config:'ler'},sobe=(k,v)=>{if(!k)return;if(v==='gravar'||!a[k])a[k]=v};
 for(const id of sel){const mid=moduloDe(id);if(!mid||mid==='ger')continue;sobe(AREA_TELA[id]||AREA[mid],leit.has(id)?'ler':'gravar');for(const x of LE_MODULO[mid]||[])sobe(x,'ler')}
 return a}
// Modelos rápidos: só pré-marcam as telas (módulo → 'e' editar ou 'v' só ver; null = todos os módulos só para ver).
const MODELOS=[['atd','Atendimento',{atd:'e',crm:'v'}],['venatd','Vendas + Atendimento',{atd:'e',ven:'e',crm:'e'}],['venatdres','Vendas + Atendimento + Resultado',{atd:'e',ven:'e',crm:'e',res:'v'}],['fin','Financeiro',{fin:'e',orc:'e',ven:'v',rel:'v'}],['cont','Contabilidade',{res:'e',fis:'v',fin:'v',rel:'v'}],['est','Estoque e expedição',{est:'e',atd:'v',cad:'v'}],['ver','Só consulta (todos os módulos)',null]];
const titulo=id=>(typeof navItems!=='undefined'&&navItems.find(n=>n[0]===id)?.[2])||id;
const existe=i=>typeof navItems==='undefined'||navItems.some(n=>n[0]===i);
let edit=null,acessosEquipe=null;
const todasTelas=()=>[...new Set([...menu().MODS.flatMap(m=>m.grupos.flatMap(([,l])=>l)),...menu().GERAL])];
const souEu=uid=>!!uid&&uid===window.Cloud?.session?.user?.id;
// Quem edita a si mesmo não tira a tela Equipe e acessos (nem a deixa só para ver).
const travar=()=>{if(edit?.eu){edit.sel.add('equipe');edit.leit.delete('equipe')}};
// modo: 'membro' (quem já tem acesso), 'convite' (e-mail novo) ou 'pedido' (liberar um pedido de acesso).
async function abrirPermissoes(uid,email,role,modo='membro'){let atual=null;
 if(modo==='membro'){try{const {data}=await Cloud.client.rpc('list_acessos',{ws:Cloud.ws});acessosEquipe=data||[];atual=acessosEquipe.find(r=>r.user_id===uid)||null}catch{acessosEquipe=[]}}
 else if(!acessosEquipe){try{const {data}=await Cloud.client.rpc('list_acessos',{ws:Cloud.ws});acessosEquipe=data||[]}catch{acessosEquipe=[]}}
 const admin=role==='owner';
 edit={uid,email,role,modo,admin,adminAntes:admin,eu:modo==='membro'&&souEu(uid),
  sel:new Set(modo==='membro'?(atual?.paginas||padrao(role)):[]),leit:new Set(modo==='membro'?(atual?.leitura||[]):[]),modelo:null};
 travar();desenhar()}
function aplicarModelo(k){const m=MODELOS.find(x=>x[0]===k);if(!m)return;const {MODS}=menu();edit.sel.clear();edit.leit.clear();
 for(const mod of MODS){const nivel=m[2]?m[2][mod.id]:'v';if(!nivel)continue;for(const [,l] of mod.grupos)for(const i of l){if(!existe(i))continue;edit.sel.add(i);if(nivel==='v')edit.leit.add(i)}}
 edit.modelo=m[1];travar()}
function desenhar(){if(!edit)return;const {MODS,GERAL}=menu(),areas=areasDe(edit.sel,edit.leit);
 const tela=i=>{const on=edit.sel.has(i),ver=edit.leit.has(i),trava=edit.eu&&i==='equipe';return `<div class="pm-tela ${on?'on':''}"><label${trava?' title="Você não pode tirar de si mesmo a tela Equipe e acessos"':''}><input type="checkbox" class="check" data-pm-tela="${esc(i)}" ${on?'checked':''} ${trava?'disabled':''}> ${esc(titulo(i))}${trava?' <span class="badge">sua</span>':''}</label>${on&&!trava?`<select class="pm-nivel" data-pm-nivel="${esc(i)}" aria-label="Nível em ${esc(titulo(i))}"><option value="e" ${!ver?'selected':''}>Editar</option><option value="v" ${ver?'selected':''}>Só ver</option></select>`:''}</div>`};
 const grupoHtml=(t,ids)=>{ids=ids.filter(existe);if(!ids.length)return '';const n=ids.filter(i=>edit.sel.has(i)).length;
  return `<div class="pm-grupo"><label class="pm-sub"><input type="checkbox" class="check" data-pm-grupo="${esc(ids.join(','))}" ${n===ids.length?'checked':''} ${n&&n<ids.length?'data-meio="1"':''}> ${esc(t)}</label><div class="pm-telas">${ids.map(tela).join('')}</div></div>`};
 const modHtml=m=>{const ids=m.grupos.flatMap(([,l])=>l).filter(existe);if(!ids.length)return '';const n=ids.filter(i=>edit.sel.has(i)).length,ed=ids.filter(i=>edit.sel.has(i)&&!edit.leit.has(i)).length;
  return `<section class="pm-mod ${n?'tem':''}"><div class="pm-head"><label><input type="checkbox" class="check" data-pm-grupo="${esc(ids.join(','))}" ${n===ids.length?'checked':''} ${n&&n<ids.length?'data-meio="1"':''}> <strong>${esc(m.t)}</strong></label><span class="row" style="gap:8px"><span class="caption">${n}/${ids.length}${n?` · ${ed===n?'edita':ed?`edita ${ed}, só vê ${n-ed}`:'só vê'}`:''}</span>${n?`<select class="pm-nivel" data-pm-modnivel="${esc(ids.join(','))}" aria-label="Nível do módulo ${esc(m.t)}"><option value="">Nível do módulo…</option><option value="e">Editar tudo</option><option value="v">Só ver tudo</option></select>`:''}</span></div>${m.grupos.map(([t,l])=>grupoHtml(t,l)).join('')}</section>`};
 const outros=(acessosEquipe||[]).filter(r=>r.user_id!==edit.uid&&r.paginas),equipe=window.Integrations?.state?.team||[],nome=esc(String(edit.email).split('@')[0]);
 const titulo0=edit.modo==='convite'?`Convidar ${esc(edit.email)}`:edit.modo==='pedido'?`Liberar o acesso de ${esc(edit.email)}`:`Acesso de ${esc(edit.email)}`;
 modal(titulo0,`<label class="row" style="gap:8px;align-items:flex-start;margin:0 0 4px"${edit.eu?' title="Você não pode tirar de si mesmo a marca de administrar"':''}><input type="checkbox" class="check" id="pmAdmin" ${edit.admin?'checked':''} ${edit.eu?'disabled':''}><span><b>Pode administrar a equipe e as configurações</b><br><span class="caption">Convida e libera pessoas, escolhe as telas de cada uma, conecta as integrações e mexe nas configurações da empresa.${edit.eu?' Você não pode tirar de si mesmo.':''}</span></span></label>
 <p class="caption">Marque módulo por módulo e tela por tela o que ${nome} acessa, e se só <b>vê</b> ou também <b>edita</b>. Vale para todo mundo, inclusive para quem administra; os dados liberados no banco seguem as telas marcadas.</p>
 <div class="row wrap" style="gap:6px;margin:10px 0 6px"><span class="caption">Modelos rápidos (só marcam as telas):</span>${MODELOS.map(([k,t])=>`<button class="small ${edit.modelo===t?'primary':''}" data-pm-modelo="${k}">${esc(t)}</button>`).join('')}${outros.length?`<select data-pm-copiar aria-label="Copiar as telas de outra pessoa"><option value="">Copiar de…</option>${outros.map(r=>`<option value="${esc(r.user_id)}">${esc(equipe.find(t=>t.user_id===r.user_id)?.email||r.user_id)}</option>`).join('')}</select>`:''}</div>
 <div class="row wrap" style="gap:8px;margin:6px 0 12px"><input type="search" id="pmBusca" placeholder="Buscar tela…" style="min-width:200px;flex:1"><button class="small" data-pm="tudo">Marcar tudo</button><button class="small" data-pm="nada">Desmarcar tudo</button></div>
 <div class="pm-arvore">${MODS.map(modHtml).join('')}${modHtml({id:'ger',t:'Menu do usuário (conta, integrações, auditoria…)',grupos:[['Geral',GERAL]]})}</div>
 <div class="notice" style="margin-top:10px;padding:8px 12px"><b>Dados liberados:</b> ${edit.admin?'todos (quem administra pode se dar qualquer tela; as telas marcadas organizam o menu)':Object.entries(areas).map(([k,v])=>`${NOME_AREA[k]} (${v==='gravar'?'edita':'só vê'})`).join(' · ')}. As ações feitas no servidor (emitir nota, enviar GNRE, lançar estoque) seguem as mesmas telas.</div>
 <div class="modalfoot"><span class="caption" style="margin-right:auto">${edit.sel.size} tela(s) · ${[...edit.sel].filter(i=>edit.leit.has(i)).length} só para ver · Ajuda e manual ficam sempre disponíveis.</span><button class="quiet" data-pm="cancelar">Cancelar</button><button class="primary" data-pm="salvar">${edit.modo==='convite'?'Convidar':edit.modo==='pedido'?'Liberar acesso':'Salvar acesso'}</button></div>`);
 document.querySelectorAll('[data-meio]').forEach(c=>c.indeterminate=true);
 const b=document.getElementById('pmBusca');if(b){b.value=edit.busca||'';b.oninput=()=>{edit.busca=b.value;filtrar()};filtrar();if(edit.busca){b.focus()}}}
function filtrar(){const q=normalized(edit.busca||'');document.querySelectorAll('.pm-tela').forEach(l=>{l.hidden=!!q&&!normalized(l.textContent).includes(q)});document.querySelectorAll('.pm-grupo').forEach(g=>{g.hidden=!!q&&![...g.querySelectorAll('.pm-tela')].some(l=>!l.hidden)});document.querySelectorAll('.pm-mod').forEach(m=>{m.hidden=!!q&&![...m.querySelectorAll('.pm-grupo')].some(g=>!g.hidden)})}
document.addEventListener('change',e=>{if(!edit)return;const t=e.target,mudou=()=>{edit.modelo=null;travar();desenhar()};
 if(t.id==='pmAdmin'){if(edit.eu){t.checked=true;return}edit.admin=!!t.checked;if(edit.admin)edit.sel.add('equipe');return mudou()} // quem passa a administrar ganha a tela Equipe e acessos
 if(t.dataset.pmTela){if(t.checked)edit.sel.add(t.dataset.pmTela);else{edit.sel.delete(t.dataset.pmTela);edit.leit.delete(t.dataset.pmTela)}return mudou()}
 if(t.dataset.pmNivel){t.value==='v'?edit.leit.add(t.dataset.pmNivel):edit.leit.delete(t.dataset.pmNivel);return mudou()}
 if(t.dataset.pmModnivel){if(!t.value)return;for(const i of t.dataset.pmModnivel.split(','))if(edit.sel.has(i))t.value==='v'?edit.leit.add(i):edit.leit.delete(i);return mudou()}
 if(t.dataset.pmGrupo){for(const i of t.dataset.pmGrupo.split(','))if(t.checked)edit.sel.add(i);else{edit.sel.delete(i);edit.leit.delete(i)}return mudou()}
 if(t.matches('[data-pm-copiar]')&&t.value){const r=(acessosEquipe||[]).find(x=>x.user_id===t.value);if(r){edit.sel=new Set(r.paginas||[]);edit.leit=new Set(r.leitura||[]);return mudou()}}});
// O que vai para o banco: as telas marcadas (todas, sem nenhuma só para ver, de quem administra = null, "todas as telas",
// que inclui as telas que vierem depois), o nível de cada uma e os dados que elas usam.
function pacote(){const leit=[...edit.leit].filter(i=>edit.sel.has(i)),todas=todasTelas(),tudo=todas.filter(existe).every(i=>edit.sel.has(i))&&!leit.length;
 if(edit.admin&&tudo)return {paginas:null,leitura:null,acessos:null,conhecidas:null};
 return {paginas:[...edit.sel],leitura:leit,acessos:areasDe(edit.sel,edit.leit),conhecidas:todas}}
async function salvar(){const p=pacote(),c=Cloud.client,papel=edit.admin?'owner':'member';let msg='';
 if(edit.modo==='convite'){await window.EquipeConvite.convidar(edit.email,papel,p);return ''}
 if(edit.modo==='pedido'){const r=await c.rpc('decide_access',{ws:Cloud.ws,uid:edit.uid,aprovar:true,papel});if(r.error)throw r.error;msg=r.data}
 else if(edit.admin!==edit.adminAntes){const r=await c.rpc('set_admin',{ws:Cloud.ws,uid:edit.uid,sim:edit.admin});if(r.error)throw r.error}
 const {data,error}=await c.rpc('set_acesso',{ws:Cloud.ws,uid:edit.uid,...p});if(error)throw error;return msg?msg+' '+data:data}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-pm],[data-pm-modelo],[data-acc-telas]');if(!b)return;
 if(b.dataset.accTelas){abrirPermissoes(b.dataset.accTelas,b.dataset.email||'',b.dataset.role||'member',b.dataset.modo||'membro');return}
 if(!edit)return;
 if(b.dataset.pmModelo){aplicarModelo(b.dataset.pmModelo);desenhar();return}
 const k=b.dataset.pm,{MODS,GERAL}=menu();
 if(k==='tudo'){MODS.forEach(m=>m.grupos.forEach(([,l])=>l.filter(existe).forEach(i=>edit.sel.add(i))));GERAL.filter(existe).forEach(i=>edit.sel.add(i));edit.modelo=null;desenhar();return}
 if(k==='nada'){edit.sel.clear();edit.leit.clear();edit.modelo=null;travar();desenhar();return}
 if(k==='cancelar'){edit=null;closeModal();return}
 if(k==='salvar'){if(!edit.sel.size){toast('Marque ao menos uma tela.');return}b.disabled=true;
  try{const m=await salvar();if(m)toast(m);edit=null;closeModal();window.EquipeTelas?.recarregar();await window.Integrations?.load?.();render()}
  catch(x){toast(x.message||String(x))}finally{b.disabled=false}}});
window.PerfisAcesso={areasDe,MODELOS,abrir:(u,e,r,modo)=>abrirPermissoes(u,e,r,modo),estado:()=>edit};
// A marca de administrar direto na lista (Quem tem acesso): set_admin, com confirmação. Ninguém tira de si mesmo.
document.addEventListener('change',async e=>{const s=e.target.closest('[data-acc-admin]');if(!s)return;const uid=s.dataset.accAdmin,email=s.dataset.email||'esta pessoa';
 if(souEu(uid)){s.checked=true;toast('Você não pode tirar de si mesmo a marca de administrar.');return}
 if(!confirm(s.checked?`${email} vai poder administrar a equipe e as configurações. Confirmar?`:`${email} deixa de administrar a equipe e as configurações (continua com as telas marcadas). Confirmar?`)){s.checked=!s.checked;return}
 const {data,error}=await Cloud.client.rpc('set_admin',{ws:Cloud.ws,uid,sim:!!s.checked});toast(error?error.message:data);window.EquipeTelas?.recarregar();await window.Integrations?.load?.();render()});
})();
