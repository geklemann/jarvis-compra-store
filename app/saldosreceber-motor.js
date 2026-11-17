// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Saldos a receber por plataforma: motor PURO (sem DOM, sem data de hoje) da tela web/saldosreceber.js.
// Usa as MESMAS regras da conciliação (web/app.js e a view v_pedidos): líquido = bruto − taxa; recebido = soma das
// liberações vinculadas ao pedido; saldo do pedido = líquido − recebido. Aqui o tempo entra: o saldo numa data D é
//   Σ líquido dos pedidos com data ≤ D − Σ liberações (vinculadas ou não) com data ≤ D,
// e a composição (roll-forward) de cada período abre esse movimento por natureza:
//   saldo inicial + vendas (bruto, pela data do pedido) − taxas (pela data do pedido) − cancelamentos/reembolsos
//   (pela data do cancelamento) − repasses vinculados + estornos (repasse negativo vinculado) − ajustes da plataforma
//   − liberações sem pedido vinculado (todas pela data da liberação) = saldo final, que é o inicial do período seguinte.
// Cancelamento/reembolso: o pedido cancelado chega com a taxa igual (ou quase igual) ao bruto. Mesma regra da Margem
// (web/margem.js › cancelado): taxa ≥ 95% do bruto ou bruto zerado. A parte da taxa até o bruto vira "cancelamento", o
// que passar do bruto continua "taxa" (ex.: Shopee reembolsado ao comprador, bruto 100 e taxa 100,49 → cancelamento 100
// e taxa 0,49). Sem cancelamento: tudo é taxa.
// Data do cancelamento (quandoCancelou): external.cancelado_em do pedido, gravada pela sincronização, pela planilha de
// cancelamentos (Importar) e pela NF de devolução autorizada, com a origem em external.cancelamento_origem (quem
// prevalece: juntarCancelamento, a mesma regra de supabase/functions/_shared/cancelamento.ts); sem ela, a data do
// primeiro estorno vinculado ao pedido (aproximação); sem nenhuma, a data do pedido, marcada como estimada. Nunca antes
// da data do pedido. Assim um cancelamento tardio muda só o período em que aconteceu, não os dias que já passaram.
// Usado no navegador (window.SaldosReceberMotor) e no Node (module.exports), nos testes testes/ecom_saldos_motor.test.mjs.
(()=>{
const r2=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
const DIA=864e5;
const ms=d=>Date.parse(String(d).slice(0,10)+'T00:00:00Z');
const isoDe=t=>new Date(t).toISOString().slice(0,10);
const somaDias=(d,n)=>isoDe(ms(d)+n*DIA);
const dias=(a,b)=>Math.round((ms(b)-ms(a))/DIA); // b − a, em dias
const MESES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const dBR=d=>d?String(d).slice(0,10).split('-').reverse().join('/'):'';

// Plataformas: o repasse do Mercado Livre cai no Mercado Pago (conta), às vezes importado com plataforma "Mercado Pago".
const GRUPO={'Mercado Pago':'Mercado Livre'};
const grupo=p=>GRUPO[p]||p||'Sem plataforma';
const NOMES={'Mercado Livre':'Mercado Livre / Mercado Pago'};
const nomeGrupo=g=>NOMES[g]||g;
// Ordem: Shopee primeiro (em destaque), depois as conhecidas, depois as outras em ordem alfabética.
const ORDEM=['Shopee','Mercado Livre','Magalu','TikTok Shop'];
const ordenar=gs=>[...gs].sort((a,b)=>{const ia=ORDEM.indexOf(a),ib=ORDEM.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib)||a.localeCompare(b,'pt-BR')});

/** Pedido cancelado/reembolsado (mesma regra da Margem): bruto zerado ou taxa ≥ 95% do bruto. */
const cancelado=o=>!(Number(o.gross)>0)||Number(o.fee)>=Number(o.gross)*0.95;
/** Partes do pedido: venda (bruto), taxa, cancelamento; venda − taxa − cancelamento = líquido (bruto − taxa). */
function partes(o){const g=r2(o.gross||0),f=r2(o.fee||0);
 if(!cancelado(o))return {venda:g,taxa:f,cancel:0,liquido:r2(g-f),cancelado:false};
 const c=r2(Math.min(Math.max(f,0),Math.max(g,0)));return {venda:g,taxa:r2(f-c),cancel:c,liquido:r2(g-f),cancelado:true}}

// ───────── Data do cancelamento
const ORIGENS={manual:'Informada à mão',plataforma:'Informada pela plataforma',planilha:'Planilha de cancelamentos',nf_devolucao:'NF de devolução autorizada',
 plataforma_atualizacao:'Última atualização do pedido na plataforma (aproximação)',estorno:'Data do estorno vinculado (aproximação)',pedido:'Data do pedido (estimada)'};
/** Quem prevalece quando duas fontes informam a data: a de prioridade maior; empate, a data mais antiga. */
const PRIORIDADE={manual:5,plataforma:4,planilha:3,nf_devolucao:2,plataforma_atualizacao:1};
const dataValida=s=>{const d=typeof s==='string'?s.slice(0,10):'';return /^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(ms(d))&&isoDe(ms(d))===d?d:''};
const nomeOrigem=k=>ORIGENS[k]||'Informada';
/** external do pedido com a data do cancelamento que vale entre a que já estava (antigo) e a nova: os outros campos de
 *  `novo` substituem os de `antigo` (como a sincronização sempre fez); cancelado_em/cancelamento_origem seguem a
 *  prioridade da origem (PRIORIDADE; origem desconhecida = 0) e, no empate, a data mais antiga. Data inválida não conta. */
function juntarCancelamento(antigo,novo){const a=antigo&&typeof antigo==='object'?antigo:{},n=novo&&typeof novo==='object'?novo:{},out={...a,...n};
 const da=dataValida(a.cancelado_em),dn=dataValida(n.cancelado_em),pa=PRIORIDADE[a.cancelamento_origem]||0,pn=PRIORIDADE[n.cancelamento_origem]||0;
 const fica=!dn?(da?'a':''):!da?'n':pn!==pa?(pn>pa?'n':'a'):(dn<da?'n':'a');
 if(!fica){delete out.cancelado_em;delete out.cancelamento_origem;return out}
 const x=fica==='a'?a:n;out.cancelado_em=fica==='a'?da:dn;if(x.cancelamento_origem)out.cancelamento_origem=x.cancelamento_origem;else delete out.cancelamento_origem;return out}
/** Primeiro estorno (liberação negativa vinculada) de cada pedido: Map pedido → data. */
function estornosPorPedido(R){const m=new Map();for(const r of R)if(r.nat==='estorno'){const d=r.date.slice(0,10),u=m.get(r.linkedOrder);if(!u||d<u)m.set(r.linkedOrder,d)}return m}
/** Quando o cancelamento entra no saldo: {data, origem, estimada}. Só faz sentido para pedido cancelado (partes().cancelado). */
function quandoCancelou(o,estornos){const d0=String(o.date).slice(0,10),x=o.external||{},inf=dataValida(x.cancelado_em),est=estornos?.get?.(o.id)||'';
 const data=inf||est,origem=inf?(x.cancelamento_origem||'informada'):est?'estorno':'pedido';
 return {data:data&&data>d0?data:d0,origem,estimada:!data}}

/** Planilha de cancelamentos (Importar › Cancelamentos, reembolsos e devoluções): o que cada linha {pedido, data} faz.
 *  Acha o pedido pelo número (ou pelo pedido / pacote do Mercado Livre em external). Fica de fora: linha sem pedido ou
 *  com data inválida, pedido que não está no Jarvis, pedido de competência fechada, pedido repetido, e quando o pedido
 *  já tem data de origem mais confiável (juntarCancelamento) ou a mesma data. Devolve {aplicar:[{id, linha, pedido, data,
 *  antes, venda, plataforma, cancelado, antesDaVenda, external}], ignorados:[{linha, pedido, data, motivo}]}. */
function planoCancelamentos({orders=[],closures={},linhas=[],origem='planilha'}){
 const porId=new Map(orders.map(o=>[String(o.id),o])),alt=new Map();
 for(const o of orders){const x=o.external||{};for(const k of [...(Array.isArray(x.ml_order_ids)?x.ml_order_ids:[]),x.pack_id])if(k!=null&&k!==''&&!porId.has(String(k)))alt.set(String(k),o)}
 const aplicar=[],ignorados=[],vistos=new Set();
 linhas.forEach((l,i)=>{const linha=i+1,pedido=String(l?.pedido??'').trim(),data=dataValida(String(l?.data??'')),o=porId.get(pedido)||alt.get(pedido);
  const fora=m=>ignorados.push({linha,pedido,data:data||String(l?.data??''),motivo:m});
  if(!pedido)return fora('sem número do pedido');if(!data)return fora('data inválida');if(!o)return fora('pedido não encontrado no Jarvis');
  if(closures&&closures[String(o.date).slice(0,7)])return fora('competência fechada');if(vistos.has(o.id))return fora('pedido repetido na planilha');vistos.add(o.id);
  const x=o.external||{},antes=dataValida(x.cancelado_em),ext=juntarCancelamento(x,{cancelado_em:data,cancelamento_origem:origem});
  if(antes===data&&x.cancelamento_origem===origem)return fora('já estava com esta data');
  if(ext.cancelado_em!==data||ext.cancelamento_origem!==origem)return fora(`mantida a data de ${dBR(ext.cancelado_em)} (${nomeOrigem(ext.cancelamento_origem).toLowerCase()})`);
  aplicar.push({id:o.id,linha,pedido,data,antes,venda:String(o.date).slice(0,10),plataforma:o.platform||'',cancelado:cancelado(o),antesDaVenda:data<String(o.date).slice(0,10),external:ext})});
 return {aplicar,ignorados}}

/** Natureza da liberação, com o conjunto de pedidos existentes (vínculo para pedido que não existe = sem vínculo). */
function natureza(r,existe){const v=!!r.linkedOrder&&existe(r.linkedOrder);
 if(r.kind==='ajuste')return 'ajuste';if(!v)return 'semVinculo';return Number(r.amount)<0?'estorno':'repasse'}

const COLS=['vendas','taxas','cancel','repasses','estornos','ajustes','semVinculo'];
const ROTULOS={inicial:'Saldo inicial',vendas:'Vendas (bruto)',taxas:'Taxas e comissões',cancel:'Cancelamentos e reembolsos',repasses:'Repasses recebidos',estornos:'Estornos e débitos da plataforma',ajustes:'Ajustes da plataforma',semVinculo:'Liberações sem pedido vinculado',final:'Saldo final'};

/** Conta (loja) de cada pedido: a das liberações dele (vinculadas, depois a do pedido informado); sem liberação, a
 *  conta mais usada da plataforma. Só importa quando a plataforma tem mais de uma conta. */
function contas(orders,receipts){const porPed=new Map(),inf=new Map(),freq=new Map();
 for(const r of receipts){const c=r.account||'';if(!c)continue;const g=grupo(r.platform);const f=freq.get(g)||new Map();f.set(c,(f.get(c)||0)+1);freq.set(g,f);
  if(r.linkedOrder&&!porPed.has(r.linkedOrder))porPed.set(r.linkedOrder,c);if(r.orderId&&!inf.has(r.orderId))inf.set(r.orderId,c)}
 const principal=new Map([...freq].map(([g,f])=>[g,[...f].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0][0]]));
 const lista=new Map([...freq].map(([g,f])=>[g,[...f.keys()].sort((a,b)=>a.localeCompare(b,'pt-BR'))]));
 const doPedido=o=>porPed.get(o.id)||inf.get(o.id)||principal.get(grupo(o.platform))||'';
 return {doPedido,lista}}

