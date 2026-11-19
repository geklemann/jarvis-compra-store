// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Preços e margem: a camada que monta, com os dados da empresa, os parâmetros da conta única (web/preco-motor.js) —
// window.Preco — e as telas "Custo do produto" e "Regras de venda". Todas as telas de preço e margem leem daqui:
//   custo do produto  = a última nota de entrada (com frete, IPI e ST: o total da nota − a soma dos itens, rateado
//                       pelo valor) + a composição digitada (frete, IPI, ST, créditos, perdas) + embalagem; o custo à
//                       mão vale quando a empresa ou o produto escolhem; o do Bling fica só para conferir;
//   custo do canal    = a regra do canal (comissão e taxa fixa por faixa de preço); no Mercado Livre, de R$ 79 para
//                       cima, o frete pago pela loja é a média real de cada produto nos últimos 30 dias (sem venda: a
//                       tabela de faixas de peso do canal, depois a média do canal);
//   tributos          = Simples: alíquota efetiva do DAS (receita de 12 meses) + DIFAL real das notas, só se as regras
//                       fiscais da empresa geram DIFAL; Presumido/Real: ICMS, DIFAL, PIS/COFINS e IRPJ/CSLL;
//   despesas          = anúncios pagos (% digitado, com o real ao lado) e despesas fixas pela média da DRE dos últimos
//                       3 meses (ou digitadas);
//   metas             = Mínimo (lucro líquido zero) e Alvo (10% líquido, editável), as mesmas em todas as telas.
// Rotas antigas: #precos (Regras e simulador) → Regras de venda; #raiox → Margem real › O que mudou.
(()=>{
const M=window.PrecoMotor,n=M.n,r2=M.r2;
Object.assign(paths,{custo:'M3 7h18v13H3z M3 7l3-4h12l3 4 M12 11v5 M9.5 13.5h5',regras:'M4 6h10 M18 6h2 M4 12h4 M12 12h8 M4 18h12 M20 18h0 M14 4v4 M8 10v4 M16 16v4'});
const PLAT={'Mercado Livre':'Mercado Livre','Mercado Livre Clássico':'Mercado Livre','Magalu':'Magalu','Shopee':'Shopee','Site próprio':'Site próprio'};
const pc=v=>v==null||!isFinite(v)?'—':(Math.round(v*10)/10).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
const vv=v=>String(Math.round(n(v)*100)/100).replace('.',',');
const hojeISO=()=>new Date().toLocaleDateString('sv-SE');
const menos=d=>{const x=new Date();x.setDate(x.getDate()-d);return x.toLocaleDateString('sv-SE')};
const mesesAntes=(m,k)=>{const [a,b]=m.split('-').map(Number),out=[];for(let i=0;i<k;i++)out.push(new Date(a,b-1-i,15).toLocaleDateString('sv-SE').slice(0,7));return out};
const mesAtual=()=>typeof month==='string'&&/^\d{4}-\d{2}$/.test(month)?month:hojeISO().slice(0,7);
const memo=new Map();function lembrar(nome,chave,fn){const x=memo.get(nome);if(x&&x.k===chave)return x.v;const v=fn();memo.set(nome,{k:chave,v});return v}

// ─── Regras (db.pricing), convertidas das antigas na primeira leitura ───
function regras(){const r=M.converter(db.pricing);if(r.mudou){db.pricing=r.pricing;M.converterProdutos(db.products)}const p=db.pricing;
 p.canais=p.canais||{};for(const [k,v] of Object.entries(M.CANAIS_PADRAO))if(!p.canais[k])p.canais[k]=JSON.parse(JSON.stringify(v));
 for(const c of Object.values(p.canais)){if(!Array.isArray(c.faixas))c.faixas=[];if(c.freteAcima==null)c.freteAcima=0;if(c.freteFixo==null)c.freteFixo=0}
 p.metas={minimo:0,alvo:p.metas?.alvo??10};p.tributos=p.tributos||{fonte:'auto',difal:'auto',manual:8};p.despesas=p.despesas||{ads:3,fixas:{fonte:'dre',manual:5}};
 if(!p.despesas.fixas)p.despesas.fixas={fonte:'dre',manual:5};p.custo=p.custo||{regra:'nota'};p.excecoes=Array.isArray(p.excecoes)?p.excecoes:[];return p}
const canalRegra=k=>regras().canais[k]||null;
const canaisAtivos=()=>Object.entries(regras().canais).filter(([,c])=>c.ativo).map(([k])=>k);
/** Mercado Livre Clássico só aparece se a empresa tem preço dele em algum produto. */
const canaisDaTabela=()=>canaisAtivos().filter(k=>k!=='Site próprio'||(db.products||[]).some(p=>n(p.precos?.[k])>0)).filter(k=>k!=='Mercado Livre Clássico'||(db.products||[]).some(p=>n(p.precos?.[k])>0));
const rotulo=k=>canalRegra(k)?.rotulo||M.CANAIS_PADRAO[k]?.rotulo||k;
function canalDe(t){const s=normalized(String(t||''));if(/shopee/.test(s))return 'Shopee';if(/magalu|magazine/.test(s))return 'Magalu';if(/classic/.test(s))return 'Mercado Livre Clássico';if(/mercado|\bml\b|meli/.test(s))return 'Mercado Livre';if(/site|loja propria|nuvem|tray|shopify/.test(s))return 'Site próprio';return null}

// ─── Produtos (tabela do Jarvis + cadastro do Bling) ───
const produto=sku=>(db.products||[]).find(p=>String(p.id)===String(sku))||null;
const bling=sku=>(window.Estoque?.lista?.()||[]).find(p=>String(p.id)===String(sku))||null;
function produtos(){const bl=new Map((window.Estoque?.lista?.()||[]).filter(p=>!p.ignorar).map(p=>[String(p.id),p])),tab=new Map((db.products||[]).map(p=>[String(p.id),p]));
 const ids=new Set([...tab.keys(),...[...bl.keys()].filter(k=>n(bl.get(k).custo)>0||(db.purchases||[]).length)]);
 return [...ids].map(id=>{const t=tab.get(id),b=bl.get(id);return {id,nome:t?.nome||b?.nome||id,imagem:b?.imagem||null,saldo:b?.saldo!=null?n(b.saldo):null,precoBling:n(b?.preco)||null,custoBling:n(b?.custo)||null,peso:t?.peso??b?.peso??null,
  grupo:t?.extra?.grupo||'',marca:t?.extra?.grupo||t?.extra?.marca||'',precos:t?.precos||{},extra:t?.extra||{},emTabela:!!t}})}

// ─── Custo do produto ───
function notas(){const P=db.purchases||[];return lembrar('notas',P.length+'|'+(P[0]?.id||'')+'|'+(P.at?.(-1)?.id||''),()=>{const m=new Map();
 for(const nf of P){if(nf.tipo!=='compra'||/cancel|denega/i.test(String(nf.situacao||'')))continue;for(const it of nf.itens||[]){const k=String(it.sku||'').trim().toUpperCase();if(!k)continue;const u=M.unitarioNaNota(nf,it);if(!u)continue;(m.get(k)||m.set(k,[]).get(k)).push({...u,nota:nf.numero||'',data:nf.emissao||'',fornecedor:nf.fornecedor||''})}}
 for(const l of m.values())l.sort((a,b)=>String(b.data).localeCompare(String(a.data)));return m})}
const notasDe=sku=>notas().get(String(sku||'').trim().toUpperCase())||[];
function custo(sku){const R=regras(),p=produto(sku),b=bling(sku),e=p?.extra||{},cp=e.comp||{},ns=notasDe(sku),nota=ns[0]||null;
 const q=ns.reduce((s,x)=>s+x.qtd,0),media=q?ns.reduce((s,x)=>s+(x.valor+x.acrescimos)*x.qtd,0)/q:null,regra=R.custo.regra||'nota';
 let compra=0,acr=0,origem={tipo:'sem'};
 if((e.custoManual||regra==='manual')&&n(p?.custo)>0){compra=n(p.custo);origem={tipo:'manual',texto:e.custoManual?'à mão (este produto)':'à mão (regra da empresa)'}}
 else if(regra==='media'&&media){compra=media;origem={tipo:'media',texto:`média de ${ns.length} nota(s) de entrada`}}
 else if(nota){compra=nota.valor;acr=nota.acrescimos;origem={tipo:'nota',texto:`NF ${nota.nota} · ${nota.data?new Date(nota.data+'T12:00').toLocaleDateString('pt-BR'):''}`,nota}}
 else if(n(p?.custo)>0){compra=n(p.custo);origem={tipo:'manual',texto:'à mão · sem nota de entrada'}}
 else if(n(b?.custo)>0){compra=n(b.custo);origem={tipo:'bling',texto:'Bling · sem nota nem custo à mão'}}
 const c=M.custoProduto({compra,acrescimos:acr,frete:cp.frete,ipi:cp.ipi,st:cp.st,creditos:cp.creditos,perdas:cp.perdas,embalagem:p?.embalagem});
 const ant=ns[1]||null,mudou=nota&&ant&&ant.valor>0&&Math.abs(nota.valor/ant.valor-1)>0.02&&nota.data>=menos(30);
 return {...c,sku,origem,tem:compra>0,bling:n(b?.custo)||null,media,nota,notas:ns.length,mudou,velho:origem.tipo==='nota'&&nota.data<menos(180),difBling:compra>0&&n(b?.custo)>0?(n(b.custo)-(compra+acr))/(compra+acr):null}}
const custoDe=sku=>{const c=custo(sku);return c.tem?c.total:0};

// ─── Tributos, despesas e metas ───
const simples=()=>{try{const s=window.Contab?.simples?.();if(s!=null)return !!s}catch{}return /simples|mei/i.test(String(db.gerencial?.fiscal?.regime||''))};
const regimeNome=()=>String(window.Marca?.regime?.()||db.gerencial?.fiscal?.regime||(simples()?'Simples Nacional':'não informado'));
function tributosAuto(){return lembrar('trib',[(db.orders||[]).length,(db.accLines||[]).length,mesAtual(),JSON.stringify(db.gerencial?.fiscal?.por_uf||'').length,db.gerencial?.contabil?.aliq_simples||''].join('|'),()=>{
 const C=window.Contab,meses=mesesAntes(mesAtual(),7).slice(1),ts=[]; /* meses fechados: o mês corrente ainda está pela metade */try{if(C?.tributos)for(const m of meses){const t=C.tributos(m);if(t&&n(t.receita)>0)ts.push([m,t]);if(ts.length>=3)break}}catch{}
 if(ts.length){const rec=ts.reduce((s,[,t])=>s+n(t.receita),0),dif=ts.reduce((s,[,t])=>s+n(t.difal),0),sn=!!ts[0][1].simples;
  if(sn)return {simples:true,das:n(ts[0][1].aliqDas)*100,rbt12:n(ts[0][1].rbt12),difalReal:rec?dif/rec*100:0,meses:ts.map(x=>x[0]),notas:null};
  const icms=ts.reduce((s,[,t])=>s+n(t.icms),0),pis=ts.reduce((s,[,t])=>s+n(t.pis)+n(t.cofins),0),c=db.gerencial?.contabil||{},real=/real/i.test(regimeNome());
  const ir=real?0:(n(c.presuncao_irpj)||8)*0.15+(n(c.presuncao_csll)||12)*0.09;
  return {simples:false,icms:rec?icms/rec*100:0,pis:rec?pis/rec*100:0,difalReal:rec?dif/rec*100:0,irpj:ir,real,meses:ts.map(x=>x[0])}}
 // Sem a apuração do Contab: a alíquota efetiva do último balancete (−tributos ÷ receita).
 try{for(const m of meses){const d=window.Gestao?.dreMes?.(m);if(d?.fonte==='balancete'&&d.v?.receita>0)return {balancete:true,pct:-(d.v.impostos||0)/d.v.receita*100,meses:[m]}}}catch{}
 return null})}
// DIFAL + FCP real: o das notas emitidas no período da apuração (os mesmos meses do DAS), pela RPC difal_resumo, a mesma
// que o faturamento usa. Lido em segundo plano uma vez por período; sem nuvem, sem notas ou com erro, fica o DIFAL da
// apuração do Jarvis (Contab.tributos).
const difalNotas={chave:null,v:null,lendo:false};
function difalDasNotas(meses){const C=window.Cloud;if(!meses?.length||!C?.ws||typeof C.client?.rpc!=='function')return null;
 const ms=[...meses].sort(),desde=ms[0]+'-01',[a,b]=ms.at(-1).split('-').map(Number),ate=new Date(a,b,0).toLocaleDateString('sv-SE'),k=C.ws+'|'+desde+'|'+ate;
 if(difalNotas.chave===k)return difalNotas.v;if(difalNotas.lendo)return null;difalNotas.lendo=true;difalNotas.chave=k;difalNotas.v=null;
 Promise.resolve().then(()=>C.client.rpc('difal_resumo',{ws:C.ws,desde,ate})).then(r=>{const d=r?.data?.[0];difalNotas.v=!r?.error&&d&&n(d.valor)>0?{pct:(n(d.difal)+n(d.fcp))/n(d.valor)*100,notas:n(d.notas),desde,ate}:null})
  .catch(()=>{difalNotas.v=null}).finally(()=>{difalNotas.lendo=false;if(difalNotas.v&&['regrasvenda','formacao','margem','promocao','custoproduto','concorrencia','estparado','catalogo'].includes(typeof page==='string'?page:''))try{render()}catch{}});
 return null}
function tributos(){const R=regras(),t=R.tributos,a0=tributosAuto(),sn=simples(),dn=a0&&!a0.balancete?difalDasNotas(a0.meses):null,a=dn?{...a0,difalReal:dn.pct,difalNotas:dn}:a0;
 if(t.fonte==='manual'||!a)return {pct:n(t.manual),fonte:t.fonte==='manual'?'manual':'reserva',simples:sn,partes:[['Tributos digitados',n(t.manual)]],texto:t.fonte==='manual'?'digitado em Regras de venda':'sem apuração nem balancete: valor digitado'};
 if(a.balancete)return {pct:a.pct,fonte:'balancete',simples:sn,partes:[['Alíquota efetiva do balancete',a.pct]],texto:`alíquota efetiva do balancete de ${a.meses[0].slice(5)}/${a.meses[0].slice(0,4)}`};
 const difal=t.difal==='nao'?0:t.difal==='manual'?n(t.difalManual):a.difalReal,difTxt=t.difal==='nao'?'não recolhe':t.difal==='manual'?'digitado':'real das notas';
 if(a.simples)return {pct:a.das+difal,fonte:'auto',simples:true,das:a.das,difal,difalReal:a.difalReal,difalNotas:a.difalNotas||null,difTxt,rbt12:a.rbt12,meses:a.meses,partes:[['DAS (alíquota efetiva)',a.das],['DIFAL + FCP',difal]],texto:`DAS ${pc(a.das)} + DIFAL ${pc(difal)}`};
 return {pct:a.icms+a.pis+a.irpj+difal,fonte:'auto',simples:false,difal,difalReal:a.difalReal,difalNotas:a.difalNotas||null,difTxt,meses:a.meses,partes:[['ICMS',a.icms],['DIFAL + FCP',difal],['PIS/COFINS',a.pis],[a.real?'IRPJ/CSLL (no Real, sobre o lucro: fora da conta)':'IRPJ/CSLL (presunção)',a.irpj]],texto:`ICMS ${pc(a.icms)} + DIFAL ${pc(difal)} + PIS/COFINS ${pc(a.pis)} + IRPJ/CSLL ${pc(a.irpj)}`}}
function fixasDRE(){return lembrar('fixas',[(db.accLines||[]).length,mesAtual()].join('|'),()=>{const G0=window.Gestao;if(!G0?.dreMes)return null;
 const ms=[...new Set((db.accLines||[]).filter(l=>l.kind==='balancete').map(l=>l.month))].sort().slice(-3);if(!ms.length)return null;let r=0,d=0;const por=[];
 for(const m of ms){const v=G0.dreMes(m,'gerencial')?.v||{},dm=-((v.administrativas||0)+(v.trabalhistas||0)+(v.outras||0)+(v.depreciacao||0));r+=v.receita||0;d+=dm;por.push([m,v.receita?dm/v.receita*100:0])}
 return r>0?{pct:d/r*100,meses:por,valor:d,receita:r}:null})}
function fixas(){const f=regras().despesas.fixas,d=fixasDRE();if(f.fonte==='manual'||!d)return {pct:n(f.manual),fonte:f.fonte==='manual'?'manual':'reserva',dre:d};return {pct:d.pct,fonte:'dre',dre:d}}
function ads(){const a=regras().despesas.ads;let real=null;try{real=window.Anuncios?.percentual?.()??null}catch{}return {pct:n(a),real}}
function excecao(sku,canal){const g=produto(sku)?.extra?.grupo;if(!g)return null;const l=regras().excecoes.filter(e=>e.grupo===g&&(e.canal===canal||e.canal==='*'));return l.length?Object.assign({},...l.sort((a,b)=>(a.canal==='*'?0:1)-(b.canal==='*'?0:1))):null}
function metas(sku,canal){const R=regras(),e=sku?excecao(sku,canal):null;return {minimo:0,alvo:e?.alvo!=null?n(e.alvo):n(R.metas.alvo)}}

// ─── Real dos últimos 30 dias (tarifa, frete e repasse que o marketplace informou: Margem real) ───
function real(sku,canal){const m=window.Margem?.realAnuncios?.(30);if(!m)return null;const g=m.get((PLAT[canal]||canal)+'|'+String(sku||'').trim());if(!g||!(g.u>0)||!(g.venda>0))return null;
 return {...g,preco:g.venda/g.u,varP:(g.com-g.reb+g.outros)/g.venda*100,comP:(g.com-g.reb)/g.venda*100,fixaU:g.fixa/g.u,freteU:g.frete/g.u,canalU:(g.com+g.fixa-g.reb+g.frete+g.outros)/g.u}}
function realCanal(canal){const m=window.Margem?.realAnuncios?.(30);if(!m)return null;const plat=PLAT[canal]||canal,c=canalRegra(canal);let v=0,com=0,u=0,reg=0,fr=0,uA=0,can=0,pedidos=0;
 for(const [k,g] of m){if(!k.startsWith(plat+'|')||!(g.venda>0))continue;v+=g.venda;u+=g.u;com+=g.com+g.fixa-g.reb;can+=g.com+g.fixa-g.reb+g.frete+g.outros;fr+=g.freteAcima;uA+=g.uAcima;pedidos+=g.n;if(c){const f=M.faixaDe(g.venda/g.u,c);reg+=f.comissao*g.venda+f.fixa*g.u*100}}
 return v?{venda:v,u,pedidos,comP:com/v*100,regraP:reg/v,canalP:can/v*100,freteAcimaU:uA?fr/uA:null}:null}
/** Frete pago pela loja (regra): no ML de R$ 79 para cima, a média real do produto; sem venda, a faixa de peso; depois a média do canal. */
function freteLoja(sku,canal){const c=canalRegra(canal)||{},acima=n(c.freteAcima);if(!acima)return {valor:n(c.freteFixo),fonte:n(c.freteFixo)?'regra do canal':'—'};
 const g=real(sku,canal);if(g&&g.uAcima>0)return {valor:g.freteAcima/g.uAcima,fonte:`média real do produto (${Math.round(g.uAcima)} un. em 30 dias)`};
 const peso=n(produto(sku)?.peso),fx=(c.fretePeso||[]).filter(f=>n(f.valor)>0).sort((a,b)=>(a.ate??1e9)-(b.ate??1e9));
 if(peso&&fx.length){const f=fx.find(x=>peso<=(x.ate??1e9));if(f)return {valor:n(f.valor),fonte:`tabela do canal (até ${vv(f.ate)} kg)`}}
 const rc=realCanal(canal);if(rc?.freteAcimaU!=null)return {valor:rc.freteAcimaU,fonte:'média real do canal (produto sem venda acima de R$ 79)'};
 return {valor:n(c.freteFixo),fonte:n(c.freteFixo)?'valor da regra do canal':'sem dado de frete'}}

// ─── Parâmetros da conta e os atalhos que as telas usam ───
function params(sku,canal,modo='regra'){const c=canalRegra(canal);if(!c)return null;const cu=custo(sku);if(!cu.tem)return null;
 const base={custo:cu.total,tributos:tributos().pct,ads:ads().pct,fixas:fixas().pct};
 if(modo==='real'){const g=real(sku,canal);if(!g)return null;return {...base,comissao:g.varP,fixa:g.fixaU,faixas:[],frete:g.freteU,freteAcima:0,freteFonte:'real',real:g}}
 const e=produto(sku)?.extra||{},x=excecao(sku,canal),fr=freteLoja(sku,canal),par={...base,comissao:x?.comissao!=null?n(x.comissao):n(c.comissao),fixa:n(c.fixa),faixas:c.faixas||[],frete:fr.valor,freteAcima:n(c.freteAcima),freteFonte:fr.fonte};
 if(e.frete?.[canal]!=null&&e.frete[canal]!==''){par.frete=n(e.frete[canal]);par.freteFonte='deste produto (planilha)'}
 if(e.fixa?.[canal]!=null&&e.fixa[canal]!==''){par.fixa=n(e.fixa[canal]);par.faixas=par.faixas.map(f=>({...f,fixa:0}))}
 return par}
/** Parâmetros "real" de um agregado (anúncio) já somado: mesma conta, com a tarifa e o frete que aconteceram. */
function paramsReal(g,sku){const cu=custo(sku);return {custo:cu.tem?cu.total:0,tributos:tributos().pct,ads:ads().pct,fixas:fixas().pct,comissao:g.venda?(g.com-g.reb+g.outros)/g.venda*100:0,fixa:g.u?g.fixa/g.u:0,faixas:[],frete:g.u?g.frete/g.u:0,freteAcima:0}}
function conta(sku,canal,P,modo='regra'){const p=params(sku,canal,modo);return p&&n(P)>0?M.conta(n(P),p):null}
function precos(sku,canal){const p=params(sku,canal);return p?M.precos(p,metas(sku,canal)):null}
function canalPrincipal(sku){const ini=menos(180),c=new Map();for(const o of db.orders||[]){if(o.date<ini)continue;for(const i of o.items||[])if(String(i.sku||'').trim()===String(sku))c.set(o.platform,(c.get(o.platform)||0)+n(i.qty))}
 const top=[...c].sort((a,b)=>b[1]-a[1])[0]?.[0];return (top&&canalDe(top))||'Mercado Livre'}
/** Resumo de um produto e canal num preço: o que as telas mostram (margem líquida, contribuição e os 3 preços). */
function resumo(sku,canal,P){const L=conta(sku,canal,P),pr=precos(sku,canal);return L&&pr?{preco:L.preco,liqP:L.liqP,mcP:L.mcP,liq:L.liq,mc:L.mc,piso:pr.piso,minimo:pr.minimo,alvo:pr.alvo,custo:L.custo,situacao:M.situacao(L.liqP,metas(sku,canal))}:null}
const SIT={prejuizo:['bad','abaixo do mínimo'],abaixo:['warn','abaixo do alvo'],alvo:['ok','no alvo']};

window.Preco={motor:M,regras,canaisAtivos,canaisDaTabela,rotulo,canalDe,produto,produtos,custo,custoDe,notasDe,tributos,fixas,ads,metas,excecao,real,realCanal,freteLoja,params,paramsReal,conta,precos,resumo,canalPrincipal,SIT,PLAT,
 /** Selo de situação de uma margem líquida. */selo:(liqP,m)=>{const s=SIT[M.situacao(liqP,m||metas())];return `<span class="badge ${s[0]}">${pc(liqP)}</span>`}};

// ═════════ Tela: Custo do produto ═════════
const uc={busca:'',filtro:'todos',sel:null};
window.Reiniciar?.registrar(uc,['busca','filtro','sel']);
function prod(id){db.products=db.products||[];let p=db.products.find(x=>String(x.id)===String(id));if(!p){const b=bling(id);p={id,nome:b?.nome||id,custo:n(b?.custo),embalagem:0,precos:{},extra:{}};db.products.push(p)}p.precos=p.precos||{};p.extra=p.extra||{};return p}
function custoView(){const R=regras(),L=produtos().map(p=>({p,c:custo(p.id)})),q=normalized(uc.busca);
 const F={todos:['Todos',()=>true],bling:['Diferente do Bling',x=>x.c.difBling!=null&&Math.abs(x.c.difBling)>0.02],mudou:['Custo mudou',x=>x.c.mudou],semnota:['Sem nota',x=>x.c.origem.tipo!=='nota'&&x.c.origem.tipo!=='media'],semcusto:['Sem custo',x=>!x.c.tem]};
 const cont=k=>L.filter(F[k][1]).length,lista=L.filter(x=>F[uc.filtro][1](x)&&(!q||normalized(x.p.id+' '+x.p.nome).includes(q))).sort((a,b)=>a.p.nome.localeCompare(b.p.nome,'pt-BR'));
 const sel=L.find(x=>x.p.id===uc.sel)||lista[0]||null,porNota=L.filter(x=>x.c.origem.tipo==='nota'||x.c.origem.tipo==='media').length,velhos=L.filter(x=>x.c.velho);
 const kpi=(t,v,s,c='')=>`<div class="card kpi"><span class="kpil">${t}</span><span class="kpiv ${c}">${v}</span><span class="kpis">${s}</span></div>`;
 const REG={nota:'Última nota de entrada',media:'Média das notas',manual:'Digitado à mão'};
 return `<div class="grid kpis4">${kpi('Produtos com custo',`${L.filter(x=>x.c.tem).length} de ${L.length}`,`${porNota} pela nota de entrada · ${L.filter(x=>x.c.origem.tipo==='manual').length} à mão`)}${kpi('Custo diferente do Bling',String(cont('bling')),'mais de 2% de diferença · vale atualizar o Bling',cont('bling')?'gold':'')}${kpi('Nota de entrada nova',String(cont('mudou')),'custo mudou mais de 2% em 30 dias · confira o preço',cont('mudou')?'gold':'')}${kpi('Sem nota há 180 dias',String(velhos.length),velhos.length?`custo pode estar velho (${esc(velhos.slice(0,2).map(x=>x.p.id).join(', '))})`:'todas as notas são recentes')}</div>
 ${sel?custoPainel(sel.p,sel.c,R,REG):''}
 <div class="tablebox"><div class="pmbar"><input type="search" id="pmCustoBusca" placeholder="Produto ou SKU…" value="${esc(uc.busca)}"><div class="segtabs">${Object.entries(F).map(([k,[t]])=>`<button class="${uc.filtro===k?'active':''}" data-pm-cfiltro="${k}">${t}${k==='todos'?'':` (${cont(k)})`}</button>`).join('')}</div>
  <span style="flex:1"></span><button class="small" data-g="import-precos">${icon('upload')} Importar planilha</button><button class="small" data-nav="cadprodutos">${icon('box')} Cadastro (SKU, peso, embalagem)</button></div>
 <div class="tablewrap"><table class="pmtab"><thead><tr><th>Produto</th><th class="num">Compra</th><th class="num">Frete, IPI e ST</th><th class="num">Embalagem e perdas</th><th class="num">Custo do produto</th><th>De onde veio</th><th class="num">Bling</th></tr></thead><tbody>
 ${lista.slice(0,400).map(x=>{const c=x.c;return `<tr class="clickrow ${sel&&sel.p.id===x.p.id?'pmon':''}" data-pm-csel="${esc(x.p.id)}"><td><b>${esc(x.p.nome)}</b><br><span class="caption mono">${esc(x.p.id)}</span></td><td class="num">${c.tem?money(c.compra):'—'}</td><td class="num">${c.tem?money(c.acrescimos+c.frete+c.ipi+c.st-c.creditos):'—'}</td><td class="num">${c.tem?money(c.embalagem+c.perdas):'—'}</td><td class="num"><b>${c.tem?money(c.total):'<span class="red">sem custo</span>'}</b></td><td><span class="badge ${c.origem.tipo==='nota'||c.origem.tipo==='media'?'info':c.origem.tipo==='sem'?'bad':'warn'}">${esc(c.origem.texto||'sem custo')}</span>${c.mudou?' <span class="badge gold">mudou</span>':''}</td><td class="num">${c.bling?money(c.bling):'—'}${c.difBling!=null&&Math.abs(c.difBling)>0.02?`<br><span class="caption gold">${c.difBling>0?'+':''}${pc(c.difBling*100)}</span>`:''}</td></tr>`}).join('')||'<tr><td colspan="7" class="empty">Nenhum produto neste filtro.</td></tr>'}</tbody></table></div></div>`}
function custoPainel(p,c,R,REG){const t=produto(p.id),cp=t?.extra?.comp||{},inp=(k,v,ph='0,00')=>`<input class="pmin" data-pm-comp="${esc(p.id)}|${k}" value="${v?vv(v):''}" placeholder="${ph}" inputmode="decimal">`;
 return `<section class="card pmconta pmlargo"><div class="pmtag">Composição · ${esc(p.id)}</div><h3>${esc(p.nome)}</h3>
 <div class="pmcontagrid"><div><div class="tablewrap"><table class="pmwf"><tbody>
  <tr><td>Valor do produto na nota (por unidade)<br><span class="caption">${esc(c.origem.texto||'')}</span></td><td class="num">${money(c.compra)}</td></tr>
  <tr class="l2"><td>+ Frete, IPI e ST da nota (total da nota − itens, rateado pelo valor)</td><td class="num">${money(c.acrescimos)}</td></tr>
  <tr class="l2"><td>+ Frete da compra (à parte, por unidade)</td><td class="num">${inp('frete',cp.frete)}</td></tr>
  <tr class="l2"><td>+ IPI destacado na nota</td><td class="num">${inp('ipi',cp.ipi)}</td></tr>
  <tr class="l2"><td>+ ICMS-ST pago na compra</td><td class="num">${inp('st',cp.st)}</td></tr>
  <tr class="l2"><td>− Créditos de impostos que a empresa recupera <span class="caption">(${simples()?'Simples: não recupera':'Presumido/Real: ICMS, PIS e COFINS das compras'})</span></td><td class="num">${inp('creditos',cp.creditos)}</td></tr>
  <tr class="l2"><td>+ Perdas e quebras (%)</td><td class="num">${inp('perdas',cp.perdas,'0')}</td></tr>
  <tr class="l2"><td>+ Embalagem de envio</td><td class="num"><input class="pmin" data-pm-emb="${esc(p.id)}" value="${t?.embalagem?vv(t.embalagem):''}" placeholder="0,00" inputmode="decimal"></td></tr>
  <tr class="t"><td>= Custo do produto</td><td class="num">${money(c.total)}</td></tr></tbody></table></div></div>
 <div><div class="pmrow" style="margin-top:0"><label class="row" style="gap:6px;font-weight:400"><input type="checkbox" class="check" data-pm-manual="${esc(p.id)}" ${t?.extra?.custoManual?'checked':''}> Usar o custo à mão neste produto</label><span class="row" style="gap:4px">R$ <input class="pmin" data-pm-custo="${esc(p.id)}" value="${t?.custo?vv(t.custo):''}" placeholder="custo à mão" inputmode="decimal"></span></div>
 <div class="notice" style="margin:10px 0 0"><b>Conferência:</b> Bling ${c.bling?money(c.bling):'—'} · média das notas ${c.media?money(c.media):'—'} (é a que a Contabilidade usa no CMV) · ${c.notas} nota(s) de entrada.${c.nota?` Última: NF ${esc(c.nota.nota)} de ${esc(c.nota.fornecedor||'')}, ${c.nota.qtd} un.`:''}</div>
 <div class="pmrow"><span class="caption">Regra da empresa:</span><div class="segtabs">${Object.entries(REG).map(([k,t])=>`<button class="${(R.custo.regra||'nota')===k?'active':''}" data-pm-cregra="${k}">${t}</button>`).join('')}</div></div>
 <p class="caption">Importação (custo de chegada: FOB × câmbio, frete e seguro internacionais, II, IPI, PIS/COFINS e ICMS da importação, despachante) e o envio do custo ao Bling chegam na próxima fase.</p></div></div></section>`}

// ═════════ Tela: Regras de venda ═════════
const ur={conf:false,nova:{grupo:'',canal:'*',comissao:'',alvo:''}};
window.Reiniciar?.registrar(ur,['conf']);
const inR=(path,v,suf,w=64)=>`<span class="row" style="gap:4px;justify-content:flex-end;flex-wrap:nowrap"><input class="pmin" style="width:${w}px" data-pm-r="${path}" value="${v===''||v==null?'':vv(v)}" inputmode="decimal">${suf?`<span class="caption">${suf}</span>`:''}</span>`;
// Tarifa do canal (comissão + taxa fixa − rebate, sem frete) da regra × a real. "Usar o real" só ajusta a comissão de canal
// sem comissão por faixa e que não junta tipos de anúncio (no ML o pedido não diz se é Clássico ou Premium).
const ajustavel=k=>!/^Mercado Livre/.test(k)&&!(regras().canais[k]?.faixas||[]).some(f=>f.comissao!=null&&f.comissao!=='');
function difs(){const R=regras(),out=[];for(const k of canaisAtivos()){const r=realCanal(k);if(!r||r.pedidos<5||k==='Mercado Livre Clássico')continue;const d=r.comP-r.regraP;if(Math.abs(d)>1.5)out.push({k,txt:`tarifa ${rotulo(k)} (${pc(r.regraP)} na regra, ${pc(r.comP)} real)`,usar:ajustavel(k)?()=>{const c=R.canais[k];c.comissao=r2(n(c.comissao)+d)}:null})}
 const f=fixas(),d=f.dre;if(d&&R.despesas.fixas.fonte==='manual'&&Math.abs(n(R.despesas.fixas.manual)-d.pct)>2)out.push({k:'fixas',txt:`despesas fixas (${pc(n(R.despesas.fixas.manual))} digitadas, ${pc(d.pct)} pela DRE)`,usar:()=>{R.despesas.fixas.fonte='dre'}});
 const a=ads();if(a.real!=null&&Math.abs(a.real*100-a.pct)>1.5)out.push({k:'ads',txt:`anúncios (${pc(a.pct)} na regra, ${pc(a.real*100)} real)`,usar:()=>{R.despesas.ads=r2(a.real*100)}});return out}
function regrasView(){const R=regras(),t=tributos(),T=R.tributos,f=fixas(),a=ads(),D=difs(),leg=R.notasConversao||[];
 const sel=(path,v,ops)=>`<select data-pm-rs="${path}">${ops.map(([k,l])=>`<option value="${k}" ${v===k?'selected':''}>${l}</option>`).join('')}</select>`;
 const grupos=[...new Set((db.products||[]).map(p=>p.extra?.grupo).filter(Boolean))].sort();
 const faixaTxt=c=>(c.faixas||[]).length?[...c.faixas].sort((x,y)=>(x.ate??1e9)-(y.ate??1e9)).map(x=>`${x.ate==null?'acima':'até '+money(x.ate)} → ${x.comissao!=null&&x.comissao!==''?vv(x.comissao)+'% + ':''}${money(n(x.fixa)+n(c.fixa))}`).join(' · '):n(c.fixa)?money(n(c.fixa))+' por item':'—';
 return ` ${D.length?`<section class="vgv-hero vgv-mini"><div class="vgv-luz" aria-hidden="true"></div><div class="vgv-top"><div><span class="vgv-eyebrow">Regras × real · últimos 30 dias</span><h2>${D.length===1?'Uma regra está':D.length+' regras estão'} longe do real: ${esc(D.map(x=>x.txt).join('; '))}.</h2>${D.some(x=>!x.usar)?`<p class="caption">Mercado Livre (Clássico e Premium vêm juntos nos pedidos) e canais com comissão por faixa de preço não mudam sozinhos: confira o tipo de anúncio e a tabela do canal e ajuste à mão.</p>`:''}</div>${D.some(x=>x.usar)?`<button class="primary ${ur.conf?'danger':''}" data-pm="usar-real" style="flex:none;width:auto;align-self:center">${ur.conf?'Confirmar: usar os valores reais':'Usar os valores reais'}</button>`:''}</div></section>`:''}
 ${leg.length?`<div class="notice"><b>Regras convertidas das telas antigas:</b> ${leg.map(esc).join(' ')} <button class="small quiet" data-pm="ok-legado">Entendi</button></div>`:''}
 <div class="grid two"><section class="card"><div class="cardhead"><h2>Tributos sobre a venda</h2></div><div class="tablewrap"><table class="pmwf"><tbody>
  <tr><td>Regime</td><td class="num"><b>${esc(regimeNome())}</b><br><span class="caption">vem de Fiscal › Regras fiscais</span></td></tr>
  <tr><td>Como calcular</td><td class="num">${sel('tributos.fonte',T.fonte||'auto',[['auto','Pelo regime (apuração do Jarvis)'],['manual','Digitado']])}</td></tr>
  ${T.fonte==='manual'||t.fonte==='reserva'?`<tr><td>Tributos sobre o preço</td><td class="num">${inR('tributos.manual',T.manual,'%')}</td></tr>`:''}
  ${t.fonte==='auto'&&t.simples?`<tr><td>DAS (alíquota efetiva)</td><td class="num"><b>${pc(t.das)}</b><br><span class="caption">Anexo I pela receita de 12 meses (${money(t.rbt12||0)})</span></td></tr>`:''}
  ${t.fonte==='auto'&&!t.simples?t.partes.filter(x=>!/DIFAL/.test(x[0])).map(([l,v])=>`<tr><td>${esc(l)}</td><td class="num"><b>${pc(v)}</b></td></tr>`).join(''):''}
  ${t.fonte==='auto'?`<tr><td>DIFAL + FCP (venda a consumidor de outro estado)</td><td class="num">${sel('tributos.difal',T.difal||'auto',[['auto','Real das notas'],['nao','Não recolhe'],['manual','Digitado']])}${T.difal==='manual'?inR('tributos.difalManual',T.difalManual,'%'):`<br><b>${pc(t.difal)}</b>`}<br><span class="caption">real: ${pc(t.difalReal)} das vendas (${(t.meses||[]).map(m=>m.slice(5)+'/'+m.slice(2,4)).join(', ')}${t.difalNotas?` · ${t.difalNotas.notas.toLocaleString('pt-BR')} notas emitidas`:' · apuração do Jarvis'})</span></td></tr>`:''}
  ${t.fonte==='balancete'?`<tr><td>Alíquota efetiva</td><td class="num"><b>${pc(t.pct)}</b><br><span class="caption">${esc(t.texto)}</span></td></tr>`:''}
  <tr class="t"><td><b>Total sobre o preço</b></td><td class="num"><b>${pc(t.pct)}</b></td></tr></tbody></table></div>
  <p class="caption">${t.simples?'No Simples, o tributo é a alíquota efetiva do DAS (muda com a receita de 12 meses) mais o DIFAL onde as regras fiscais da empresa mandam recolher. <b>Confirme com o contador</b> se a empresa do Simples deve recolher o DIFAL nessas vendas (STF, ADI 5464; cada estado aplica do seu jeito).':'No Lucro Presumido/Real: ICMS, DIFAL, PIS/COFINS e IRPJ/CSLL pela apuração do Jarvis, nunca misturados com o DAS.'}</p></section>
 <section class="card"><div class="cardhead"><h2>Despesas da empresa (rateadas no preço)</h2></div><div class="tablewrap"><table class="pmwf"><tbody>
  <tr><td>Anúncios pagos</td><td class="num">${inR('despesas.ads',R.despesas.ads,'% da venda')}<span class="caption">${a.real!=null?`real do mês: ${pc(a.real*100)} (Anúncios pagos)`:'real: importe o gasto em Anúncios pagos'}</span></td></tr>
  <tr><td>Despesas fixas (pessoal, aluguel, sistemas, contador)</td><td class="num">${sel('despesas.fixas.fonte',R.despesas.fixas.fonte||'dre',[['dre','Média da DRE (3 meses)'],['manual','Digitado']])}${R.despesas.fixas.fonte==='manual'||!f.dre?inR('despesas.fixas.manual',R.despesas.fixas.manual,'% da venda'):`<br><b>${pc(f.pct)}</b>`}<br><span class="caption">${f.dre?`DRE ${f.dre.meses.map(([m,p])=>`${m.slice(5)}/${m.slice(2,4)} ${pc(p)}`).join(' · ')}`:'sem balancete importado: use o valor digitado'}</span></td></tr></tbody></table></div>
  <h3 style="margin:14px 0 6px">Metas</h3><div class="tablewrap"><table class="pmwf"><tbody>
  <tr><td>Mínimo <span class="caption">(lucro líquido zero: abaixo disso a venda dá prejuízo)</span></td><td class="num"><b>0%</b></td></tr>
  <tr><td>Alvo <span class="caption">(margem líquida do preço sugerido)</span></td><td class="num">${inR('metas.alvo',R.metas.alvo,'%')}</td></tr></tbody></table></div>
  <p class="caption">As mesmas metas valem na Formação de preço, na Margem real, nas Promoções, no Estoque parado, no Vigia de preços e em Produtos e anúncios. Piso = margem de contribuição zero (só para queimar estoque).</p></section></div>
 <section class="tablebox" style="margin-top:14px"><div class="tabletop"><div><h2>Canais</h2><p class="caption">Por tipo de anúncio. Tarifa = comissão + taxa fixa − rebate (sem o frete), em % do valor dos itens: a da regra nos preços vendidos × a real, só com a tarifa vinda da API do marketplace, nos últimos 30 dias. No Mercado Livre, Premium e Clássico vêm juntos.</p></div></div>
 <div class="tablewrap"><table class="pmtab"><thead><tr><th>Canal</th><th class="num">Comissão (regra)</th><th class="num">Tarifa regra × real</th><th>Taxa fixa e comissão por faixa de preço</th><th>Frete pago pela loja</th><th>Situação</th></tr></thead><tbody>
 ${Object.entries(R.canais).map(([k,c])=>{const r=realCanal(k),d=r&&k!=='Mercado Livre Clássico'?r.comP-r.regraP:null;return `<tr><td><label class="row" style="gap:6px"><input type="checkbox" class="check" data-pm-ativo="${esc(k)}" ${c.ativo?'checked':''}><b>${esc(rotulo(k))}</b></label><span class="caption">${esc(k)}</span></td><td class="num">${inR(`canais.${k}.comissao`,c.comissao,'%')}</td><td class="num">${r&&k!=='Mercado Livre Clássico'?`${pc(r.regraP)} × <b>${pc(r.comP)}</b><br><span class="caption">${r.pedidos} venda(s)</span>`:k==='Mercado Livre Clássico'?'<span class="caption">junto do Premium</span>':'—'}</td>
  <td>${esc(faixaTxt(c))}<br><button class="fplink" data-pm-faixas="${esc(k)}">editar faixas</button></td><td>${n(c.freteAcima)?`de ${money(c.freteAcima)} para cima: a média real de cada produto (30 dias)${r?.freteAcimaU!=null?`<br><span class="caption">média do canal ${money(r.freteAcimaU)}</span>`:''}<br><button class="fplink" data-pm-peso="${esc(k)}">tabela por peso (reserva)</button>`:`${inR(`canais.${k}.freteFixo`,c.freteFixo,'R$/un.')}`}</td>
  <td>${d==null?'<span class="caption">sem vendas</span>':Math.abs(d)<=1.5?'<span class="badge ok">bate com o real</span>':`<span class="badge ${Math.abs(d)<=4?'warn':'bad'}">${d>0?'+':''}${vv(Math.round(d*10)/10)} p.p.</span>`}</td></tr>`}).join('')}</tbody></table></div></section>
 <section class="tablebox" style="margin-top:14px"><div class="tabletop"><div><h2>Exceções por grupo de produtos</h2><p class="caption">Quando um grupo tem comissão ou alvo diferentes (substitui os percentuais por grupo da planilha antiga). Grupos vêm da planilha de preços importada.</p></div></div>
 <div class="tablewrap"><table class="pmtab"><thead><tr><th>Grupo</th><th>Canal</th><th class="num">Comissão</th><th class="num">Alvo líquido</th><th></th></tr></thead><tbody>
 ${R.excecoes.map((e,i)=>`<tr><td><b>${esc(e.grupo)}</b></td><td>${e.canal==='*'?'Todos':esc(rotulo(e.canal))}</td><td class="num">${e.comissao!=null?pc(n(e.comissao)):'regra do canal'}</td><td class="num">${e.alvo!=null?pc(n(e.alvo)):'alvo da empresa'}</td><td><button class="small quiet" data-pm-exdel="${i}">Remover</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty">Nenhuma exceção: todos os produtos seguem as regras acima.</td></tr>'}
 ${grupos.length?`<tr><td><select data-pm-nova="grupo"><option value="">Grupo…</option>${grupos.map(g=>`<option ${ur.nova.grupo===g?'selected':''}>${esc(g)}</option>`).join('')}</select></td><td><select data-pm-nova="canal"><option value="*">Todos</option>${Object.keys(R.canais).map(k=>`<option value="${esc(k)}" ${ur.nova.canal===k?'selected':''}>${esc(rotulo(k))}</option>`).join('')}</select></td><td class="num"><input class="pmin" data-pm-nova="comissao" value="${esc(ur.nova.comissao)}" placeholder="%" inputmode="decimal"></td><td class="num"><input class="pmin" data-pm-nova="alvo" value="${esc(ur.nova.alvo)}" placeholder="%" inputmode="decimal"></td><td><button class="small" data-pm="ex-add">Incluir</button></td></tr>`:''}</tbody></table></div></section>`}
function janelaFaixas(k){const c=regras().canais[k],l=[...(c.faixas||[])].sort((a,b)=>(a.ate??1e9)-(b.ate??1e9));
 modal(`Faixas de preço · ${rotulo(k)}`,`<p class="caption" style="margin-top:-8px">Até o preço de cada faixa vale a comissão dela (em branco = a do canal, ${vv(c.comissao)}%) e a taxa fixa por item. Última faixa sem limite: deixe "até" em branco.</p>
 <div class="tablewrap"><table><thead><tr><th>Até (R$)</th><th class="num">Comissão (%)</th><th class="num">Taxa fixa (R$)</th><th></th></tr></thead><tbody>${l.map((f,i)=>`<tr><td><input class="pmin" data-pm-fx="${esc(k)}|${i}|ate" value="${f.ate==null?'':vv(f.ate)}" placeholder="sem limite"></td><td class="num"><input class="pmin" data-pm-fx="${esc(k)}|${i}|comissao" value="${f.comissao==null||f.comissao===''?'':vv(f.comissao)}" placeholder="${vv(c.comissao)}"></td><td class="num"><input class="pmin" data-pm-fx="${esc(k)}|${i}|fixa" value="${vv(f.fixa)}"></td><td><button class="small quiet" data-pm-fxdel="${esc(k)}|${i}">×</button></td></tr>`).join('')||'<tr><td colspan="4" class="empty">Sem faixas: só a comissão e a taxa fixa do canal.</td></tr>'}</tbody></table></div>
 <p class="caption">Taxa fixa do canal em todo item: <input class="pmin" data-pm-r="canais.${esc(k)}.fixa" value="${vv(c.fixa)}"> R$</p>
 <div class="modalfoot"><button data-pm-fxadd="${esc(k)}">Nova faixa</button><button data-pm-fxpadrao="${esc(k)}" class="quiet">Voltar ao padrão</button><button class="primary" data-action="close">Fechar</button></div>`)}
function janelaPeso(k){const c=regras().canais[k],l=c.fretePeso||(c.fretePeso=[]);
 modal(`Frete por peso · ${rotulo(k)}`,`<p class="caption" style="margin-top:-8px">Reserva para o produto que ainda não vendeu acima de R$ ${vv(c.freteAcima)} nos últimos 30 dias: o frete pago pela loja pelo peso do produto (Cadastro). Use a tabela do frete grátis da sua conta.</p>
 <div class="tablewrap"><table><thead><tr><th>Até (kg)</th><th class="num">Frete (R$)</th><th></th></tr></thead><tbody>${l.map((f,i)=>`<tr><td><input class="pmin" data-pm-pz="${esc(k)}|${i}|ate" value="${f.ate==null?'':vv(f.ate)}" placeholder="sem limite"></td><td class="num"><input class="pmin" data-pm-pz="${esc(k)}|${i}|valor" value="${vv(f.valor)}"></td><td><button class="small quiet" data-pm-pzdel="${esc(k)}|${i}">×</button></td></tr>`).join('')||'<tr><td colspan="3" class="empty">Sem tabela: o produto sem venda usa a média real do canal.</td></tr>'}</tbody></table></div>
 <div class="modalfoot"><button data-pm-pzadd="${esc(k)}">Nova faixa</button><button class="primary" data-action="close">Fechar</button></div>`)}
function setPath(o,path,v){const k=path.split('.');while(k.length>1){const x=k.shift();o=o[x]=o[x]||{}}o[k[0]]=v}
const gravar=(txt,det)=>{audit(txt,det||'');save();render()};
document.addEventListener('change',e=>{const x=e.target,d=x.dataset;if(!d)return;
 if(d.pmR){const v=String(x.value).trim()===''?'':n(x.value);if(d.pmR==='metas.alvo'&&!(v>-50&&v<80))return toast('Alvo entre -50% e 80%.');setPath(regras(),d.pmR,v);gravar('Regras de venda alteradas',`${d.pmR} = ${x.value}`);if(document.querySelector('.modalback')&&d.pmR.endsWith('.fixa'))janelaFaixas(d.pmR.split('.')[1]);return}
 if(d.pmRs){setPath(regras(),d.pmRs,x.value);gravar('Regras de venda alteradas',`${d.pmRs} = ${x.value}`);return}
 if(d.pmAtivo){regras().canais[d.pmAtivo].ativo=x.checked;gravar('Canal '+(x.checked?'ligado':'desligado')+' nas regras de venda',d.pmAtivo);return}
 if(d.pmFx){const [k,i,c]=d.pmFx.split('|'),f=regras().canais[k].faixas[Number(i)];f[c]=String(x.value).trim()===''?(c==='fixa'?0:null):n(x.value);gravar('Faixa de preço alterada',`${k} · ${c} = ${x.value}`);janelaFaixas(k);return}
 if(d.pmPz){const [k,i,c]=d.pmPz.split('|'),f=regras().canais[k].fretePeso[Number(i)];f[c]=String(x.value).trim()===''?null:n(x.value);gravar('Frete por peso alterado',`${k} · ${c} = ${x.value}`);janelaPeso(k);return}
 if(d.pmNova){ur.nova[d.pmNova]=x.value;return}
 if(d.pmComp){const [id,k]=d.pmComp.split('|'),p=prod(id);p.extra.comp={...(p.extra.comp||{}),[k]:n(x.value)};gravar('Custo do produto: composição',`${id} · ${k} = ${x.value}`);return}
 if(d.pmEmb){const p=prod(d.pmEmb);p.embalagem=n(x.value);gravar('Custo do produto: embalagem',`${d.pmEmb} · ${x.value}`);return}
 if(d.pmCusto){const p=prod(d.pmCusto);p.custo=r2(n(x.value));if(p.custo>0)p.extra.custoManual=true;gravar('Custo do produto à mão',`${d.pmCusto} · ${money(p.custo)}`);return}
 if(d.pmManual){const p=prod(d.pmManual);p.extra.custoManual=x.checked;if(x.checked&&!(n(p.custo)>0))p.custo=r2(custo(d.pmManual).compra);gravar(x.checked?'Custo à mão ligado':'Custo pela regra da empresa',d.pmManual);return}});
document.addEventListener('input',e=>{const x=e.target;if(x.id!=='pmCustoBusca')return;uc.busca=x.value;const p=x.selectionStart;render();const nn=document.getElementById('pmCustoBusca');if(nn){nn.focus();try{nn.setSelectionRange(p,p)}catch{}}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-pm],[data-pm-cfiltro],[data-pm-csel],[data-pm-cregra],[data-pm-faixas],[data-pm-peso],[data-pm-fxadd],[data-pm-fxdel],[data-pm-fxpadrao],[data-pm-pzadd],[data-pm-pzdel],[data-pm-exdel]');if(!b)return;const d=b.dataset,R=regras();
 if(d.pmCfiltro){uc.filtro=d.pmCfiltro;render();return}
 if(d.pmCsel&&!e.target.closest('input,button,select')){uc.sel=d.pmCsel;render();return}
 if(d.pmCregra){R.custo.regra=d.pmCregra;gravar('Regra do custo do produto',d.pmCregra);return}
 if(d.pmFaixas){janelaFaixas(d.pmFaixas);return}if(d.pmPeso){janelaPeso(d.pmPeso);return}
 if(d.pmFxadd){R.canais[d.pmFxadd].faixas.push({ate:null,fixa:0});save();janelaFaixas(d.pmFxadd);render();return}
 if(d.pmFxdel){const [k,i]=d.pmFxdel.split('|');R.canais[k].faixas.splice(Number(i),1);gravar('Faixa de preço removida',k);janelaFaixas(k);return}
 if(d.pmFxpadrao){const k=d.pmFxpadrao;R.canais[k].faixas=JSON.parse(JSON.stringify(M.CANAIS_PADRAO[k]?.faixas||[]));gravar('Faixas do canal voltaram ao padrão',k);janelaFaixas(k);return}
 if(d.pmPzadd){(R.canais[d.pmPzadd].fretePeso||(R.canais[d.pmPzadd].fretePeso=[])).push({ate:null,valor:0});save();janelaPeso(d.pmPzadd);return}
 if(d.pmPzdel){const [k,i]=d.pmPzdel.split('|');R.canais[k].fretePeso.splice(Number(i),1);gravar('Frete por peso removido',k);janelaPeso(k);return}
 if(d.pmExdel!=null){const ex=R.excecoes.splice(Number(d.pmExdel),1)[0];gravar('Exceção por grupo removida',`${ex?.grupo} · ${ex?.canal}`);return}
 switch(d.pm){case 'usar-real':{if(!ur.conf){ur.conf=true;render();return}const D=difs().filter(x=>x.usar);D.forEach(x=>x.usar());ur.conf=false;gravar('Regras de venda: valores reais aplicados',D.map(x=>x.txt).join('; '));toast('Regras atualizadas com o real dos últimos 30 dias.');return}
  case 'ok-legado':delete R.notasConversao;save();render();return;
  case 'ex-add':{const x=ur.nova;if(!x.grupo)return toast('Escolha o grupo.');const e0={grupo:x.grupo,canal:x.canal||'*'};if(String(x.comissao).trim()!=='')e0.comissao=n(x.comissao);if(String(x.alvo).trim()!=='')e0.alvo=n(x.alvo);if(e0.comissao==null&&e0.alvo==null)return toast('Informe a comissão ou o alvo.');R.excecoes.push(e0);ur.nova={grupo:'',canal:'*',comissao:'',alvo:''};gravar('Exceção por grupo incluída',`${e0.grupo} · ${e0.canal}`);return}}});

addPage('custoproduto','custo','Custo do produto',custoView,'Quanto cada unidade custa para chegar à prateleira, montado da nota de entrada (com frete, IPI e ST), a embalagem e as perdas. É o único custo usado em todas as telas; o Bling e a média das notas ficam só para conferir.','',()=>{});
addPage('regrasvenda','regras','Regras de venda',regrasView,'Tudo o que sai de cada venda além do custo, num lugar só: tributos, canais, anúncios, despesas fixas e as metas (Mínimo e Alvo) de todas as telas. Ao lado, o real dos últimos 30 dias.','',()=>{});

// ─── Rotas antigas (links e favoritos) ───
const ROTAS={precos:['regrasvenda'],dvv:['regrasvenda'],raiox:['margem',()=>window.Margem?.aba?.('mudou')]};
window.Preco.rotasAntigas=ROTAS;
const nav0=navigate;navigate=function(p){const r=ROTAS[p];if(r){r[1]?.();return nav0(r[0])}return nav0(p)};
const ren0=render;render=function(){const r=ROTAS[page];if(r){r[1]?.();page=r[0]}return ren0()};
})();
