// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Empresa nova no Jarvis: "Primeiros passos" (lista que se marca sozinha conforme a empresa conecta o Bling e os
// marketplaces, sincroniza, cadastra custos, vê o diagnóstico e convida a equipe), "Plano e assinatura" (escolha do
// plano com o preço na hora e pagamento pelo Asaas) e um aviso discreto dos dias de teste. Empresas "internas"
// (sem cobrança) não veem teste nem cobrança. Também registra a tela "Dados da empresa" (código em marca.js).
(()=>{
const st={a:null,carregada:false,integ:null,membros:null};
// Planos (os mesmos de supabase/functions/_shared/precos_jarvis.ts e do site; testes/assinatura.test.mjs confere os dois).
const PLANOS={essencial:{nome:'Essencial',mensal:197,pedidos:1000,usuarios:3,modulos:['ini','ven','fin','cad','res','rel'],resumo:'Lucro real, conciliação, financeiro e caixa, alertas por e-mail.'},
 profissional:{nome:'Profissional',mensal:397,pedidos:3000,usuarios:null,modulos:['ini','ven','fin','cad','res','rel','atd','est','pre','fis'],resumo:'Tudo do Essencial + estoque e compras, NF-e com DIFAL e GNRE, atendimento numa fila, Ads, vigia de preços, assistente com IA.'},
 premium:{nome:'Premium',mensal:697,pedidos:8000,usuarios:null,modulos:['ini','ven','fin','cad','res','rel','atd','est','pre','fis','orc','crm','pes'],resumo:'Tudo do Profissional + contabilidade automática, orçamento e forecast, folha e ponto, CRM e B2B, diretoria no bolso, suporte prioritário.'}};
const PAGINAS_PREMIUM=['contabauto','fechcontab','planocontas','bolso'];
const plano={plano:'profissional',ciclo:'mensal'};
const R=v=>typeof money==='function'?money(v):String(v);
const diasTeste=a=>a?.teste_ate?Math.ceil((new Date(a.teste_ate+'T23:59:59')-new Date())/864e5):null;

async function carregar(forca){if(!window.Cloud?.ws||(!forca&&st.carregada))return;st.carregada=true;
 try{const c=Cloud.client,ws=Cloud.ws;const [a,i]=await Promise.all([c.from('assinaturas').select('*').eq('workspace_id',ws).maybeSingle(),c.from('integrations').select('provider,status').eq('workspace_id',ws)]);
  st.a=a.data||null;st.integ=i.data||[];try{const t=await c.rpc('list_team',{ws});st.membros=(t.data||[]).length}catch{}}catch{}
 if(typeof render==='function')render()}

// ── Preço na tela (o servidor recalcula; é só para a pessoa ver antes de assinar) ──
function preco(){const p=PLANOS[plano.plano]||PLANOS.profissional;return {mensal:p.mensal,itens:[[`Plano ${p.nome}, até ${p.pedidos.toLocaleString('pt-BR')} pedidos por mês`,p.mensal]],cobrar:plano.ciclo==='anual'?p.mensal*10:p.mensal}}

// ── O que o plano libera: teste e uso interno liberam tudo; assinatura ativa ou em atraso, só o do plano. ──
function planoVigente(){const a=st.a;if(!a||['interno','teste'].includes(a.status))return null;return PLANOS[a.plano]||null}
const liberaModulo=mid=>{const p=planoVigente();return !p||p.modulos.includes(mid)};
const liberaPagina=id=>{const p=planoVigente();return !p||a_premium(p)||!PAGINAS_PREMIUM.includes(id)};
const a_premium=p=>p===PLANOS.premium;
if(window.Perfis){const mv=Perfis.moduloVisivel,pv=Perfis.paginaVisivel;
 Perfis.moduloVisivel=mid=>mv(mid)!==false&&liberaModulo(mid);
 Perfis.paginaVisivel=id=>(pv?pv(id):true)!==false&&liberaPagina(id)}

// ── Primeiros passos ──
function passos(){const con=p=>(st.integ||[]).some(i=>i.provider===p&&i.status==='conectado'),marcado=k=>{try{return localStorage.getItem('jarvis_passo_'+k)==='1'}catch{return false}};
 const custos=(window.Estoque?.lista?.()||[]).some(p=>Number(p.custo)>0);
 return [
  ['marca','Dados da empresa','Nome, logo e assinatura das mensagens aos clientes.','dadosempresa',!!String(db.gerencial?.empresa?.nome_exibicao||'').trim()],
  ['bling','Conectar o Bling','Pedidos, notas e produtos entram sozinhos (só leitura no diagnóstico).','integracoes',con('bling')],
  ['mkt','Conectar os marketplaces','Mercado Livre, Shopee e Magalu: tarifas, repasses e atendimento de cada venda.','integracoes',con('mercadolivre')||con('shopee')||con('magalu')],
  ['sync','Primeira sincronização','Os últimos meses de pedidos chegam em alguns minutos depois das conexões.','dashboard',(db.orders||[]).length>0],
  ['custo','Custos dos produtos','Sem o custo, a margem fica estimada. Use Importar planilha em Custos e embalagens ou ajuste item a item.','cadprodutos',custos],
  ['diag','Ver o diagnóstico gratuito','Margem por canal, tarifa cobrada a mais e repasse que não chegou, numa página.','diagnostico',marcado('diag')],
  ['equipe','Convidar a equipe','Cada pessoa com o seu login e só as telas do seu trabalho.','equipe',(st.membros||1)>1],
  ['plano','Escolher o plano','Continue depois do teste: o preço sai na hora pela quantidade de pedidos.','plano',st.a?.status==='ativa'||st.a?.status==='interno'],
 ]}
function viewComecar(){if(!st.carregada)carregar();const l=passos(),feitos=l.filter(p=>p[4]).length,d=diasTeste(st.a);
 return `<div class="notice"><strong>Bem-vindo ao Jarvis.</strong> Siga os passos abaixo: cada um se marca sozinho quando fica pronto. ${st.a?.status==='teste'&&d!=null?`Teste grátis: <b>${Math.max(0,d)} dia(s)</b> restante(s).`:''}</div>
 <div class="tablebox" style="margin-top:16px"><div class="tabletop"><div><h2>Primeiros passos</h2><p class="caption">${feitos} de ${l.length} concluído(s)</p></div></div>
  <div style="display:grid;gap:2px">${l.map(([k,t,s,nav,ok],i)=>`<div class="listline" style="align-items:center"><div class="row" style="gap:12px;align-items:flex-start"><span class="badge ${ok?'ok':'info'}" style="min-width:26px;justify-content:center">${ok?'✓':i+1}</span><div><strong>${t}</strong><br><span class="caption">${s}</span></div></div><button class="small ${ok?'':'primary'}" data-nav="${nav}" data-passo="${k}">${ok?'Ver':'Fazer'}</button></div>`).join('')}</div></div>`}

// ── Plano e assinatura ──
function viewPlano(){if(!st.carregada)carregar();const a=st.a,p=preco(),d=diasTeste(a),dono=window.Cloud?.role==='owner';
 const situ=!a?'':a.status==='interno'?'<span class="badge ok">Uso interno · sem cobrança</span>':a.status==='ativa'?'<span class="badge ok">Assinatura ativa</span>':a.status==='atrasada'?'<span class="badge bad">Pagamento em atraso</span>':a.status==='cancelada'?'<span class="badge bad">Assinatura cancelada</span>':`<span class="badge warn">Teste grátis · ${Math.max(0,d??0)} dia(s) com tudo liberado</span>`;
 if(a?.status==='interno')return `<div class="notice">${situ} Esta empresa usa o Jarvis sem cobrança.</div>`;
 const atual=PLANOS[a?.plano];
 return `<div class="notice">${situ} ${atual?`Plano atual: <b>${atual.nome}</b>, até ${atual.pedidos.toLocaleString('pt-BR')} pedidos por mês, ${R(a.valor_mensal||atual.mensal)}/mês.`:a?.status==='ativa'?'':'Escolha o plano para continuar depois do teste.'}${a?.status==='ativa'?' Para trocar de plano, escolha abaixo.':''} ${a?.link_pagamento&&a.status!=='ativa'?`<a href="${esc(a.link_pagamento)}" target="_blank" rel="noopener">Abrir a fatura</a>`:''}</div>
 <div class="grid three" style="margin-top:16px">${Object.entries(PLANOS).map(([k,x])=>`<button type="button" class="card" data-pl-plano="${k}" aria-pressed="${plano.plano===k}" style="text-align:left;display:block;${plano.plano===k?'border-color:var(--accent);box-shadow:0 0 0 2px rgb(var(--ar) / 25%)':''}">
  <span class="row" style="justify-content:space-between"><b style="font-size:17px">${x.nome}</b>${k==='profissional'?'<span class="badge info">mais escolhido</span>':''}</span>
  <span style="display:block;font-size:26px;font-weight:700;margin:8px 0 2px">${R(plano.ciclo==='anual'?Math.round(x.mensal*10/12):x.mensal)}<small class="caption">/mês</small></span>
  <span class="caption">Até ${x.pedidos.toLocaleString('pt-BR')} pedidos/mês · ${x.usuarios?x.usuarios+' usuários':'usuários ilimitados'}</span><span style="display:block;margin-top:8px;font-size:13px">${x.resumo}</span></button>`).join('')}</div>
 <div class="grid two" style="align-items:start;margin-top:16px">
  <form class="formcard" id="plForm" style="display:grid;gap:12px"><h2 style="margin:0">${a?.status==='ativa'?'Trocar para o plano':'Assinar o plano'} ${esc(PLANOS[plano.plano].nome)}</h2>
   <label>Pagamento<select data-pl="ciclo"><option value="mensal" ${plano.ciclo==='mensal'?'selected':''}>Mensal</option><option value="anual" ${plano.ciclo==='anual'?'selected':''}>Anual (paga 10 meses e usa 12)</option></select></label>
   ${dono?`<div class="row wrap" style="gap:10px"><label style="flex:1;min-width:180px">CNPJ de quem paga<input name="cnpj" required inputmode="numeric" placeholder="00.000.000/0000-00"></label><label style="flex:1;min-width:180px">E-mail para a fatura<input name="email" type="email" value="${esc(window.Cloud?.session?.user?.email||'')}"></label></div>
   <button class="primary">Assinar · ${R(p.cobrar)}${plano.ciclo==='anual'?'/ano':'/mês'}</button><p class="caption" style="margin:0">Boleto, Pix ou cartão.${a?.status==='ativa'?'':' O primeiro vencimento é no fim do teste grátis.'} Sem fidelidade.</p>`:'<div class="notice">Só o dono da empresa assina o plano.</div>'}
  </form>
  <div class="tablebox"><div class="tabletop"><h2>Resumo</h2></div><div class="tablewrap"><table><tbody>${p.itens.map(([t,v])=>`<tr><td>${esc(t)}</td><td class="num">${R(v)}</td></tr>`).join('')}<tr><td><b>Mensal</b></td><td class="num"><b>${R(p.mensal)}</b></td></tr>${plano.ciclo==='anual'?`<tr><td>Cobrança anual (10 × ${R(p.mensal)})</td><td class="num"><b>${R(p.cobrar)}</b></td></tr>`:''}</tbody></table></div>
   <p class="caption" style="padding:0 16px 14px">Pedidos acima do limite: R$ 49 a cada 1.000 no mês. Implantação: guiada e grátis no Essencial; R$ 490 no Profissional (grátis no anual); acompanhada e inclusa no Premium. Cancelamento com 30 dias de aviso e exportação completa dos dados. Compare tudo em jaarvis.com.br/planos.</p></div>
 </div>`}

async function assinar(f){const fd=new FormData(f);const r=await Integrations.callFn('cobranca',{action:'checkout',...plano,cnpj:fd.get('cnpj'),email:fd.get('email')});
 if(r?.error)throw Error(r.error);await carregar(true);if(r.link){window.open(r.link,'_blank','noopener');toast('Fatura aberta numa nova aba.')}else toast('Assinatura criada.')}

document.addEventListener('click',e=>{const b=e.target.closest('[data-pl-plano],[data-passo]');if(!b)return;
 if(b.dataset.plPlano){e.preventDefault();plano.plano=b.dataset.plPlano;render();return}
 if(b.dataset.passo==='diag'){try{localStorage.setItem('jarvis_passo_diag','1')}catch{}}});
document.addEventListener('change',e=>{const t=e.target;if(t.dataset.pl==='ciclo'){plano.ciclo=t.value;render()}});
document.addEventListener('submit',async e=>{if(e.target.id!=='plForm')return;e.preventDefault();const b=e.target.querySelector('button.primary');if(b)b.disabled=true;try{await assinar(e.target)}catch(x){toast(x.message||String(x))}finally{if(b)b.disabled=false}});

// Aviso discreto do teste (só em empresa em teste ou com pagamento em atraso), no Resumo da semana e na tela Hoje.
if(typeof render==='function'){const r0=render;render=function(){const r=r0.apply(this,arguments);try{aviso()}catch{}return r}}
function aviso(){if(!st.carregada){carregar();return}const a=st.a,v=document.getElementById('view');if(!v||!a||!['resumo','central'].includes(page))return;
 document.querySelector('.emp-aviso')?.remove();const d=diasTeste(a);
 const msg=a.status==='teste'?`Teste grátis: <b>${Math.max(0,d??0)} dia(s)</b> restante(s).`:a.status==='atrasada'?'<b>Pagamento da assinatura em atraso.</b>':'';if(!msg)return;
 v.insertAdjacentHTML('afterbegin',`<div class="notice emp-aviso" style="display:flex;gap:12px;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-bottom:12px"><span>${msg}</span><span class="row" style="gap:8px"><button class="small" data-nav="comecar">Primeiros passos</button><button class="small primary" data-nav="plano">Ver planos</button></span></div>`)}

// Item "Plano e assinatura" no menu do usuário (o menu é montado dentro de erp.js; empresas internas não veem).
new MutationObserver(()=>{const m=document.querySelector('#erpdrop .userhead');if(!m||!st.a||st.a.status==='interno')return;const box=m.parentElement;if(box.querySelector('[data-nav="plano"]'))return;
 const ref=box.querySelector('[data-erp-seg]'),html=`<button class="dropitem" data-nav="plano">${typeof icon==='function'?icon('tag').replace('class="icon"','class="icon" style="width:18px;height:18px"'):''}<span><strong>Plano e assinatura</strong><small>${st.a.status==='teste'?`Teste grátis · ${Math.max(0,diasTeste(st.a)??0)} dia(s)`:'Plano, fatura e pagamento'}</small></span></button>`;
 if(ref)ref.insertAdjacentHTML('beforebegin',html);else m.insertAdjacentHTML('afterend',html)}).observe(document.documentElement,{childList:true,subtree:true});
if(window.Marca?.tela){const t=Marca.tela;addPage(t.id,t.icone,t.titulo,t.view,t.sub,'',()=>{})}
addPage('comecar','check','Primeiros passos',viewComecar,'O que fazer para o Jarvis mostrar a margem real da sua operação.','',()=>{});
addPage('plano','tag','Plano e assinatura',viewPlano,'Escolha o plano pela quantidade de pedidos e assine com boleto, Pix ou cartão.','',()=>{});
// Plano escolhido no site (jaarvis.com.br/planos → ?plano=premium) já vem marcado.
{const q=(location.search.match(/[?&]plano=(essencial|profissional|premium)/)||[])[1];if(q)plano.plano=q}
window.Empresa={carregar,preco,PLANOS,PAGINAS_PREMIUM,liberaModulo,liberaPagina};
})();