/** Prepara os dados com os filtros: plataforma (grupo) e conta. Devolve os pedidos e as liberações do recorte, com o
 *  grupo de cada liberação (a do pedido vinculado, quando existe, para o saldo do pedido ficar na plataforma dele). */
function recorte({orders=[],receipts=[],plataforma='',conta=''}){
 const porId=new Map(orders.map(o=>[o.id,o])),existe=id=>porId.has(id),C=contas(orders,receipts);
 const okP=g=>!plataforma||g===plataforma;
 const O=orders.filter(o=>o&&o.date&&okP(grupo(o.platform))&&(!conta||C.doPedido(o)===conta)),noRecorte=new Set(O.map(o=>o.id));
 // Liberação vinculada acompanha o pedido (plataforma e conta dele); a sem vínculo, a própria plataforma e conta.
 const R=receipts.filter(r=>r&&r.date&&Number(r.amount)).map(r=>{const vinc=!!r.linkedOrder&&existe(r.linkedOrder);
  return {...r,amount:r2(r.amount),vinc,grupo:vinc?grupo(porId.get(r.linkedOrder).platform):grupo(r.platform),nat:natureza(r,existe)}})
  .filter(r=>r.vinc?noRecorte.has(r.linkedOrder):okP(r.grupo)&&(!conta||(r.account||'')===conta));
 return {O,R,porId,contas:C}}

