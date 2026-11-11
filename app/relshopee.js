// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Relatórios › Marketplace para contabilidade: os relatórios que o escritório pede de cada marketplace, buscados
// direto nas APIs na hora, sem alterar nada. Shopee: Meus pedidos › Todos, Saldo da carteira, Minha renda e saldo
// pendente. Mercado Livre / Mercado Pago: vendas, pagamentos, liberações e saldo da conta.
// Cada relatório sai em Excel com uma aba por mês (ou CSV).
(()=>{
const PAG='relshopee';
const hojeISO=()=>new Date(Date.now()-3*36e5).toISOString().slice(0,10);
const padrao=()=>{const [a,m]=hojeISO().split('-').map(Number),fim=new Date(Date.UTC(a,m-1,0)),ini=new Date(Date.UTC(a,m-6,1));return {de:ini.toISOString().slice(0,10),ate:fim.toISOString().slice(0,10)}};
const st={...padrao(),res:{},rodando:null,pend:{},plat:'shopee'};
const TIPOS={
 pedidos:{t:'Meus pedidos',menu:'Meus pedidos › Todos',s:'Pedidos de todos os status (inclusive cancelados e não pagos), um item por linha, pela data de criação.',data:'Criado em',ic:'cart'},
 carteira:{t:'Saldo da carteira',menu:'Saldo da carteira › Todos',s:'Todas as transações da carteira: renda dos pedidos, ajustes, reembolsos, saques e Shopee Acelera.',data:'Data',ic:'wallet'},
 renda:{t:'Minha renda',menu:'Minha renda › Pedidos completos',s:'Valor liberado de cada pedido, pela data de liberação, com a composição (comissão, taxas, frete, cupons).',data:'Liberado em',ic:'money'},
 ml_vendas:{t:'Vendas',menu:'Vendas › todas',s:'Vendas de todos os status (inclusive canceladas), um item por linha, com tipo de anúncio e tarifa de venda, pela data da venda.',data:'Criado em'},
 mp_pagamentos:{t:'Pagamentos do Mercado Pago',menu:'Mercado Pago › Atividade',s:'Pagamentos criados no período: valor, tarifas, frete, cupom, líquido, reembolso e quando libera.',data:'Criado em'},
 mp_liberacoes:{t:'Liberações do Mercado Pago',menu:'Mercado Pago › Dinheiro liberado',s:'Pagamentos liberados no período, pela data de liberação, com tarifas e líquido recebido.',data:'Liberado em'}};
const PLAT={shopee:{nome:'Shopee',onde:'Na Shopee',acao:'shopee_relatorio',tipos:['pedidos','carteira','renda'],saldo:'pendente'},
 ml:{nome:'Mercado Livre / Mercado Pago',onde:'No Mercado Livre',acao:'ml_relatorio',tipos:['ml_vendas','mp_pagamentos','mp_liberacoes'],saldo:'mp_saldo'}};
const platDe=tipo=>Object.keys(PLAT).find(p=>PLAT[p].tipos.includes(tipo)||PLAT[p].saldo===tipo)||'shopee';
const R=v=>typeof money==='function'?money(v):String(v),nf=v=>Number(v||0).toLocaleString('pt-BR'),fmt=(v,f)=>f==='m'?R(v):nf(v);
const dBR=d=>d?d.slice(0,10).split('-').reverse().join('/'):'';
const MES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const mesNome=k=>`${MES[Number(k.slice(5,7))-1]}-${k.slice(0,4)}`;
const redesenhar=()=>{if(page===PAG)render()};
const pode=()=>['owner','member','financeiro','contador'].includes(window.Cloud?.role);
async function fn(body){const r=await Cloud.client.functions.invoke('integrations',{body:{workspace_id:Cloud.ws,action:PLAT[platDe(body.tipo)].acao,...body}});if(r.error){let msg=r.error.message;try{msg=(await r.error.context.json()).error||msg}catch{}throw Error(msg)}return r.data}

async function gerar(tipo){if(st.rodando)return toast('Espere a busca em andamento terminar.');if(!st.de||!st.ate||st.de>st.ate)return toast('Informe o período: de / até.');
 const de=st.de,ate=st.ate,ini=Date.parse(de+'T00:00:00-03:00')/1e3,fim=Date.parse(ate+'T23:59:59-03:00')/1e3;
 const r=st.res[tipo]={de,ate,linhas:[],avisos:[],prog:0,erro:'',inicio:Date.now()};st.rodando=tipo;redesenhar();
 let cursor=null;const vistos=new Set();
 try{do{const d=await fn({tipo,de,ate,cursor});
   for(const l of d.linhas||[]){if(tipo==='carteira'&&l['ID da transação']!==''){const k=String(l['ID da transação']);if(vistos.has(k))continue;vistos.add(k)}r.linhas.push(l)}
   for(const a of d.avisos||[])if(!r.avisos.includes(a))r.avisos.push(a);
   cursor=d.next;r.prog=cursor?Math.min(.99,Math.max(0,(cursor.win-ini)/(fim-ini))):1;redesenhar()}while(cursor);
  r.fim=Date.now();audit('Relatório de marketplace para a contabilidade',`${PLAT[platDe(tipo)].nome} · ${TIPOS[tipo].t} · ${dBR(de)} a ${dBR(ate)} · ${r.linhas.length} linha(s)`)}
 catch(e){r.erro=e.message||String(e)}
 st.rodando=null;redesenhar()}

async function pendente(p){const tipo=PLAT[p].saldo;if(st.pend[p]?.carregando)return;st.pend[p]={carregando:true};redesenhar();
 try{const d=await fn({tipo});st.pend[p]={em:new Date(),resumo:d.resumo,erro:d.erro||''}}catch(e){st.pend[p]={em:new Date(),erro:e.message||String(e)}}redesenhar()}

const mesDe=(tipo,l)=>String(l[TIPOS[tipo].data]||'').slice(0,7)||'sem data';
function resumo(tipo,L){const porMes={};for(const l of L){const k=mesDe(tipo,l);(porMes[k]=porMes[k]||[]).push(l)}
 const meses=Object.keys(porMes).sort();
 if(tipo==='pedidos'){const ped=new Map();for(const l of L)if(!ped.has(l['ID do pedido']))ped.set(l['ID do pedido'],l);const P=[...ped.values()],st_={};for(const p of P)st_[p.Status]=(st_[p.Status]||0)+1;
  return {meses,porMes,kpis:[['Pedidos',nf(P.length)],['Itens (linhas)',nf(L.length)],['Total dos pedidos',R(P.reduce((s,p)=>s+(Number(p['Total do pedido'])||0),0))],['Cancelados',nf(st_.CANCELLED||0)]],
   linhaMes:k=>{const m=new Map();for(const l of porMes[k])m.set(l['ID do pedido'],l);const v=[...m.values()];return [v.length,v.reduce((s,p)=>s+(Number(p['Total do pedido'])||0),0)]},colMes:['Pedidos','Total'],colFmt:['n','m']}}
 if(tipo==='carteira'){const ent=L.filter(l=>Number(l.Valor)>0).reduce((s,l)=>s+Number(l.Valor),0),sai=L.filter(l=>Number(l.Valor)<0).reduce((s,l)=>s+Number(l.Valor),0);
  return {meses,porMes,kpis:[['Transações',nf(L.length)],['Entradas',R(ent)],['Saídas',R(sai)],['Valor total',R(ent+sai)]],
   linhaMes:k=>{const v=porMes[k],e=v.filter(l=>Number(l.Valor)>0).reduce((s,l)=>s+Number(l.Valor),0),s_=v.filter(l=>Number(l.Valor)<0).reduce((s,l)=>s+Number(l.Valor),0);return [v.length,e,s_,e+s_]},colMes:['Transações','Entradas','Saídas','Total'],colFmt:['n','m','m','m']}}
 const soma=(v,c)=>v.reduce((s,l)=>s+(Number(l[c])||0),0);
 if(tipo==='ml_vendas'){const ped=new Map();for(const l of L)if(!ped.has(l['ID do pedido']))ped.set(l['ID do pedido'],l);const P=[...ped.values()];
  return {meses,porMes,kpis:[['Vendas',nf(P.length)],['Itens (linhas)',nf(L.length)],['Total das vendas',R(soma(P,'Total do pedido'))],['Canceladas',nf(P.filter(p=>p.Status==='cancelled').length)]],
   linhaMes:k=>{const m=new Map();for(const l of porMes[k])m.set(l['ID do pedido'],l);const v=[...m.values()];return [v.length,soma(v,'Total do pedido'),soma(porMes[k],'Tarifa de venda')]},colMes:['Vendas','Total','Tarifas de venda'],colFmt:['n','m','m']}}
 if(tipo==='mp_pagamentos'||tipo==='mp_liberacoes'){const ok=v=>tipo==='mp_pagamentos'?v.filter(l=>l.Status==='approved'):v,ap=ok(L);
  return {meses,porMes,kpis:[[tipo==='mp_pagamentos'?'Pagamentos':'Liberações',nf(L.length)],[tipo==='mp_pagamentos'?'Aprovados (valor)':'Valor das transações',R(soma(ap,'Valor da transação'))],['Tarifas',R(soma(ap,'Tarifas'))],['Líquido',R(soma(ap,'Líquido recebido'))]],
   linhaMes:k=>{const v=ok(porMes[k]);return [porMes[k].length,soma(v,'Valor da transação'),soma(v,'Tarifas'),soma(v,'Líquido recebido')]},colMes:[tipo==='mp_pagamentos'?'Pagamentos':'Liberações','Valor','Tarifas','Líquido'],colFmt:['n','m','m','m']}}
 const tot=L.reduce((s,l)=>s+(Number(l['Valor liberado'])||0),0);
 return {meses,porMes,kpis:[['Pedidos liberados',nf(L.length)],['Valor liberado',R(tot)],['Comissões',R(L.reduce((s,l)=>s+(Number(l['Comissão'])||0),0))],['Taxas de serviço',R(L.reduce((s,l)=>s+(Number(l['Taxa de serviço'])||0),0))]],
  linhaMes:k=>{const v=porMes[k];return [v.length,v.reduce((s,l)=>s+(Number(l['Valor liberado'])||0),0)]},colMes:['Pedidos','Valor liberado'],colFmt:['n','m']}}

const nomeArq=(tipo,r,ext,k)=>`${platDe(tipo)==='ml'?'mercadolivre':'shopee'}-${tipo.replace(/^(ml|mp)_/,'')}-${k?k:`${r.de}-a-${r.ate}`}.${ext}`;
function excel(tipo,k){const r=st.res[tipo],X=window.XLSX;if(!X)return toast('A biblioteca do Excel não carregou. Recarregue a página.');
 const z=resumo(tipo,r.linhas),wb=X.utils.book_new();wb.Props={Title:`${PLAT[platDe(tipo)].nome} · ${TIPOS[tipo].t}`,Author:'Jarvis',CreatedDate:new Date()};
 const meses=k?[k]:z.meses;
 if(!k){const cab=[[`${PLAT[platDe(tipo)].nome} · ${TIPOS[tipo].menu}`],[`Período: ${dBR(r.de)} a ${dBR(r.ate)}`],[`Buscado em ${new Date(r.fim||Date.now()).toLocaleString('pt-BR')}`],[],['Mês',...z.colMes]];
  const ws=X.utils.aoa_to_sheet([...cab,...meses.map(m=>[mesNome(m),...z.linhaMes(m).map(v=>Math.round(v*100)/100)])]);
  ws['!cols']=[{wch:14},...z.colMes.map(()=>({wch:16}))];X.utils.book_append_sheet(wb,ws,'Resumo')}
 for(const m of meses){const ws=X.utils.json_to_sheet(z.porMes[m]||[]);const cols=Object.keys((z.porMes[m]||[])[0]||{});ws['!cols']=cols.map(c=>({wch:Math.min(40,Math.max(10,c.length+2))}));X.utils.book_append_sheet(wb,ws,mesNome(m).slice(0,31))}
 X.writeFile(wb,nomeArq(tipo,r,'xlsx',k),{compression:true})}
function csv(tipo){const r=st.res[tipo],L=r.linhas;if(!L.length)return;const cols=[...new Set(L.flatMap(l=>Object.keys(l)))],q=v=>{const s=v==null?'':typeof v==='number'?String(v).replace('.',','):String(v);return /[;"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
 download(nomeArq(tipo,r,'csv'),'﻿'+[cols.map(q).join(';'),...L.map(l=>cols.map(c=>q(l[c])).join(';'))].join('\r\n'))}

function cartao(tipo){const T=TIPOS[tipo],r=st.res[tipo],rod=st.rodando===tipo;let corpo='';
 if(rod)corpo=`<div class="rsh-prog"><div class="bar"><i style="width:${Math.round((r.prog||0)*100)}%;background:var(--accent)"></i></div><span class="caption">${nf(r.linhas.length)} linha(s) até agora · ${Math.round((r.prog||0)*100)}% do período. Pode continuar usando o Jarvis nesta aba.</span></div>`;
 else if(r?.erro)corpo=`<div class="notice" style="margin:12px 0 0"><b>Não foi possível buscar.</b> ${esc(r.erro)}${r.linhas.length?` (${nf(r.linhas.length)} linha(s) chegaram antes do erro)`:''}</div>`;
 else if(r){const z=resumo(tipo,r.linhas);
  corpo=`<div class="rsh-kpis">${z.kpis.map(([a,b])=>`<div><small>${a}</small><b>${b}</b></div>`).join('')}</div>
  ${r.avisos.map(a=>`<p class="caption">⚠ ${esc(a)}</p>`).join('')}
  ${z.meses.length?`<div class="tablewrap"><table><thead><tr><th>Mês</th>${z.colMes.map(c=>`<th class="num">${c}</th>`).join('')}<th></th></tr></thead><tbody>${z.meses.map(m=>`<tr><td>${mesNome(m)}</td>${z.linhaMes(m).map((v,i)=>`<td class="num">${fmt(v,z.colFmt[i])}</td>`).join('')}<td class="num"><button class="small quiet" data-rsh-mes="${tipo}" data-m="${m}" title="Baixar só este mês">${icon('download')} Excel</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="caption">Nada no período.</p>'}
  <div class="row wrap" style="margin-top:12px"><button class="small primary" data-rsh-xlsx="${tipo}" ${r.linhas.length?'':'disabled'}>${icon('download')} Excel (uma aba por mês)</button><button class="small" data-rsh-csv="${tipo}" ${r.linhas.length?'':'disabled'}>CSV</button><span class="caption">${dBR(r.de)} a ${dBR(r.ate)} · buscado às ${new Date(r.fim).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span></div>`}
 return `<section class="card rsh-card"><div class="cardhead"><div><h2>${T.t}</h2><p class="caption">${PLAT[platDe(tipo)].onde}: ${T.menu}</p></div><button class="small${r&&!r.erro?'':' primary'}" data-rsh-gerar="${tipo}" ${st.rodando||!pode()?'disabled':''}>${icon('refresh')} ${r&&!rod?'Buscar de novo':'Buscar'}</button></div><p class="caption" style="margin-top:-8px">${T.s}</p>${corpo}</section>`}

function valoresPend(o,pre=''){const out=[];for(const [k,v] of Object.entries(o||{})){if(v&&typeof v==='object'&&!Array.isArray(v))out.push(...valoresPend(v,pre+k+' › '));else if(typeof v==='number'||(typeof v==='string'&&v!==''&&!isNaN(Number(v))))out.push([pre+k,Number(v)])}return out}
const NOME_PEND={pending:'Pendente',pending_amount:'Pendente',total_pending:'Pendente',released:'Liberado',released_amount:'Liberado',this_week:'Esta semana',this_month:'Este mês',total:'Total',total_released:'Total liberado'};
const nomeChave=k=>k.split(' › ').filter(p=>!/^(total_income|income|response)$/.test(p)).map(p=>NOME_PEND[p]||p.replace(/_/g,' ')).join(' › ')||k;
const NOME_SALDO={available_balance:'Disponível',unavailable_balance:'A liberar',total_amount:'Saldo total'};
function cartaoPendente(pl){const p=st.pend[pl],ml=pl==='ml';let corpo='';
 if(p?.carregando)corpo='<p class="caption">Consultando…</p>';
 else if(p&&p.resumo){const v=valoresPend(p.resumo);corpo=v.length?`<div class="rsh-kpis">${v.slice(0,8).map(([k,n])=>`<div><small>${esc(NOME_SALDO[k]||nomeChave(k))}</small><b>${R(n)}</b></div>`).join('')}</div><p class="caption">Consultado em ${p.em.toLocaleString('pt-BR')}.${ml?'':' A Shopee informa que esses valores não incluem ajustes.'}</p>`:`<p class="caption">A consulta voltou sem valores.</p>`}
 else if(p)corpo=`<div class="notice" style="margin:12px 0 0">${ml?'O Mercado Pago':'A Shopee'} não liberou o saldo pela integração (${esc(p.erro||'sem resposta')}). Enquanto isso, o print ainda precisa ser tirado ${ml?'no Mercado Pago':'na Central do Vendedor › Minha renda'}.</div>`;
 return `<section class="card rsh-card"><div class="cardhead"><div><h2>${ml?'Saldo do Mercado Pago':'Saldo pendente'}</h2><p class="caption">${ml?'No Mercado Pago: Seu dinheiro (disponível e a liberar)':'Na Shopee: Minha renda › Visão geral › Pendente'}</p></div><button class="small primary" data-rsh-pend="${pl}" ${p?.carregando||!pode()?'disabled':''}>${icon('refresh')} Consultar agora</button></div><p class="caption" style="margin-top:-8px">${ml?'Dinheiro disponível e a liberar na conta, no momento da consulta (substitui o print).':'Valor a receber de pedidos ainda não liberados, no momento da consulta (substitui o print da tela inicial).'}</p>${corpo}</section>`}

function view(){if(!window.Cloud?.ws)return '<div class="empty">Entre na conta para usar os relatórios.</div>';
 const atalhos=(()=>{const [a,m]=hojeISO().split('-').map(Number),l=[];for(let i=1;i<=6;i++){const d=new Date(Date.UTC(a,m-1-i,1)),f=new Date(Date.UTC(a,m-i,0));l.push([d.toISOString().slice(0,10),f.toISOString().slice(0,10),mesNome(d.toISOString().slice(0,7))])}return l.reverse()})();
 return `<div class="notice"><b>Para o escritório de contabilidade.</b> Os relatórios de cada marketplace, buscados direto na plataforma na hora da consulta. Nada é alterado. Períodos de vários meses levam alguns minutos; o Excel sai com uma aba por mês.</div>
 <div class="segtabs rsh-plat">${Object.entries(PLAT).map(([k,p])=>`<button class="${st.plat===k?'on':''}" data-rsh-plat="${k}">${p.nome}</button>`).join('')}</div>
 <div class="card rsh-periodo"><div class="row wrap"><label class="rsh-l">De<input type="date" data-rsh-de value="${st.de}"></label><label class="rsh-l">Até<input type="date" data-rsh-ate value="${st.ate}"></label>
  <div class="segtabs rsh-atalhos">${atalhos.map(([d,f,n])=>`<button class="${st.de===d&&st.ate===f?'on':''}" data-rsh-per="${d}|${f}">${n}</button>`).join('')}</div></div></div>
 ${pode()?'':'<div class="notice">Seu perfil não acessa os relatórios dos marketplaces. Peça ao administrador.</div>'}
 <div class="grid two rsh-grid">${PLAT[st.plat].tipos.map(cartao).join('')}${cartaoPendente(st.plat)}</div>`}

document.addEventListener('click',e=>{const b=e.target.closest('[data-rsh-gerar],[data-rsh-xlsx],[data-rsh-csv],[data-rsh-mes],[data-rsh-pend],[data-rsh-per],[data-rsh-plat]');if(!b)return;const d=b.dataset;
 if(d.rshGerar)gerar(d.rshGerar);else if(d.rshXlsx)excel(d.rshXlsx);else if(d.rshCsv)csv(d.rshCsv);else if(d.rshMes)excel(d.rshMes,d.m);else if(d.rshPend)pendente(d.rshPend);else if(d.rshPlat){st.plat=d.rshPlat;redesenhar()}
 else if(d.rshPer){const [x,y]=d.rshPer.split('|');st.de=x;st.ate=y;redesenhar()}});
document.addEventListener('change',e=>{const x=e.target;if(x.matches('[data-rsh-de]'))st.de=x.value;else if(x.matches('[data-rsh-ate]'))st.ate=x.value;else return;redesenhar()});
addPage(PAG,'download','Marketplace para contabilidade',view,'Relatórios da Shopee e do Mercado Livre / Mercado Pago (pedidos, carteira, renda, liberações e saldo), prontos para o escritório de contabilidade baixar.','',()=>{});
})();
