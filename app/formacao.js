// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Preços e margem › Formação de preço e Promoções. Um produto por linha e os canais lado a lado: o preço de hoje
// (editável), a margem líquida que sobra nele e o preço Alvo. Clicando numa célula abre "A conta": do preço à margem
// líquida, a regra ao lado do real dos últimos 30 dias e os três preços de referência (Piso, Mínimo e Alvo). Toda a conta
// vem do motor único (web/preco-motor.js) pelos parâmetros de Preços e margem (window.Preco, web/precificacao.js):
// custo do produto, regras dos canais, tributos, anúncios, despesas fixas e as metas. Ações em lote: aplicar o Alvo,
// reajustar %, arredondar para ,90, ajustar em massa com prévia. Importa e exporta no layout da "TABELA E-COMMERCE".
(()=>{
Object.assign(paths,{calc:'M5 3h14v18H5z M8 7h8 M8 11h2 M12 11h2 M16 11h0 M8 15h2 M12 15h2 M8 19h2 M12 19h6'});
const ui={busca:'',filtro:'todos',marca:'',sel:new Set(),conta:null,sim:null,promoCanal:'',promoTipo:''};
window.Reiniciar?.registrar(ui,['busca','filtro','marca','sel','conta']); // estado de tela: volta ao original ao clicar no menu
const P=()=>window.Preco,MM=()=>window.PrecoMotor;
const n2=v=>{if(typeof v==='string'&&/^-?\d+(\.\d+)?$/.test(v.trim()))return Number(v);const x=typeof v==='number'?v:Number(String(v??'').replace(/[R$\s]/g,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.'));return isFinite(x)?x:0};
const pc=v=>v==null||!isFinite(v)?'—':(v).toFixed(1).replace('.',',')+'%';
const nf2=v=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:0});
const arred90=v=>v<=0?0:Math.floor(v)+.9<v?Math.floor(v)+1.9:Math.floor(v)+.9;
function G(){return P().regras()}
// Grupos da planilha (abas "DVV <grupo>"): guardados só para ler a planilha antiga; o que vale na conta são as exceções
// por grupo das Regras de venda (comissão e alvo), refeitas a cada importação.
const canaisPlanilha=(icms,difal,margem)=>Object.fromEntries([['Mercado Livre',16.5],['Mercado Livre Clássico',11.5],['Magalu',18],['Shopee',20]].map(([c,com])=>[c,{pis:3.65,icms,difal,irpj:2.2,csll:1.08,comissao:com,margem,adm:1}]));
const GRUPOS_PADRAO={'Padrão':{compra:null,ipi:0,credito:0,quebra:1,embalagem:3,canais:canaisPlanilha(1,13,10)}};
const novoGrupo=()=>JSON.parse(JSON.stringify(GRUPOS_PADRAO['Padrão']));
function grupos(){const g=G();if(!g.grupos||Array.isArray(g.grupos))g.grupos={};return g.grupos}
const somaPct=o=>Object.values(o||{}).reduce((s,v)=>s+n2(v),0);
// Custo da cadeia de um grupo da planilha (fornecedor do mesmo grupo vendendo ao e-commerce): custo × (1 + quebra) e,
// com o percentual de venda da compra, ÷ (1 − %) + IPI − crédito de ICMS. Vira o custo à mão do produto.
function custoCadeia(gr,custo,quebra){const x=grupos()[gr];if(!x)return n2(custo);const b=n2(custo)*(1+n2(quebra??x.quebra)/100);if(!x.compra)return b;const pv=b/(1-somaPct(x.compra)/100);return pv+pv*n2(x.ipi)/100-pv*n2(x.credito)/100}
/** Comissão e margem de lucro dos grupos da planilha → exceções por grupo das Regras de venda. */
function excecoesDoDVV(){const R=G(),alvo=n2(R.metas.alvo),novas=R.excecoes.filter(e=>!e.daPlanilha);
 for(const [g,x] of Object.entries(grupos()))for(const [k,d] of Object.entries(x?.canais||{})){const c=R.canais[k];if(!c||!d)continue;const e={grupo:g,canal:k,daPlanilha:true};
  if(k!=='Shopee'&&d.comissao!=null&&Math.abs(n2(d.comissao)-n2(c.comissao))>0.001)e.comissao=n2(d.comissao);if(d.margem!=null&&Math.abs(n2(d.margem)-alvo)>0.001)e.alvo=n2(d.margem);if(e.comissao!=null||e.alvo!=null)novas.push(e)}
 R.excecoes=novas}
// Base: produtos do Bling e da tabela de preços (Preco.produtos) + vendas de 30 dias por canal.
function base(){return P().produtos().map(p=>({...p,custo:P().custoDe(p.id)}))}
const canais=()=>P().canaisDaTabela();
/** Para cada canal da tabela: preço do Jarvis, a conta nele, os três preços e o real de 30 dias. */
function linha(p){return canais().map(nome=>{const preco=n2(p.precos[nome]),r=preco?P().conta(p.id,nome,preco):null,pr=P().precos(p.id,nome),mt=P().metas(p.id,nome);
 return {nome,rot:P().rotulo(nome),preco,r,pr,mt,sit:r?MM().situacao(r.liqP,mt):null,real:P().real(p.id,nome)}})}
const SIT={prejuizo:['bad','abaixo do mínimo'],abaixo:['warn','abaixo do alvo'],alvo:['ok','no alvo']};
// ─── "A conta": do preço à margem líquida, regra × real 30 dias, os três preços e o markup ───
function painelConta(p,c){const rg=P().params(p.id,c.nome),pr=c.pr;if(!rg)return `<section class="card pmconta"><div class="pmtag">A conta · ${esc(p.id)}</div><h3>${esc(p.nome)}</h3><p class="caption">Sem custo do produto: cadastre em <button class="fplink" data-nav="custoproduto">Custo do produto</button>.</p></section>`;
 const preco=c.preco||pr?.alvo||0,x=MM().conta(preco,rg),rp=P().params(p.id,c.nome,'real'),xr=rp?MM().conta(preco,rp):null,PS=MM().passos(preco,rg),PR=xr?MM().passos(preco,rp):null;
 const lin=(s,i)=>`<tr class="${s.total?'t':'l2'}"><td>${esc(s.rotulo)}</td><td class="num">${money(s.valor)}</td><td class="num caption">${pc(s.pct)}</td><td class="num">${PR?money(PR[i].valor):''}</td></tr>`;
 const e=P().produto(p.id)?.extra||{},b=P().produto(p.id)?null:null,bl=p.precoBling;
 return `<section class="card pmconta pmlargo"><div class="pmtag">A conta · ${esc(p.id)} · ${esc(c.rot)}</div><h3>${esc(p.nome)} a ${money(preco)}${c.preco?'':' <span class="caption">(alvo: ainda sem preço)</span>'}</h3>
 <div class="pmcontagrid"><div><div class="tablewrap"><table class="pmwf"><thead><tr><th></th><th class="num">Regra</th><th class="num">%</th><th class="num">${xr?`Real 30 d<br><span class="caption">${nf2(rp.real.u)} un.</span>`:'Real 30 d'}</th></tr></thead><tbody>${PS.filter(s=>s.total||Math.abs(s.valor)>0.004||(PR&&Math.abs(PR[PS.indexOf(s)].valor)>0.004)).map(s=>lin(s,PS.indexOf(s))).join('')}</tbody></table></div>
 ${xr?'':'<p class="caption">Sem vendas deste produto neste canal nos últimos 30 dias: o real aparece quando houver.</p>'}</div>
 <div><div class="pmprecos"><div><small>Piso · contribuição zero</small><b>${pr?.piso?money(pr.piso):'—'}</b><span class="caption">só para queimar estoque</span></div><div><small>Mínimo · paga também anúncios e fixas</small><b>${pr?.minimo?money(pr.minimo):'—'}</b><span class="caption">abaixo disso dá prejuízo</span></div><div class="pmalvo"><small>Alvo · ${pc(c.mt.alvo)} de margem líquida</small><b>${pr?.alvo?money(pr.alvo):'—'}</b>${pr?.alvo?`<button class="small" data-fp-sug="${esc(p.id)}|${esc(c.nome)}">Usar este preço</button>`:''}</div></div>
 <p class="caption">Markup sobre o custo: ${x.markup?x.markup.toFixed(2).replace('.',','):'—'}× hoje · ${pr?.markupAlvo?pr.markupAlvo.toFixed(2).replace('.',','):'—'}× no alvo. Conta: preço = (custo + taxa fixa + frete) ÷ (1 − comissão − tributos − anúncios − fixas − meta), na faixa de preço certa. Frete: ${esc(rg.freteFonte||'—')}.</p>
 <div class="pmrow"><span class="caption">Deste produto neste canal (em branco = regra):</span><label class="caption">Frete R$ <input class="pmin" data-fp-extra="${esc(p.id)}|frete|${esc(c.nome)}" value="${e.frete?.[c.nome]!=null?String(e.frete[c.nome]).replace('.',','):''}" inputmode="decimal"></label><label class="caption">Taxa fixa R$ <input class="pmin" data-fp-extra="${esc(p.id)}|fixa|${esc(c.nome)}" value="${e.fixa?.[c.nome]!=null?String(e.fixa[c.nome]).replace('.',','):''}" inputmode="decimal"></label></div>
 <div class="notice" style="margin:10px 0 0">${bl?`No Bling hoje: <b>${money(bl)}</b>${c.preco&&Math.abs(bl-c.preco)>0.004?` <span class="badge warn">diferente do Jarvis</span>`:' (igual à tabela)'}. `:''}Os preços mudam só na tabela do Jarvis; o envio ao Bling e ao Mercado Livre, sempre com confirmação, chega na próxima fase.</div></div></div></section>`}
function kpisFormacao(L){const T=L.flatMap(x=>x.c.filter(c=>c.r)),n=T.length,ok=T.filter(c=>c.sit==='alvo').length,mn=T.filter(c=>c.sit==='prejuizo').length,ps=T.filter(c=>c.r.mcP<0).length,dif=L.filter(x=>x.p.precoBling&&x.c.some(c=>c.preco&&Math.abs(c.preco-x.p.precoBling)>0.004)).length,alvo=n2(G().metas.alvo);
 const k=(t,v,s,cl='')=>`<div class="card kpi"><span class="kpil">${t}</span><span class="kpiv ${cl}">${v}</span><span class="kpis">${s}</span></div>`;
 return `<div class="grid kpis4">${k(`Preços no alvo (${pc(alvo)} líquida)`,`${ok} de ${n}`,'preço × canal desta lista','green')}${k('Abaixo do mínimo',String(mn),'não pagam anúncios e despesas fixas',mn?'red':'')}${k('Abaixo do piso',String(ps),'vendem abaixo do custo + canal + tributos',ps?'red':'')}${k('Diferente do Bling',String(dif),'produto com preço do Jarvis ≠ preço no Bling',dif?'gold':'')}</div>`}
function view(){const q=normalized(ui.busca),CN=canais();let L=base().map(p=>({p,c:linha(p)}));
 const marcas=[...new Set(L.map(x=>x.p.marca).filter(Boolean))].sort(),todos=L;
 const F={todos:['Todos',()=>true],abaixo:['Abaixo do alvo',x=>x.c.some(c=>c.sit&&c.sit!=='alvo')],minimo:['Abaixo do mínimo',x=>x.c.some(c=>c.sit==='prejuizo')],sempreco:['Sem preço em algum canal',x=>x.p.custo&&x.c.some(c=>!c.preco)],semcusto:['Sem custo',x=>!x.p.custo]};
 L=L.filter(x=>(!q||normalized(x.p.id+' '+x.p.nome).includes(q))&&(!ui.marca||x.p.marca===ui.marca)&&F[ui.filtro][1](x));
 const vend=x=>x.c.reduce((s,c)=>s+(c.real?.venda||0),0);L.sort((a,b)=>vend(b)-vend(a)||a.p.nome.localeCompare(b.p.nome,'pt-BR'));
 ui.ultimo={L};
 const sel=ui.conta&&todos.find(x=>x.p.id===ui.conta.id),selC=sel&&(sel.c.find(c=>c.nome===ui.conta.canal)||sel.c[0]),aberto=sel?{x:sel,c:selC}:L[0]&&L[0].c[0]?{x:L[0],c:L[0].c[0]}:null;
 const cel=(x,c)=>{const s=c.sit?SIT[c.sit]:null,on=aberto&&aberto.x.p.id===x.p.id&&aberto.c.nome===c.nome;return `<td class="num fpcel ${on?'pmcelon':''}" data-fp-conta="${esc(x.p.id)}|${esc(c.nome)}"><input class="fpin" data-fp-preco="${esc(x.p.id)}|${esc(c.nome)}" value="${c.preco?c.preco.toFixed(2).replace('.',','):''}" placeholder="${c.pr?.alvo?c.pr.alvo.toFixed(2).replace('.',','):'—'}" inputmode="decimal" aria-label="Preço ${esc(c.rot)}">
  <div class="fpmeta">${c.r?`<b class="badge ${s[0]}" title="${s[1]}">${pc(c.r.liqP)}</b>`:'<span class="caption">sem preço</span>'}</div><div class="fpsub">${c.pr?.alvo?`<button class="fplink" data-fp-sug="${esc(x.p.id)}|${esc(c.nome)}" title="Aplicar o preço Alvo (${pc(c.mt.alvo)} líquida)">alvo ${money(c.pr.alvo)}</button>`:''}</div></td>`};
 return `${kpisFormacao(todos)}
 <div class="fpbar"><input type="search" id="fpBusca" placeholder="Produto ou SKU…" value="${esc(ui.busca)}">${marcas.length?`<select data-fp-marca aria-label="Grupo"><option value="">Todos os grupos</option>${marcas.map(m=>`<option ${ui.marca===m?'selected':''}>${esc(m)}</option>`).join('')}</select>`:''}
  <div class="segtabs">${Object.entries(F).map(([k,[t,f]])=>`<button class="${ui.filtro===k?'active':''}" data-fp-filtro="${k}">${t}${k==='todos'?'':` (${todos.filter(f).length})`}</button>`).join('')}</div><span style="flex:1"></span>
  <button class="small ${ui.sim?'primary':''}" data-fp="sim">${icon('sliders')} Ajustar em massa</button><button class="small" data-fp="importar">${icon('upload')} Importar planilha</button><button class="small" data-fp="versoes">${icon('refresh')} Versões</button><button class="small" data-fp="exportar">${icon('download')} Exportar tabela</button></div>
 ${ui.sim?simView(L):''}
 ${ui.sel.size?`<div class="fplote"><b>${ui.sel.size} selecionado(s)</b><button class="small primary" data-fp="lote-sug">Aplicar o preço Alvo</button><span class="row" style="gap:6px"><input id="fpPct" value="5" style="width:60px" inputmode="decimal">%<button class="small" data-fp="lote-pct">Reajustar</button></span><button class="small" data-fp="lote-90">Arredondar para ,90</button><button class="small quiet" data-fp="lote-limpar">Limpar seleção</button></div>`:''}
 ${aberto?painelConta(aberto.x.p,aberto.c):''}
 <div class="tablebox"><div class="tablewrap"><table class="fptab"><thead><tr><th style="width:28px"><input type="checkbox" class="check" data-fp-todos ${L.length&&L.every(x=>ui.sel.has(x.p.id))?'checked':''} aria-label="Selecionar todos"></th><th>Produto</th><th class="num">Custo</th>${CN.map(k=>{const c=G().canais[k];return `<th class="num">${esc(P().rotulo(k))}<br><span class="caption" style="font-weight:400">preço · líquida · alvo</span></th>`}).join('')}</tr></thead><tbody>
 ${L.slice(0,300).map(x=>`<tr><td><input type="checkbox" class="check" data-fp-sel="${esc(x.p.id)}" ${ui.sel.has(x.p.id)?'checked':''} aria-label="Selecionar ${esc(x.p.nome)}"></td>
  <td><div class="fpprod">${x.p.imagem?`<img src="${esc(x.p.imagem)}" alt="">`:'<span class="fpsem"></span>'}<div><b>${esc(x.p.nome)}</b><br><span class="caption mono">${esc(x.p.id)}${x.p.marca?' · '+esc(x.p.marca):''}${x.p.saldo!=null?` · ${nf2(x.p.saldo)} em estoque`:''}</span></div></div></td>
  <td class="num">${x.p.custo?money(x.p.custo):'<button class="fplink red" data-nav="custoproduto">sem custo</button>'}</td>${x.c.map(c=>cel(x,c)).join('')}</tr>`).join('')||`<tr><td colspan="${3+CN.length}" class="empty">Nenhum produto neste filtro.</td></tr>`}</tbody></table></div>
 <p class="caption" style="padding:8px 14px">${L.length>300?`Mostrando 300 de ${L.length}. Use a busca. `:''}Margem líquida = depois do custo do canal, dos tributos (${pc(P().tributos().pct)}), dos anúncios (${pc(P().ads().pct)}) e das despesas fixas (${pc(P().fixas().pct)}). Verde: no alvo; amarelo: abaixo do alvo; vermelho: abaixo do Mínimo. As regras (tributos, canais, despesas e metas) ficam em <button class="fplink" data-nav="regrasvenda">Regras de venda</button>; o custo, em <button class="fplink" data-nav="custoproduto">Custo do produto</button>.</p></div>`}

// ─── Ajustar em massa: nova margem líquida para os produtos da tela (ou os selecionados), prévia "hoje × depois" ───
// Novo preço = o que dá a nova margem líquida (motor), opcionalmente arredondado para ,90. Impacto = unidades reais dos
// últimos 30 dias × diferença de preço e de lucro líquido por unidade.
const simPadrao=()=>({margem:n2(G().metas.alvo),canais:new Set(canais()),escopo:'tela',arred:true,queda:0,conf:false});
function simular(L){const s=ui.sim,alvo=s.escopo==='sel'&&ui.sel.size?L.filter(x=>ui.sel.has(x.p.id)):L,linhas=[],tot={};
 for(const x of alvo){if(!x.p.custo)continue;const cs=[];
  for(const c of x.c){if(!s.canais.has(c.nome)||!c.preco)continue;const rg=P().params(x.p.id,c.nome);if(!rg)continue;let nv=MM().precoPara(s.margem,'liq',rg);if(!nv)continue;if(s.arred)nv=arred90(nv);nv=Math.round(nv*100)/100;
   const a=MM().conta(c.preco,rg),b=MM().conta(nv,rg),q=c.nome==='Mercado Livre Clássico'?0:(c.real?.u||0),t=tot[c.nome]||(tot[c.nome]={n:0,q:0,rA:0,rB:0,lA:0,lB:0,sobe:0,desce:0});
   t.n++;t.q+=q;t.rA+=q*c.preco;t.rB+=q*nv*(1-s.queda/100);t.lA+=q*a.liq;t.lB+=q*b.liq*(1-s.queda/100);if(nv>c.preco+0.004)t.sobe++;else if(nv<c.preco-0.004)t.desce++;
   cs.push({nome:c.nome,rot:c.rot,de:c.preco,para:nv,mA:a.liqP,mB:b.liqP,q})}
  if(cs.length)linhas.push({x,cs})}
 return {linhas,tot}}
function simView(L){const s=ui.sim,{linhas,tot}=simular(L),n=linhas.reduce((a,l)=>a+l.cs.length,0),dp=v=>(v>=0?'+':'')+v.toFixed(1).replace('.',',')+'%',cls=v=>v>0.05?'green':v<-0.05?'red':'',CN=canais();
 const resumo=Object.entries(tot).map(([nome,t])=>{const dl=t.lB-t.lA;return `<tr><td><strong>${esc(P().rotulo(nome))}</strong><br><span class="caption">${t.n} preço(s) · ${t.sobe} sobem · ${t.desce} descem</span></td><td class="num">${t.q?money(t.rA):'—'}</td><td class="num">${t.q?money(t.rB):'—'}</td><td class="num ${cls(t.rB-t.rA)}">${t.q?dp(t.rA?(t.rB/t.rA-1)*100:0):'—'}</td><td class="num">${t.q?money(t.lA):'—'}</td><td class="num"><b>${t.q?money(t.lB):'—'}</b></td><td class="num ${cls(dl)}"><b>${t.q?(dl>=0?'+ ':'− ')+money(Math.abs(dl)):'—'}</b></td><td class="num">${t.q?`${pc(t.rA?t.lA/t.rA*100:0)} → <b>${pc(t.rB?t.lB/t.rB*100:0)}</b>`:'—'}</td></tr>`}).join('');
 return `<div class="card fpsim" style="margin-bottom:12px"><div class="cardhead"><h2>Ajustar em massa · prévia</h2>${icon('sliders')}</div>
 <div class="row wrap" style="gap:14px;align-items:flex-end">
  <label>Nova margem líquida<span class="row" style="gap:4px"><input id="fpSimMargem" data-fp-sim="margem" value="${String(s.margem).replace('.',',')}" inputmode="decimal" style="width:70px"> %</span></label>
  <label>Produtos<select data-fp-sim="escopo"><option value="tela" ${s.escopo==='tela'?'selected':''}>Os da tela (${L.length}, com busca e filtros)</option><option value="sel" ${s.escopo==='sel'?'selected':''} ${ui.sel.size?'':'disabled'}>Os selecionados (${ui.sel.size})</option></select></label>
  <div><span class="caption">Canais</span><div class="row wrap" style="gap:8px;margin-top:4px">${CN.map(nome=>`<label class="row" style="gap:4px;font-weight:400"><input type="checkbox" class="check" data-fp-simcanal="${esc(nome)}" ${s.canais.has(nome)?'checked':''}> ${esc(P().rotulo(nome))}</label>`).join('')}</div></div>
  <label class="row" style="gap:6px;font-weight:400"><input type="checkbox" class="check" data-fp-sim="arred" ${s.arred?'checked':''}> Arredondar para ,90</label>
  <label title="Para testar o efeito de vender menos com o preço mais alto">Queda de vendas estimada<span class="row" style="gap:4px"><input data-fp-sim="queda" value="${String(s.queda).replace('.',',')}" inputmode="decimal" style="width:60px"> %</span></label></div>
 <div class="tablewrap" style="margin-top:10px"><table><thead><tr><th>Canal</th><th class="num">Faturamento hoje</th><th class="num">Faturamento depois</th><th class="num">Variação</th><th class="num">Lucro líquido hoje</th><th class="num">Lucro líquido depois</th><th class="num">Diferença</th><th class="num">Margem líquida</th></tr></thead><tbody>${resumo||'<tr><td colspan="8" class="empty">Nenhum preço para ajustar com estes filtros.</td></tr>'}</tbody></table></div>
 <p class="caption">Um mês: as unidades vendidas nos últimos 30 dias de cada produto e canal${s.queda?`, com ${String(s.queda).replace('.',',')}% a menos`:''}, no preço de hoje e no novo. ML Clássico entra só na lista de preços (as vendas do ML aparecem no Premium).</p>
 <h3 style="margin:14px 0 8px">Como está × como fica (${n} preço(s))</h3>
 <div class="tablewrap" style="max-height:460px;overflow:auto"><table><thead><tr><th>Produto</th>${CN.filter(c=>s.canais.has(c)).map(c=>`<th class="num">${esc(P().rotulo(c))}<br><span class="caption">hoje → depois · líquida</span></th>`).join('')}</tr></thead><tbody>
 ${linhas.slice(0,400).map(l=>`<tr><td><strong>${esc(l.x.p.nome)}</strong><br><span class="caption mono">${esc(l.x.p.id)}</span></td>${CN.filter(c=>s.canais.has(c)).map(nome=>{const y=l.cs.find(z=>z.nome===nome);if(!y)return '<td class="num caption">—</td>';const d=y.de?(y.para/y.de-1)*100:0;
  return `<td class="num">${money(y.de)} → <b>${money(y.para)}</b> <span class="${cls(d)}">${dp(d)}</span><br><span class="caption">${pc(y.mA)} → <b>${pc(y.mB)}</b>${y.q?` · ${nf2(y.q)} un./mês`:''}</span></td>`}).join('')}</tr>`).join('')}</tbody></table></div>
 <div class="row wrap" style="gap:10px;margin-top:12px;align-items:center"><span style="flex:1"></span><button class="quiet" data-fp="sim-fechar">Fechar sem aplicar</button><button class="primary ${s.conf?'danger':''}" data-fp="sim-aplicar" ${n?'':'disabled'}>${s.conf?`Confirmar: aplicar ${n} preço(s)`:`Aplicar ${n} preço(s)`}</button></div>
 <p class="caption">Antes de aplicar, o Jarvis guarda uma versão da tabela (botão Versões) para voltar atrás. Os preços mudam só na tabela de preços do Jarvis; nada é enviado aos marketplaces.</p></div>`}
function aplicarSim(L){const s=ui.sim,{linhas}=simular(L);let n=0;guardarVersao(`Ajuste em massa: margem líquida ${String(s.margem).replace('.',',')}% em ${linhas.length} produto(s)`);
 for(const l of linhas){const p=prod(l.x.p.id);for(const y of l.cs){p.precos[y.nome]=y.para;n++}}
 audit('Ajuste em massa aplicado',`margem líquida ${s.margem}% · ${linhas.length} produto(s) · ${n} preço(s)`);save();ui.sim=null;render();toast(`${n} preço(s) atualizado(s). Para voltar atrás, use Versões.`)}

// ─── Promoções: onde cabe desconto até o Mínimo (lucro líquido zero), com o estoque que sobra ───
// Preço médio vendido nos últimos 30 dias (Margem real) e a conta das Regras de venda nesse preço: a mesma margem
// líquida e o mesmo Mínimo da Formação de preço. Estoque: saldo do Bling ÷ ritmo de 90 dias = cobertura em dias.
function promocoes(){const B=new Map(base().map(p=>[p.id,p])),ini90=new Date(Date.now()-90*864e5).toLocaleDateString('sv-SE'),q90=new Map(),ult=new Map(),out=[],m=window.Margem?.realAnuncios?.(30)||new Map();
 for(const o of db.orders||[])for(const it of o.items||[]){const k=String(it.sku||'').trim();if(!k)continue;if(o.date>=ini90)q90.set(k,(q90.get(k)||0)+n2(it.qty));if(!ult.has(k)||o.date>ult.get(k))ult.set(k,o.date)}
 for(const [k,g] of m){const [plat,sku]=[k.slice(0,k.indexOf('|')),k.slice(k.indexOf('|')+1)],p=B.get(sku),canal=P().canalDe(plat);if(!p||!p.custo||!canal||!(g.u>0))continue;
  const pr=g.venda/g.u,L=P().conta(sku,canal,pr),ref=P().precos(sku,canal);if(!L||!ref)continue;const mt=P().metas(sku,canal),pMin=ref.minimo,desc=pr>0&&pMin?Math.max(0,(1-pMin/pr)*100):0;
  const ritmo=(q90.get(sku)||0)/90,saldo=p.saldo!=null?n2(p.saldo):null,cob=saldo!=null&&ritmo>0?saldo/ritmo:saldo>0?Infinity:null,mr=L.liqP;
  const tipo=saldo!=null&&(saldo<=0||(cob!=null&&cob<15))?'estoque':mr<0?'sem':cob!=null&&cob>120&&desc>=5?'queimar':mr>=mt.alvo&&desc>=8?'folga':desc>=3?'leve':'sem';
  out.push({id:sku,nome:p.nome,imagem:p.imagem,marca:p.marca,plat,canal,q:g.u,receita:g.venda,pr,mr,mc:L.mcP,pMin,piso:ref.piso,desc,saldo,cob,ultima:ult.get(sku)||null,tipo,lucroMes:L.liq*g.u})}
 const ord={queimar:0,folga:1,leve:2,estoque:3,sem:4};return out.sort((a,b)=>ord[a.tipo]-ord[b.tipo]||b.desc*Math.min(b.q,200)-a.desc*Math.min(a.q,200))}
const PROMO_ROT={queimar:['Queimar estoque','bad','Estoque para mais de 120 dias e espaço para desconto: promoção forte, kit ou destaque (no limite, até o Piso)'],folga:['Promoção com folga','ok','Margem líquida no alvo: dá para baixar o preço e ganhar volume'],leve:['Promoção leve','info','Cabe um desconto pequeno (cupom, frete, destaque)'],estoque:['Pouco estoque','warn','Estoque para menos de 15 dias (ou zerado): não promover antes de repor'],sem:['Sem espaço','','Margem líquida perto ou abaixo do Mínimo: não fazer promoção agora']};
function promoView(pagina){const L0=promocoes(),q=normalized(ui.busca),L=L0.filter(x=>(!ui.promoCanal||x.plat===ui.promoCanal)&&(!ui.promoTipo||x.tipo===ui.promoTipo)&&(!q||normalized(x.id+' '+x.nome).includes(q))&&(!ui.marca||x.marca===ui.marca)),cont=t=>L0.filter(x=>(!ui.promoCanal||x.plat===ui.promoCanal)&&x.tipo===t).length;
 const cob=x=>x.cob==null?'—':x.cob===Infinity?'sem venda':x.cob>999?'999+ dias':`${Math.round(x.cob)} dias`,alvo=n2(G().metas.alvo);
 return `${pagina?topoPromocao(L0.filter(x=>!ui.promoCanal||x.plat===ui.promoCanal)):''}<div class="card fpsim" style="margin-bottom:12px"><div class="cardhead"><div><h2>Onde fazer promoção</h2><p class="caption">Por produto e canal: a margem líquida no preço médio dos últimos 30 dias, quanto de desconto cabe até o Mínimo (lucro líquido zero) e quanto estoque sobra. Mesma conta e mesmas metas da Formação de preço.</p></div>${icon('tag')}</div>
 <div class="row wrap" style="gap:12px;align-items:flex-end;margin-bottom:10px">${pagina?`<input type="search" id="fpPromoBusca" placeholder="Produto ou SKU…" value="${esc(ui.busca)}" style="min-width:220px">`:''}<label>Canal<select data-fp-promo="canal"><option value="">Todos</option>${[...new Set(L0.map(x=>x.plat))].map(c=>`<option ${ui.promoCanal===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
  <div class="segtabs" style="margin:0"><button class="${!ui.promoTipo?'active':''}" data-fp-promotipo="">Todos</button>${Object.entries(PROMO_ROT).map(([k,[t]])=>`<button class="${ui.promoTipo===k?'active':''}" data-fp-promotipo="${k}">${t} (${cont(k)})</button>`).join('')}</div></div>
 <div class="tablewrap" style="max-height:520px;overflow:auto"><table><thead><tr><th>Produto</th><th>Canal</th><th>Sugestão</th><th class="num">Vendas 30d</th><th class="num">Preço médio</th><th class="num">Margem líquida</th><th class="num" title="Desconto máximo sobre o preço médio até o Mínimo">Desconto que cabe</th><th class="num">Mínimo · piso</th><th class="num">Estoque</th><th class="num" title="Saldo ÷ ritmo de venda dos últimos 90 dias">Cobertura</th></tr></thead><tbody>
 ${L.slice(0,300).map(x=>{const [t,tom,d]=PROMO_ROT[x.tipo];return `<tr><td class="comfoto">${x.imagem?`<span class="pfoto"><img src="${esc(x.imagem)}" alt="" loading="lazy" onerror="this.remove()"></span>`:''}<button class="fplink" data-fp-abrir="${esc(x.id)}|${esc(x.canal)}">${esc(x.nome)}</button><br><span class="caption mono">${esc(x.id)}</span></td><td>${esc(x.plat)}</td><td><span class="badge ${tom}" title="${esc(d)}">${t}</span></td><td class="num">${nf2(x.q)} un.<br><span class="caption">${money(x.receita)}</span></td><td class="num">${money(x.pr)}</td><td class="num"><b class="${x.mr<0?'red':x.mr<alvo?'gold':'green'}">${pc(x.mr)}</b><br><span class="caption">contrib. ${pc(x.mc)}</span></td><td class="num"><b>${x.desc>=0.5?pc(x.desc):'—'}</b></td><td class="num">${x.pMin?money(x.pMin):'—'}<br><span class="caption">${x.piso?money(x.piso):'—'}</span></td><td class="num">${x.saldo!=null?nf2(x.saldo):'—'}</td><td class="num">${cob(x)}</td></tr>`}).join('')||'<tr><td colspan="10" class="empty">Nenhum produto neste filtro.</td></tr>'}</tbody></table></div>
 <p class="caption">O desconto é sobre o preço médio vendido. Comissão, tributos, anúncios e despesas fixas baixam junto com o preço; custo, taxa fixa e frete não. Na Shopee, um preço que cai de faixa muda a comissão e a taxa fixa (a conta já considera). Abaixo do Mínimo a venda dá prejuízo; abaixo do Piso não paga nem o produto.</p></div>`}
const kv=(t,v,s,cls='')=>`<div><small>${t}</small><b class="${cls}">${v}</b><span>${s||''}</span></div>`;
function topoPromocao(L0){const c=t=>L0.filter(x=>x.tipo===t),q=c('queimar'),med=q.length?q.reduce((s,x)=>s+x.desc,0)/q.length:0;
 // O mesmo produto aparece uma vez por canal, mas o estoque é um só: conta cada SKU uma vez (no preço médio dos canais).
 const porSku=new Map();for(const x of q){const y=porSku.get(x.id)||{saldo:x.saldo>0?x.saldo:0,pr:0,n:0};y.pr+=x.pr;y.n++;porSku.set(x.id,y)}
 const valor=[...porSku.values()].reduce((s,y)=>s+y.saldo*y.pr/y.n,0),np=porSku.size;
 const frase=q.length?`${np} ${np>1?'itens parados':'item parado'} com espaço para desconto: cerca de ${money(valor)} em estoque que dá para girar com até ${pc(med)} de desconto médio.`:c('folga').length?`${new Set(c('folga').map(x=>x.id)).size} produto(s) vendem bem e têm margem para uma promoção que traga volume (${c('folga').length} anúncio(s) contando cada canal).`:'Nenhum produto com folga para promoção agora: a margem líquida está perto do Mínimo.';
 const top=[...q,...c('folga')].sort((a,b)=>b.desc-a.desc).filter((x,i,arr)=>arr.findIndex(y=>y.id===x.id)===i).slice(0,4);
 return `<section class="vgv-hero"><div class="vgv-luz" aria-hidden="true"></div><div class="vgv-top"><div><span class="vgv-eyebrow">Onde fazer promoção · até o Mínimo (lucro líquido zero)</span><h2>${esc(frase)}</h2></div>
  <div class="vgv-kpis vgv-kpis4">${kv('Queimar estoque',String(q.length),'mais de 120 dias · por canal','bad')}${kv('Com folga',String(c('folga').length),'no alvo · por canal','ok')}${kv('Promoção leve',String(c('leve').length),'cupom ou frete · por canal')}${kv('Não mexer',String(c('sem').length+c('estoque').length),'sem espaço ou estoque · por canal','warn')}</div></div>
  ${top.length?`<div class="vgv-vitrine"><span class="vgv-eyebrow">Melhores candidatos</span><div class="vgv-itens vgv-itens4">${top.map((x,i)=>`<button class="vgv-item" data-fp-abrir="${esc(x.id)}|${esc(x.canal)}" style="--i:${i}"><span class="vgv-img">${x.imagem?`<img src="${esc(x.imagem)}" alt="" loading="lazy" onerror="this.remove()">`:''}</span><b title="${esc(x.nome)}">${esc(x.nome)}</b><small>até ${pc(x.desc)} · ${x.saldo!=null?`${nf2(x.saldo)} un.`:''} · ${esc(x.plat)}</small></button>`).join('')}</div></div>`:''}</section>`}
// Importa a planilha de preço: abas de produtos (uma por grupo ou por marca) e, se houver, as abas "DVV <grupo>",
// que atualizam (ou criam) os percentuais de cada grupo e as faixas da Shopee. Aba de produtos com o mesmo nome de
// um grupo usa o DVV dele; as demais são tratadas como marca, pelas regras dos canais.
const GRUPO_DA_ABA=nome=>{const n=normalized(String(nome||'')).trim();if(!n)return null;return Object.keys(grupos()).find(g=>normalized(g).trim()===n)||null};
const escRe=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function lerDVV(wb){let n=0;
 for(const aba of wb.SheetNames){const m=String(aba).trim().match(/^dvv\s+(.+)$/i);if(!m)continue;const nomeGr=m[1].trim(),gr=GRUPO_DA_ABA(nomeGr)||nomeGr;if(!grupos()[gr])grupos()[gr]=novoGrupo();const G_=grupos()[gr];
  const R=XLSX.utils.sheet_to_json(wb.Sheets[aba],{header:1,raw:true,defval:''});
  const chave=l=>{l=normalized(String(l));return /^pis/.test(l)?'pis':/^difal/.test(l)?'difal':/^icms/.test(l)?'icms':/^irpj/.test(l)?'irpj':/^csll/.test(l)?'csll':/^(comiss|maketeplece|marketplace)/.test(l)?'comissao':/^margem/.test(l)?'margem':/^vendas/.test(l)?'adm':null};
  const bloco=(i,j)=>{const o={};for(let k=i+1;k<Math.min(R.length,i+20);k++){const rot=normalized(String(R[k][j]||''));if(/^total d v v/.test(rot))break;const c=chave(R[k][j]);const v=R[k][j+1];if(c&&v!==''&&isFinite(Number(v)))o[c]=Math.round(Number(v)*10000)/100}return o};
  for(let i=0;i<R.length;i++)for(let j=0;j<R[i].length;j++){const t=normalized(String(R[i][j]||'')).trim();if(!t)continue;
   let canal=null;if(/^mercado livre premium$/.test(t))canal='Mercado Livre';else if(/^mercado livre classico$/.test(t))canal='Mercado Livre Clássico';else if(t==='magalu')canal='Magalu';else if(t==='shopee')canal='Shopee';
   if(canal){const o=bloco(i,j);if(Object.keys(o).length){G_.canais[canal]={...(G_.canais[canal]||{}),...o};n++}continue}
   if(/^dvv venda .+ x/.test(t)){const o=bloco(i,j);delete o.difal;delete o.comissao;delete o.margem;delete o.adm;if(Object.keys(o).length){G_.compra=o;n++}continue}
   if(t==='valor produto'){const fx=[];for(let k=i+1;k<Math.min(R.length,i+10);k++){const ate=Number(R[k][j+1]),tx=Number(R[k][j+2]);if(!isFinite(tx)||R[k][j+2]==='')break;fx.push([isFinite(ate)&&R[k][j+1]!==''?ate:1e9,tx])}if(fx.length){fx[fx.length-1][0]=1e9;G().faixasShopee=fx;n++}}}}
 return n}
// Versões: antes de cada importação a tabela inteira (preços, fretes, taxas, grupos e exceções) é guardada; as 5 últimas ficam para restaurar.
const foto=()=>JSON.parse(JSON.stringify({produtos:db.products||[],grupos:G().grupos||null,faixas:G().faixasShopee||null,excecoes:G().excecoes||[]}));
function guardarVersao(motivo,arquivo){const g=G(),f=foto();g.versoes=[{em:new Date().toISOString(),motivo,arquivo:arquivo||null,por:window.Cloud?.session?.user?.email||'local',itens:f.produtos.length,...f},...(g.versoes||[])].slice(0,5)}
async function importar(file){const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});grupos();let n=0,fora=0,abas=[];const importados=new Set();
 guardarVersao('Antes de importar a planilha',file.name);
 const blocosDVV=lerDVV(wb);
 const oculta=nome=>!!(wb.Workbook?.Sheets||[]).find(x=>x.name===nome)?.Hidden;
 for(const nome of wb.SheetNames){if(oculta(nome)||/^dvv /.test(normalized(nome))||/base dados|base_dados/.test(normalized(nome)))continue;
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[nome],{header:1,raw:true,defval:''});const hi=rows.findIndex(r=>r.some(c=>/c[oó]digo/i.test(String(c)))&&r.some(c=>/shopee/i.test(String(c))));if(hi<0)continue;
  const cab=rows[hi].map(c=>normalized(String(c)).trim()),col=re=>cab.findIndex(c=>re.test(c));
  const gr=GRUPO_DA_ABA(nome),G_=gr&&grupos()[gr];
  const C={cod:col(/codigo/),desc:col(/descri/),custo:col(gr?new RegExp('^custo( '+escRe(normalized(gr).trim())+')?$'):/^custo$/),quebra:col(/^% quebra$/),quebraCab:col(/^custo \+ .*quebra/),emb:col(/^custo embalagem/),ipi:col(/^ipi/),credito:col(/^credito icms/),
   freteMlp:col(/^frete mercado livre premium/),freteMlc:col(/^frete mercado livre +classico/),freteMl:col(/^frete mercado/),mlp:col(/premium/),mlc:col(/^tabela mercado livre +classico/),taxaMag:col(/taxa magalu/),freteMag:col(/frete magalu/),mag:col(/tabela magalu/),taxaShp:col(/taxa shopee/),shp:col(/tabela shopee/)};
  if(C.mlc<0)C.mlc=col(/classico/);if(C.mlp>=0&&/^frete/.test(cab[C.mlp]))C.mlp=col(/^tabela mercado livre premium/);
  // IPI e crédito de ICMS da cadeia (linha acima do cabeçalho, como na planilha)
  if(G_&&hi>0){const pct=i=>{const v=Number(rows[hi-1]?.[i]);return i>=0&&isFinite(v)&&v>0&&v<1?Math.round(v*10000)/100:null};const ipi=pct(C.ipi),cr=pct(C.credito);if(ipi!=null)G_.ipi=ipi;if(cr!=null)G_.credito=cr;const qb=pct(C.quebraCab);if(qb!=null)G_.quebra=qb}
  const marca=gr||String(rows[0]?.find(c=>String(c).trim()&&isNaN(Number(c)))||nome).replace(/tabela de pre[cç]o e-?commerce/i,'').trim()||nome;abas.push(marca);
  const lista=window.Estoque?.lista?.()||[];
  for(const r of rows.slice(hi+1)){const cod=String(r[C.cod]??'').trim();if(!cod)continue;
   const id=lista.find(p=>String(p.id).replace(/^CS/i,'').toUpperCase()===cod.replace(/^CS/i,'').toUpperCase())?.id;
   if(!id){fora++;continue}
   const p=prod(id);if(!p.nome||p.nome===id)p.nome=String(r[C.desc]||p.nome);
   if(!importados.has(id)){p.precos={};p.extra={...p.extra,frete:{},fixa:{}};importados.add(id)}p.extra.fonte='planilha';p.extra.arquivo=file.name;
   const set=(canal,i)=>{const v=n2(r[i]);if(i>=0&&v>0)p.precos[canal]=Math.round(v*100)/100};set('Mercado Livre',C.mlp);set('Mercado Livre Clássico',C.mlc);set('Magalu',C.mag);set('Shopee',C.shp);
   const ex=(campo,canal,i)=>{if(i<0||r[i]==='')return;const v=n2(r[i]);p.extra[campo]={...(p.extra[campo]||{}),[canal]:v}};
   ex('frete','Mercado Livre',C.freteMlp>=0?C.freteMlp:C.freteMl);ex('frete','Mercado Livre Clássico',C.freteMlc>=0?C.freteMlc:C.freteMl);ex('frete','Magalu',C.freteMag);ex('fixa','Magalu',C.taxaMag);ex('fixa','Shopee',C.taxaShp);
   if(gr){p.extra.grupo=gr;if(C.custo>=0&&n2(r[C.custo])>0)p.extra.custoOrigem=Math.round(n2(r[C.custo])*10000)/10000;if(C.quebra>=0&&r[C.quebra]!=='')p.extra.quebra=Math.round(n2(r[C.quebra])*10000)/100;else delete p.extra.quebra;if(C.emb>=0)p.embalagem=n2(r[C.emb]);
    if(p.extra.custoOrigem){p.custo=Math.round(custoCadeia(gr,p.extra.custoOrigem,p.extra.quebra)*100)/100;p.extra.custoManual=true}}
   p.extra.marca=marca;n++}}
 if(!n&&!blocosDVV){G().versoes=(G().versoes||[]).slice(1);throw Error('Não encontrei o layout da tabela (colunas Código … Tabela Shopee).')}
 const saem=(db.products||[]).filter(p=>p.extra?.fonte==='planilha'&&!importados.has(String(p.id)));if(n&&saem.length)db.products=db.products.filter(p=>!saem.includes(p));
 if(blocosDVV)excecoesDoDVV();
 audit('Tabela de preços importada',`${file.name} · ${n} produto(s) · ${abas.join(', ')}${blocosDVV?` · comissão e margem dos grupos lidas (${blocosDVV} bloco(s)) e levadas às exceções por grupo`:''}${fora?` · ${fora} código(s) sem produto no Bling`:''}`);save();render();
 toast(`${n} produto(s) importado(s) de ${abas.join(', ')}${blocosDVV?' e a comissão e a margem de cada grupo levadas às exceções das Regras de venda':''}.${fora?` ${fora} código(s) da planilha ainda não existem no Bling e ficaram de fora.`:''}`)}
function janelaVersoes(){const vs=G().versoes||[];
 modal('Versões da tabela de preços',`<p class="caption" style="margin-top:-8px">Antes de cada importação, a tabela inteira (preços, fretes, taxas e exceções por grupo) é guardada. Restaurar troca a tabela atual pela versão escolhida, e a atual também fica guardada.</p>
 <div class="tablewrap"><table><thead><tr><th>Guardada em</th><th>Motivo</th><th class="num">Produtos</th><th></th></tr></thead><tbody>${vs.map((v,i)=>`<tr><td>${new Date(v.em).toLocaleString('pt-BR')}<br><span class="caption">${esc(String(v.por||'').split('@')[0])}</span></td><td>${esc(v.motivo)}${v.arquivo?`<br><span class="caption">${esc(v.arquivo)}</span>`:''}</td><td class="num">${v.itens}</td><td><button class="small" data-fp-restaurar="${i}">Restaurar</button></td></tr>`).join('')||'<tr><td colspan="4" class="empty">Nenhuma versão guardada ainda.</td></tr>'}</tbody></table></div>
 <div class="modalfoot"><button class="primary" data-action="close">Fechar</button></div>`)}
function restaurar(i){const g=G(),v=(g.versoes||[])[i];if(!v)return;const atual=foto();db.products=JSON.parse(JSON.stringify(v.produtos||[]));if(v.grupos)g.grupos=v.grupos;if(v.excecoes)g.excecoes=v.excecoes;if(v.faixas)g.faixasShopee=v.faixas;
 g.versoes=[{em:new Date().toISOString(),motivo:'Antes de restaurar a versão de '+new Date(v.em).toLocaleString('pt-BR'),arquivo:null,por:window.Cloud?.session?.user?.email||'local',itens:atual.produtos.length,...atual},...g.versoes.filter((_,k)=>k!==i)].slice(0,5);
 audit('Tabela de preços restaurada',`versão de ${new Date(v.em).toLocaleString('pt-BR')} · ${v.itens} produto(s)`);save();closeModal();render();toast('Versão restaurada.')}
// Grava na tabela de preços (db.products → pricing_products), criando a linha do produto na primeira alteração.
function prod(id){db.products=db.products||[];let p=db.products.find(x=>String(x.id)===String(id));if(!p){const b=base().find(x=>x.id===id)||{};p={id,nome:b.nome||id,custo:0,embalagem:0,precos:{},extra:{}};db.products.push(p)}p.precos=p.precos||{};p.extra=p.extra||{};return p}
function aplicar(ids,fn,txt){let n=0;for(const id of ids){const b=base().find(x=>x.id===id);if(!b)continue;const p=prod(id);for(const nome of canais()){const v=fn(b,nome);if(v>0){p.precos[nome]=Math.round(v*100)/100;n++}}}audit(txt,`${ids.length} produto(s) · ${n} preço(s)`);save();render();toast(`${n} preço(s) atualizado(s).`)}
const alvoDe=(id,nome)=>P().precos(id,nome)?.alvo||0;
function exportar(){const L=base(),porMarca=new Map();for(const p of L){const m=p.marca||'Produtos';(porMarca.get(m)||porMarca.set(m,[]).get(m)).push(p)}const wb=XLSX.utils.book_new(),pr=(p,k)=>P().params(p.id,k)||{};
 for(const [m,ps] of porMarca){const rows=[[`Tabela de preço e-Commerce ${m}`],['Código','Descrição','Custo','Frete Mercado Livre','Tabela Mercado Livre Premium','Tabela Mercado Livre Clássico','Taxa Magalu','Frete Magalu','Tabela Magalu','Taxa Shopee','Tabela Shopee','Margem líquida ML Premium %','Alvo ML Premium','Mínimo ML Premium'],
  ...ps.map(p=>{const x=P().resumo(p.id,'Mercado Livre',n2(p.precos['Mercado Livre']));return [p.id,p.nome,p.custo,pr(p,'Mercado Livre').frete??'',n2(p.precos['Mercado Livre']),n2(p.precos['Mercado Livre Clássico']),pr(p,'Magalu').fixa??'',pr(p,'Magalu').frete??'',n2(p.precos['Magalu']),p.extra?.fixa?.Shopee??'',n2(p.precos['Shopee']),x?Math.round(x.liqP*10)/10:'',x?.alvo||'',x?.minimo||'']})];XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),m.slice(0,31))}
 XLSX.writeFile(wb,`TABELA E-COMMERCE_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'.')}.xlsx`)}
function abrir(id,canal){ui.busca='';ui.filtro='todos';ui.conta={id,canal:canal||P().canalPrincipal(id)};if(page!=='formacao')navigate('formacao');else render()}
document.addEventListener('change',e=>{const x=e.target;const d=x.dataset;
 if(d.fpPreco){const [id,canal]=d.fpPreco.split('|');const p=prod(id),v=n2(x.value);if(v>0)p.precos[canal]=Math.round(v*100)/100;else delete p.precos[canal];ui.conta={id,canal};audit('Preço ajustado',`${id} · ${canal} · ${v?money(v):'removido'}`);save();render();return}
 if(d.fpExtra){const [id,campo,canal]=d.fpExtra.split('|'),p=prod(id);p.extra[campo]={...(p.extra[campo]||{})};if(String(x.value).trim()==='')delete p.extra[campo][canal];else p.extra[campo][canal]=n2(x.value);audit('Custo do canal deste produto',`${id} · ${canal} · ${campo} = ${x.value||'regra'}`);save();render();return}
 if(x.matches('[data-fp-marca]')){ui.marca=x.value;render();return}
 if(x.matches('[data-fp-sel]')){x.checked?ui.sel.add(x.dataset.fpSel):ui.sel.delete(x.dataset.fpSel);render();return}
 if(x.matches('[data-fp-todos]')){const ids=[...document.querySelectorAll('[data-fp-sel]')].map(i=>i.dataset.fpSel);ids.forEach(i=>x.checked?ui.sel.add(i):ui.sel.delete(i));render();return}
 if(d.fpPromo==='canal'){ui.promoCanal=x.value;render();return}
 if(!ui.sim)return;
 if(d.fpSimcanal){x.checked?ui.sim.canais.add(d.fpSimcanal):ui.sim.canais.delete(d.fpSimcanal);ui.sim.conf=false;render();return}
 const k=d.fpSim;if(!k)return;if(k==='arred')ui.sim[k]=x.checked;else if(k==='escopo')ui.sim.escopo=x.value;else{const v=n2(String(x.value).replace(',','.'));if(k==='margem'&&!(v>-50&&v<80)){toast('Margem entre -50% e 80%.');return}if(k==='queda'&&!(v>=0&&v<100)){toast('Queda entre 0% e 99%.');return}ui.sim[k]=v}ui.sim.conf=false;render()});
document.addEventListener('input',e=>{const x=e.target;if(x.id==='fpBusca'||x.id==='fpPromoBusca'){ui.busca=x.value;const p=x.selectionStart,id=x.id;render();const nn=$('#'+id);if(nn){nn.focus();try{nn.setSelectionRange(p,p)}catch{}}}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-fp],[data-fp-promotipo],[data-fp-filtro],[data-fp-sug],[data-fp-abrir],[data-fp-restaurar],[data-fp-conta]');if(!b)return;const d=b.dataset;
 if(d.fpConta){if(e.target.closest('input,button,select'))return;const [id,canal]=d.fpConta.split('|');ui.conta={id,canal};render();return}
 if(d.fpRestaurar!=null){if(b.dataset.conf!=='1'){b.dataset.conf='1';b.textContent='Confirmar';b.classList.add('danger');return}restaurar(Number(d.fpRestaurar));return}
 if(d.fpFiltro){ui.filtro=d.fpFiltro;render();return}
 if(d.fpPromotipo!=null){ui.promoTipo=d.fpPromotipo;render();return}
 if(d.fpAbrir){const [id,canal]=d.fpAbrir.split('|');abrir(id,canal);return}
 if(d.fpSug){const [id,canal]=d.fpSug.split('|'),v=alvoDe(id,canal);if(!v)return toast('Sem custo do produto para calcular o alvo.');const p=prod(id);p.precos[canal]=v;ui.conta={id,canal};audit('Preço alvo aplicado',`${id} · ${canal} · ${money(v)}`);save();render();return}
 switch(d.fp){case 'importar':{const i=document.createElement('input');i.type='file';i.accept='.xlsx,.xls';i.id='fpArq';i.style.display='none';document.body.appendChild(i);i.onchange=()=>{importar(i.files[0]).catch(er=>toast(er.message));i.remove()};i.click();break}
  case 'exportar':exportar();break;
  case 'sim':ui.sim=ui.sim?null:simPadrao();render();break;
  case 'sim-fechar':ui.sim=null;render();break;
  case 'sim-aplicar':{if(!ui.sim)break;if(!ui.sim.conf){ui.sim.conf=true;render();break}aplicarSim(ui.ultimo.L);break}
  case 'versoes':janelaVersoes();break;
  case 'lote-sug':aplicar([...ui.sel],(p,nome)=>alvoDe(p.id,nome),'Preço alvo aplicado em lote');break;
  case 'lote-pct':{const f=1+n2($('#fpPct').value)/100;aplicar([...ui.sel],(p,nome)=>n2(p.precos[nome])*f,`Reajuste de ${$('#fpPct').value}% em lote`);break}
  case 'lote-90':aplicar([...ui.sel],(p,nome)=>arred90(n2(p.precos[nome])),'Preços arredondados para ,90');break;
  case 'lote-limpar':ui.sel.clear();render();break}});
window.Formacao={importar,grupos,promocoes,topoPromocao,abrir,
 simulacao:(margem,canaisSim)=>{const u=ui.ultimo||(view(),ui.ultimo);const s0=ui.sim;ui.sim={...simPadrao(),margem,...(canaisSim?{canais:new Set(canaisSim)}:{})};const r=simular(u.L);ui.sim=s0;return r},
 linhaDe:id=>{const p=base().find(x=>x.id===id);return p?{p,c:linha(p)}:null},versoes:()=>G().versoes||[]};
addPage('formacao','calc','Formação de preço',view,'Para cada produto e canal: o preço de hoje, a margem líquida que sobra nele e os três preços de referência (Piso, Mínimo e Alvo). Clique numa célula para ver a conta passo a passo.','',()=>{});
addPage('promocao','tag','Promoções',()=>promoView(true),'Onde dá para fazer promoção: a margem líquida de cada produto e canal, o desconto que cabe até o Mínimo e o estoque que sobra.','',()=>{});
})();