const COL_NAT={repasse:'repasses',estorno:'estornos',ajuste:'ajustes',semVinculo:'semVinculo'};
/** Eventos que mexem no saldo: [data, grupo, coluna, efeito no saldo, cancelamento com data estimada?]. */
function eventos(O,R){const E=[],est=estornosPorPedido(R);
 for(const o of O){const p=partes(o),g=grupo(o.platform),d=o.date.slice(0,10);E.push([d,g,'vendas',p.venda]);if(p.taxa)E.push([d,g,'taxas',-p.taxa]);
  if(p.cancel){const q=quandoCancelou(o,est);E.push([q.data,g,'cancel',-p.cancel,q.estimada])}}
 for(const r of R)E.push([r.date.slice(0,10),r.grupo,COL_NAT[r.nat],-r.amount]);
 return E.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0)}

/** Períodos de de..até: 'dia', 'semana' (segunda a domingo, a primeira e a última cortadas no período) ou 'mes'. */
function periodos(de,ate,quebra='dia'){const out=[];if(!de||!ate||de>ate)return out;let ini=de,n=0;
 while(ini<=ate&&n++<5000){let fim;
  if(quebra==='mes'){const [y,m]=ini.split('-').map(Number);fim=isoDe(Date.UTC(y,m,0))}
  else if(quebra==='semana'){const dow=(new Date(ms(ini)).getUTCDay()+6)%7;fim=somaDias(ini,6-dow)}
  else fim=ini;
  if(fim>ate)fim=ate;out.push({ini,fim,rotulo:rotulo(ini,fim,quebra)});ini=somaDias(fim,1)}
 return out}
