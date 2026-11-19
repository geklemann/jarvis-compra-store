// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Preços e margem: o motor PURO (sem DOM, sem db, sem data de hoje) da conta única de preço e margem do E-Commerce.
// Todas as telas (Custo do produto, Regras de venda, Formação de preço, Margem real, Promoções, Vigia de preços,
// Anúncios pagos, Estoque parado, Rentabilidade por item, Produtos e anúncios) chegam aqui pela camada
// web/precificacao.js (window.Preco), que monta os parâmetros a partir dos dados da empresa.
//
// A conta (tudo em R$ por unidade, P = preço de venda):
//   custo do produto       = (compra + frete da compra + IPI + ICMS-ST − créditos) × (1 + perdas%) + embalagem
//   custo do canal(P)      = P × comissão%(faixa de P) + taxa fixa(faixa de P) + frete pago pela loja(P)
//   tributos(P)            = P × tributos%          (Simples: DAS efetivo + DIFAL, quando a regra da empresa manda)
//   margem de contribuição = P − custo do canal − tributos − custo do produto
//   margem líquida         = contribuição − P × anúncios% − P × despesas fixas%
//   Piso   : contribuição = 0      Mínimo : líquida = meta mínima (0)      Alvo : líquida = meta alvo (10%)
//   Dentro de cada faixa a conta é linear, então o preço sai do markup divisor:
//     preço = (custo do produto + taxa fixa + frete) ÷ (1 − comissão − tributos − anúncios − fixas − meta)
//   e o motor escolhe a faixa certa (a taxa fixa da Shopee e o frete do Mercado Livre mudam com o preço).
//   markup = preço ÷ custo do produto (só informativo; a conta é sempre pelo divisor).
//
// Exemplo conferido à mão (o caso da auditoria: Relógio inteligente Pro, SMW-PRO, ML Premium a R$ 329,90):
//   custo 118,09 + embalagem 3,50 = 121,59; comissão 16,5% = 54,43; frete pago pela loja 16,98; tributos 18% = 59,38
//   contribuição = 329,90 − 54,43 − 16,98 − 59,38 − 121,59 = 77,52 (23,5%)
//   anúncios 3% = 9,90; fixas 18,6% = 61,36 → líquida = 6,26 (1,9%)
//   Mínimo = (121,59 + 16,98) ÷ (1 − 0,165 − 0,18 − 0,03 − 0,186) = 138,57 ÷ 0,439 = 315,65
//   Alvo 10% = 138,57 ÷ 0,339 = 408,77 · Piso = 138,57 ÷ 0,655 = 211,56   (testes/preco_motor.test.mjs)
(()=>{
const n=v=>{if(typeof v==='string')v=v.replace(/\s/g,'').replace(/^R\$/,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.');const x=Number(v);return Number.isFinite(x)?x:0};
const r2=v=>Math.round((Number(v)||0)*100)/100;
const ceil2=v=>Math.ceil(Math.round(v*1e6)/1e4)/100;
const INF=1e12;

// ─── Regras dos canais (padrão de quem começa; a empresa ajusta em Regras de venda) ───
// faixas: [{ate, comissao?, fixa}] por faixa de preço (P ≤ ate; ate null = sem limite). comissão da faixa substitui a
// do canal; fixa da faixa soma à taxa fixa do canal. freteAcima: a loja só paga o frete a partir desse preço.
// Mercado Livre: custo fixo de R$ 6,75 por unidade abaixo de R$ 79 e, de R$ 79 para cima, o frete grátis obrigatório
// pago pela loja (o valor vem da média real de cada produto). Clássico 11,5% e Premium 16,5% (variam por categoria).
// Shopee (vendedor CNPJ, tabela da Central de Educação do Vendedor vigente desde 01/03/2026, com o reajuste de
// 01/10/2026 na primeira faixa): até R$ 79,99 → 20% + R$ 4,50; de R$ 80 a R$ 99,99 → 14% + R$ 16; de R$ 100 a
// R$ 199,99 → 14% + R$ 20; a partir de R$ 200 → 14% + R$ 26 por item. É a única regra da Shopee do Jarvis.
// Magalu: 16% + R$ 5 por item (padrão; confira o contrato da conta).
const CANAIS_PADRAO=Object.freeze({
 'Mercado Livre':{rotulo:'ML Premium',comissao:16.5,fixa:0,faixas:[{ate:78.99,fixa:6.75}],freteAcima:79,freteFixo:0,ativo:true},
 'Mercado Livre Clássico':{rotulo:'ML Clássico',comissao:11.5,fixa:0,faixas:[{ate:78.99,fixa:6.75}],freteAcima:79,freteFixo:0,ativo:true},
 'Magalu':{rotulo:'Magalu',comissao:16,fixa:5,faixas:[],freteAcima:0,freteFixo:0,ativo:true},
 'Shopee':{rotulo:'Shopee',comissao:14,fixa:0,faixas:[{ate:79.99,comissao:20,fixa:4.5},{ate:99.99,fixa:16},{ate:199.99,fixa:20},{ate:null,fixa:26}],freteAcima:0,freteFixo:0,ativo:true},
 'Site próprio':{rotulo:'Site próprio',comissao:4,fixa:0,faixas:[],freteAcima:0,freteFixo:0,ativo:false}});
const copia=o=>JSON.parse(JSON.stringify(o));
const canaisPadrao=()=>copia(CANAIS_PADRAO);
const METAS_PADRAO=Object.freeze({minimo:0,alvo:10});

/** Comissão (%) e taxa fixa (R$) que valem no preço P. */
function faixaDe(P,c){const fx=[...(c.faixas||[])].sort((a,b)=>(a.ate??INF)-(b.ate??INF)),f=fx.find(x=>P<=(x.ate??INF)+1e-9);
 return {comissao:f&&f.comissao!=null&&f.comissao!==''?n(f.comissao):n(c.comissao),fixa:n(c.fixa)+(f?n(f.fixa):0),faixa:f||null}}
const fretePara=(P,c)=>(!n(c.freteAcima)||P>=n(c.freteAcima)-1e-9)?n(c.frete):0;

/** A conta de um preço P. c: {custo, comissao, fixa, faixas, frete, freteAcima, tributos, ads, fixas} (% em pontos). */
function conta(P,c){P=n(P);const f=faixaDe(P,c),L={preco:P,comissaoPct:f.comissao,comissao:P*f.comissao/100,fixa:f.fixa,frete:fretePara(P,c),tributosPct:n(c.tributos),custo:n(c.custo),adsPct:n(c.ads),fixasPct:n(c.fixas)};
 L.tributos=P*L.tributosPct/100;L.canal=L.comissao+L.fixa+L.frete;L.mc=P-L.canal-L.tributos-L.custo;L.ads=P*L.adsPct/100;L.fixas=P*L.fixasPct/100;L.liq=L.mc-L.ads-L.fixas;
 L.mcP=P?L.mc/P*100:0;L.liqP=P?L.liq/P*100:0;L.canalP=P?L.canal/P*100:0;L.markup=L.custo?P/L.custo:null;return L}

// Trechos de preço em que a conta é linear (entre as faixas e o início do frete pago pela loja).
function trechos(c){const cortes=new Set();for(const f of c.faixas||[])if(f.ate!=null&&n(f.ate)>0)cortes.add(r2(n(f.ate)));if(n(c.freteAcima)>0)cortes.add(r2(n(c.freteAcima)-0.01));
 const cs=[...cortes].filter(x=>x>0).sort((a,b)=>a-b),out=[];let lo=0.01;for(const hi of cs){if(hi>=lo)out.push([lo,hi]);lo=r2(hi+0.01)}out.push([lo,INF]);return out}
/** Menor preço a partir do qual a margem (campo 'mc' ou 'liq') fica sempre ≥ meta%. null = não chega lá (custos variáveis + meta ≥ 100%). */
function precoPara(meta,campo,c){const T=trechos(c);let resp=null;
 for(let i=T.length-1;i>=0;i--){const [lo,hi]=T[i],ref=conta(hi>=INF?lo:hi,c),v=ref.comissaoPct+ref.tributosPct+(campo==='liq'?ref.adsPct+ref.fixasPct:0),K=ref.custo+ref.fixa+ref.frete,den=1-(v+n(meta))/100;
  if(den<=0)return resp; // neste trecho a margem nunca chega na meta
  const x=Math.max(lo,ceil2(K/den));if(x>hi+1e-9)return resp; // o trecho inteiro fica abaixo da meta
  resp=x;if(x>lo+1e-9)return resp} // a meta começa no meio do trecho; senão o trecho todo serve e o anterior pode servir também
 return resp}
/** Os três preços de referência. metas: {minimo, alvo}. */
function precos(c,metas=METAS_PADRAO){const alvo=n(metas.alvo??METAS_PADRAO.alvo),minimo=n(metas.minimo??0),p={piso:precoPara(0,'mc',c),minimo:precoPara(minimo,'liq',c),alvo:precoPara(alvo,'liq',c),metaAlvo:alvo,metaMinimo:minimo};
 p.markupAlvo=p.alvo&&n(c.custo)?p.alvo/n(c.custo):null;return p}
/** Situação de uma margem líquida frente às metas: 'prejuizo' | 'abaixo' | 'alvo'. metas.tol: quanto abaixo do Alvo ainda
 * conta como "no alvo" (0,05 p.p. no padrão: o arredondamento; Configurações › Parâmetros). */
const situacao=(liqP,metas=METAS_PADRAO)=>liqP<n(metas.minimo??0)-1e-9?'prejuizo':liqP<n(metas.alvo??10)-(metas.tol!=null?n(metas.tol):0.05)?'abaixo':'alvo';

/** Passo a passo da conta (para o painel "A conta" e os balões). */
function passos(P,c){const L=conta(P,c),pc=v=>(Math.round(v*10)/10).toLocaleString('pt-BR')+'%';
 return [['preco','Preço de venda',L.preco,'t'],['comissao',`− Comissão do canal (${pc(L.comissaoPct)})`,-L.comissao],['fixa','− Taxa fixa por item',-L.fixa],['frete','− Frete pago pela loja',-L.frete],
  ['tributos',`− Tributos sobre a venda (${pc(L.tributosPct)})`,-L.tributos],['custo','− Custo do produto',-L.custo],['mc','= Margem de contribuição',L.mc,'t'],
  ['ads',`− Anúncios pagos (${pc(L.adsPct)})`,-L.ads],['fixas',`− Despesas fixas (${pc(L.fixasPct)})`,-L.fixas],['liq','= Margem líquida',L.liq,'t']].map(([k,rot,v,t])=>({k,rotulo:rot,valor:v,pct:P?v/P*100:0,total:!!t}))}

// ─── Custo do produto ───
/** Composição do custo. Valores por unidade; perdas em %. */
function custoProduto(x={}){const compra=n(x.compra),acr=n(x.acrescimos),frete=n(x.frete),ipi=n(x.ipi),st=n(x.st),cred=n(x.creditos),perdasPct=n(x.perdas),emb=n(x.embalagem);
 const base=compra+acr+frete+ipi+st-cred,perdas=base*perdasPct/100;return {compra,acrescimos:acr,frete,ipi,st,creditos:cred,perdasPct,perdas,embalagem:emb,base,total:r2(base+perdas+emb)}}
const ativa=nf=>nf&&nf.tipo==='compra'&&!/cancel|denega/i.test(String(nf.situacao||''));
/** Valor por unidade de um item na nota, com os acréscimos da nota (frete, IPI e ST: total da nota − soma dos itens) rateados pelo valor. */
function unitarioNaNota(nf,it){const its=nf.itens||[],soma=its.reduce((s,i)=>s+n(i.total||n(i.qtd)*n(i.valor)),0),tot=n(it.total)||n(it.qtd)*n(it.valor),q=n(it.qtd);if(!q)return null;
 const acr=soma>0&&n(nf.valor)>soma+0.01?(n(nf.valor)-soma)*tot/soma:0;return {valor:tot/q,acrescimos:acr/q,qtd:q}}
const mesmoSku=(a,b)=>String(a||'').trim().toUpperCase()===String(b||'').trim().toUpperCase();
/** Última nota de entrada (compra) do SKU: {valor, acrescimos, qtd, nota, serie, data, fornecedor} ou null. */
function ultimaNota(notas,sku){let r=null;for(const nf of notas||[]){if(!ativa(nf))continue;for(const it of nf.itens||[]){if(!mesmoSku(it.sku,sku))continue;const u=unitarioNaNota(nf,it);if(!u)continue;
 if(!r||String(nf.emissao||'')>String(r.data||''))r={...u,nota:nf.numero||'',data:nf.emissao||'',fornecedor:nf.fornecedor||'',id:nf.id}}}return r}
/** Notas de entrada do SKU, da mais nova para a mais velha. */
function notasDoSku(notas,sku){const l=[];for(const nf of notas||[]){if(!ativa(nf))continue;for(const it of nf.itens||[])if(mesmoSku(it.sku,sku)){const u=unitarioNaNota(nf,it);if(u)l.push({...u,nota:nf.numero||'',data:nf.emissao||''})}}return l.sort((a,b)=>String(b.data).localeCompare(String(a.data)))}
/** Média ponderada das notas de entrada (a que a Contabilidade usa no CMV), com os acréscimos. */
function mediaNotas(notas,sku){let q=0,v=0;for(const x of notasDoSku(notas,sku)){q+=x.qtd;v+=(x.valor+x.acrescimos)*x.qtd}return q?v/q:null}

// ─── Das regras antigas (até 18/11/2026) para as de agora ───
// Antes: impostos 8%, ads 3%, fixos 5%, juros, margem alvo 15% e, por canal, comissão, taxa fixa, taxa de serviço,
// frete, cupom e "tarifa extra abaixo de"; e o DVV por grupo (impostos, comissão, Vendas/Adm e margem de lucro).
// Agora: tributos pelo regime, anúncios, despesas fixas pela DRE, duas metas (Mínimo = líquida 0, Alvo) e exceções por
// grupo. O que não tem equivalente fica guardado em `legado` (nada se perde) e a tela avisa.
const ROT_LEGADO={cupom:'cupom médio',juros:'juros de parcelamento'};
function converter(p0){const p=p0&&typeof p0==='object'?p0:{};if(p.versao>=2)return {pricing:p,mudou:false,notas:[]};
 const notas=[],velhos=p.canais&&typeof p.canais==='object'?copia(p.canais):{},canais=canaisPadrao();
 for(const [k,v] of Object.entries(velhos)){if(!v||typeof v!=='object')continue;const c=canais[k]||(canais[k]={rotulo:k,comissao:0,fixa:0,faixas:[],freteAcima:0,freteFixo:0,ativo:true});
  if(k==='Shopee'){if(n(v.comissao)!==14||n(v.servico)!==6||n(v.fixa)!==4)notas.push('Shopee: a regra antiga da conta (comissão, taxa de serviço e taxa fixa) foi trocada pela tabela oficial por faixa de preço.');}
  else{if(v.comissao!=null)c.comissao=r2(n(v.comissao)+n(v.servico));if(n(v.servico)&&!(k==='Site próprio'&&n(v.servico)===4&&!n(v.comissao)))notas.push(`${k}: a taxa de serviço de ${n(v.servico)}% foi somada à comissão (${c.comissao}%).`);
   if(v.fixa!=null)c.fixa=n(v.fixa);if(n(v.faixaAte)>0)c.faixas=[{ate:r2(n(v.faixaAte)-0.01),fixa:n(v.faixaValor)}];else if(v.faixaAte!=null&&!n(v.faixaAte))c.faixas=[];}
  if(n(v.frete))c.freteFixo=n(v.frete);if(v.ativo!=null)c.ativo=!!v.ativo;
  for(const x of ['cupom'])if(n(v[x]))notas.push(`${k}: ${ROT_LEGADO[x]} de ${n(v[x])}% não entra mais na conta (guardado).`)}
 const alvoVelho=p.margemAlvo,alvo=alvoVelho!=null&&n(alvoVelho)!==15?n(alvoVelho):10;
 if(alvoVelho!=null&&n(alvoVelho)!==15)notas.push(`Margem alvo de ${n(alvoVelho)}% mantida como o Alvo (margem líquida).`);
 if(n(p.juros))notas.push(`Juros de parcelamento de ${n(p.juros)}% não entram mais na conta: se a loja paga o parcelamento, some à comissão do canal.`);
 const excecoes=[],grupos=p.grupos&&typeof p.grupos==='object'&&!Array.isArray(p.grupos)?p.grupos:{};
 for(const [g,x] of Object.entries(grupos))for(const [k,d] of Object.entries(x?.canais||{})){if(!d)continue;const e={grupo:g,canal:k};
  if(d.comissao!=null&&canais[k]&&k!=='Shopee'&&Math.abs(n(d.comissao)-n(canais[k].comissao))>0.001)e.comissao=n(d.comissao);
  if(d.margem!=null&&Math.abs(n(d.margem)-alvo)>0.001)e.alvo=n(d.margem);if(e.comissao!=null||e.alvo!=null)excecoes.push(e)}
 if(Object.keys(grupos).length)notas.push('Percentuais por grupo da planilha: comissão e margem de lucro diferentes viraram exceções por grupo; PIS/COFINS, ICMS, DIFAL, IRPJ/CSLL e Vendas/Adm dos grupos saem (tributos pelo regime e despesas fixas pela DRE).');
 const legado={};for(const k of ['impostos','ads','fixos','juros','margemAlvo','faixasShopee'])if(p[k]!=null)legado[k]=copia(p[k]);legado.canais=velhos;if(Object.keys(grupos).length)legado.grupos=copia(grupos);
 const novo={...p,versao:2,canais,metas:{minimo:0,alvo},tributos:{fonte:'auto',difal:'auto',manual:p.impostos!=null?n(p.impostos):8},
  despesas:{ads:p.ads!=null?n(p.ads):3,fixas:{fonte:'dre',manual:p.fixos!=null?n(p.fixos):5}},custo:{regra:'nota'},excecoes,legado,notasConversao:notas};
 for(const k of ['impostos','ads','fixos','juros','margemAlvo','faixasShopee'])delete novo[k];
 return {pricing:novo,mudou:true,notas}}
/** Produtos da planilha com o custo da cadeia do DVV de compra: o custo já calculado vira o custo à mão. */
function converterProdutos(produtos){let k=0;for(const p of produtos||[]){const e=p.extra||(p.extra={});if(e.custoOrigem&&e.grupo&&e.custoManual==null){e.custoManual=true;k++}}return k}

const M={n,r2,CANAIS_PADRAO,canaisPadrao,METAS_PADRAO,faixaDe,conta,trechos,precoPara,precos,situacao,passos,custoProduto,unitarioNaNota,ultimaNota,notasDoSku,mediaNotas,converter,converterProdutos};
if(typeof window!=='undefined')window.PrecoMotor=M;
if(typeof module!=='undefined'&&module.exports)module.exports=M;
})();
