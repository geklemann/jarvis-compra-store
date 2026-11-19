// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Preços e margem › Margem real (antigo Radar de margem, com o Raio-X na aba "O que mudou"): o que cada venda deixou de
// fato. Por pedido: venda − tarifa do marketplace (com o frete do vendedor) − custo do produto − tributos sobre a venda
// = margem de contribuição; − anúncios pagos − despesas fixas = margem líquida. Custo, tributos, anúncios, despesas fixas
// e as metas (Mínimo e Alvo) vêm de Preços e margem (window.Preco, web/precificacao.js): a mesma conta da Formação de
// preço, só que com a tarifa, o frete e o repasse que o marketplace informou. Também acha as tarifas cobradas fora do
// padrão do canal (possível erro do marketplace a contestar).
(()=>{
Object.assign(paths,{radar:'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z M12 12l6-6'});
const ui={periodo:30,canal:'',aba:'anuncios',busca:'',ord:{}};
window.Reiniciar?.registrar(ui,['periodo','canal','aba','busca','ord']); // estado de tela: volta ao original ao clicar no menu
const menos=n=>{const d=new Date();d.setDate(d.getDate()-n);return d.toLocaleDateString('sv-SE')};
const p1=v=>(v*100).toFixed(1).replace('.',',')+'%';
const PM=()=>window.PrecoMotor;
let cache=null;
// Tributos sobre a venda: os de Preços e margem › Regras de venda (os mesmos da Formação de preço).
function aliqTributos(){try{const t=window.Preco?.tributos?.();if(t)return {r:t.pct/100,m:null,t}}catch{}return {r:0.24,m:null}}
// Anúncios pagos + despesas fixas (% da venda), das Regras de venda: da contribuição à margem líquida.
function despesasPct(){try{const P=window.Preco;return P?(P.ads().pct+P.fixas().pct)/100:0}catch{return 0}}
// Custo por SKU: o custo do produto de Preços e margem › Custo do produto (última nota de entrada com frete, IPI e ST,
// embalagem e perdas; à mão quando a empresa ou o produto escolhem). Já vem com a embalagem.
const chaveCusto=()=>[(db.products||[]).map(p=>p.id+':'+p.custo+':'+p.embalagem+':'+JSON.stringify(p.extra?.comp||'')+(p.extra?.custoManual?'m':'')).join(','),(db.purchases||[]).length,(window.Estoque?.lista?.()||[]).length,db.pricing?.custo?.regra||''].join('|');
let custoCache=null;
function mapaCusto(){const k=chaveCusto();if(custoCache?.k===k)return custoCache.v;const m=new Map(),P=window.Preco;if(P){const ids=new Set([...(db.products||[]).map(p=>String(p.id).trim()),...(window.Estoque?.lista?.()||[]).map(p=>String(p.id).trim())]);
 for(const o of db.orders||[])for(const i of o.items||[])if(i.sku)ids.add(String(i.sku).trim());for(const s of ids){const c=P.custo(s);if(c.tem)m.set(s,{c:c.total,e:0,f:c.origem.tipo,info:c})}}
 custoCache={k,v:m};return m}
// Tarifa só da API do marketplace: pedido com tarifa estimada pelo Bling (ou sem origem) fica fora da margem.
const tarifaReal=o=>{const f=o.feeSource||o.fee_source||'';return f===o.platform};
// Lucro de contribuição de um pedido. null = cancelado/reembolsado (tarifa ≥ 95% do bruto, bruto zerado ou abaixo de
// metade do valor dos itens: o marketplace não repassa nada, fica fora da margem); {falta:true} = algum item sem custo;
// {semTarifa:true} = tarifa ainda não veio da API do marketplace (estimativa do Bling) — fica fora, contado à parte.
function cancelado(o){const it=(o.items||[]).reduce((s,i)=>s+(Number(i.qty)||0)*(Number(i.price)||0),0);return !(o.gross>0)||o.fee>=o.gross*0.95||(it>0&&o.gross<it*0.5)}
function lucroPedido(o,custo,aliq){if(cancelado(o))return null;if(!tarifaReal(o))return {semTarifa:true};let cmv=0;for(const it of o.items||[]){const c=custo.get(String(it.sku||'').trim());if(!c)return {falta:true};cmv+=(c.c+c.e)*(Number(it.qty)||0)}
 const frete=0,trib=o.gross*aliq;/* com tarifa da API o frete do vendedor já está na tarifa (ML: sale_fee + frete) */return {cmv,frete,trib,lucro:o.gross-o.fee-frete-cmv-trib}}
// Período: 'mes' = mês da nota (competência do cabeçalho) ou os últimos N dias.
function intervalo(per=ui.periodo){if(per==='mes'){const m=typeof month==='string'?month:new Date().toLocaleDateString('sv-SE').slice(0,7),[a,b]=m.split('-').map(Number);return [m+'-01',new Date(a,b,0).toLocaleDateString('sv-SE')]}return [menos(Number(per)||30),'9999-12-31']}
const rotPeriodo=(per=ui.periodo)=>per==='mes'?'mês da nota':`últimos ${per} dias`;
function pedidosDe(ini,fim,custo,aliq){const peds=[],cancelados=[],semTarifa=[];let semCusto=0;
 for(const o of db.orders){if(o.date<ini||o.date>fim)continue;const x=lucroPedido(o,custo,aliq);
  if(!x){cancelados.push(o);continue}if(x.semTarifa){semTarifa.push(o);continue}if(x.falta){semCusto++;continue}
  peds.push({o,...x,m:o.gross?x.lucro/o.gross:0,feeP:o.gross?o.fee/o.gross:0})}
 return {peds,cancelados,semTarifa,semCusto}}
function calcular(){const [ini,fim]=intervalo(),k=[db.orders.length,ini,fim,chaveCusto(),JSON.stringify(db.pricing?.tributos||''),(db.accLines||[]).length].join('|');if(cache?.k===k)return cache.v;
 taxaML=null;const custo=mapaCusto();
 const {r:aliq,m:mesAliq}=aliqTributos(),{peds,cancelados,semTarifa,semCusto}=pedidosDe(ini,fim,custo,aliq);
 // Tarifa fora do padrão: acima de 1,5× a mediana do canal para o mesmo produto principal.
 const med=new Map();for(const x of peds){const k=x.o.platform+'|'+(x.o.items?.[0]?.sku||'');(med.get(k)||med.set(k,[]).get(k)).push(x.feeP)}
 for(const [k,l] of med){l.sort((a,b)=>a-b);med.set(k,l[Math.floor(l.length/2)])}
 for(const x of peds){const md=med.get(x.o.platform+'|'+(x.o.items?.[0]?.sku||''));x.tarifaFora=md>0&&x.feeP>md*1.5&&x.o.fee-x.o.gross*md>5;x.tarifaExcesso=md?x.o.fee-x.o.gross*md:0}
 const custoDe=sku=>{const c=custo.get(String(sku||'').trim());return c?c.c+c.e:0};const custoInfo=sku=>custo.get(String(sku||'').trim())||null;cache={k,v:{peds,aliq,mesAliq,semCusto,cancelados,semTarifa,custoDe,custoInfo}};return cache.v}
// O real dos últimos N dias por anúncio (canal + SKU), independente do período da tela: é o "Real 30 d" da Formação de
// preço e o frete médio de cada produto das Regras de venda (Preco.real, Preco.freteLoja).
let realCache=null;
function realAnuncios(dias=30){const ini=menos(dias),k=[db.orders.length,ini,chaveCusto()].join('|');if(realCache?.k===k)return realCache.v;
 const {peds}=pedidosDe(ini,'9999-12-31',mapaCusto(),aliqTributos().r),m=new Map();for(const g of agregar(peds).values())m.set(g.canal+'|'+String(g.sku||'').trim(),g);realCache={k,v:m};return m}
// Da contribuição à margem líquida: anúncios pagos e despesas fixas pelos % das Regras de venda (os mesmos da Formação).
function liquido(g){const d=despesasPct();g.desp=g.venda*d;g.ll=g.lucro-g.desp;g.ml=g.venda?g.ll/g.venda:0;return g}
const nn=v=>Number(v)||0;
// A regra da Shopee é uma só: a do canal em Regras de venda (comissão e taxa fixa por faixa de preço, web/preco-motor.js).
const regraShopee=p=>{const c=window.Preco?.regras?.().canais?.Shopee||window.PrecoMotor?.CANAIS_PADRAO?.Shopee;return c&&window.PrecoMotor?window.PrecoMotor.faixaDe(p,c):{comissao:14,fixa:0}};
const faixaShopee=p=>regraShopee(p).fixa;
// Comissão do ML por SKU: tarifas − frete, nos pedidos em que o Bling traz o frete separado (Clássico ≈ 11,5%, Premium ≈ 16,5%).
let taxaML=null;
function comissaoML(){if(taxaML)return taxaML;const m=new Map(),all=[],med=l=>{l.sort((a,b)=>a-b);return l[Math.floor(l.length/2)]};
 for(const o of db.orders){if(o.platform!=='Mercado Livre')continue;const tp=nn(o.external?.tarifas_plataforma),sh=nn(o.shipping),its=o.items||[];if(!tp||!sh||sh>=tp||its.length!==1)continue;
  const v=nn(its[0].qty)*nn(its[0].price),r=v?(tp-sh)/v:0;if(r<0.05||r>0.3)continue;for(const k of [String(its[0].sku||'')+'|'+nn(its[0].price).toFixed(2),String(its[0].sku||'')])(m.get(k)||m.set(k,[]).get(k)).push(r);all.push(r)}
 taxaML={sku:new Map([...m].map(([k,l])=>[k,med(l)])),geral:all.length?med(all):0.115};return taxaML}
// Decompõe o custo de plataforma de UM pedido (venda dos produtos − repasse + frete do vendedor) em partes que somam o total.
function partes(x){const o=x.o,e=o.external||{},its=o.items||[],tot=its.reduce((a,i)=>a+nn(i.qty)*nn(i.price),0)||nn(o.gross),T=tot-(nn(o.gross)-nn(o.fee))+x.frete;
 const r={tot,T,com:0,fixa:0,reb:0,frete:x.frete,outros:0,real:false,dt:[],ot:[],rb:[]};const R=e.renda;
 if(o.platform==='Shopee'&&R&&R.commission_fee!=null){const c=nn(R.commission_fee),s=nn(R.service_fee),nc=R.net_commission_fee!=null?nn(R.net_commission_fee):c,ns=R.net_service_fee!=null?nn(R.net_service_fee):s;
  r.fixa=Math.min(s,its.reduce((a,i)=>a+faixaShopee(nn(i.price))*nn(i.qty),0));r.com=c+s-r.fixa;r.reb=Math.max(0,c-nc+s-ns);r.real=true;
  r.dt=[['Comissão Shopee',c],['Taxa de serviço (parte %)',s-r.fixa]];if(r.reb)r.rb=[['Rebate da Shopee na comissão e na taxa',r.reb]];
  r.outros=T-(r.com+r.fixa-r.reb)-r.frete;const pix=nn(R.pix_discount),cup=nn(R.seller_discount),pro=nn(R.shipping_seller_protection_fee_amount);
  r.ot=[['Desconto Pix dado ao comprador',pix],['Cupom da loja',cup],['Proteção de envio',pro]].filter(y=>y[1]>0.004);const resto=r.outros-pix-cup-pro;if(Math.abs(resto)>=0.01)r.ot.push([resto<0?'Ajustes a seu favor':'Outros ajustes da Shopee',resto])}
 // Sem o Bling (pedido só da API do ML) a tarifa do pedido já é a do ML (sale_fee + frete): separa o frete do mesmo jeito.
 else if(o.platform==='Mercado Livre'&&(e.tarifas_plataforma!=null||((o.feeSource||o.fee_source)==='Mercado Livre'&&nn(o.shipping)>0))){const tp=nn(e.tarifas_plataforma??o.fee),sh=nn(o.shipping),t=comissaoML(),k=String(its[0]?.sku||'');
  if(sh>0&&sh<tp){r.com=tp-sh;r.real=true}else r.com=Math.min(tp,tot*(t.sku.get(k+'|'+nn(its[0]?.price).toFixed(2))??t.sku.get(k)??t.geral));
  r.dt=[['Comissão do ML (tarifa de venda)',r.com]];r.frete=x.frete+(tp-r.com);if(tp-r.com>0.004)r.ot.push(['Frete cobrado pelo ML (Mercado Envios)',tp-r.com]);
  const dif=T-tp-x.frete;if(dif<-0.004){r.reb=-dif;r.rb=[['Repasse acima do previsto (rebate/campanha do ML)',-dif]]}else if(dif>0.004){r.outros=dif;r.menor=dif>0.5;r.ot.push(['Repasse menor que o previsto pelo ML (vale conferir o pedido)',dif])}}
 else if(o.platform==='Shopee'){// sem o detalhe da API: a regra da Shopee das Regras de venda (comissão e taxa fixa da faixa de preço de cada item)
  const pago=nn(o.gross),desc=pago>0&&pago<tot?tot-pago:0,f=tot?(tot-desc)/tot:1;
  const cS=its.reduce((a,i)=>a+nn(i.qty)*nn(i.price)*f*regraShopee(nn(i.price)).comissao/100,0);r.com=cS;r.fixa=its.reduce((a,i)=>a+faixaShopee(nn(i.price))*nn(i.qty),0);
  r.dt=[['Comissão Shopee (regra do canal)',cS]];if(desc)r.ot.push(['Desconto ao comprador (cupom/campanha da loja)',desc]);const dif=T-x.frete-r.com-r.fixa-desc;r.outros=desc;
  if(dif<-0.004){r.reb=-dif;r.rb=[['Cobrado a menos que a regra (rebate/campanha)',-dif]]}else if(dif>0.004){r.outros+=dif;r.ot.push(['Outros ajustes da Shopee',dif])}}
 else{r.com=Math.max(0,Math.min(T-x.frete,nn(o.fee)));r.real=o.fee_source===o.platform||o.feeSource===o.platform;r.dt=[[`Tarifa ${o.platform}`,r.com]];r.outros=T-x.frete-r.com;if(Math.abs(r.outros)>=0.01)r.ot.push([r.outros<0?'Ajustes a seu favor':'Outras deduções do repasse',r.outros])}
 if(x.frete>0.004)r.ot.unshift(['Frete pago pelo vendedor',x.frete]);return r}
// Soma, por anúncio (canal + SKU), o que a plataforma ficou de cada venda: comissão, taxa fixa, rebate, frete do
// vendedor e outros (descontos bancados pela loja, diferenças de repasse), rateados pelo valor dos itens. freteAcima e
// uAcima: o frete das vendas a partir do preço em que a loja paga o frete (ML: R$ 79), base do frete da regra.
function agregar(peds){const m=new Map(),soma=(mp,l,f)=>{for(const [k,v] of l)mp.set(k,(mp.get(k)||0)+v*f)},P=window.Preco,acima=new Map();
 const ac=plat=>{if(!acima.has(plat)){let v=0;try{v=nn(P?.regras?.().canais?.[P.canalDe(plat)]?.freteAcima)}catch{}acima.set(plat,v)}return acima.get(plat)};
 for(const x of peds){const its=x.o.items||[],p=partes(x),tot=p.tot||1,lim=ac(x.o.platform);
  for(const i of its){const q=nn(i.qty),vb=q*nn(i.price);if(!q||!vb)continue;const sh=vb/tot,sku=String(i.sku||i.title||'').trim(),k=x.o.platform+'|'+sku,
   g=m.get(k)||{canal:x.o.platform,sku:i.sku,nome:i.title||i.sku,u:0,venda:0,com:0,fixa:0,reb:0,frete:0,outros:0,cmv:0,n:0,nReal:0,freteAcima:0,uAcima:0,dt:new Map(),ot:new Map(),rb:new Map()};
   g.u+=q;g.venda+=vb;g.com+=p.com*sh;g.fixa+=p.fixa*sh;g.reb+=p.reb*sh;g.frete+=p.frete*sh;g.outros+=p.outros*sh;g.cmv+=(x.custoDe?.(i.sku)??0)*q;g.n++;if(p.real)g.nReal++;if(p.menor)(g.menores||(g.menores=[])).push(x.o.id);
   if(nn(i.price)>=lim-1e-9){g.freteAcima+=p.frete*sh;g.uAcima+=q}soma(g.dt,p.dt,sh);soma(g.ot,p.ot,sh);soma(g.rb,p.rb,sh);m.set(k,g)}}
 return m}
// Por anúncio: a conta do motor (web/preco-motor.js) no preço médio vendido, com a tarifa e o frete reais do período;
// Mínimo e Alvo são os da Formação de preço (Regras de venda), os mesmos em todas as telas.
function anuncios(peds,aliq,custoDe){const M=PM(),P=window.Preco;for(const x of peds)x.custoDe=custoDe;const m=agregar(peds);
 const ORD={prejuizo:0,abaixo:1,ok:2,poucos:3};
 return [...m.values()].filter(g=>g.u>0&&g.cmv>0).map(g=>{const u=g.u,sku=String(g.sku||'').trim(),preco=g.venda/u,par=P.paramsReal(g,sku),L=M.conta(preco,par),kc=P.canalDe(g.canal)||g.canal,pr=P.precos(sku,kc),mt=P.metas(sku,kc),s=M.situacao(L.liqP,mt);
  return {...g,aliq:L.tributosPct/100,preco,custo:L.custo,tarU:(g.com+g.fixa-g.reb)/u,foU:(g.frete+g.outros)/u,tp:(g.com+g.fixa-g.reb)/g.venda,comP:g.com/g.venda,fixaU:g.fixa/u,rebU:g.reb/u,
   canalU:L.canal,tribU:L.tributos,lucroU:L.mc,margem:L.mcP/100,despU:L.ads+L.fixas,llU:L.liq,liqP:L.liqP,min:pr?.minimo??null,eq:pr?.piso??null,alvo:pr?.alvo??null,metaAlvo:mt.alvo,L,
   st:u<3?'poucos':s==='prejuizo'?'prejuizo':s==='abaixo'?'abaixo':'ok'}}).sort((a,b)=>ORD[a.st]-ORD[b.st]||a.liqP-b.liqP)}
// Detalhe (ao passar o mouse) de como cada valor foi calculado.
const linhaTip=(t,v,cls='')=>`<div class="mgtl ${cls}"><span>${t}</span><b>${v}</b></div>`;
function tipTarifa(a){const u=a.u,pp=v=>a.preco?` <em>${p1(v/u/a.preco)}</em>`:'';
 return `<strong>Tarifa do e-commerce · ${esc(a.canal)}</strong><small>média por unidade em ${a.n} venda(s)</small>`+linhaTip('Preço praticado',money(a.preco))
  +[...a.dt].map(([t,v])=>linhaTip(esc(t),money(v/u)+pp(v))).join('')+(a.fixaU>0.004?linhaTip('Taxa fixa por item (faixa de preço)',money(a.fixaU)):'')
  +[...a.rb].map(([t,v])=>linhaTip('− '+esc(t),'− '+money(v/u)+pp(v),'green')).join('')
  +linhaTip('= Tarifa real',`${money(a.tarU)} <em>${p1(a.tp)}</em>`,'tot')
  +`<small>${a.nReal===a.n?'Valores reais da plataforma em todas as vendas.':a.nReal?`Valores reais em ${a.nReal} de ${a.n} vendas; o resto estimado pela taxa do anúncio.`:'Estimado pela taxa do canal (sem detalhe da plataforma).'}${a.canal==='Shopee'?' Shopee: comissão 12% (18% até R$ 79,99) + taxa de serviço 5,5% + taxa fixa por faixa de preço.':''}</small>`}
function tipOutros(a){const u=a.u,l=[...a.ot].filter(([,v])=>Math.abs(v)>=0.005);
 return `<strong>Frete e outros gastos</strong><small>média por unidade · não é tarifa do e-commerce</small>`+(l.map(([t,v])=>linhaTip(esc(t),money(v/u),v<0?'green':'')).join('')||linhaTip('Nenhum','R$ 0,00'))
  +(a.menores?.length?`<small class="gold">Pedido(s) com repasse abaixo do previsto: ${a.menores.map(esc).join(', ')}. Confira no Mercado Pago; se não houver motivo (devolução, reclamação), vale contestar.</small>`:'')+linhaTip('= Total',`${money(a.foU)} <em>${p1(a.preco?a.foU/a.preco:0)}</em>`,'tot')+linhaTip('Repasse médio por unidade',money(a.preco-a.tarU-a.foU))}
function agrupar(peds,chave){const m=new Map();for(const x of peds){const ks=chave(x);for(const [k,peso] of ks){const g=m.get(k)||{k,n:0,venda:0,lucro:0,neg:0};g.n+=peso;g.venda+=x.o.gross*peso;g.lucro+=x.lucro*peso;if(x.lucro<0)g.neg+=peso;m.set(k,g)}}return [...m.values()].map(g=>({...g,m:g.venda?g.lucro/g.venda:0}))}
function tipConta(a){const L=a.L,pc=v=>` <em>${p1(a.preco?v/a.preco:0)}</em>`;
 return `<strong>Do preço à margem líquida</strong><small>por unidade, no preço médio vendido · ${a.n} venda(s)</small>`+linhaTip('Preço médio',money(a.preco))+linhaTip('− Custo do canal (comissão, taxa, frete, descontos)','− '+money(L.canal)+pc(L.canal))+linhaTip(`− Tributos sobre a venda (${p1(L.tributosPct/100)})`,'− '+money(L.tributos)+pc(L.tributos))+linhaTip('− Custo do produto','− '+money(L.custo)+pc(L.custo))
  +linhaTip('= Margem de contribuição',`${money(L.mc)} <em>${p1(L.mcP/100)}</em>`,'tot')+linhaTip(`− Anúncios pagos (${p1(L.adsPct/100)})`,'− '+money(L.ads))+linhaTip(`− Despesas fixas (${p1(L.fixasPct/100)})`,'− '+money(L.fixas))+linhaTip('= Margem líquida',`${money(L.liq)} <em>${p1(L.liqP/100)}</em>`,'tot')
  +`<small>Tributos, anúncios e despesas fixas das Regras de venda (Preços e margem): os mesmos da Formação de preço.</small>`}
function tipCusto(a,ci){const c=ci?.info;
 return `<strong>Custo do produto</strong><small>por unidade · ${esc(a.sku||'')}</small>`+(c?linhaTip('Compra ('+esc(c.origem.texto||'')+')',money(c.compra))+(c.acrescimos+c.frete+c.ipi+c.st-c.creditos>0.004?linhaTip('+ Frete, IPI e ST',money(c.acrescimos+c.frete+c.ipi+c.st-c.creditos)):'')+(c.perdas>0.004?linhaTip('+ Perdas',money(c.perdas)):'')+linhaTip('+ Embalagem',money(c.embalagem)):'')+linhaTip('= Custo usado na margem',money(a.custo),'tot')+`<small>Vem de Preços e margem › Custo do produto (a última nota de entrada com frete, IPI e ST). Ajuste lá.</small>`}
function tipMinimo(a){const pr=window.Preco?.params?.(String(a.sku||'').trim(),window.Preco.canalDe(a.canal)||a.canal);if(!pr)return '<strong>Sem custo do produto</strong>';const L=PM().conta(a.min||a.preco,pr);
 return `<strong>Mínimo e alvo · regra do canal</strong><small>os mesmos da Formação de preço</small>`+linhaTip('Custo do produto',money(pr.custo))+linhaTip('+ Taxa fixa e frete pagos pela loja',money(L.fixa+L.frete))+linhaTip('Comissão + tributos + anúncios + fixas',p1((L.comissaoPct+L.tributosPct+L.adsPct+L.fixasPct)/100))+linhaTip('Piso (contribuição zero)',a.eq?money(a.eq):'—','tot')+linhaTip('Mínimo (líquida zero)',a.min?money(a.min):'—','tot')+linhaTip(`Alvo (${String(a.metaAlvo).replace('.',',')}% líquida)`,a.alvo?money(a.alvo):'—','tot')+`<small>preço = (custo + taxa fixa + frete) ÷ (1 − comissão − tributos − anúncios − fixas − meta)</small>`}
function view(){if(ui.aba==='mudou')return barraTopo([])+(window.RaioX?.view?.()||'<div class="empty">Carregando…</div>');
 const {peds,aliq,semCusto,cancelados,semTarifa=[],custoDe,custoInfo}=calcular(),l=peds.filter(x=>!ui.canal||x.o.platform===ui.canal),P=window.Preco,mt=P?.metas?.()||{alvo:10};
 const venda=l.reduce((s,x)=>s+x.o.gross,0),lucro=l.reduce((s,x)=>s+x.lucro,0),neg=l.filter(x=>x.lucro<0),perda=neg.reduce((s,x)=>s+x.lucro,0),fora=l.filter(x=>x.tarifaFora),excesso=fora.reduce((s,x)=>s+x.tarifaExcesso,0);
 const canais=[...new Set(peds.map(x=>x.o.platform))];
 const prods=agrupar(l,x=>{const t=(x.o.items||[]).reduce((s,i)=>s+(Number(i.qty)||0)*(Number(i.price)||0),0)||1;return (x.o.items||[]).map(i=>[i.title||i.sku,(Number(i.qty)||0)*(Number(i.price)||0)/t])}).filter(g=>g.n>=1).sort((a,b)=>a.m-b.m);
 const porCanal=agrupar(l,x=>[[x.o.platform,1]]).sort((a,b)=>b.venda-a.venda);
 prods.forEach(liquido);porCanal.forEach(liquido);const T=liquido({k:'Total',n:l.length,venda,lucro,neg:neg.length,m:venda?lucro/venda:0});
 const prodsV=[...prods].sort((a,b)=>b.venda-a.venda),dp=despesasPct();
 const kpi=(t,v,s,tom)=>`<div class="card kpi"><span class="kpil">${t}</span><span class="kpiv ${tom||''}">${v}</span><span class="kpis">${s}</span></div>`;
 const nc=cancelados.filter(o=>!ui.canal||o.platform===ui.canal),ns=semTarifa.filter(o=>!ui.canal||o.platform===ui.canal);
 const cabG=['Pedidos','Vendido','Contribuição','% contrib.','Anúncios e fixas','Margem líquida','% líquida'],linG=g=>[`<strong>${esc(g.k)}</strong>`,(g.n||0).toLocaleString('pt-BR',{maximumFractionDigits:0}),money(g.venda),`<span class="${g.lucro<0?'red':''}">${money(g.lucro)}</span>`,barra(g.m),money(-g.desp),`<strong class="${g.ll<0?'red':'green'}">${money(g.ll)}</strong>`,`<span class="${g.ml<0?'red':''}">${p1(g.ml)}</span>`];
 return `${barraTopo(canais)}
 <div class="grid kpis4">${kpi('Vendido (com custo e tarifa real)',money(venda),`${l.length.toLocaleString('pt-BR')} pedidos · ${nc.length} cancelados fora`)}${kpi('Margem de contribuição',p1(venda?lucro/venda:0),`${money(lucro)} · antes de anúncios e fixas`,lucro<0?'red':'green')}${kpi('Margem líquida',p1(T.ml),`${money(T.ll)} · alvo ${String(mt.alvo).replace('.',',')}%`,T.ll<0?'red':T.ml*100<mt.alvo?'gold':'green')}${kpi('A conferir',fora.length.toLocaleString('pt-BR'),`tarifas fora do padrão · ${money(excesso)} a contestar`,fora.length?'gold':'')}</div>
 <p class="caption">Tributos ${p1(aliq)} (${esc(P?.tributos?.()?.texto||'')}), anúncios e despesas fixas ${p1(dp)} da venda: as Regras de venda de Preços e margem. ${ns.length?`${ns.length} pedido(s) ainda sem a tarifa real do marketplace ficaram fora. `:''}${semCusto?`<span class="gold">${semCusto} pedido(s) fora por falta de custo do produto.</span>`:''}</p>
 ${ui.aba==='anuncios'?(()=>{const A=anuncios(l,aliq,custoDe),pj=A.filter(a=>a.st==='prejuizo'),ab=A.filter(a=>a.st==='abaixo');const ST={prejuizo:['bad','prejuízo'],abaixo:['warn','abaixo do alvo'],ok:['ok','saudável'],poucos:['','poucas vendas']};
  return `<div class="notice ${pj.length?'warnbox':''}"><strong>${pj.length} anúncio(s) abaixo do Mínimo</strong> (margem líquida negativa) e ${ab.length} abaixo do alvo de ${String(mt.alvo).replace('.',',')}%. Passe o mouse nos valores para ver a conta; o detalhe da tarifa (comissão, taxa, frete, rebate, repasse menor) fica no balão de "Canal". Clique no título de uma coluna para ordenar.</div>`+tabela(['Anúncio','Canal','Unid.','Preço médio','Custo','Custo do canal','Tributos','Contribuição','Líquida','Mínimo · alvo','Situação'],A.slice(0,400).map(a=>{const tip=(h,v)=>`<span class="mgtip" data-tip="${esc(h)}">${v}</span>`;
   return [[`<div class="estprod"><span><button class="fplink" data-mg-abrir="${esc(a.sku||'')}"><strong>${esc(String(a.nome).slice(0,60))}</strong></button><br><span class="caption mono">${esc(a.sku||'')}</span></span></div>`,String(a.nome)],esc(a.canal),[Math.round(a.u).toLocaleString('pt-BR'),a.u],[money(a.preco),a.preco],[tip(tipCusto(a,custoInfo(a.sku)),money(a.custo)),a.custo],
    [tip(tipTarifa(a)+'<div style="height:8px"></div>'+tipOutros(a),`${money(a.canalU)}<br><span class="caption">${p1(a.preco?a.canalU/a.preco:0)}${a.menores?.length?' · <span class="gold">repasse menor</span>':''}</span>`),a.canalU],[money(a.tribU),a.tribU],
    [tip(tipConta(a),`${money(a.lucroU)}<br><span class="caption">${p1(a.margem)}</span>`),a.lucroU],[tip(tipConta(a),`<strong class="${a.llU<0?'red':''}">${money(a.llU)}</strong><br><span class="caption ${a.llU<0?'red':''}">${p1(a.liqP/100)}</span>`),a.liqP],
    [a.min?tip(tipMinimo(a),`<strong class="${a.preco<a.min?'red':''}">${money(a.min)}</strong><br><span class="caption">${a.alvo?money(a.alvo):'—'}</span>`):'—',a.min||0],[`<span class="badge ${ST[a.st][0]}">${ST[a.st][1]}</span>`,{prejuizo:0,abaixo:1,ok:2,poucos:3}[a.st]]]}))})()
 :ui.aba==='produtos'?tabela(['Produto',...cabG],[T,...prodsV.slice(0,400)].map(linG))
 :ui.aba==='canais'?tabela(['Canal',...cabG],[T,...porCanal].map(linG))
 :ui.aba==='pedidos'?`<p class="caption">Pedidos com margem de contribuição negativa: venderam abaixo do Piso (não pagaram nem o produto, o canal e os tributos).</p>`+tabela(['Pedido','Canal','Data','Venda','Tarifa','Frete','Custo','Tributos','Contribuição'],neg.sort((a,b)=>a.lucro-b.lucro).slice(0,300).map(x=>[`<span class="mono clickrow" data-order="${esc(x.o.id)}">${esc(x.o.id)}</span><br><span class="caption">${esc((x.o.items||[]).map(i=>i.title||i.sku).join(' · ').slice(0,60))}</span>`,esc(x.o.platform),new Date(x.o.date+'T12:00:00').toLocaleDateString('pt-BR'),money(x.o.gross),money(x.o.fee),money(x.frete),money(x.cmv),money(x.trib),`<strong class="red">${money(x.lucro)}</strong>`]))
 :tabela(['Pedido','Canal','Produto','Venda','Tarifa','% cobrado','Normal do canal','Excesso'],fora.sort((a,b)=>b.tarifaExcesso-a.tarifaExcesso).slice(0,300).map(x=>[`<span class="mono clickrow" data-order="${esc(x.o.id)}">${esc(x.o.id)}</span>`,esc(x.o.platform),esc((x.o.items?.[0]?.title||'').slice(0,50)),money(x.o.gross),money(x.o.fee),p1(x.feeP),p1(x.feeP-x.tarifaExcesso/x.o.gross),`<strong class="gold">${money(x.tarifaExcesso)}</strong>`]))}`}
const ABAS=[['anuncios','Por anúncio'],['produtos','Por produto'],['canais','Por canal'],['pedidos','Pedidos com prejuízo'],['tarifas','Tarifas fora do padrão'],['mudou','O que mudou (Raio-X)']];
function barraTopo(canais){const mud=ui.aba==='mudou';
 return `<div class="crmbar mgbarra">${mud?'':`<div class="segtabs">${[['mes','Mês da nota'],[30,'Últimos 30 dias'],[90,'90 dias']].map(([k,t])=>`<button class="${String(ui.periodo)===String(k)?'active':''}" data-mg-per="${k}">${t}</button>`).join('')}</div>`}
  <div class="segtabs">${ABAS.map(([k,t])=>`<button class="${ui.aba===k?'active':''}" data-mg-aba="${k}">${t}</button>`).join('')}</div>
  ${mud?'':`<div class="segtabs">${[['','Todos'],...canais.map(c=>[c,c])].map(([k,t])=>`<button class="${ui.canal===k?'active':''}" data-mg-canal="${esc(k)}">${esc(t)}</button>`).join('')}</div><div class="searchin">${icon('search')}<input type="search" data-mg-busca placeholder="Buscar produto, SKU, canal…" value="${esc(ui.busca)}"></div>`}</div>`}
const barra=m=>`<span class="mgbar"><i class="${m<0?'neg':m*100<(window.Preco?.metas?.().alvo??10)?'low':''}" style="width:${Math.min(100,Math.abs(m)*250)}%"></i></span> <span class="${m<0?'red':''}">${p1(m)}</span>`;
const cel=c=>Array.isArray(c)?c:[c,null];
const tabela=(cab,linhas)=>`<div class="tablebox"><div class="tablewrap mgrola"><table class="mgtab"><thead><tr>${cab.map((c,i)=>`<th class="${i?'num':''} mgord" data-mg-ord="${i}" title="Ordenar por esta coluna">${c}<i class="mgseta"></i></th>`).join('')}</tr></thead><tbody>${linhas.map(l=>`<tr class="${/^<strong>Total<\/strong>$/.test(cel(l[0])[0])?'mgfixo':''}">${l.map((c,i)=>{const [h,v]=cel(c);return `<td class="${i?'num':''}"${v!=null?` data-v="${esc(typeof v==='number'?String(v):String(v))}"`:''}>${h}</td>`}).join('')}</tr>`).join('')||`<tr><td colspan="${cab.length}" class="empty">Nada aqui. ✓</td></tr>`}</tbody></table></div><div class="mgrodape caption" data-mg-cont></div></div>`;
document.addEventListener('click',e=>{const b=e.target.closest('[data-mg-aba],[data-mg-canal],[data-mg-per],[data-mg-abrir]');if(!b)return;const d=b.dataset;
 if(d.mgAbrir!=null){window.Formacao?.abrir?.(d.mgAbrir);return}
 if(d.mgPer){ui.periodo=d.mgPer==='mes'?'mes':Number(d.mgPer);cache=null}if(d.mgAba)ui.aba=d.mgAba;if(d.mgCanal!==undefined)ui.canal=d.mgCanal;render()});
// Ordena e filtra as linhas já desenhadas (sem redesenhar a tela: o foco da busca não se perde).
const normal=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function valorCel(td){if(!td)return '';if(td.dataset.v!=null){const n=Number(td.dataset.v);return td.dataset.v!==''&&!isNaN(n)?n:normal(td.dataset.v)}const t=td.textContent.trim(),m=t.match(/([−-])?\s*(?:R\$\s*)?([\d.]+(?:,\d+)?)/);if(!m)return normal(t);return (m[1]?-1:1)*Number(m[2].replace(/\./g,'').replace(',','.'))}
function aplicarTabela(){const tb=$('.mgtab tbody');if(!tb)return;const o=ui.ord[ui.aba],q=normal(ui.busca).trim(),rows=[...tb.rows].filter(r=>!r.querySelector('.empty'));
 if(o){const fixos=rows.filter(r=>r.classList.contains('mgfixo')),resto=rows.filter(r=>!r.classList.contains('mgfixo'));resto.sort((a,b)=>{const x=valorCel(a.cells[o.i]),y=valorCel(b.cells[o.i]);const c=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'pt-BR',{numeric:true});return o.dir*c});for(const r of [...fixos,...resto])tb.appendChild(r)}
 let n=0;for(const r of rows){const ok=!q||r.classList.contains('mgfixo')||q.split(/\s+/).every(p=>normal(r.textContent).includes(p));r.hidden=!ok;if(ok&&!r.classList.contains('mgfixo'))n++}
 $$('.mgtab th[data-mg-ord]').forEach(th=>{th.classList.toggle('on',!!o&&Number(th.dataset.mgOrd)===o.i);th.dataset.dir=o&&Number(th.dataset.mgOrd)===o.i?(o.dir>0?'asc':'desc'):''});
 const c=$('[data-mg-cont]');if(c)c.textContent=q?`${n} linha(s) encontradas para "${ui.busca}"`:`${n} linha(s)${o?' · ordenado por '+($(`.mgtab th[data-mg-ord="${o.i}"]`)?.textContent||''):''}`}
document.addEventListener('click',e=>{const th=e.target.closest('.mgtab th[data-mg-ord]');if(!th)return;const i=Number(th.dataset.mgOrd),o=ui.ord[ui.aba];ui.ord[ui.aba]={i,dir:o&&o.i===i?-o.dir:(i===0||i===1?1:-1)};aplicarTabela()});
let tipEl=null;
document.addEventListener('mouseover',e=>{const t=e.target.closest?.('.mgtip[data-tip]');if(!t){if(tipEl&&!e.target.closest?.('.mgtip-pop'))tipEl.hidden=true;return}
 if(!tipEl){tipEl=document.createElement('div');tipEl.className='mgtip-pop';document.body.appendChild(tipEl)}tipEl.innerHTML=t.dataset.tip;tipEl.hidden=false;const r=t.getBoundingClientRect(),w=tipEl.offsetWidth,h=tipEl.offsetHeight;
 let x=Math.min(window.innerWidth-w-12,Math.max(12,r.right-w)),y=r.bottom+8;if(y+h>window.innerHeight-12)y=Math.max(12,r.top-h-8);tipEl.style.left=x+'px';tipEl.style.top=y+'px'});
document.addEventListener('scroll',()=>{if(tipEl)tipEl.hidden=true},true);
function bind(){const b=$('[data-mg-busca]');if(b)b.oninput=()=>{ui.busca=b.value;aplicarTabela()};if(tipEl)tipEl.hidden=true;aplicarTabela()}
addPage('margem','radar','Margem real',view,'O que cada venda deixou de fato: tarifa e repasse que o marketplace informou, frete, tributos e o custo do produto, até a margem líquida. Mesmas contas e metas da Formação de preço.','',bind);
// Desempenho de UM produto (para o orbe, a busca e a IA): vendas, lucro e margem por canal no período do Radar,
// comparação com o período anterior, preço mínimo por canal e estoque.
function produtoDesempenho(sku){const {peds,aliq,custoDe}=calcular(),per=Number(ui.periodo)||30,ini=menos(per),ini0=menos(per*2);sku=String(sku||'').trim();
 const canais=new Map();let u=0,venda=0,lucro=0,ped=0;
 for(const x of peds){const its=x.o.items||[],tot=its.reduce((a,i)=>a+(Number(i.qty)||0)*(Number(i.price)||0),0)||1;let tem=false;
  for(const i of its){if(String(i.sku||'').trim()!==sku)continue;const q=Number(i.qty)||0,vb=q*(Number(i.price)||0),sh=vb/tot;tem=true;u+=q;venda+=vb;lucro+=x.lucro*sh;const g=canais.get(x.o.platform)||{canal:x.o.platform,u:0,venda:0,lucro:0};g.u+=q;g.venda+=vb;g.lucro+=x.lucro*sh;canais.set(x.o.platform,g)}if(tem)ped++}
 // Comparação de volume: os dois períodos com a mesma regra (todos os pedidos não cancelados, com ou sem tarifa da API).
 let u0=0,v0=0,uT=0,vT=0;for(const o of db.orders){if(o.date<ini0||cancelado(o))continue;const atual=o.date>=ini;for(const i of o.items||[])if(String(i.sku||'').trim()===sku){const q=Number(i.qty)||0,v=q*(Number(i.price)||0);if(atual){uT+=q;vT+=v}else{u0+=q;v0+=v}}}
 const an=anuncios(peds,aliq,custoDe).filter(a=>String(a.sku||'').trim()===sku);
 return {sku,periodo:per,unidades:uT,unidades_margem:u,venda,venda_total:vT,lucro,margem:venda?lucro/venda:0,pedidos:ped,unidades_ant:u0,venda_ant:v0,custo:custoDe(sku),meta:window.Preco?.metas?.().alvo??10,
  canais:[...canais.values()].map(g=>({...g,margem:g.venda?g.lucro/g.venda:0,preco:g.u?g.venda/g.u:0,minimo:an.find(a=>a.canal===g.canal)?.min??null,equilibrio:an.find(a=>a.canal===g.canal)?.eq??null})).sort((a,b)=>b.venda-a.venda)}}
function rankingProdutos(){const {peds}=calcular(),m=new Map();for(const x of peds){const its=x.o.items||[],tot=its.reduce((a,i)=>a+(Number(i.qty)||0)*(Number(i.price)||0),0)||1;for(const i of its){const k=String(i.sku||i.title).trim(),vb=(Number(i.qty)||0)*(Number(i.price)||0),g=m.get(k)||{sku:k,nome:i.title||k,u:0,venda:0,lucro:0};g.u+=Number(i.qty)||0;g.venda+=vb;g.lucro+=x.lucro*vb/tot;m.set(k,g)}}
 return [...m.values()].map(g=>({...g,margem:g.venda?g.lucro/g.venda:0}))}
// Resumo para o Diagnóstico de repasses e margem (mesmas contas do Radar, no período do Radar).
function diagCore(){const {peds,aliq,custoDe,semCusto,cancelados}=calcular(),ini=intervalo()[0];
 const canais=new Map(),menores=[];let fora=0,excesso=0;
 for(const x of peds){const p=partes(x),c=canais.get(x.o.platform)||{canal:x.o.platform,n:0,venda:0,prod:0,tar:0,fo:0,lucro:0};
  c.n++;c.venda+=x.o.gross;c.prod+=p.tot;c.tar+=p.com+p.fixa-p.reb;c.fo+=p.frete+p.outros;c.lucro+=x.lucro;canais.set(x.o.platform,c);
  if(x.tarifaFora){fora++;excesso+=x.tarifaExcesso}if(p.menor)menores.push({id:x.o.id,valor:p.outros,data:x.o.date})}
 const venda=peds.reduce((s,x)=>s+x.o.gross,0),lucro=peds.reduce((s,x)=>s+x.lucro,0),base=db.orders.filter(o=>o.date>=ini&&!cancelado(o)).reduce((s,o)=>s+o.gross,0);
 const fixos=venda*despesasPct();
 const A=anuncios(peds,aliq,custoDe),pj=A.filter(a=>a.st==='prejuizo').map(a=>({nome:a.nome,sku:a.sku,canal:a.canal,u:a.u,preco:a.preco,min:a.min,eq:a.eq,perda:-a.lucroU*a.u,margem:a.margem})).filter(a=>a.perda>0).sort((a,b)=>b.perda-a.perda);
 const abaixo=A.filter(a=>a.st==='abaixo').length;
 return {periodo:ui.periodo,ini,pedidos:peds.length,venda,lucro,margem:venda?lucro/venda:0,liquido:lucro-fixos,aliq,semCusto,cancelados:cancelados.length,
  canais:[...canais.values()].map(c=>({...c,tarP:c.prod?c.tar/c.prod:0,foP:c.prod?c.fo/c.prod:0,m:c.venda?c.lucro/c.venda:0})).sort((a,b)=>b.venda-a.venda),
  fora:{n:fora,valor:excesso},menores:{n:menores.length,valor:menores.reduce((s,m)=>s+m.valor,0),lista:menores.sort((a,b)=>b.valor-a.valor).slice(0,5)},
  prejuizo:{n:pj.length,valor:pj.reduce((s,a)=>s+a.perda,0),top:pj.slice(0,5)},abaixo,anuncios:A.length}}
const diagnostico=per=>{const o=ui.periodo;if(per)ui.periodo=per;try{return diagCore()}finally{ui.periodo=o}};
// Margem de contribuição de um mês (AAAA-MM), por canal ('' = empresa toda): só pedidos com custo de todos os itens.
function porMes(mes){const custo=mapaCusto(),{r:aliq}=aliqTributos(),out={},S=c=>out[c]||(out[c]={venda:0,lucro:0,pedidos:0,semCusto:0});
 for(const o of db.orders||[]){if(!String(o.date||'').startsWith(mes))continue;const x=lucroPedido(o,custo,aliq);if(!x||x.semTarifa)continue;
  for(const c of ['',o.platform]){const s=S(c);if(x.falta){s.semCusto++;continue}s.venda+=Number(o.gross)||0;s.lucro+=x.lucro;s.pedidos++}}
 return out}
// ─── Raio-X: por que a margem mudou de um mês (A) para outro (B) ───
// Margem = 1 − tarifa% − frete% − custo% − tributos% (sobre as vendas dos pedidos com custo). A variação se divide
// exatamente entre esses fatores; por canal e por produto, a contribuição de cada um = lucroB/vendasB − lucroA/vendasA
// (soma = variação total), separada em efeito MIX (vender mais do que tem margem menor) e efeito MARGEM (o próprio
// item ficou pior). Itens de um pedido recebem tarifa, frete e tributos na proporção do valor.
function acumulaMes(mes,custo,aliq){const T={venda:0,fee:0,frete:0,cmv:0,trib:0,lucro:0,pedidos:0,semCusto:0},canais={},prods={};
 const S=(o,k)=>o[k]||(o[k]={venda:0,fee:0,frete:0,cmv:0,trib:0,lucro:0,u:0,nome:k});
 for(const o of db.orders||[]){if(!String(o.date||'').startsWith(mes))continue;const x=lucroPedido(o,custo,aliq);if(!x||x.semTarifa)continue;if(x.falta){T.semCusto++;continue}
  const g=nn(o.gross),its=o.items||[],tot=its.reduce((a,i)=>a+nn(i.qty)*nn(i.price),0);
  for(const [obj,dv] of [[T,1],[S(canais,o.platform),1]]){obj.venda+=g*dv;obj.fee+=nn(o.fee);obj.frete+=x.frete;obj.cmv+=x.cmv;obj.trib+=x.trib;obj.lucro+=x.lucro}T.pedidos++;
  for(const i of its){const q=nn(i.qty),sh=tot?q*nn(i.price)/tot:1/its.length,k=String(i.sku||i.title||'?').trim(),c=custo.get(k),p=S(prods,k);
   if(i.title)p.nome=i.title;p.sku=k;const cm=c?(c.c+c.e)*q:0;p.venda+=g*sh;p.fee+=nn(o.fee)*sh;p.frete+=x.frete*sh;p.trib+=x.trib*sh;p.cmv+=cm;p.u+=q;p.lucro+=g*sh-nn(o.fee)*sh-x.frete*sh-x.trib*sh-cm}}
 return {T,canais,prods}}
const pc=(o,k)=>o&&o.venda?o[k]/o.venda:0;
function efeitos(A,B,mapA,mapB){const VA=A.venda||1,VB=B.venda||1,mA=A.venda?A.lucro/A.venda:0,ks=new Set([...Object.keys(mapA),...Object.keys(mapB)]);let mix=0,marg=0;const itens=[];
 for(const k of ks){const a=mapA[k],b=mapB[k],wA=(a?.venda||0)/VA,wB=(b?.venda||0)/VB,ma=a?.venda?a.lucro/a.venda:mA,mb=b?.venda?b.lucro/b.venda:ma;
  // Mix: peso que mudou × (margem do item − margem média), para o total do mix somar zero quando só redistribui.
  const eMix=(wB-wA)*(ma-mA),eMarg=wB*(mb-ma),contrib=(b?.lucro||0)/VB-(a?.lucro||0)/VA;mix+=eMix;marg+=eMarg;itens.push({k,a,b,wA,wB,ma:a?.venda?ma:null,mb:b?.venda?mb:null,eMix,eMarg,contrib})}
 return {mix,marg,itens:itens.sort((x,y)=>x.contrib-y.contrib)}}
/** O que mudou na margem de A para B: fatores, canais e produtos (com o que piorou em cada um). */
function raiox(mA,mB){const custo=mapaCusto(),{r:aliq}=aliqTributos(),A=acumulaMes(mA,custo,aliq),B=acumulaMes(mB,custo,aliq),a=A.T,b=B.T;
 const fat=[['tarifa','Tarifa dos marketplaces','fee'],['frete','Frete pago pela loja','frete'],['custo','Custo dos produtos','cmv'],['tributos','Tributos sobre a venda','trib']].map(([id,t,k])=>({id,t,a:pc(a,k),b:pc(b,k),efeito:-(pc(b,k)-pc(a,k))}));
 const mA_=a.venda?a.lucro/a.venda:null,mB_=b.venda?b.lucro/b.venda:null,canais=efeitos(a,b,A.canais,B.canais),prods=efeitos(a,b,A.prods,B.prods);
 // O que mudou em cada produto que puxou a margem para baixo (por unidade).
 const diag=x=>{const a=x.a,b=x.b;if(!a?.u||!b?.u)return b?.u?'Produto novo no mês':'Deixou de vender';const pa=a.venda/a.u,pb=b.venda/b.u,ca=a.cmv/a.u,cb=b.cmv/b.u,ta=pc(a,'fee'),tb=pc(b,'fee'),fa=a.frete/a.u,fb=b.frete/b.u;
  const l=[];if(pb<pa*0.97)l.push(['preco',(pb/pa-1),`Preço médio caiu ${((1-pb/pa)*100).toFixed(1).replace('.',',')}% (${money(pa)} → ${money(pb)}): campanha, cupom ou preço baixado`]);
  if(cb>ca*1.03)l.push(['custo',(cb/ca-1),`Custo subiu ${((cb/ca-1)*100).toFixed(1).replace('.',',')}% (${money(ca)} → ${money(cb)}): renegociar ou repassar no preço`]);
  if(tb>ta+0.01)l.push(['tarifa',tb-ta,`Tarifa subiu de ${p1(ta)} para ${p1(tb)}: conferir tipo de anúncio, faixa de comissão e campanhas`]);
  if(fb>fa*1.1&&fb-fa>0.5)l.push(['frete',(fb/(fa||1)-1),`Frete por unidade subiu de ${money(fa)} para ${money(fb)}`]);
  return l.length?l.sort((x,y)=>Math.abs(y[1])-Math.abs(x[1])).map(x=>x[2]).join(' · '):'Mudança pequena em vários fatores'};
 for(const x of prods.itens)x.diag=diag(x);
 return {mA,mB,a,b,margemA:mA_,margemB:mB_,variacao:mA_!=null&&mB_!=null?mB_-mA_:null,fatores:fat,aliq,canais,produtos:prods,semCusto:{a:a.semCusto,b:b.semCusto}}}
/** Margem e fatores mês a mês (tendência). */
function tendencia(meses){const custo=mapaCusto(),{r:aliq}=aliqTributos();return meses.map(m=>{const t=acumulaMes(m,custo,aliq).T;return {mes:m,venda:t.venda,tarifa:pc(t,'fee'),frete:pc(t,'frete'),custo:pc(t,'cmv'),tributos:pc(t,'trib'),margem:t.venda?t.lucro/t.venda:null}})}
// Margem se o anúncio fosse vendido a outro preço: a conta das Regras de venda (window.Preco), a mesma da Formação de
// preço. margem = margem líquida; min = Mínimo (líquida zero); eq = Piso; atual = no preço médio vendido em 30 dias.
function simular(sku,preco,canal='Mercado Livre'){try{const P=window.Preco;sku=String(sku||'').trim();if(!P||!preco)return null;const k=P.canalDe(canal)||canal,L=P.conta(sku,k,preco);if(!L)return null;
 const pr=P.precos(sku,k),g=P.real(sku,k),A=g?P.conta(sku,k,g.preco):null;
 return {preco,lucroU:L.liq,margem:L.liqP/100,contribuicao:L.mc,margemContribuicao:L.mcP/100,atual:A?{preco:g.preco,lucroU:A.liq,margem:A.liqP/100}:null,eq:pr?.piso??null,min:pr?.minimo??null,alvo:pr?.alvo??null,vendas:g?.u||0}}catch{return null}}
// Tarifa, frete e tributos médios do período (sobre a venda), para quem ainda quer a média geral.
function parametros(){try{const {peds,aliq}=calcular(),v=peds.reduce((x,p)=>x+p.o.gross,0);return v?{aliq,tarifa:peds.reduce((x,p)=>x+p.o.fee,0)/v,frete:peds.reduce((x,p)=>x+p.frete,0)/v}:null}catch{return null}}
// Lucro de contribuição por canal e SKU num mês (chave "canal|sku"): base da tela Anúncios pagos.
function lucroSkuCanal(mes){const custo=mapaCusto(),{r:aliq}=aliqTributos(),m=new Map();
 for(const o of db.orders||[]){if(!String(o.date||'').startsWith(mes))continue;const x=lucroPedido(o,custo,aliq);if(!x)continue;const its=o.items||[],tot=its.reduce((a,i)=>a+nn(i.qty)*nn(i.price),0);
  for(const i of its){const k=o.platform+'|'+String(i.sku||'').trim(),sh=tot?nn(i.qty)*nn(i.price)/tot:1/its.length,g=m.get(k)||{venda:0,lucro:0,u:0,semCusto:0,semTarifa:0,vendaMargem:0,nome:i.title||''};
   g.venda+=nn(o.gross)*sh;g.u+=nn(i.qty);if(x.semTarifa)g.semTarifa++;else if(x.falta)g.semCusto++;else{g.lucro+=x.lucro*sh;g.vendaMargem+=nn(o.gross)*sh}m.set(k,g)}}
 return m}
window.Margem={realAnuncios,aba:k=>{if(ABAS.some(([x])=>x===k))ui.aba=k},periodo:()=>ui.periodo,anunciosDoPeriodo:()=>{const {peds,aliq,custoDe}=calcular();return anuncios(peds,aliq,custoDe)},/** Lucro de contribuição de cada pedido desde `ini` (só os que entram na margem: tarifa da API e custo de todos os itens). */pedidos:ini=>{const custo=mapaCusto(),{r:aliq}=aliqTributos(),out=[];for(const o of db.orders){if(o.date<ini)continue;const x=lucroPedido(o,custo,aliq);if(x&&!x.semTarifa&&!x.falta)out.push({o,...x})}return out},lucroSkuCanal,parametros,partes,diagnostico,mes:porMes,simular,raiox,tendencia,produto:produtoDesempenho,ranking:rankingProdutos,avisos:()=>{try{const {peds,aliq,custoDe}=calcular();const n=anuncios(peds,aliq,custoDe).filter(a=>a.st==='prejuizo'&&a.u>=3).length;return n?[['bad','radar',n+' anúncio(s) vendendo com prejuízo','Veja o Mínimo por canal em Preços e margem › Margem real','margem']]:[]}catch{return []}},resumo:()=>{const {peds}=calcular();const neg=peds.filter(x=>x.lucro<0);return {pedidos:peds.length,prejuizo:neg.length,perda:neg.reduce((s,x)=>s+x.lucro,0),venda:peds.reduce((s,x)=>s+x.o.gross,0),lucro:peds.reduce((s,x)=>s+x.lucro,0)}}};
})();