function rotulo(ini,fim,q){if(q==='mes'){const m=Number(ini.slice(5,7));const cheio=ini.slice(8)==='01'&&somaDias(fim,1).slice(8)==='01';return `${MESES[m-1]}/${ini.slice(0,4)}${cheio?'':` (${ini.slice(8)} a ${fim.slice(8)})`}`}
 if(q==='semana')return ini===fim?dBR(ini):`${dBR(ini).slice(0,5)} a ${dBR(fim)}`;return dBR(ini)}

// cancelEst: a parte da coluna "cancel" com data estimada (a do pedido). Só informa: já está dentro de "cancel".
const zero=()=>Object.fromEntries(['inicial',...COLS,'final','cancelEst'].map(k=>[k,0]));
const fecha=l=>{for(const k of ['inicial',...COLS,'final','cancelEst'])l[k]=r2(l[k]);return l};

/** Composição (roll-forward) por plataforma e por período.
 *  Devolve {periodos, grupos:[{grupo,nome,linhas:[{ini,fim,rotulo,inicial,vendas,…,final}],total}], geral:{linhas,total}, contas}.
 *  total: inicial do primeiro período, soma das colunas e final do último. */
function composicao({orders=[],receipts=[],de,ate,quebra='dia',plataforma='',conta=''}){
 const {O,R,contas:C}=recorte({orders,receipts,plataforma,conta}),E=eventos(O,R),P=periodos(de,ate,quebra);
 const gs=ordenar(new Set(E.map(e=>e[1])));
 const abre=new Map(gs.map(g=>[g,0]));let i=0;
 for(;i<E.length&&E[i][0]<de;i++)abre.set(E[i][1],abre.get(E[i][1])+E[i][3]);
 const por=new Map(gs.map(g=>[g,[]])),saldo=new Map(abre);
 for(const p of P){const ls=new Map(gs.map(g=>[g,{ini:p.ini,fim:p.fim,rotulo:p.rotulo,...zero(),inicial:saldo.get(g)}]));
  for(;i<E.length&&E[i][0]<=p.fim;i++){const [,g,c,v,estimada]=E[i],l=ls.get(g);l[c]+=v;if(estimada)l.cancelEst+=v}
  for(const g of gs){const l=ls.get(g);l.final=l.inicial+COLS.reduce((s,c)=>s+l[c],0);saldo.set(g,r2(l.final));por.get(g).push(fecha(l))}}
 const totalDe=L=>{const t=zero();if(!L.length)return t;t.inicial=L[0].inicial;for(const l of L)for(const c of [...COLS,'cancelEst'])t[c]+=l[c];t.final=L[L.length-1].final;return fecha(t)};
 const grupos=gs.map(g=>({grupo:g,nome:nomeGrupo(g),linhas:por.get(g),total:totalDe(por.get(g))}))
  .filter(x=>x.linhas.some(l=>['inicial',...COLS].some(k=>Math.abs(l[k])>=0.005)));
 const linhas=P.map((p,k)=>{const l={ini:p.ini,fim:p.fim,rotulo:p.rotulo,...zero()};for(const x of grupos)for(const c of ['inicial',...COLS,'final','cancelEst'])l[c]+=x.linhas[k][c];return fecha(l)});
 return {periodos:P,grupos,geral:{linhas,total:totalDe(linhas)},contas:Object.fromEntries(C.lista)}}

