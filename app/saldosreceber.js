// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Relatórios › Saldos a receber por plataforma: de onde vem e para onde vai o saldo a receber de cada marketplace
// (Shopee primeiro), por dia, semana ou mês, em qualquer período — composição (saldo inicial + vendas − taxas −
// cancelamentos − repasses ± ajustes = saldo final), posição numa data com os pedidos e a idade de cada um, e a
// conferência com o saldo que a Shopee e o Mercado Pago informam. Só lê os pedidos e as liberações já carregados
// (db.orders, db.receipts), com as mesmas regras da conciliação; as contas ficam em web/saldosreceber-motor.js.
(()=>{
const PAG='saldosreceber',M=window.SaldosReceberMotor;
const hoje=()=>new Date().toLocaleDateString('sv-SE');
const ATALHOS=[['hoje','Hoje'],['ontem','Ontem'],['7d','7 dias'],['30d','30 dias'],['mes','Este mês'],['mesant','Mês passado'],['ano','Este ano']];
function intervalo(k){const h=hoje(),d=n=>M.somaDias(h,n),[y,m]=h.split('-').map(Number),iso=t=>new Date(t).toISOString().slice(0,10);
 return {hoje:[h,h],ontem:[d(-1),d(-1)],'7d':[d(-6),h],'30d':[d(-29),h],mes:[h.slice(0,8)+'01',h],mesant:[iso(Date.UTC(y,m-2,1)),iso(Date.UTC(y,m-1,0))],ano:[`${y}-01-01`,h]}[k]}
const ui={atalho:'mes',de:'',ate:'',quebra:'dia',plat:'',conta:'',aba:'composicao',data:'',faixa:'',todos:false,dias:15,imprimir:false};
window.Reiniciar?.registrar(ui,['atalho','de','ate','quebra','plat','conta','aba','data','faixa','todos','dias']);
const conf={}; // consultas à plataforma (Shopee / Mercado Livre): {carregando, em, informado, erro, resumo}
const periodo=()=>{if(!ui.de||!ui.ate){const [a,b]=intervalo(ui.atalho)||intervalo('mes');ui.de=a;ui.ate=b}return [ui.de,ui.ate]};
const dataPos=()=>ui.data||periodo()[1];
const R=v=>money(M.r2(v)),dBR=M.dBR;
const sinal=v=>Math.abs(v)<0.005?'<span class="sr-zero">—</span>':R(v);
const curto=v=>{const a=Math.abs(v),s=v<0?'−':'';return a>=1e6?`${s}${(a/1e6).toLocaleString('pt-BR',{maximumFractionDigits:1})} mi`:a>=1e3?`${s}${(a/1e3).toLocaleString('pt-BR',{maximumFractionDigits:a>=1e4?0:1})} mil`:`${s}${Math.round(a)}`};
const pode=()=>!window.Cloud?.role||['owner','member','financeiro','contador'].includes(window.Cloud.role);
const podeConsultar=()=>!!window.Cloud?.ws&&['owner','member','financeiro','contador'].includes(window.Cloud?.role);
const demo=()=>!!window.JARVIS_DEMO;
const redesenhar=()=>{if(page===PAG)render()};
// Cores das plataformas no gráfico (paleta categórica conferida para os dois temas; a cor segue a plataforma).
const COR={'Shopee':'c1','Mercado Livre':'c3','Magalu':'c2','TikTok Shop':'c4'};
const cor=g=>COR[g]||'c5';
const fechados=()=>new Set(Object.keys(db.closures||{}));

function dados(){const [de,ate]=periodo();const base={orders:db.orders||[],receipts:db.receipts||[],plataforma:ui.plat,conta:ui.conta};
 const comp=M.composicao({...base,de,ate,quebra:ui.quebra});return {de,ate,base,comp}}

// ───────── Composição
const COLS=M.COLS;
function colunasVisiveis(comp){return COLS.filter(c=>['vendas','taxas','repasses'].includes(c)||comp.geral.linhas.some(l=>Math.abs(l[c])>=0.005)||comp.grupos.some(g=>Math.abs(g.total[c])>=0.005))}
const CAB={inicial:'Saldo inicial',vendas:'(+) Vendas',taxas:'(−) Taxas',cancel:'(−) Cancelamentos',repasses:'(−) Repasses',estornos:'(+) Estornos',ajustes:'(±) Ajustes',semVinculo:'(−) Sem vínculo',final:'Saldo final'};
const DICA={vendas:'Bruto dos pedidos, pela data do pedido',taxas:'Taxas e comissões do pedido',cancel:'Pedidos cancelados ou reembolsados (taxa ≥ 95% do bruto), pela data do cancelamento; sem ela, pela data do pedido (marcado com *: data estimada)',repasses:'Liberações vinculadas a pedidos, pela data da liberação',estornos:'Liberações negativas vinculadas (débito da plataforma no pedido)',ajustes:'Ajustes da plataforma (com ou sem pedido)',semVinculo:'Liberações sem pedido vinculado: descontadas do saldo como "não identificado"'};
// Cancelamento sem data informada conta na data do pedido: a célula ganha o * de "data estimada".
const est=l=>Math.abs(l.cancelEst||0)>=0.005?`<sup class="sr-est" title="${esc(`Inclui ${R(Math.abs(l.cancelEst))} de cancelamento(s) sem a data do cancelamento, contados na data do pedido (data estimada)`)}">*</sup>`:'';
const celula=(l,c)=>{const e=c==='cancel'?est(l):'';return `<td class="num">${e?`<span class="sr-nw">${sinal(l[c])}${e}</span>`:sinal(l[c])}</td>`};
function tabelaComp(linhas,total,cols,{rotuloTotal='Total do período',fechado}={}){
 return `<div class="tablewrap sr-tab"><table><thead><tr><th>Período</th><th class="num">${CAB.inicial}</th>${cols.map(c=>`<th class="num" title="${esc(DICA[c])}">${CAB[c]}</th>`).join('')}<th class="num">${CAB.final}</th></tr></thead>
 <tbody>${linhas.map(l=>`<tr><td>${esc(l.rotulo)}${fechado&&fechado.has(l.ini.slice(0,7))&&ui.quebra==='mes'?' <span class="badge info">fechado</span>':''}</td><td class="num">${sinal(l.inicial)}</td>${cols.map(c=>celula(l,c)).join('')}<td class="num"><b>${R(l.final)}</b></td></tr>`).join('')}</tbody>
 <tfoot><tr class="sr-totl"><td>${esc(rotuloTotal)}</td><td class="num">${R(total.inicial)}</td>${cols.map(c=>celula(total,c)).join('')}<td class="num">${R(total.final)}</td></tr></tfoot></table></div>`}
function resumoPlataformas(comp,cols){if(!comp.grupos.length)return '';
 return `<section class="card sr-card"><div class="cardhead"><div><h2>Total por plataforma</h2><p class="caption">${dBR(comp.periodos[0]?.ini)} a ${dBR(comp.periodos.at(-1)?.fim)} · cada coluna é o efeito no saldo; a soma da linha dá o saldo final.</p></div></div>
 <div class="tablewrap sr-tab"><table><thead><tr><th>Plataforma</th><th class="num">${CAB.inicial}</th>${cols.map(c=>`<th class="num" title="${esc(DICA[c])}">${CAB[c]}</th>`).join('')}<th class="num">${CAB.final}</th></tr></thead>
 <tbody>${comp.grupos.map(g=>`<tr class="${g.grupo==='Shopee'?'sr-dest':''}"><td><span class="sr-sw ${cor(g.grupo)}"></span>${esc(g.nome)}</td><td class="num">${R(g.total.inicial)}</td>${cols.map(c=>celula(g.total,c)).join('')}<td class="num"><b>${R(g.total.final)}</b></td></tr>`).join('')}</tbody>
 <tfoot><tr class="sr-totl"><td>Todas</td><td class="num">${R(comp.geral.total.inicial)}</td>${cols.map(c=>celula(comp.geral.total,c)).join('')}<td class="num">${R(comp.geral.total.final)}</td></tr></tfoot></table></div></section>`}
function abaComposicao(D){const {comp}=D,cols=colunasVisiveis(comp),f=fechados();
 if(!comp.grupos.length)return `<div class="empty">Nenhum pedido nem liberação até ${dBR(D.ate)}${ui.plat?` em ${esc(M.nomeGrupo(ui.plat))}`:''}.</div>`;
 const longo=comp.periodos.length>120?`<p class="caption">${comp.periodos.length} períodos: para ler melhor, quebre por semana ou mês.</p>`:'';
 return `${grafico()}${resumoPlataformas(comp,cols)}
 ${comp.grupos.map(g=>`<section class="card sr-card ${g.grupo==='Shopee'?'sr-shopee':''}"><div class="cardhead"><div><h2><span class="sr-sw ${cor(g.grupo)}"></span>${esc(g.nome)}</h2><p class="caption">Saldo a receber em ${dBR(D.ate)}: <b>${R(g.total.final)}</b></p></div>${g.grupo==='Shopee'?'<span class="badge purple">em destaque</span>':''}</div>${longo}${tabelaComp(g.linhas,g.total,cols,{fechado:f})}</section>`).join('')}
 ${comp.grupos.length>1?`<section class="card sr-card"><div class="cardhead"><div><h2>Todas as plataformas</h2><p class="caption">Soma das plataformas acima, período a período.</p></div></div>${tabelaComp(comp.geral.linhas,comp.geral.total,cols,{fechado:f})}</section>`:''}
 ${cartaoCancelamentos(D)}
 <p class="caption sr-regra">Regras: venda pelo bruto e pela data do pedido (data da NF no Bling); taxa = taxa registrada no pedido; cancelamento/reembolso = pedido com taxa ≥ 95% do bruto, pela data do cancelamento (informada pela plataforma, pela planilha de cancelamentos ou pela NF de devolução; sem ela, a do primeiro estorno vinculado; sem nenhuma, a data do pedido, marcada com * como data estimada); repasses, estornos, ajustes e liberações sem vínculo pela data da liberação. Líquido = bruto − taxa e saldo = líquido − recebido, como na Conciliação. Pedidos em trânsito continuam no saldo (o dinheiro ainda não entrou).</p>`}

// Cancelamentos e reembolsos que entram no período, com a data e de onde ela veio.
function cartaoCancelamentos(D){const C=M.cancelamentos({...D.base,de:D.de,ate:D.ate});if(!C.qtd)return '';const LIM=200,vis=ui.todos||ui.imprimir?C.lista:C.lista.slice(0,LIM);
 return `<section class="card sr-card"><div class="cardhead"><div><h2>Cancelamentos e reembolsos no período</h2><p class="caption">${C.qtd} pedido(s) · ${R(C.total)}, pela data do cancelamento.${C.estimadas.qtd?` <b>${C.estimadas.qtd} com data estimada</b> (${R(C.estimadas.valor)}): sem a data do cancelamento, contam na data do pedido. Importe a planilha de cancelamentos da plataforma para acertar.`:''}</p></div>${C.estimadas.qtd&&!demo()?'<button class="small" data-nav="imports">Importar cancelamentos</button>':''}</div>
 <div class="tablewrap sr-tab sr-ped"><table><thead><tr><th>Plataforma</th><th>Pedido</th><th>Venda</th><th>Cancelamento</th><th>De onde veio a data</th><th class="num">Valor</th></tr></thead>
 <tbody>${vis.map(x=>`<tr data-order="${esc(x.id)}" class="clickrow"><td>${esc(x.nome)}</td><td>${esc(x.id)}</td><td>${dBR(x.venda)}</td><td>${dBR(x.data)}${x.estimada?' <span class="badge warn">data estimada</span>':''}</td><td>${esc(x.origemNome)}</td><td class="num">${R(x.valor)}</td></tr>`).join('')}</tbody></table></div>
 ${vis.length<C.lista.length?`<button class="small" data-sr-todos>Mostrar os ${C.lista.length} cancelamentos</button>`:''}</section>`}

// ───────── Gráficos (SVG à mão, desenhados na largura real do cartão)
function grafico(){return `<section class="card sr-card"><div class="cardhead"><div><h2>Saldo a receber no período</h2><p class="caption">Saldo no fim de cada ${ui.quebra==='mes'?'mês':ui.quebra==='semana'?'semana':'dia'}, por plataforma (linha tracejada: total).</p></div></div><div class="sr-leg" id="srLegSaldo"></div><div class="sr-graf" id="srGrafSaldo"></div></section>
 <section class="card sr-card"><div class="cardhead"><div><h2>Vendas líquidas × repasses</h2><p class="caption">Vendas menos taxas e cancelamentos, e todas as liberações recebidas no período. Quando as vendas passam dos repasses, o saldo a receber cresce.</p></div></div><div class="sr-leg"><span><i class="sr-sw v1"></i>Vendas líquidas</span><span><i class="sr-sw v2"></i>Repasses recebidos</span></div><div class="sr-graf" id="srGrafMov"></div></section>`}
const passoBom=v=>{if(!(v>0))return 1;const p=Math.pow(10,Math.floor(Math.log10(v))),n=v/p;return (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p};
function eixo(min,max){const passo=passoBom((max-min)/4||1),top=Math.ceil(max/passo)*passo,bot=Math.floor(min/passo)*passo,t=[];for(let v=bot;v<=top+passo/1e6;v+=passo)t.push(M.r2(v));return {top,bot,t}}
let ultimo=null;
function desenhar(){const D=ultimo;if(!D)return;const S=M.serie(D.comp);if(!S.length)return;
 const gs=D.comp.grupos.map(g=>g.grupo),nomes=Object.fromEntries(D.comp.grupos.map(g=>[g.grupo,g.nome]));
 const leg=document.getElementById('srLegSaldo');if(leg)leg.innerHTML=gs.map(g=>`<span><i class="sr-sw ${cor(g)}"></i>${esc(nomes[g])}</span>`).join('')+(gs.length>1?'<span><i class="sr-sw sr-tot"></i>Total</span>':'');
 desenharUm('srGrafSaldo',S,{series:[...gs.map(g=>({k:g,nome:nomes[g],cls:cor(g),v:s=>s.por[g]??0})),...(gs.length>1?[{k:'_t',nome:'Total',cls:'sr-tot',v:s=>s.total}]:[])],tipo:'linha'});
 desenharUm('srGrafMov',S,{series:[{k:'v',nome:'Vendas líquidas',cls:'v1',v:s=>s.vendasLiquidas},{k:'r',nome:'Repasses recebidos',cls:'v2',v:s=>s.repasses}],tipo:'barra'})}
function desenharUm(id,S,{series,tipo}){const box=document.getElementById(id);if(!box)return;
 const W=Math.max(300,box.clientWidth||720),H=W<600?210:260,pl=W<600?46:62,pr=12,pt=12,pb=26,cw=W-pl-pr,ch=H-pt-pb;
 const vals=S.flatMap(s=>series.map(x=>x.v(s))),{top,bot,t}=eixo(Math.min(0,...vals),Math.max(0,...vals));
 const Y=v=>pt+(top-v)/((top-bot)||1)*ch,bw=cw/S.length,X=i=>pl+i*bw+bw/2,y0=Y(0);
 const cada=Math.max(1,Math.ceil(S.length/(W<600?4:8)));
 let marcas='';
 if(tipo==='linha')marcas=series.map(x=>{const pts=S.map((s,i)=>`${i?'L':'M'}${X(i).toFixed(1)} ${Y(x.v(s)).toFixed(1)}`).join('');
  return `<path d="${pts}" class="sr-ln ${x.cls}${x.k==='_t'?' sr-lntot':''}"/>${S.length<=40?S.map((s,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(x.v(s)).toFixed(1)}" r="${S.length<=12?3.5:2.2}" class="sr-pt ${x.cls}"/>`).join(''):''}`}).join('');
 else{const n=series.length,gap=2,w=Math.max(1.5,Math.min(22,(bw*.7-gap*(n-1))/n));
  marcas=S.map((s,i)=>series.map((x,j)=>{const v=x.v(s),y=Y(Math.max(v,0)),h=Math.abs(Y(v)-y0),xx=X(i)-(n*w+gap*(n-1))/2+j*(w+gap);return h<0.5?'':`<rect x="${xx.toFixed(1)}" y="${(v>=0?y:y0).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(3,w/2).toFixed(1)}" class="sr-bar ${x.cls}"/>`}).join('')).join('')}
 box.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(series.map(x=>x.nome).join(', '))}">
  ${t.map(v=>`<line x1="${pl}" x2="${W-pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="${Math.abs(v)<1e-9?'sr-zeroln':'sr-grade'}"/><text x="${pl-6}" y="${(Y(v)+4).toFixed(1)}" text-anchor="end" class="sr-ax">${curto(v)}</text>`).join('')}
  ${marcas}
  ${S.map((s,i)=>i%cada===0?`<text x="${X(i).toFixed(1)}" y="${H-7}" text-anchor="middle" class="sr-ax">${esc(rotCurto(s))}</text>`:'').join('')}
  <line class="sr-cruz" y1="${pt}" y2="${pt+ch}" x1="-10" x2="-10"/><rect x="${pl}" y="${pt}" width="${cw}" height="${ch}" fill="transparent" class="sr-hit"/></svg><div class="sr-tip" hidden></div>`;
 const svg=box.querySelector('svg'),hit=box.querySelector('.sr-hit'),cruz=box.querySelector('.sr-cruz'),tip=box.querySelector('.sr-tip');
 const mostra=e=>{const r=svg.getBoundingClientRect(),x=(e.clientX-r.left)*(W/r.width),i=Math.max(0,Math.min(S.length-1,Math.floor((x-pl)/bw))),s=S[i];
  cruz.setAttribute('x1',X(i));cruz.setAttribute('x2',X(i));
  tip.innerHTML=`<b>${esc(s.rotulo)}</b>${series.map(x=>`<div><i class="sr-sw ${x.cls}"></i>${esc(x.nome)}<span>${R(x.v(s))}</span></div>`).join('')}`;tip.hidden=false;
  const px=X(i)*(r.width/W),esq=px>r.width/2;tip.style.left=esq?'':`${px+12}px`;tip.style.right=esq?`${r.width-px+12}px`:'';};
 hit.addEventListener('pointermove',mostra);hit.addEventListener('pointerdown',mostra);
 hit.addEventListener('pointerleave',()=>{tip.hidden=true;cruz.setAttribute('x1',-10);cruz.setAttribute('x2',-10)})}
const rotCurto=s=>ui.quebra==='mes'?s.rotulo.split(' ')[0]:dBR(s.ini).slice(0,5);
let tRes=null;addEventListener('resize',()=>{clearTimeout(tRes);tRes=setTimeout(()=>{if(page===PAG)desenhar()},150)});

// ───────── Posição numa data
function abaPosicao(D){const data=dataPos(),pos=M.posicao({...D.base,data}),T=pos.totais;
 const lista=pos.pedidos.filter(p=>!ui.faixa||p.faixa===ui.faixa),LIM=300,vis=ui.todos||ui.imprimir?lista:lista.slice(0,LIM);
 const faixasCols=M.FAIXAS.map(f=>f[0]);
 return `<section class="card sr-card"><div class="cardhead sr-poshead"><div><h2>Posição em ${dBR(data)}</h2><p class="caption">Pedidos com data até ${dBR(data)}: líquido − o que foi recebido até essa data. A idade conta da <b>previsão de liberação</b>; sem previsão, da <b>data da venda</b> (coluna "Base").</p></div><label class="sr-l">Data<input type="date" data-sr-data value="${data}"></label></div>
 <div class="grid metrics sr-kpis">${kpi('Saldo dos pedidos',T.saldoPedidos,`${T.pedidos} pedido(s) em aberto`)}${kpi('Em trânsito',T.emTransito,'Já incluído no saldo dos pedidos')}${kpi('Liberações sem vínculo',-T.semVinculo,'Recebido sem pedido identificado')}${kpi('Saldo a receber',T.saldo,'Pedidos − liberações sem vínculo',true)}</div>
 <div class="tablewrap sr-tab"><table><thead><tr><th>Plataforma</th><th class="num">Pedidos</th>${M.FAIXAS.map(f=>`<th class="num">${esc(f[1])}</th>`).join('')}<th class="num">Saldo dos pedidos</th><th class="num">Sem vínculo</th><th class="num">Saldo a receber</th></tr></thead>
 <tbody>${pos.porGrupo.map(g=>`<tr class="${g.grupo==='Shopee'?'sr-dest':''}"><td><span class="sr-sw ${cor(g.grupo)}"></span>${esc(g.nome)}</td><td class="num">${g.pedidos}</td>${faixasCols.map(k=>`<td class="num">${sinal(g.faixas[k])}</td>`).join('')}<td class="num">${R(g.saldoPedidos)}</td><td class="num">${sinal(-g.semVinculo)}</td><td class="num"><b>${R(g.saldo)}</b></td></tr>`).join('')}</tbody>
 <tfoot><tr class="sr-totl"><td>Todas</td><td class="num">${T.pedidos}</td>${pos.faixas.map(f=>`<td class="num">${sinal(f.saldo)}</td>`).join('')}<td class="num">${R(T.saldoPedidos)}</td><td class="num">${sinal(-T.semVinculo)}</td><td class="num">${R(T.saldo)}</td></tr></tfoot></table></div></section>
 <section class="card sr-card"><div class="cardhead"><div><h2>Pedidos que compõem o saldo</h2><p class="caption">${lista.length} pedido(s)${ui.faixa?' nesta faixa':''}. Clique no pedido para abrir. "Em trânsito" é a marcação atual do pedido.</p></div></div>
 <div class="segtabs sr-faixas"><button class="${ui.faixa?'':'active'}" data-sr-faixa="">Todas</button>${pos.faixas.map(f=>`<button class="${ui.faixa===f.faixa?'active':''}" data-sr-faixa="${f.faixa}">${esc(f.nome)} · ${f.pedidos}</button>`).join('')}</div>
 ${lista.length?`<div class="tablewrap sr-tab sr-ped"><table><thead><tr><th>Plataforma</th><th>Pedido</th><th>Venda</th><th>Previsão</th><th class="num">Idade</th><th>Base</th><th>Situação</th><th>Cancelamento</th><th class="num">Líquido</th><th class="num">Recebido</th><th class="num">Saldo</th></tr></thead>
 <tbody>${vis.map(p=>`<tr data-order="${esc(p.id)}" class="clickrow"><td>${esc(p.nome)}</td><td>${esc(p.id)}</td><td>${dBR(p.data)}</td><td>${p.previsao?dBR(p.previsao):'—'}</td><td class="num">${p.idade<=0?`<span class="badge ok">a vencer${p.idade<0?` em ${-p.idade} d`:''}</span>`:`<span class="badge ${p.idade>30?'bad':p.idade>7?'warn':'info'}">${p.idade} d</span>`}</td><td>${p.base==='previsao'?'previsão':'venda'}</td><td>${esc(p.situacao)}</td><td>${p.cancelamento?`${dBR(p.cancelamento)}${p.cancelEstimada?' <span class="badge warn">data estimada</span>':''}`:'—'}</td><td class="num">${R(p.liquido)}</td><td class="num">${sinal(p.recebido)}</td><td class="num"><b>${R(p.saldo)}</b></td></tr>`).join('')}</tbody></table></div>
 ${vis.length<lista.length?`<button class="small" data-sr-todos>Mostrar os ${lista.length} pedidos</button>`:''}`:'<p class="caption">Nenhum pedido em aberto.</p>'}</section>
 <section class="card sr-card"><div class="cardhead"><div><h2>Liberações sem pedido vinculado até ${dBR(data)}</h2><p class="caption">Dinheiro que entrou sem pedido identificado (inclui os ajustes da plataforma sem pedido). Reduz o saldo a receber como "não identificado"; vincule na Conciliação para saber de que pedido é.</p></div><b>${R(T.semVinculo)}</b></div>
 ${pos.soltas.length?`<div class="tablewrap sr-tab"><table><thead><tr><th>Plataforma</th><th>Liberação</th><th>Data</th><th>Tipo</th><th>Pedido informado</th><th>Descrição</th><th class="num">Valor</th></tr></thead><tbody>${(ui.todos||ui.imprimir?pos.soltas:pos.soltas.slice(0,LIM)).map(s=>`<tr><td>${esc(s.nome)}</td><td>${esc(s.id)}</td><td>${dBR(s.data)}</td><td>${esc(s.tipo)}</td><td>${esc(s.pedidoInformado)||'—'}</td><td>${esc(s.descricao)||'—'}</td><td class="num">${R(s.valor)}</td></tr>`).join('')}</tbody></table></div>${!ui.todos&&pos.soltas.length>LIM?`<button class="small" data-sr-todos>Mostrar as ${pos.soltas.length} liberações</button>`:''}`:'<p class="caption">Nenhuma.</p>'}
 ${pos.soltas.length?`<button class="small" data-nav="reconcile">Vincular na Conciliação</button>`:''}</section>`}
const kpi=(t,v,s,forte)=>`<div class="card metric ${forte?'sr-forte':''}"><div class="label">${esc(t)}</div><div class="value ${v<0?'red':''}">${R(v)}</div><small>${esc(s)}</small></div>`;

// ───────── Conferência com a plataforma
const CONF={'Shopee':{titulo:'Shopee · saldo pendente',onde:'Na Shopee: Minha renda › Visão geral › Pendente',plat:'shopee',nota:'A Shopee informa que o pendente não inclui ajustes.'},
 'Mercado Livre':{titulo:'Mercado Pago · saldo a liberar',onde:'No Mercado Pago: Seu dinheiro › A liberar',plat:'ml',nota:'O "a liberar" do Mercado Pago inclui todo o dinheiro da conta, não só as vendas do Mercado Livre.'}};
async function consultar(g){const c=CONF[g];if(conf[g]?.carregando)return;
 if(demo())return toast('Na demonstração não há conta conectada: a consulta não é feita.');
 if(!podeConsultar())return toast('Seu perfil não consulta o saldo nas plataformas. Peça ao administrador.');
 conf[g]={carregando:true};redesenhar();
 try{if(!window.MarketplaceSaldo?.consultar)throw Error('consulta indisponível nesta versão');const d=await window.MarketplaceSaldo.consultar(c.plat);
  conf[g]={em:new Date(),resumo:d?.resumo||null,erro:d?.erro||'',informado:M.valorPlataforma(g,d?.resumo)}}
 catch(e){conf[g]={em:new Date(),erro:e.message||String(e)}}
 redesenhar()}
function cartaoConf(g,pos){const c=CONF[g],q=conf[g],inf=q&&!q.carregando&&!q.erro?q.informado:null,x=M.conferencia({pos,grupo:g,informado:inf,dias:ui.dias});
 let topo;
 if(demo())topo=`<div class="notice sr-not"><b>Demonstração.</b> Com a conta conectada, "Consultar agora" pergunta à ${g==='Shopee'?'Shopee':'Mercado Pago'} o saldo ${g==='Shopee'?'pendente':'a liberar'} neste momento e mostra aqui: saldo do Jarvis × saldo informado × diferença, com as causas prováveis abaixo. Na Loja Modelo nada é consultado.</div>`;
 else if(q?.carregando)topo='<p class="caption">Consultando…</p>';
 else if(q?.erro)topo=`<div class="notice sr-not">Não foi possível consultar (${esc(q.erro)}). Confira o valor ${esc(c.onde)} e compare com o saldo do Jarvis abaixo.</div>`;
 else if(q&&inf==null)topo='<div class="notice sr-not">A consulta voltou sem o valor esperado. Veja os valores no relatório Marketplace para contabilidade.</div>';
 else topo='';
 return `<section class="card sr-card ${g==='Shopee'?'sr-shopee':''}"><div class="cardhead"><div><h2>${esc(c.titulo)}</h2><p class="caption">${esc(c.onde)}</p></div><button class="small primary" data-sr-consultar="${esc(g)}" ${demo()||!podeConsultar()||q?.carregando?'disabled':''}>${icon('arrow')} Consultar agora</button></div>
 ${topo}
 <div class="sr-conf"><div><small>Saldo do Jarvis hoje</small><b>${R(x.jarvis)}</b></div><div><small>Informado pela plataforma</small><b>${inf==null?'—':R(inf)}</b>${q?.em?`<small>${q.em.toLocaleString('pt-BR')}</small>`:''}</div><div><small>Diferença (Jarvis − plataforma)</small><b class="${x.diferenca&&Math.abs(x.diferenca)>=0.01?'red':''}">${x.diferenca==null?'—':R(x.diferenca)}</b></div></div>
 <h3 class="sr-h3">Causas prováveis de diferença</h3>${x.causas.length?`<ul class="sr-causas">${x.causas.map(k=>`<li><b>${R(k.valor)}</b> ${esc(k.texto)}</li>`).join('')}</ul>`:'<p class="caption">Nada fora do comum no Jarvis: pedidos em dia, sem liberação solta e sem pedido em trânsito.</p>'}
 <p class="caption">${esc(c.nota)} O saldo do Jarvis é o da posição de hoje (pedidos − liberações sem vínculo).</p></section>`}
function abaConferencia(D){const pos=M.posicao({orders:db.orders||[],receipts:db.receipts||[],data:hoje()});
 const gs=['Shopee','Mercado Livre'].filter(g=>!ui.plat||ui.plat===g);
 return `<div class="notice">Compara o saldo a receber do Jarvis com o que a plataforma informa agora. ${podeConsultar()||demo()?'':'A consulta precisa da conta conectada e de perfil com acesso aos relatórios dos marketplaces.'}
 <label class="sr-l sr-dias">Pedido "sem liberação" depois de<input type="number" min="1" max="365" value="${ui.dias}" data-sr-dias> dias</label></div>
 ${gs.length?`<div class="grid two sr-grid">${gs.map(g=>cartaoConf(g,pos)).join('')}</div>`:'<div class="empty">A conferência existe para a Shopee e o Mercado Pago. Escolha "Todas" ou uma delas no filtro.</div>'}`}

// ───────── Tela
function filtros(D){const gsDados=M.ordenar(new Set([...(db.orders||[]).map(o=>M.grupo(o.platform)),...(db.receipts||[]).map(r=>M.grupo(r.platform))]));
 const contas=ui.plat?(D.comp.contas[ui.plat]||[]):[];
 return `<div class="card sr-filtros"><div class="sr-linha"><label class="sr-l">De<input type="date" data-sr-de value="${D.de}"></label><label class="sr-l">Até<input type="date" data-sr-ate value="${D.ate}"></label>
  <label class="sr-l">Plataforma<select data-sr-plat><option value="">Todas</option>${gsDados.map(g=>`<option value="${esc(g)}" ${ui.plat===g?'selected':''}>${esc(M.nomeGrupo(g))}</option>`).join('')}</select></label>
  ${contas.length>1?`<label class="sr-l">Conta / loja<select data-sr-conta><option value="">Todas</option>${contas.map(c=>`<option ${ui.conta===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label>`:''}</div>
  <div class="sr-linha"><div class="segtabs sr-seg">${ATALHOS.map(([k,n])=>`<button class="${ui.atalho===k?'active':''}" data-sr-atalho="${k}">${n}</button>`).join('')}</div>
  <div class="segtabs sr-seg" aria-label="Quebra">${[['dia','Dia'],['semana','Semana'],['mes','Mês']].map(([k,n])=>`<button class="${ui.quebra===k?'active':''}" data-sr-quebra="${k}">${n}</button>`).join('')}</div></div></div>`}
function topo(D){const g=D.comp.geral.total,sh=D.comp.grupos.find(x=>x.grupo==='Shopee');
 return `<div class="grid metrics sr-kpis">${kpi(`Saldo inicial · ${dBR(M.somaDias(D.de,-1))}`,g.inicial,'A receber no fim do dia anterior')}${kpi('Vendas líquidas no período',g.vendas+g.taxas+g.cancel,`Bruto ${R(g.vendas)} − taxas e cancelamentos`)}${kpi('Recebido no período',-(g.repasses+g.estornos+g.ajustes+g.semVinculo),'Todas as liberações, pela data')}${kpi(`Saldo final · ${dBR(D.ate)}`,g.final,sh?`Shopee: ${R(sh.total.final)}`:'Todas as plataformas do filtro',true)}</div>`}
function view(){if(!M)return '<div class="empty">O cálculo dos saldos não carregou. Recarregue a página.</div>';
 if(!pode())return '<div class="notice">Seu perfil não acessa este relatório. Peça ao administrador.</div>';
 const D=dados();ultimo=D;
 if(!(db.orders||[]).length&&!(db.receipts||[]).length)return `${filtros(D)}<div class="empty">Ainda não há pedidos nem liberações. Conecte as plataformas em Integrações ou importe as planilhas.</div>`;
 const acoes=`<div class="sr-acoes"><button class="small" data-sr-xlsx>${icon('download')} Excel para o contador</button><button class="small" data-sr-pdf>${icon('file')} PDF / imprimir (A4)</button><button class="small quiet" data-nav="relshopee">Relatórios das plataformas</button></div>`;
 if(ui.imprimir)return `<div class="sr-print"><h2 class="sr-ptit">Saldos a receber por plataforma · ${dBR(D.de)} a ${dBR(D.ate)}${ui.plat?` · ${esc(M.nomeGrupo(ui.plat))}`:''}${ui.conta?` · ${esc(ui.conta)}`:''}</h2>${topo(D)}${abaComposicao(D)}${abaPosicao(D)}</div>`;
 const abas=[['composicao','Composição'],['posicao','Posição na data'],['conferencia','Conferência com a plataforma']];
 return `<div class="notice sr-intro"><b>Quanto cada marketplace ainda deve à loja, e por quê.</b> Saldo inicial + vendas − taxas − cancelamentos − repasses ± ajustes = saldo final, com as mesmas regras da Conciliação. Nada é alterado.</div>
 ${filtros(D)}${topo(D)}${acoes}
 <div class="segtabs sr-abas">${abas.map(([k,n])=>`<button class="${ui.aba===k?'active':''}" data-sr-aba="${k}">${n}</button>`).join('')}</div>
 ${ui.aba==='posicao'?abaPosicao(D):ui.aba==='conferencia'?abaConferencia(D):abaComposicao(D)}`}
function bind(){if(ui.aba==='composicao'||ui.imprimir)desenhar()}

// ───────── Excel
function excel(){const X=window.XLSX;if(!X)return toast('A biblioteca do Excel não carregou. Recarregue a página.');
 const D=dados(),data=dataPos(),pos=M.posicao({...D.base,data}),wb=X.utils.book_new(),emp=window.Cloud?.wsName||'',agora=new Date().toLocaleString('pt-BR');
 const dt=s=>s?new Date(s+'T12:00:00Z'):null,n=v=>M.r2(v),filtro=[ui.plat?M.nomeGrupo(ui.plat):'Todas as plataformas',ui.conta].filter(Boolean).join(' · ');
 wb.Props={Title:'Saldos a receber por plataforma',Author:'Jarvis',CreatedDate:new Date()};
 const folha=(linhas,cab,larg,moeda,datas)=>{const ws=X.utils.aoa_to_sheet(linhas,{cellDates:true});const rg=X.utils.decode_range(ws['!ref']);
  for(let r=cab;r<=rg.e.r;r++)for(let c=0;c<=rg.e.c;c++){const cel=ws[X.utils.encode_cell({r,c})];if(!cel)continue;if(cel.t==='n'&&moeda.includes(c))cel.z='#,##0.00;-#,##0.00';if(datas.includes(c)&&cel.t==='d')cel.z='dd/mm/yyyy'}
  ws['!cols']=larg.map(w=>({wch:w}));return ws};
 const cols=['inicial',...COLS,'final'],cabC=['Plataforma','Período','De','Até',...cols.map(c=>M.ROTULOS[c])];
 const L=[['Saldos a receber por plataforma · composição (roll-forward)'],[[emp,filtro].filter(Boolean).join(' · ')],[`Período: ${dBR(D.de)} a ${dBR(D.ate)} · quebra por ${ui.quebra==='mes'?'mês':ui.quebra}`],['Cada coluna é o efeito no saldo (positivo aumenta, negativo reduz); saldo final = saldo inicial + colunas.'],['Cancelamentos pela data do cancelamento; sem ela, pela data do pedido (data estimada): veja a aba Cancelamentos.'],[`Gerado pelo Jarvis em ${agora}`],[],cabC];
 for(const g of D.comp.grupos){for(const l of g.linhas)L.push([g.nome,l.rotulo,dt(l.ini),dt(l.fim),...cols.map(c=>n(l[c]))]);L.push([`Total ${g.nome}`,'',dt(D.de),dt(D.ate),...cols.map(c=>n(g.total[c]))],[])}
 if(D.comp.grupos.length>1){for(const l of D.comp.geral.linhas)L.push(['Todas as plataformas',l.rotulo,dt(l.ini),dt(l.fim),...cols.map(c=>n(l[c]))]);L.push(['Total geral','',dt(D.de),dt(D.ate),...cols.map(c=>n(D.comp.geral.total[c]))])}
 X.utils.book_append_sheet(wb,folha(L,8,[28,22,11,11,...cols.map(()=>16)],cols.map((_,i)=>i+4),[2,3]),'Composição');
 const T=pos.totais,P=[['Saldos a receber · posição na data'],[[emp,filtro].filter(Boolean).join(' · ')],[`Posição em ${dBR(data)} (pedidos com data até a posição; recebido até a posição). Idade pela previsão de liberação; sem previsão, pela data da venda.`],[`Gerado pelo Jarvis em ${agora}`],[],
  ['Plataforma','Pedidos',...M.FAIXAS.map(f=>f[1]),'Saldo dos pedidos','Liberações sem vínculo','Saldo a receber']];
 for(const g of pos.porGrupo)P.push([g.nome,g.pedidos,...M.FAIXAS.map(f=>n(g.faixas[f[0]])),n(g.saldoPedidos),n(-g.semVinculo),n(g.saldo)]);
 P.push(['Todas',T.pedidos,...pos.faixas.map(f=>n(f.saldo)),n(T.saldoPedidos),n(-T.semVinculo),n(T.saldo)],[]);
 const iDet=P.length;P.push(['Plataforma','Pedido','Data da venda','Previsão de liberação','Idade (dias)','Base da idade','Faixa','Situação','Bruto','Taxas e cancelamento','Líquido','Recebido até a data','Saldo','Última liberação','Data do cancelamento','Origem da data do cancelamento']);
 const nomeFx=Object.fromEntries(M.FAIXAS.map(f=>[f[0],f[1]]));
 for(const p of pos.pedidos)P.push([p.nome,String(p.id),dt(p.data),dt(p.previsao),p.idade,p.base==='previsao'?'Previsão de liberação':'Data da venda',nomeFx[p.faixa],p.situacao,n(p.bruto),n(p.taxa),n(p.liquido),n(p.recebido),n(p.saldo),dt(p.ultimaLiberacao),dt(p.cancelamento),p.cancelamento?M.nomeOrigem(p.cancelOrigem):'']);
 const wsP=folha(P,5,[28,22,13,13,10,20,26,30,13,13,13,13,13,13,13,34],[],[2,3,13,14]);
 // Duas tabelas na aba: por plataforma (moeda da 3ª coluna em diante) e os pedidos (moeda do bruto ao saldo).
 const rg=X.utils.decode_range(wsP['!ref']);for(let r=5;r<=rg.e.r;r++)for(let c=0;c<=rg.e.c;c++){const cel=wsP[X.utils.encode_cell({r,c})];if(!cel||cel.t!=='n')continue;cel.z=(r<iDet?c>=2:c>=8&&c<=12)?'#,##0.00;-#,##0.00':'0'}
 X.utils.book_append_sheet(wb,wsP,'Posição na data');
 const S=[['Liberações sem pedido vinculado até a data'],[[emp,filtro].filter(Boolean).join(' · ')],[`Até ${dBR(data)} · descontadas do saldo a receber como "não identificado"`],[],['Plataforma','Liberação','Data','Tipo','Conta','Pedido informado','Descrição','Valor']];
 for(const s of pos.soltas)S.push([s.nome,String(s.id),dt(s.data),s.tipo,s.conta,String(s.pedidoInformado||''),s.descricao,n(s.valor)]);
 S.push(['Total','','','','','','',n(T.semVinculo)]);
 X.utils.book_append_sheet(wb,folha(S,5,[28,22,12,20,16,20,40,14],[7],[2]),'Liberações sem vínculo');
 const C=M.cancelamentos({...D.base,de:D.de,ate:D.ate}),K=[['Cancelamentos e reembolsos no período'],[[emp,filtro].filter(Boolean).join(' · ')],[`${dBR(D.de)} a ${dBR(D.ate)} · pela data do cancelamento; sem ela, pela data do pedido (data estimada)`],[],['Plataforma','Pedido','Data da venda','Data do cancelamento','Data estimada','Origem da data','Valor']];
 for(const x of C.lista)K.push([x.nome,String(x.id),dt(x.venda),dt(x.data),x.estimada?'Sim':'Não',x.origemNome,n(x.valor)]);
 K.push(['Total','','','','','',n(C.total)],['Com data estimada (data do pedido)','','','',C.estimadas.qtd,'',n(C.estimadas.valor)]);
 X.utils.book_append_sheet(wb,folha(K,5,[28,22,13,15,12,44,14],[6],[2,3]),'Cancelamentos');
 X.writeFile(wb,`saldos-a-receber-${D.de}-a-${D.ate}.xlsx`,{compression:true});
 try{audit('Relatório de saldos a receber por plataforma',`${dBR(D.de)} a ${dBR(D.ate)} · ${filtro} · Excel`)}catch{}}

function imprimir(){ui.imprimir=true;render();const volta=()=>{removeEventListener('afterprint',volta);ui.imprimir=false;redesenhar()};addEventListener('afterprint',volta);
 if(window.Exportar?.pdf)Exportar.pdf();else setTimeout(()=>window.print(),60)}

document.addEventListener('click',e=>{const b=e.target.closest('[data-sr-atalho],[data-sr-quebra],[data-sr-aba],[data-sr-faixa],[data-sr-todos],[data-sr-consultar],[data-sr-xlsx],[data-sr-pdf]');if(!b||page!==PAG)return;const d=b.dataset;
 if(d.srAtalho){ui.atalho=d.srAtalho;[ui.de,ui.ate]=intervalo(d.srAtalho);ui.quebra=d.srAtalho==='ano'?'mes':'dia';ui.data=''}
 else if(d.srQuebra)ui.quebra=d.srQuebra;else if(d.srAba)ui.aba=d.srAba;else if(d.srFaixa!==undefined){ui.faixa=d.srFaixa;ui.todos=false}else if(d.srTodos!==undefined)ui.todos=true;
 else if(d.srConsultar)return consultar(d.srConsultar);else if(d.srXlsx!==undefined)return excel();else if(d.srPdf!==undefined)return imprimir();
 redesenhar()});
document.addEventListener('change',e=>{const x=e.target;if(page!==PAG)return;
 if(x.matches('[data-sr-de]')){ui.de=x.value;ui.atalho='';ui.data=''}else if(x.matches('[data-sr-ate]')){ui.ate=x.value;ui.atalho='';ui.data=''}
 else if(x.matches('[data-sr-plat]')){ui.plat=x.value;ui.conta=''}else if(x.matches('[data-sr-conta]'))ui.conta=x.value;
 else if(x.matches('[data-sr-data]')){ui.data=x.value;ui.todos=false}else if(x.matches('[data-sr-dias]'))ui.dias=Math.max(1,Math.min(365,Number(x.value)||15));else return;
 if(ui.de&&ui.ate&&ui.de>ui.ate)[ui.de,ui.ate]=[ui.ate,ui.de];redesenhar()});

const css=`.sr-filtros{padding:14px 18px;margin-bottom:16px;display:flex;flex-direction:column;gap:12px}
.sr-linha{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end}
.sr-l{display:flex;flex-direction:column;gap:4px;margin:0;font-size:12px;color:var(--muted);min-width:0}
.sr-l input,.sr-l select{min-width:0;max-width:100%}
.sr-seg{margin:0}.sr-seg button{font-size:12px;padding:7px 10px}
.sr-abas{margin:4px 0 16px}
.sr-acoes{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}
.sr-kpis{margin:0 0 16px}.sr-kpis .metric .value{font-size:22px}.sr-forte{border-color:rgb(var(--ar) / 45%)}
.sr-card{margin-bottom:16px;min-width:0}.sr-card h2{display:flex;align-items:center;gap:8px}
.sr-shopee{border-color:#eb683466;box-shadow:inset 3px 0 0 #eb6834}
.sr-tab table{font-size:12.5px}.sr-tab td,.sr-tab th{padding:7px 8px;white-space:nowrap}.sr-tab th{white-space:normal;line-height:1.25}.sr-totl td{font-weight:700;border-top:1px solid var(--line)}
.sr-dest td{background:#eb68340f}.sr-tab td>.sr-sw{margin-right:6px}
.sr-zero{color:var(--muted)}.sr-nw{white-space:nowrap}.sr-est{color:var(--gold);font-weight:700;margin-left:2px;cursor:help}
.sr-regra{margin:-4px 0 18px;line-height:1.6}
.sr-poshead{flex-wrap:wrap;align-items:flex-end}
.sr-faixas{margin:0 0 10px}.sr-faixas button{font-size:12px;padding:6px 9px}
.sr-ped tr.clickrow{cursor:pointer}
.sr-sw{display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--sr);flex:none}
.sr-leg{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:var(--muted);margin:-6px 0 8px}.sr-leg span{display:inline-flex;align-items:center;gap:6px}
.sr-graf{position:relative;width:100%;min-height:200px;overflow:hidden}.sr-graf svg{display:block;max-width:100%;height:auto}
.sr-grade{stroke:var(--line);stroke-width:1}.sr-zeroln{stroke:var(--muted);stroke-width:1;opacity:.6}
.sr-ax{fill:var(--muted);font-size:11px;font-variant-numeric:tabular-nums}
.sr-ln{fill:none;stroke:var(--sr);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}.sr-lntot{stroke-dasharray:5 4}
.sr-pt{fill:var(--sr);stroke:var(--panel);stroke-width:2}
.sr-bar{fill:var(--sr)}
.sr-cruz{stroke:var(--muted);stroke-width:1;stroke-dasharray:3 3}
.sr-tip{position:absolute;top:8px;z-index:3;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:12px;box-shadow:var(--shadow);pointer-events:none;min-width:180px}
.sr-tip div{display:flex;align-items:center;gap:6px;margin-top:4px}.sr-tip span{margin-left:auto;padding-left:12px;font-variant-numeric:tabular-nums}
.c1{--sr:#d95926}.c2{--sr:#3987e5}.c3{--sr:#c98500}.c4{--sr:#d55181}.c5{--sr:#0ca30c}.v1{--sr:#3987e5}.v2{--sr:#199e70}.sr-tot{--sr:var(--text)}
body.light .c1{--sr:#eb6834}body.light .c2{--sr:#2a78d6}body.light .c3{--sr:#eda100}body.light .c4{--sr:#e87ba4}body.light .c5{--sr:#008300}body.light .v1{--sr:#2a78d6}body.light .v2{--sr:#1baf7a}
.sr-conf{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:8px 0 14px}
.sr-conf>div{background:var(--panel2);border-radius:10px;padding:10px 12px;min-width:0}.sr-conf small{display:block;font-size:11px;color:var(--muted)}.sr-conf b{display:block;font-size:18px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.sr-h3{font-size:13px;margin:4px 0 6px}.sr-causas{margin:0 0 10px;padding-left:18px;font-size:12.5px;line-height:1.6}.sr-causas b{font-variant-numeric:tabular-nums;margin-right:4px}
.sr-not{margin:0 0 10px}.sr-dias{flex-direction:row;align-items:center;gap:6px;margin-top:6px}.sr-dias input{width:70px}
.sr-grid{align-items:start}
.sr-ptit{font-size:16px;margin:0 0 10px}
@media(max-width:600px){.sr-filtros{padding:12px}.sr-kpis .metric .value{font-size:18px}.sr-l{flex:1 1 140px}.sr-l input,.sr-l select{width:100%}}
@media print{.sr-print .sr-card{break-inside:auto}.sr-print .sr-tab table{font-size:9px!important}.sr-print .sr-tip,.sr-print .sr-acoes{display:none!important}.sr-print .sr-ln{stroke-width:1.5}}`;
try{const st=document.createElement('style');st.textContent=css;document.head.appendChild(st)}catch{}

addPage(PAG,'chart','Saldos a receber por plataforma',view,'Composição do saldo a receber de cada marketplace (Shopee em destaque) por dia, semana ou mês, a posição numa data com a idade dos pedidos e a conferência com o saldo da plataforma.','',bind);
window.SaldosReceber={view,excel,dados,consultar,ui};
})();