/** Cancelamentos e reembolsos que entram no saldo de de..até (pela data do cancelamento), com a origem da data:
 *  {lista:[{id,grupo,nome,venda,data,origem,origemNome,estimada,valor}], total, qtd, estimadas:{qtd,valor}}. */
function cancelamentos({orders=[],receipts=[],de,ate,plataforma='',conta=''}){const {O,R}=recorte({orders,receipts,plataforma,conta}),est=estornosPorPedido(R),lista=[];
 for(const o of O){const p=partes(o);if(!p.cancel)continue;const q=quandoCancelou(o,est);if((de&&q.data<de)||(ate&&q.data>ate))continue;const g=grupo(o.platform);
  lista.push({id:o.id,grupo:g,nome:nomeGrupo(g),venda:o.date.slice(0,10),data:q.data,origem:q.origem,origemNome:nomeOrigem(q.origem),estimada:q.estimada,valor:p.cancel})}
 lista.sort((a,b)=>a.data.localeCompare(b.data)||String(a.id).localeCompare(String(b.id)));
 const E=lista.filter(x=>x.estimada);
 return {lista,qtd:lista.length,total:r2(lista.reduce((s,x)=>s+x.valor,0)),estimadas:{qtd:E.length,valor:r2(E.reduce((s,x)=>s+x.valor,0))}}}

/** Saldo numa data (fim do dia), pela mesma conta da composição — atalho para conferências. */
function saldoEm(args,data){const {O,R}=recorte(args),E=eventos(O,R);let s=0;for(const e of E)if(e[0]<=data)s+=e[3];return r2(s)}

const FAIXAS=[['avencer','A vencer',-Infinity,0],['d1_7','Vencido 1–7 dias',1,7],['d8_15','Vencido 8–15 dias',8,15],['d16_30','Vencido 16–30 dias',16,30],['d31_60','Vencido 31–60 dias',31,60],['d60','Vencido há mais de 60 dias',61,Infinity]];
const faixaDe=d=>FAIXAS.find(f=>d>=f[2]&&d<=f[3])[0];

/** Posição numa data: os pedidos que compõem o saldo (líquido − recebido até a data), com a idade, e as liberações sem
 *  vínculo até a data. Idade: dias desde a previsão de liberação (due) ou, sem previsão, desde a data da venda.
 *  Pedido com repasse vinculado ANTES da data do pedido (nota emitida depois) entra com saldo negativo, marcado.
 *  Pedido cancelado depois da data da posição ainda conta como venda a receber (líquido = bruto − taxa sem o cancelamento). */
function posicao({orders=[],receipts=[],data,plataforma='',conta=''}){
 const {O,R}=recorte({orders,receipts,plataforma,conta}),rec=new Map(),ultima=new Map(),est=estornosPorPedido(R);
 for(const r of R)if(r.vinc&&r.date.slice(0,10)<=data){rec.set(r.linkedOrder,(rec.get(r.linkedOrder)||0)+r.amount);const u=ultima.get(r.linkedOrder);if(!u||r.date>u)ultima.set(r.linkedOrder,r.date.slice(0,10))}
 const pedidos=[];
 for(const o of O){const vendido=o.date.slice(0,10)<=data,recebido=r2(rec.get(o.id)||0);if(!vendido&&!recebido)continue;
  const p=partes(o),q=p.cancel?quandoCancelou(o,est):null,canc=!!q&&q.data<=data;
  const liquido=!vendido?0:q&&!canc?r2(p.venda-p.taxa):p.liquido,saldo=r2(liquido-recebido);if(Math.abs(saldo)<0.005)continue;
  const base=o.due?'previsao':'venda',ref=(o.due||o.date).slice(0,10),idade=dias(ref,data);
  const situacao=!vendido?'Repasse antes da data do pedido':recebido>0&&saldo>0?'Recebido em parte (divergência)':recebido>0?'Recebido a mais (divergência)':recebido<0?'Estorno vinculado':o.transit?'Em trânsito':canc||(p.cancelado&&!q)?'Cancelado/reembolsado':'A receber';
  pedidos.push({id:o.id,grupo:grupo(o.platform),nome:nomeGrupo(grupo(o.platform)),data:o.date.slice(0,10),previsao:o.due?o.due.slice(0,10):'',base,idade,faixa:faixaDe(idade),
   bruto:vendido?p.venda:0,taxa:vendido?r2(p.taxa+(canc?p.cancel:0)):0,liquido,recebido,saldo,transito:!!o.transit,situacao,ultimaLiberacao:ultima.get(o.id)||'',
   cancelamento:q?q.data:'',cancelOrigem:q?q.origem:'',cancelEstimada:!!q&&q.estimada})}
 pedidos.sort((a,b)=>b.idade-a.idade||a.data.localeCompare(b.data)||String(a.id).localeCompare(String(b.id)));
 const soltas=R.filter(r=>!r.vinc&&r.date.slice(0,10)<=data)
  .map(r=>({id:r.id,grupo:r.grupo,nome:nomeGrupo(r.grupo),data:r.date.slice(0,10),valor:r.amount,tipo:r.kind==='ajuste'?'Ajuste da plataforma':'Liberação',conta:r.account||'',pedidoInformado:r.orderId||'',descricao:r.description||''}))
  .sort((a,b)=>b.data.localeCompare(a.data)||String(a.id).localeCompare(String(b.id)));
 // Ajuste vinculado a pedido entra no recebido do pedido (acima); por isso não aparece entre as soltas.
 const gs=ordenar(new Set([...pedidos.map(p=>p.grupo),...soltas.map(s=>s.grupo)]));
 const faixas=FAIXAS.map(([k,n])=>{const L=pedidos.filter(p=>p.faixa===k);return {faixa:k,nome:n,pedidos:L.length,saldo:r2(L.reduce((s,p)=>s+p.saldo,0))}});
 const porGrupo=gs.map(g=>{const L=pedidos.filter(p=>p.grupo===g),S=soltas.filter(s=>s.grupo===g),ped=r2(L.reduce((s,p)=>s+p.saldo,0)),sv=r2(S.reduce((s,x)=>s+x.valor,0));
  return {grupo:g,nome:nomeGrupo(g),pedidos:L.length,saldoPedidos:ped,emTransito:r2(L.filter(p=>p.transito).reduce((s,p)=>s+p.saldo,0)),semVinculo:sv,qtdSemVinculo:S.length,saldo:r2(ped-sv),
   faixas:Object.fromEntries(FAIXAS.map(([k])=>[k,r2(L.filter(p=>p.faixa===k).reduce((s,p)=>s+p.saldo,0))]))}});
 const saldoPedidos=r2(pedidos.reduce((s,p)=>s+p.saldo,0)),semVinculo=r2(soltas.reduce((s,x)=>s+x.valor,0));
 return {data,pedidos,soltas,faixas,porGrupo,totais:{pedidos:pedidos.length,saldoPedidos,semVinculo,saldo:r2(saldoPedidos-semVinculo),emTransito:r2(pedidos.filter(p=>p.transito).reduce((s,p)=>s+p.saldo,0))}}}

/** Série para o gráfico: saldo final por período e por plataforma; vendas líquidas e repasses (todas as liberações). */
function serie(comp){return comp.periodos.map((p,k)=>{const por={};let vend=0,rep=0;
 for(const g of comp.grupos){const l=g.linhas[k];por[g.grupo]=l.final;vend+=l.vendas+l.taxas+l.cancel;rep+=-(l.repasses+l.estornos+l.ajustes+l.semVinculo)}
 return {ini:p.ini,fim:p.fim,rotulo:p.rotulo,por,total:comp.geral.linhas[k].final,vendasLiquidas:r2(vend),repasses:r2(rep)}})}

/** Valor informado pela plataforma na consulta de saldo (resposta crua da API, em qualquer nível):
 *  Shopee (get_income_overview): o "pendente" (pending…); Mercado Pago (balance): o "a liberar" (unavailable_balance). */
function planos(o,pre=''){const out=[];for(const [k,v] of Object.entries(o||{})){if(v&&typeof v==='object'&&!Array.isArray(v))out.push(...planos(v,pre+k+'.'));else if(typeof v==='number'||(typeof v==='string'&&v!==''&&!isNaN(Number(v))))out.push([pre+k,Number(v)])}return out}
function valorPlataforma(plat,resumo){const v=planos(resumo);if(!v.length)return null;
 if(plat==='Shopee'){const p=v.filter(([k])=>/pending/i.test(k));const t=p.find(([k])=>/total/i.test(k))||p[0];return t?r2(t[1]):null}
 const u=v.find(([k])=>/(^|\.)unavailable_balance$/.test(k));return u?r2(u[1]):null}

/** Conferência com a plataforma: saldo do Jarvis (posição) × informado, diferença e causas prováveis. */
function conferencia({pos,grupo:g,informado,dias:limite=15}){const G=pos.porGrupo.find(x=>x.grupo===g)||{saldo:0,saldoPedidos:0,semVinculo:0,qtdSemVinculo:0,emTransito:0};
 const L=pos.pedidos.filter(p=>p.grupo===g),soma=a=>r2(a.reduce((s,p)=>s+p.saldo,0));
 const atrasados=L.filter(p=>p.saldo>0&&p.idade>limite),transito=L.filter(p=>p.transito),negativos=L.filter(p=>p.saldo<0),divergentes=L.filter(p=>p.recebido>0&&p.saldo>0);
 const jarvis=G.saldo,dif=informado==null?null:r2(jarvis-informado),causas=[];
 if(atrasados.length)causas.push({k:'atrasados',qtd:atrasados.length,valor:soma(atrasados),texto:`${atrasados.length} pedido(s) sem liberação há mais de ${limite} dias da previsão (ou da venda): talvez já liberados e não vinculados, cancelados na plataforma ou retidos.`});
 if(G.qtdSemVinculo)causas.push({k:'semVinculo',qtd:G.qtdSemVinculo,valor:r2(G.semVinculo),texto:`${G.qtdSemVinculo} liberação(ões) sem pedido vinculado: já descontadas do saldo do Jarvis; vincule para saber de que pedido são.`});
 if(transito.length)causas.push({k:'transito',qtd:transito.length,valor:soma(transito),texto:`${transito.length} pedido(s) em trânsito: a plataforma pode ainda não contar como pendente.`});
 if(divergentes.length)causas.push({k:'divergentes',qtd:divergentes.length,valor:soma(divergentes),texto:`${divergentes.length} pedido(s) recebido(s) a menor: a diferença fica no saldo do Jarvis até ser explicada.`});
 if(negativos.length)causas.push({k:'negativos',qtd:negativos.length,valor:soma(negativos),texto:`${negativos.length} pedido(s) com saldo negativo (recebido a mais, reembolso ou repasse antes da nota).`});
 return {grupo:g,jarvis,informado,diferenca:dif,causas}}

const M={r2,dias,somaDias,dBR,grupo,nomeGrupo,ordenar,cancelado,partes,natureza,periodos,composicao,saldoEm,posicao,serie,valorPlataforma,conferencia,COLS,ROTULOS,FAIXAS,
 dataValida,juntarCancelamento,quandoCancelou,cancelamentos,planoCancelamentos,nomeOrigem,ORIGENS,PRIORIDADE};
if(typeof window!=='undefined')window.SaldosReceberMotor=M;
if(typeof module!=='undefined'&&module.exports)module.exports=M;
})();
