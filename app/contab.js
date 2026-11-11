// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Contabilidade automática (partidas dobradas) gerada a partir do que já existe no Jarvis:
// vendas, tarifas e fretes (pedidos), custo das mercadorias vendidas (itens × custo), notas e títulos
// (competência), extrato bancário (caixa), aplicações e transferências. Saídas: diário, razão, balancete,
// DRE e balanço — por competência — com exportação para o escritório contábil.
// É uma contabilidade GERENCIAL: o escritório continua responsável pela escrituração oficial (ECD/ECF).
(()=>{
Object.assign(paths,{ledger:'M4 4h12l4 4v12H4z M8 10h8 M8 14h8 M8 18h5 M16 4v4h4'});
// ─────────────── Plano de contas ───────────────
const PLANO=[
 ['1','ATIVO','A'],['1.1','Ativo circulante','A'],['1.1.01','Caixa e bancos','A'],['1.1.01.90','Caixa (fundo fixo)','A'],['1.1.01.99','Outras contas próprias','A'],
 ['1.1.02','Aplicações financeiras','A'],['1.1.02.99','Aplicações a identificar','A'],
 ['1.1.03','Marketplaces a receber e carteiras','A'],['1.1.03.01','Mercado Livre / Mercado Pago','A'],['1.1.03.02','Shopee','A'],['1.1.03.03','Magalu','A'],['1.1.03.09','Outros canais','A'],
 ['1.1.04','Estoque de mercadorias','A'],['1.1.05','Clientes · vendas diretas','A'],['1.1.06','ICMS a recuperar (compras)','A'],['1.1.09','Pagamentos e recebimentos por outro meio (a identificar)','A'],
 ['1.2','Ativo não circulante — imobilizado','A'],['1.2.01','Veículos','A'],['1.2.02','Máquinas e equipamentos','A'],['1.2.03','Móveis e utensílios','A'],
 ['2','PASSIVO','P'],['2.1','Passivo circulante','P'],['2.1.01','Fornecedores e contas a pagar','P'],['2.1.02','Tributos sobre vendas a recolher','P'],['2.1.02.01','ICMS próprio a recolher','P'],['2.1.02.02','ICMS DIFAL/FCP a recolher','P'],['2.1.02.03','PIS a recolher','P'],['2.1.02.04','COFINS a recolher','P'],['2.1.02.05','Simples Nacional (DAS) a recolher','P'],['2.1.03','IRPJ e CSLL a recolher','P'],['2.1.03.01','IRPJ a recolher','P'],['2.1.03.02','CSLL a recolher','P'],
 ['3','PATRIMÔNIO LÍQUIDO','P'],['3.1','Capital social','P'],['3.1.01','Capital integralizado','P'],['3.9','Saldos de abertura','P'],['3.9.01','Saldos de abertura (implantação)','P'],['3.8','Resultado do período','P'],
 ['4','RECEITAS','R'],['4.1','Receita bruta de vendas','R'],['4.1.01','Vendas Mercado Livre','R'],['4.1.02','Vendas Shopee','R'],['4.1.03','Vendas Magalu','R'],['4.1.04','Vendas diretas (atacado)','R'],['4.1.09','Vendas outros canais','R'],
 ['4.2','(−) Deduções da receita','R'],['4.2.01','PIS e COFINS','R'],['4.2.02','ICMS e DIFAL (GNRE/DARE)','R'],['4.2.03','Devoluções de vendas','R'],['4.2.04','Tributos sobre vendas (provisão)','R'],['4.2.04.01','ICMS próprio sobre vendas','R'],['4.2.04.02','ICMS DIFAL e FCP sobre vendas','R'],['4.2.04.03','PIS sobre vendas','R'],['4.2.04.04','COFINS sobre vendas','R'],['4.2.04.05','Simples Nacional (DAS) sobre vendas','R'],['4.2.05','Simples Nacional (DAS)','R'],
 ['4.3','Receitas financeiras e outras','R'],['4.3.01','Rendimentos de aplicações','R'],['4.3.02','Outras receitas','R'],
 ['5','CUSTOS','D'],['5.1','Custo das vendas','D'],['5.1.01','Custo das mercadorias vendidas (CMV)','D'],['5.1.02','Embalagens','D'],
 ['6','DESPESAS','D'],['6.1','Despesas de venda','D'],['6.1.01','Tarifas de marketplace','D'],['6.1.02','Fretes e logística','D'],['6.1.03','Marketing e anúncios','D'],
 ['6.2','Pessoal','D'],['6.2.01','Salários e encargos','D'],['6.2.02','Pró-labore','D'],
 ['6.3','Administrativas','D'],['6.3.01','Aluguel','D'],['6.3.02','Água, luz e internet','D'],['6.3.03','Contabilidade','D'],['6.3.04','Serviços de terceiros','D'],['6.3.05','Material de uso e consumo','D'],['6.3.06','Sistemas e softwares','D'],['6.3.07','Seguros','D'],['6.3.08','Reembolsos de despesas','D'],
 ['6.4','Impostos e taxas','D'],['6.4.01','Impostos e taxas','D'],['6.5','Despesas financeiras','D'],['6.5.01','Tarifas bancárias','D'],['6.5.02','Juros e multas','D'],['6.8','Tributos sobre o lucro','D'],['6.8.01','IRPJ, CSLL e outros DARF federais','D'],['6.8.02','Provisão para IRPJ (lucro presumido)','D'],['6.8.03','Provisão para CSLL (lucro presumido)','D'],['6.9','Outras despesas','D'],['6.9.01','Outras despesas','D'],
 ['9','CONTAS TRANSITÓRIAS','A'],['9.1','Transitórias','A'],['9.1.01','Movimentos bancários a classificar','A']];
const CAT={'Compra de mercadorias':'1.1.04','Mercadorias para revenda':'1.1.04','Simples Nacional (DAS)':'4.2.05','Embalagens':'5.1.02','ICMS DIFAL / GNRE':'4.2.02','PIS e COFINS':'4.2.01','Impostos e taxas':'6.4.01','Imobilizado · veículos':'1.2.01','Máquinas e equipamentos':'1.2.02','Móveis e utensílios':'1.2.03',
 'Aluguel':'6.3.01','Pró-labore':'6.2.02','Salários e encargos':'6.2.01','Contabilidade':'6.3.03','Serviços de terceiros':'6.3.04','Material de uso e consumo':'6.3.05','Sistemas e softwares':'6.3.06','Água, luz e internet':'6.3.02','Seguros':'6.3.07',
 'Reembolso de despesas':'6.3.08','Tarifas bancárias':'6.5.01','Empréstimos e juros':'6.5.02','Fretes e logística':'6.1.02','Marketing e anúncios':'6.1.03','Tarifas de marketplace':'6.1.01','Outras despesas':'6.9.01',
 'Aporte de capital':'3.1.01','Aporte de sócios':'3.1.01','Outras receitas':'4.3.02','Rendimentos de aplicações':'4.3.01','Estorno / devolução':'4.3.02','Empréstimo recebido':'2.1.01'};
// Sem vínculo salvo nem nome padrão, a conta sai do nome da categoria (cada empresa batiza as suas: "Salários", "Luz"…).
const PELO_NOME=[[/mercadoria|revenda/,'1.1.04'],[/simples nacional|\bdas\b/,'4.2.05'],[/icms|difal|gnre/,'4.2.02'],[/tarifa.*banc|banc.*tarifa/,'6.5.01'],[/tarifa|comiss/,'6.1.01'],[/frete|coleta|transport/,'6.1.02'],[/marketing|anuncio|publicidade|propaganda/,'6.1.03'],[/embalage/,'5.1.02'],
 [/pro.?labore/,'6.2.02'],[/salari|folha|encargo|fgts|inss|ferias/,'6.2.01'],[/alugu|condominio/,'6.3.01'],[/\bluz\b|energia|agua|internet|telefon/,'6.3.02'],[/contab|honorario/,'6.3.03'],[/sistema|software|assinatura/,'6.3.06'],[/seguro/,'6.3.07'],[/juro|multa/,'6.5.02']];
const contaCat=c=>{const m=db.gerencial?.contabil?.mapa?.[c]||CAT[c];if(m)return m;const n=normalized(c||'');return PELO_NOME.find(([re])=>re.test(n))?.[1]||'6.9.01'};
const PLAT={'Mercado Livre':'01','Shopee':'02','Magalu':'03'};const pl=p=>PLAT[p]||'09';

// ─────────────── Tributos sobre vendas (competência) ───────────────
// Provisiona ICMS/DIFAL/PIS/COFINS pela alíquota efetiva do escritório (tributos ÷ receita do balancete do mês);
// sem balancete no mês, usa a última alíquota conhecida. Os pagamentos (GNRE/DARE/DARF de PIS-COFINS) baixam a provisão.
// No Simples Nacional (regime cadastrado em Regras fiscais) a provisão é o DAS sobre a receita (Anexo I, comércio) mais o
// DIFAL por UF: sem ICMS próprio, PIS, COFINS, IRPJ e CSLL separados (estão dentro do DAS).
const cfg={provisao:true};try{Object.assign(cfg,JSON.parse(localStorage.getItem('eb_contab')||'{}'))}catch{}
function aliquotas(meses){const out=new Map();let ult=null;for(const m of meses){let r=null;try{const d=window.Gestao?.dreMes?.(m);if(d?.fonte==='balancete'&&d.v?.receita>0)r=-(d.v.impostos||0)/d.v.receita}catch{}if(r!=null&&r>0&&r<0.6){ult={r,m,fonte:'balancete'};out.set(m,ult)}else if(ult)out.set(m,{r:ult.r,m:ult.m,fonte:'estimada'})}return out}
const TRIB=new Set(['ICMS DIFAL / GNRE','PIS e COFINS']);
const simples=()=>/simples/i.test(String(db.gerencial?.fiscal?.regime||window.Marca?.regime?.()||''));
const ehDas=c=>/simples nacional|\bdas\b/i.test(c||'');
const ehTrib=c=>TRIB.has(c)||/difal|gnre/i.test(c||'')||(simples()&&ehDas(c));
// Anexo I (comércio, LC 123/2006 com a LC 155/2016): [receita bruta de 12 meses até, alíquota nominal %, parcela a deduzir].
const ANEXO1=[[180000,4,0],[360000,7.3,5940],[720000,9.5,13860],[1800000,10.7,22500],[3600000,14.3,87300],[4800000,19,378000]];
function aliqSimples(rbt12){if(!(rbt12>0))return 0.04;const f=ANEXO1.find(x=>rbt12<=x[0])||ANEXO1[5];return Math.max(0,(rbt12*f[1]/100-f[2])/rbt12)}
const provisaoOn=()=>db.gerencial?.contabil?.provisao??cfg.provisao;
const UFS=['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
const NOME_UF={ALAGOAS:'AL',PIAUI:'PI',' PI ':'PI'};
// UF de uma guia (GNRE/DARE/DUA): "SEFAZ-RJ/GNRE", "GNRE-PA", "GNRE ALAGOAS ONLINE", "SEFAZ-SC/DARE"…
function ufGuia(txt){const t=' '+String(txt||'').toUpperCase()+' ';const m=t.match(/SEFAZ[- ]?([A-Z]{2})\b|GNRE[- ]([A-Z]{2})\b|\b([A-Z]{2})[- ]SEFAZ\b|SEFAZ ([A-Z]{2})\b/);const u=m&&(m[1]||m[2]||m[3]||m[4]);if(u&&UFS.includes(u))return u;for(const [k,v] of Object.entries(NOME_UF))if(t.includes(k))return v;return null}
// Conta do passivo baixada por um pagamento de tributo; PIS e COFINS vêm juntos no DARF e são rateados.
/* UF do emitente (Regras fiscais). Vazia enquanto a empresa não preencher: nada de estado fixo no código. */
const ufEmit=()=>String(window.Marca?.uf?.()||db.gerencial?.fiscal?.uf||'').toUpperCase();
function contaTrib(c,txt){if(!(provisaoOn()&&ehTrib(c)))return contaCat(c);if(ehDas(c))return '2.1.02.05';if(c==='PIS e COFINS')return 'PC';const u=ufGuia(txt),ue=ufEmit();return u&&ue&&u===ue?'2.1.02.01':'2.1.02.02.'+(u||'99')}
// Guia de DIFAL sem UF no histórico ("Secretaria da Fazenda"): rateada pelas UFs provisionadas na competência anterior.
let difalUF=new Map();
const mesAnt=d=>{const [y,mo]=d.split('-').map(Number);return mo===1?`${y-1}-12`:`${y}-${String(mo-1).padStart(2,'0')}`};
function rateioDifal(v,d){const x=d&&(difalUF.get(mesAnt(d))||difalUF.get(d.slice(0,7))),l=Object.entries(x||{}).filter(([,y])=>y>0),t=l.reduce((a,[,y])=>a+y,0);if(!t)return [['2.1.02.02.99',v]];
 let resto=Math.round(v*100)/100;return l.map(([u,y],i)=>{const p=i===l.length-1?resto:Math.round(v*y/t*100)/100;resto=Math.round((resto-p)*100)/100;return ['2.1.02.02.'+u,p]})}
const linhasTrib=(conta,v,d)=>{if(conta==='2.1.02.02.99')return rateioDifal(v,d);if(conta!=='PC')return [[conta,v]];const pis=Math.round(v*65/365*100)/100;return [['2.1.02.03',pis],['2.1.02.04',Math.round((v-pis)*100)/100]]};
// Tributos de cada venda pelas mesmas regras do emissor de NF-e (Parametrização fiscal): ICMS próprio pela alíquota
// interestadual (4% importados; 7% N/NE/CO/ES; 12% S/SE) ou interna na UF do emitente; DIFAL + FCP ao destino para não contribuinte;
// PIS e COFINS como o escritório apura: sobre a receita menos o ICMS próprio.
const ALIQ_INT={AC:19,AL:19,AM:20,AP:18,BA:20.5,CE:20,DF:20,ES:17,GO:19,MA:23,MG:18,MS:17,MT:17,PA:19,PB:20,PE:20.5,PI:22.5,PR:19.5,RJ:20,RN:20,RO:19.5,RR:20,RS:17,SC:17,SE:19,SP:18,TO:20};
const INTER7=new Set(['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MS','MT','PA','PB','PE','PI','RN','RO','RR','SE','TO']),IMPORT=new Set([1,2,3,8]),FCP0={AL:1,RJ:2};
function tributosMes(orders,origem,diretas=new Map()){const F=db.gerencial?.fiscal||{},pu=F.por_uf||{},r2=v=>Math.round(v*100)/100,out=new Map();
 const ue=ufEmit(),intUF=Number(F.aliq_icms_interna)||ALIQ_INT[ue]||18,pis=(Number(F.aliq_pis)||0.65)/100,cof=(Number(F.aliq_cofins)||3)/100,og0=Number(F.origem_padrao??5);
 for(const o of orders){const m=o.date.slice(0,7),U=String(o.state||o.customer?.state||ue||'').toUpperCase(),g=Number(o.gross)||0;if(!g)continue;
  const x=out.get(m)||{receita:0,icms:0,difal:{},pis:0,cofins:0};x.receita+=g;const itens=(o.items||[]).filter(i=>Number(i.qty)*Number(i.price)>0),soma=itens.reduce((s,i)=>s+i.qty*i.price,0);
  const partes=itens.length?itens.map(i=>({og:origem.get(String(i.sku||'').trim())??og0,v:g*i.qty*i.price/soma})):[{og:og0,v:g}];
  const interno=!U||U===ue,interna=pu[U]?.interna??(F.aliquotas||{})[U]??ALIQ_INT[U]??18,fcp=pu[U]?.fcp??FCP0[U]??0,contrib=String(o.customer?.doc||'').replace(/\D/g,'').length===14&&o.customer?.ie;
  for(const p of partes){const inter=interno?intUF:IMPORT.has(Number(p.og))?4:(pu[U]?.inter||(INTER7.has(U)?7:12));x.icms+=r2(p.v*inter/100);
   if(!interno&&!contrib&&pu[U]?.difal!==false)x.difal[U]=(x.difal[U]||0)+r2(p.v*(Math.max(0,interna-inter)+fcp)/100)}
  out.set(m,x)}
 for(const x of out.values()){const b=x.receita-x.icms;x.pis=r2(b*pis);x.cofins=r2(b*cof)}
 // DAS: alíquota efetiva do Anexo I pela receita dos 12 meses anteriores (início de atividade: média dos meses × 12),
 // ou a fixada em Regras fiscais. A base do DAS inclui as vendas diretas (atacado) faturadas.
 for(const [m,v] of diretas){const x=out.get(m)||{receita:0,icms:0,difal:{},pis:0,cofins:0};x.diretas=v;out.set(m,x)}
 const ms=[...out.keys()].sort(),fixa=Number(F.aliq_simples),rs=x=>x.receita+(x.diretas||0);
 for(const [i,m] of ms.entries()){const x=out.get(m),ant=ms.slice(Math.max(0,i-12),i).filter(k=>k>=mesMenos(m,12)),soma=ant.reduce((a,k)=>a+rs(out.get(k)),0);
  x.rbt12=ant.length>=12?soma:ant.length?soma/ant.length*12:rs(x)*12;x.aliqDas=fixa>0?fixa/100:aliqSimples(x.rbt12);x.das=r2(rs(x)*x.aliqDas)}
 return out}
const mesMenos=(m,n)=>{const [y,mo]=m.split('-').map(Number),d=new Date(y,mo-1-n,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
function creditoCompras(){const F=db.gerencial?.fiscal||{};if(Number(F.credito_icms_compras)>0)return {r:Number(F.credito_icms_compras)/100,fonte:'parametrização'};
 const meses=[...new Set((db.accLines||[]).map(l=>l.month))].sort().reverse();
 for(const m of meses){const L=(db.accLines||[]).filter(l=>l.month===m&&String(l.conta||'').split('.').length>=5),e=L.find(l=>/ESTOQUE DE MERCADORIA/i.test(l.descricao||'')),c=L.find(l=>/CUSTO DAS MERCADORIAS VENDIDAS/i.test(l.descricao||''));
  if(!e||!(Number(e.debito)>1000))continue;const r=(Number(e.credito)-(Number(c?.debito)||0))/Number(e.debito);if(r>0.03&&r<0.2)return {r,fonte:'balancete de '+m.slice(5)+'/'+m.slice(0,4)}}
 return {r:0.12,fonte:'padrão 12%'}}
// Calibração pelo que o escritório escriturou (balancete): fator por componente; meses sem balancete usam o último fator.
function escritorioTrib(m){const L=(db.accLines||[]).filter(l=>l.month===m&&(l.kind||'balancete')==='balancete'&&/^3\.1\.02\.02\.\d/.test(l.conta||''));if(!L.length)return null;
 const v=re=>L.filter(l=>re.test(l.descricao||'')).reduce((s,l)=>s+(Number(l.debito)||0)-(Number(l.credito)||0),0);return {difal:v(/DIFAL|FCP|FUNDO/i),icms:v(/^ICMS(?!.*(DIFAL|FCP))/i),pis:v(/^PIS/i),cofins:v(/^COFINS/i),das:v(/SIMPLES|\bDAS\b/i)}}

// ─────────────── Geração do diário ───────────────
let cache=null;let aliqCache=new Map(),tribInfo=new Map(),credInfo=null;
function contas(){const m=new Map(PLANO.map(([c,n,t])=>[c,{c,n,t}]));for(const u of [...UFS.filter(u=>u!==ufEmit()),'99'])m.set('2.1.02.02.'+u,{c:'2.1.02.02.'+u,n:u==='99'?'DIFAL a recolher · UF a identificar':'DIFAL/FCP a recolher · '+u,t:'P'});let i=1,j=1;
 for(const a of db.bankAccounts||[]){const cod=a.tipo==='aplicacao'?`1.1.02.${String(j++).padStart(2,'0')}`:`1.1.01.${String(i++).padStart(2,'0')}`;m.set(cod,{c:cod,n:a.nome,t:'A',banco:a.id})}
 // Personalização do plano (gerencial.plano): nomes, contas novas e contas removidas.
 const p=db.gerencial?.plano||{};for(const [c,n] of Object.entries(p.nomes||{}))if(m.has(c))m.get(c).n=n;for(const [c,x] of Object.entries(p.novas||{}))m.set(c,{c,n:x.n,t:x.t||'D',nova:true});for(const c of p.removidas||[])if(!m.get(c)?.banco)m.delete(c);return m}
function diario(){const posEstoque=Math.round((window.Estoque?.lista?.()||[]).filter(p=>!p.ignorar&&p.formato!=='V'&&Number(p.saldo)>0&&Number(p.custo)>0).reduce((s,p)=>s+Number(p.saldo)*Number(p.custo),0)*100)/100;const k=[posEstoque,db.gerencial?.contabil?.custo_cmv,JSON.stringify(db.gerencial?.fiscal||{}),(db.accLines||[]).length,(window.VendaDireta?.vendas?.()||[]).length,(window.VendaDireta?.titulos?.()||[]).filter(r=>r.status==='recebido').length,provisaoOn(),db.gerencial?.contabil?.aliq_efetiva,JSON.stringify(db.gerencial?.contabil?.mapa||{}),JSON.stringify(db.gerencial?.plano||{}),db.orders.length,(db.bankTx||[]).length,(db.payables||[]).length,(db.purchases||[]).length,(db.bankAccounts||[]).length,(window.Estoque?.lista?.()||[]).length].join('|');if(cache?.k===k)return cache.v;
 const plano=contas(),banco=new Map([...plano.values()].filter(x=>x.banco).map(x=>[x.banco,x.c])),L=[];
 const lanc=(d,hist,orig,linhas)=>{linhas=linhas.filter(([,v])=>Math.abs(v)>=0.005);if(linhas.length)L.push({d,hist,orig,l:linhas})}; // l: [conta, valor>0 débito / <0 crédito]
 const par=(d,hist,orig,deb,cred,v)=>{v=Math.round(v*100)/100;if(!v)return;if(v<0){[deb,cred]=[cred,deb];v=-v}lanc(d,hist,orig,[[deb,v],[cred,-v]])};
 // Saldos de abertura das contas bancárias e aplicações (na data do saldo inicial).
 const invConta=a=>banco.get(a.id),iniCorrentes=(db.bankAccounts||[]).filter(a=>a.tipo!=='aplicacao'&&a.dataSaldoInicial).map(a=>a.dataSaldoInicial).sort()[0]||'';
 for(const a of db.bankAccounts||[]){if(!a.dataSaldoInicial)continue;const c=banco.get(a.id);
  if(a.tipo==='aplicacao'){// Aplicação: o saldo do extrato já inclui aplicações e rendimentos até a data; separamos o que veio da conta corrente.
   const aplicado=(db.bankTx||[]).filter(t=>t.status==='conciliado'&&t.vinculo?.tipo==='aplicacao'&&t.origem!=='espelho'&&t.data<=a.dataSaldoInicial&&destinoAplic(t,a)).reduce((s,t)=>s-t.valor,0);
   // Tudo que foi aplicado saiu da conta corrente (lançado abaixo); a diferença até o extrato são os rendimentos acumulados.
   // Aplicação que já existia quando o Jarvis começou (saldo na mesma data ou antes das contas correntes e nada aplicado
   // por elas): o saldo é de abertura, não rendimento.
   if(!aplicado&&a.dataSaldoInicial<=iniCorrentes){par(a.dataSaldoInicial,`Saldo de abertura · ${a.nome}`,{tipo:'abertura',id:a.id},c,'3.9.01',a.saldoInicial||0);continue}
   par(a.dataSaldoInicial,`Rendimentos acumulados até ${new Date(a.dataSaldoInicial+'T12:00:00').toLocaleDateString('pt-BR')} · ${a.nome} (diferença do extrato)`,{tipo:'rendimento',id:a.id},c,'4.3.01',a.saldoInicial-aplicado)}
  else par(a.dataSaldoInicial,`Saldo de abertura · ${a.nome}`,{tipo:'abertura',id:a.id},c,'3.9.01',a.saldoInicial||0)}
 function destinoAplic(t,a){const d=normalized(t.descricao);if(/cdb/.test(d))return /cdb/.test(normalized(a.nome));if(/mapfre|frerffi|fundo|kinea|actv|^int (aplicacao|resgate)/.test(d))return /fundo|mapfre/.test(normalized(a.nome));return false}
 const aplicDe=t=>{const a=(db.bankAccounts||[]).find(x=>x.tipo==='aplicacao'&&destinoAplic(t,x));return a?banco.get(a.id):'1.1.02.99'};
 // Provisões primeiro: a guia de DIFAL sem UF, lançada adiante, é rateada pelas UFs provisionadas.
 tribInfo=new Map();difalUF=new Map();const sn=simples();
 if(provisaoOn()){const rec=new Map();for(const o of db.orders){const m=o.date.slice(0,7);rec.set(m,(rec.get(m)||0)+o.gross)}const meses=[...rec.keys()].sort();aliqCache=aliquotas(meses);const fixa=Number(db.gerencial?.contabil?.aliq_efetiva);if(fixa>0)for(const m of meses)aliqCache.set(m,{r:fixa/100,m,fonte:'parametrização'});
  const origem=new Map();for(const p of window.Estoque?.lista?.()||[])if(p.origem!=null&&p.origem!=='')origem.set(String(p.id).trim(),Number(p.origem));
  const vd=new Map();if(sn)for(const v of window.VendaDireta?.vendas?.()||[])if(v.status==='faturado'&&v.emissao){const m=String(v.emissao).slice(0,7);vd.set(m,(vd.get(m)||0)+(Number(v.total)||0))}
  const tm=tributosMes(db.orders,origem,vd);let fat={icms:1,difal:1,pis:1,cofins:1,das:1,m:null};const COMP=sn?['das','difal']:['icms','difal','pis','cofins'];
  for(const m of meses){const t=tm.get(m);if(!t)continue;const dif=Object.values(t.difal).reduce((s,v)=>s+v,0),e=escritorioTrib(m);
   let exato=null;if(e){const f=(a,b,lim)=>b>0&&a>0?(lim?Math.min(1.35,Math.max(0.75,a/b)):a/b):1;fat={icms:f(e.icms,t.icms,1),difal:f(e.difal,dif,1),pis:f(e.pis,t.pis,1),cofins:f(e.cofins,t.cofins,1),das:f(e.das,t.das,1),m};exato={icms:f(e.icms,t.icms),difal:f(e.difal,dif),pis:f(e.pis,t.pis),cofins:f(e.cofins,t.cofins),das:f(e.das,t.das),m}}
   // No mês com balancete o valor é o do escritório; nos demais, o fator (limitado) do último balancete.
   let k={...(exato||fat)};const a=aliqCache.get(m);if(fixa>0&&a){const tot={icms:t.icms,difal:dif,pis:t.pis,cofins:t.cofins,das:t.das},bruto=COMP.reduce((x,c)=>x+tot[c]*k[c],0),alvo=t.receita*a.r;if(bruto>0)for(const c of COMP)k[c]*=alvo/bruto}
   const p2=x=>(x*100).toFixed(2).replace('.',',')+'%',base=sn?`Simples Nacional, DAS ${p2(t.aliqDas*k.das)} (${Number(db.gerencial?.fiscal?.aliq_simples)>0?'Regras fiscais':'Anexo I '+p2(t.aliqDas)}`:'regras da NF-e',cal=k.m?` calibrad${sn?'o':'as'} pelo balancete de ${k.m.slice(5)}/${k.m.slice(0,4)}`:'',ref=k.m===m?'conforme balancete do escritório':base+cal+(sn?')':''),mm=`${m.slice(5)}/${m.slice(0,4)}`,o={tipo:'provisao',id:m},d=fim(m);
   if(sn)par(d,`Simples Nacional (DAS) sobre vendas de ${mm} · ${ref}`,o,'4.2.04.05','2.1.02.05',t.das*k.das);else par(d,`ICMS próprio sobre vendas de ${mm} · ${ref}`,o,'4.2.04.01','2.1.02.01',t.icms*k.icms);
   const pu={};for(const [u,v] of Object.entries(t.difal).sort()){pu[u]=v*k.difal;par(d,`ICMS DIFAL/FCP · ${u} · vendas de ${mm}`,o,'4.2.04.02','2.1.02.02.'+u,v*k.difal)}difalUF.set(m,pu);
   if(!sn){par(d,`PIS sobre vendas de ${mm} · ${ref}`,o,'4.2.04.03','2.1.02.03',t.pis*k.pis);par(d,`COFINS sobre vendas de ${mm} · ${ref}`,o,'4.2.04.04','2.1.02.04',t.cofins*k.cofins)}
   tribInfo.set(m,sn?{ref,simples:true,receita:t.receita+(t.diretas||0),aliqDas:t.aliqDas*k.das,rbt12:t.rbt12,das:t.das*k.das,difal:dif*k.difal,icms:0,pis:0,cofins:0}:{ref,receita:t.receita,icms:t.icms*k.icms,difal:dif*k.difal,pis:t.pis*k.pis,cofins:t.cofins*k.cofins})}
  // IRPJ e CSLL no lucro presumido (comércio): 8% e 12% da receita bruta menos devoluções; adicional de 10% do IRPJ
  // sobre a base que passa de R$ 20 mil no mês. É exatamente como o escritório provisiona mês a mês.
  const Fz=db.gerencial?.fiscal||{};if(!sn&&/presumido/i.test(Fz.regime||'Lucro Presumido')){const dev=new Map();for(const n of db.purchases||[])if(n.tipo==='devolucao'&&n.emissao&&!/rejeit|cancel|denegad/i.test(n.situacao||'')){const m=n.emissao.slice(0,7);dev.set(m,(dev.get(m)||0)+(Number(n.valor)||0))}
   const pi=(Number(Fz.presuncao_irpj)||8)/100,pc=(Number(Fz.presuncao_csll)||12)/100;
   for(const m of meses){const b=Math.max(0,(rec.get(m)||0)-(dev.get(m)||0)),bi=b*pi,irpj=bi*0.15+Math.max(0,bi-20000)*0.10,csll=b*pc*0.09,mm=`${m.slice(5)}/${m.slice(0,4)}`,o={tipo:'provisao',id:m};
    par(fim(m),`Provisão IRPJ de ${mm} · presumido ${Math.round(pi*100)}% da receita`,o,'6.8.02','2.1.03.01',irpj);par(fim(m),`Provisão CSLL de ${mm} · presumido ${Math.round(pc*100)}% da receita`,o,'6.8.03','2.1.03.02',csll);
    const ti=tribInfo.get(m);if(ti)Object.assign(ti,{irpj,csll})}}}
 // Extrato bancário (regime de caixa das contas bancárias).
 const pagosPeloBanco=new Set(),recebidosPeloBanco=new Set(),darfs=[];
 for(const t of db.bankTx||[]){if(t.origem==='espelho'||t.status==='ignorado')continue;const c=banco.get(t.contaId);if(!c)continue;const v=t.vinculo||{},h=`${t.descricao}`,o={tipo:'extrato',id:t.id};
  if(t.status!=='conciliado'){par(t.data,h+' (a classificar)',o,c,'9.1.01',t.valor);continue}
  if(v.tipo==='recebivel'){for(const id of v.ids||[v.id])recebidosPeloBanco.add(id);par(t.data,`Recebimento · ${v.desc||h}`,o,c,'1.1.05',t.valor);continue}
  if(v.tipo==='payable'){for(const id of v.ids||[v.id])pagosPeloBanco.add(id);o.forn=(db.payables||[]).find(p=>p.id===(v.ids?.[0]||v.id))?.fornecedor||v.desc||'';par(t.data,`Pagamento · ${v.desc||h}`,o,c,'2.1.01',t.valor);continue}
  if(v.tipo==='aplicacao'){par(t.data,`${t.valor<0?'Aplicação':'Resgate'} · ${h}`,o,c,aplicDe(t),t.valor);continue}
  if(v.tipo==='transferencia'){const d=normalized((v.desc||'')+' '+h);const outra=/mercado ?pago|mercado livre/.test(d)?'1.1.03.01':/shopee/.test(d)?'1.1.03.02':/magalu|magazine luiza/.test(d)?'1.1.03.03':/saque|caixa/.test(d)?'1.1.01.90':'1.1.01.99';par(t.data,v.desc||h,o,c,outra,t.valor);continue}
  // Despesa ou receita direto no extrato.
  if(v.tipo==='despesa'&&String(v.id||'').startsWith('EXT-'))pagosPeloBanco.add(v.id);
  const darf=/darf|receita federal/i.test(h+' '+(v.desc||''))&&/impostos e taxas/i.test(v.categoria||t.categoria||'');
  if(darf){darfs.push({t,c,h:v.desc||h,o});continue}
  const ct=contaTrib(v.categoria||t.categoria,h+' '+(v.desc||''));
  lanc(t.data,v.desc||h,o,[[c,t.valor],...linhasTrib(ct,-t.valor,t.data)])}
 // Títulos (competência): notas de entrada e recorrentes/lançamentos entram em Fornecedores; os criados pelo extrato já estão acima.
 for(const p of db.payables||[]){if(p.status==='cancelado'||p.origem==='extrato')continue;// Recorrentes (aluguel, pró-labore, contador…) são da competência do vencimento, não da data em que foram criados.
  const d=p.origem==='recorrente'?p.vencimento:(p.emissao||p.vencimento);if(!d)continue;const o={tipo:'titulo',id:p.id};
  const vt=Math.round((p.valor+(p.juros||0)-(p.desconto||0))*100)/100;o.forn=p.fornecedor||p.descricao||'';
  lanc(d,`${p.fornecedor||p.descricao}${p.documento?' · doc '+p.documento:''}${p.parcelas>1?` · ${p.parcela}/${p.parcelas}`:''}`,o,[...linhasTrib(contaTrib(p.categoria,(p.fornecedor||'')+' '+(p.descricao||'')),vt,d),['2.1.01',-vt]]);
  if(p.status==='pago'&&!pagosPeloBanco.has(p.id)&&p.pagoEm)par(p.pagoEm,`Pagamento sem extrato · ${p.fornecedor||p.descricao}${p.conta?' · '+p.conta:''}`,o,'2.1.01','1.1.09',p.valorPago||p.valor)}
 // Devoluções de clientes (notas de entrada de devolução).
 for(const n of db.purchases||[])if(n.tipo==='devolucao'&&n.emissao&&!/rejeit|cancel|denegad/i.test(n.situacao||''))par(n.emissao,`Devolução de venda · NF ${n.numero||''} · ${n.fornecedor||''}`,{tipo:'nota',id:n.id},'4.2.03','1.1.03.09',n.valor);
 // Crédito de ICMS das notas de compra de mercadorias: sai do estoque para ICMS a recuperar e compensa o ICMS próprio do mês.
 credInfo=null;if(provisaoOn()&&!sn){const cr=creditoCompras(),porMes=new Map();credInfo=cr;
  for(const n of db.purchases||[]){if(n.tipo==='devolucao'||!n.emissao||/rejeit|cancel|denegad/i.test(n.situacao||'')||String(n.fornecedorDoc||n.fornecedor_doc||'').replace(/\D/g,'').length!==14)continue;const v=Math.round((Number(n.valor)||0)*cr.r*100)/100;if(!v)continue;
   par(n.emissao,`Crédito de ICMS · NF ${n.numero||''} · ${n.fornecedor||''} (${(cr.r*100).toFixed(2).replace('.',',')}%)`,{tipo:'nota',id:n.id,forn:n.fornecedor||''},'1.1.06','1.1.04',v);const m=n.emissao.slice(0,7);porMes.set(m,(porMes.get(m)||0)+v)}
  for(const [m,v] of porMes)par(fim(m),`Compensação do crédito de ICMS das compras de ${m.slice(5)}/${m.slice(0,4)}`,{tipo:'provisao',id:m},'2.1.02.01','1.1.06',v)}
 // Vendas: receita bruta, tarifa e frete do vendedor por canal; CMV pelos itens × custo.
 const custo=new Map((db.products||[]).map(p=>[p.id,Number(p.custo)||0]));for(const p of window.Estoque?.lista?.()||[])if(Number(p.custo))custo.set(p.id,Number(p.custo));
 // Base do CMV: custo médio ponderado das notas de entrada até o fim do mês da venda (como o escritório valora o estoque);
 // SKU sem nota de entrada usa o custo do cadastro. Alternativa na parametrização: só o custo do cadastro (Bling).
 const medioMes=new Map();if((db.gerencial?.contabil?.custo_cmv||'medio_nf')==='medio_nf'){const ent=[];
  for(const n of db.purchases||[]){if(n.tipo==='devolucao'||!n.emissao||/rejeit|cancel|denegad/i.test(n.situacao||'')||String(n.fornecedorDoc||n.fornecedor_doc||'').replace(/\D/g,'').length!==14)continue;for(const it of n.itens||[])if(Number(it.qtd)>0&&Number(it.total)>0)ent.push([n.emissao.slice(0,7),String(it.sku||'').trim(),Number(it.qtd),Number(it.total)])}
  ent.sort((a,b)=>a[0].localeCompare(b[0]));const acc=new Map(),ms=[...new Set([...db.orders.map(o=>o.date.slice(0,7)),...(window.VendaDireta?.vendas?.()||[]).map(v=>String(v.emissao||'').slice(0,7))])].filter(Boolean).sort();let i=0;
  for(const m of ms){while(i<ent.length&&ent[i][0]<=m){const [,s,q,v]=ent[i++];const a=acc.get(s)||{q:0,v:0};a.q+=q;a.v+=v;acc.set(s,a)}for(const [s,a] of acc)medioMes.set(m+'|'+s,a.v/a.q)}}
 const custoDe=(s,m)=>medioMes.get(m+'|'+s)??custo.get(s);
 let semCusto=0;
 for(const o of db.orders){const a=`1.1.03.${pl(o.platform)}`,r=`4.1.${pl(o.platform)}`,orig={tipo:'pedido',id:o.id};
  const linhas=[[a,o.gross],[r,-o.gross]];if(o.fee){linhas.push(['6.1.01',o.fee],[a,-o.fee])}// Frete só é custo do vendedor quando vem da API do marketplace; no pedido do Bling é o frete da nota (pago pelo comprador).
  if(o.shipping&&/API/.test(o.source||'')&&!/Bling/.test(o.source||'')){linhas.push(['6.1.02',o.shipping],[a,-o.shipping])}
  lanc(o.date,`Venda ${o.platform} · pedido ${o.id}`,orig,linhas);
  let cmv=0;for(const it of o.items||[]){const c=custoDe(String(it.sku||'').trim(),o.date.slice(0,7));if(c)cmv+=c*(Number(it.qty)||0);else semCusto++}
  if(cmv)par(o.date,`CMV · pedido ${o.id}`,orig,'5.1.01','1.1.04',cmv)}
 // DARF pagos: PIS/COFINS do mês anterior (valor bate com a provisão), IRPJ/CSLL do presumido, ou despesa federal.
 {const presum=provisaoOn()&&!sn&&/presumido/i.test(db.gerencial?.fiscal?.regime||'Lucro Presumido'),perto=(a,b)=>b>0&&Math.abs(a-b)<=Math.max(1,b*0.005);
  for(const {t,c,h,o} of darfs){const v=-t.valor,[y,mo]=t.data.split('-').map(Number),ant=mo===1?`${y-1}-12`:`${y}-${String(mo-1).padStart(2,'0')}`,ti=provisaoOn()?tribInfo.get(ant):null;let l;
   if(ti?.simples&&perto(v,ti.das))l=[['2.1.02.05',v]];
   else if(ti&&perto(v,ti.pis+ti.cofins)){const p=Math.round(v*ti.pis/(ti.pis+ti.cofins)*100)/100;l=[['2.1.02.03',p],['2.1.02.04',Math.round((v-p)*100)/100]]}
   else if(ti&&perto(v,ti.pis))l=[['2.1.02.03',v]];else if(ti&&perto(v,ti.cofins))l=[['2.1.02.04',v]];
   else if(presum){const ref=tribInfo.get(ant)||tribInfo.get(t.data.slice(0,7)),fi=ref?.irpj&&ref?.csll?ref.irpj/(ref.irpj+ref.csll):0.634,p=Math.round(v*fi*100)/100;l=[['2.1.03.01',p],['2.1.03.02',Math.round((v-p)*100)/100]]}
   else l=[['6.8.01',v]];
   lanc(t.data,h,o,[[c,t.valor],...l])}}
 // Vendas diretas faturadas: receita contra clientes (pelas parcelas) e CMV pelos itens.
 for(const vd of window.VendaDireta?.vendas?.()||[]){if(vd.status!=='faturado'||!vd.emissao)continue;const o={tipo:'venda_direta',id:vd.id};par(vd.emissao,`Venda direta nº ${vd.numero} · ${vd.cliente?.fantasia||vd.cliente?.nome||''}`,o,'1.1.05','4.1.04',Number(vd.total)||0);
  let cmvVd=0;for(const it of vd.itens||[])cmvVd+=(custoDe(String(it.sku||'').trim(),String(vd.emissao).slice(0,7))||0)*(Number(it.qtd)||0);if(cmvVd)par(vd.emissao,`CMV · venda direta nº ${vd.numero}`,o,'5.1.01','1.1.04',cmvVd)}
 // Parcela recebida sem movimento no extrato (baixa manual em Contas a receber): sai de Clientes para "outro meio".
 for(const r of window.VendaDireta?.titulos?.()||[])if(r.origem==='venda_direta'&&r.status==='recebido'&&r.recebido_em&&!recebidosPeloBanco.has(r.id))par(r.recebido_em,`Recebimento sem extrato · ${r.cliente||''} · ${r.descricao||''}${r.parcelas>1?` · ${r.parcela}/${r.parcelas}`:''}`,{tipo:'recebivel',id:r.id},'1.1.09','1.1.05',Number(r.valor_recebido)||Number(r.valor)||0);
 // Estoque de abertura (implantação): o Jarvis não conhece o estoque de antes das primeiras notas; a posição de hoje
 // (saldo × custo do Bling), menos as entradas e mais as saídas lançadas até hoje, é o saldo de abertura do estoque.
 if(posEstoque>0&&db.gerencial?.contabil?.estoque_abertura!==false&&L.length){const hoje=new Date().toLocaleDateString('sv-SE'),d0=L.reduce((m,e)=>e.d<m?e.d:m,hoje);let mov=0;for(const e of L)if(e.d<=hoje)for(const [c,v] of e.l)if(c==='1.1.04')mov+=v;
  const ab=Math.round((posEstoque-mov)*100)/100;if(ab>0)par(d0,`Estoque de abertura (implantação) · posição de estoque de hoje (${money(posEstoque)}) menos as entradas e mais as saídas lançadas desde então`,{tipo:'abertura',id:'estoque'},'1.1.04','3.9.01',ab)}
 L.sort((a,b)=>a.d.localeCompare(b.d));cache={k,v:{L,plano,semCusto}};return cache.v}

// ─────────────── Saldos ───────────────
function saldos(ate,desde){const {L,plano}=diario(),s=new Map();const add=(c,campo,v)=>{const parts=c.split('.');for(let i=1;i<=parts.length;i++){const k=parts.slice(0,i).join('.');const x=s.get(k)||{ant:0,deb:0,cred:0};x[campo]+=v;s.set(k,x)}};
 for(const e of L){if(e.d>ate)break;for(const [c,v] of e.l){if(desde&&e.d<desde)add(c,'ant',v);else{add(c,v>0?'deb':'cred',Math.abs(v))}}}
 return {s,plano}}
const mesBR=m=>new Date(m+'-15T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
const natDev=c=>['1','5','6','9'].includes(c[0]);
const fim=m=>{const [y,mm]=m.split('-').map(Number);return new Date(y,mm,0).toLocaleDateString('sv-SE')};
const ui={aba:'balancete',abaPlano:'plano',acumulado:false,conta:null,busca:''};
window.Reiniciar?.registrar(ui,['aba','abaPlano','acumulado','conta','busca']); // estado de tela: volta ao original ao clicar no menu
const periodo=()=>{const ini=ui.acumulado?month.slice(0,4)+'-01-01':month+'-01';return {ini,fim:fim(month)}};
const valorNat=(c,x)=>natDev(c)?x:-x;
const mf=v=>{v=Math.abs(v)<0.005?0:v;return `<span class="${v<0?'red':''}">${money(v)}</span>`};

function balancete(){const {ini,fim:f}=periodo(),{s,plano}=saldos(f,ini);
 const cods=[...s.keys()].filter(c=>plano.has(c)||c.split('.').length<=2).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 const tot={deb:0,cred:0};for(const [c,x] of s)if(!c.includes('.')){tot.deb+=x.deb;tot.cred+=x.cred}
 return `<div class="tablebox"><div class="tabletop"><div><h2>Balancete · ${ui.acumulado?'acumulado de '+month.slice(0,4):mesBR(month)}</h2><p class="caption">Débitos ${money(tot.deb)} = créditos ${money(tot.cred)} ${Math.abs(tot.deb-tot.cred)<0.05?'<span class="badge ok">fechado</span>':'<span class="badge bad">diferença '+money(tot.deb-tot.cred)+'</span>'}</p></div><button class="small" data-ct-csv="balancete">${icon('download')} Exportar</button></div>
 <div class="tablewrap"><table class="ctb"><thead><tr><th>Conta</th><th class="num">Saldo anterior</th><th class="num">Débitos</th><th class="num">Créditos</th><th class="num">Saldo atual</th></tr></thead><tbody>
 ${cods.map(c=>{const x=s.get(c),n=plano.get(c)?.n||c,nivel=c.split('.').length,ant=valorNat(c,x.ant),atual=valorNat(c,x.ant+x.deb-x.cred);if(!x.ant&&!x.deb&&!x.cred)return '';
  return `<tr class="${nivel<=2?'ctbgrupo':'clickrow'} n${nivel}" ${nivel>2?`data-ct-conta="${c}"`:''}><td><span class="mono caption">${c}</span> ${esc(n)}</td><td class="num">${mf(ant)}</td><td class="num">${money(x.deb)}</td><td class="num">${money(x.cred)}</td><td class="num"><strong>${mf(atual)}</strong></td></tr>`}).join('')}</tbody></table></div></div>`}

function dre(){const {ini,fim:f}=periodo(),{s}=saldos(f,ini),mov=c=>{const x=s.get(c);return x?x.deb-x.cred:0};
 const rb=-mov('4.1'),ded=mov('4.2'),rl=rb-ded,cmv=mov('5.1'),lb=rl-cmv,dv=mov('6.1'),pes=mov('6.2'),adm=mov('6.3'),imp=mov('6.4'),out=mov('6.9'),ebitda=lb-dv-pes-adm-imp-out,fin=-mov('4.3')-mov('6.5'),ir=mov('6.8'),res=ebitda+fin-ir;
 const pc=v=>rb?`<span class="caption">${(v/rb*100).toFixed(1).replace('.',',')}%</span>`:'';
 const l=(t,v,cls='',c='')=>`<tr class="${cls}" ${c?`data-ct-conta="${c}"`:''}><td>${t}</td><td class="num">${mf(v)}</td><td class="num">${pc(v)}</td></tr>`;
 return `<div class="grid two"><div class="tablebox"><div class="tabletop"><div><h2>DRE · ${ui.acumulado?'acumulado de '+month.slice(0,4):mesBR(month)}</h2><p class="caption">Gerada pelos lançamentos automáticos. Clique numa linha para ver o razão.</p></div></div><div class="tablewrap"><table class="ctb"><tbody>
 ${l('Receita bruta de vendas',rb,'ctbgrupo')}${l('Mercado Livre',-mov('4.1.01'),'n3 clickrow','4.1.01')}${l('Shopee',-mov('4.1.02'),'n3 clickrow','4.1.02')}${l('Magalu',-mov('4.1.03'),'n3 clickrow','4.1.03')}${l('Vendas diretas (atacado)',-mov('4.1.04'),'n3 clickrow','4.1.04')}${l('Outros canais',-mov('4.1.09'),'n3 clickrow','4.1.09')}
 ${l(simples()?'(−) Deduções (DAS do Simples, DIFAL, devoluções)':'(−) Deduções (ICMS/DIFAL, PIS/COFINS, devoluções)',-ded,'n3')}${l('Receita líquida',rl,'ctbgrupo')}
 ${l('(−) CMV',-mov('5.1.01'),'n3 clickrow','5.1.01')}${l('(−) Embalagens',-mov('5.1.02'),'n3 clickrow','5.1.02')}${l('Lucro bruto',lb,'ctbgrupo')}
 ${l('(−) Tarifas de marketplace',-mov('6.1.01'),'n3 clickrow','6.1.01')}${l('(−) Fretes',-mov('6.1.02'),'n3 clickrow','6.1.02')}${l('(−) Marketing',-mov('6.1.03'),'n3 clickrow','6.1.03')}${l('(−) Pessoal',-pes,'n3')}${l('(−) Administrativas',-adm,'n3')}${l('(−) Impostos e taxas',-imp,'n3')}${l('(−) Outras',-out,'n3')}
 ${l('Resultado operacional',ebitda,'ctbgrupo')}${l('Resultado financeiro',fin,'n3')}${l(simples()?'(−) IRPJ, CSLL e DARF federais <span class="caption">(no Simples, dentro do DAS)</span>':'(−) IRPJ, CSLL e DARF federais',-ir,'n3 clickrow','6.8.01')}${l('Resultado do período',res,'ctbgrupo ctbfinal')}</tbody></table></div></div>
 <div class="card"><h2>Como ler</h2><label class="check-l"><input type="checkbox" class="check" id="ctProv" ${cfg.provisao?'checked':''}> Tributos sobre vendas por competência (${simples()?'DAS do Simples Nacional e DIFAL por UF':'ICMS, DIFAL por UF, PIS e COFINS'}${(t=>t?' · '+(((t.das||0)+t.icms+t.difal+t.pis+t.cofins)/t.receita*100).toFixed(1).replace('.',',')+'% da receita, '+esc(t.ref):'')(tribInfo.get(month))})</label><p class="caption">Desligado, os tributos entram só quando são pagos (${simples()?'DAS e GNRE':'GNRE/DARE'}). O regime vem de Fiscal › Regras › Regras fiscais${simples()?' (Simples Nacional)':''}.</p><p class="caption" style="line-height:1.8">A DRE sai direto do diário: vendas e tarifas pelos pedidos, CMV pelos itens vendidos × custo do produto (Bling/Tabela de preços), notas e títulos pela data de emissão, e o que foi pago direto no banco (GNRE, aluguel, pró-labore…) pela data do extrato.<br><br>Compare com o balancete do escritório em <button class="small quiet" data-nav="contabil">DRE e Contabilidade</button> para achar diferenças de classificação ou de data.${diario().semCusto?`<br><br><span class="gold">${diario().semCusto} item(ns) vendido(s) sem custo cadastrado — o CMV fica subestimado. Cadastre o custo em Cadastros › Produtos › Custos e embalagens.</span>`:''}</p></div></div>`}

function balanco(){const {fim:f}=periodo(),{s}=saldos(f),sal=c=>{const x=s.get(c);return x?x.deb-x.cred:0};
 const res=-(sal('4')+sal('5')+sal('6'));const ativo=sal('1')+sal('9'),passivo=-sal('2'),pl=-sal('3')+res;
 const l=(t,v,cls='',c='')=>`<tr class="${cls}" ${c?`data-ct-conta="${c}"`:''}><td>${t}</td><td class="num">${mf(v)}</td></tr>`;
 const {plano}=diario(),filhos=p=>[...plano.keys()].filter(c=>c.startsWith(p+'.')&&c.split('.').length===p.split('.').length+1&&Math.abs(sal(c))>=0.01);
 const bloco=(p,sinal=1)=>filhos(p).map(c=>{const sub=filhos(c);return l(`<span class="mono caption">${c}</span> ${esc(plano.get(c)?.n||c)}`,sinal*sal(c),sub.length?'n2':'n3 clickrow',sub.length?'':c)+sub.map(x=>l(`<span class="mono caption">${x}</span> ${esc(plano.get(x)?.n||x)}`,sinal*sal(x),'n3 clickrow',x)).join('')}).join('');
 return `<div class="grid two"><div class="tablebox"><div class="tabletop"><h2>Ativo em ${new Date(f+'T12:00:00').toLocaleDateString('pt-BR')}</h2></div><div class="tablewrap"><table class="ctb"><tbody>${bloco('1')}${Math.abs(sal('9'))>=0.01?bloco('9'):''}${l('Total do ativo',ativo,'ctbgrupo ctbfinal')}</tbody></table></div></div>
 <div class="tablebox"><div class="tabletop"><h2>Passivo e patrimônio líquido</h2></div><div class="tablewrap"><table class="ctb"><tbody>${bloco('2',-1)}${l('Total do passivo',passivo,'ctbgrupo')}${bloco('3',-1)}${l('Resultado acumulado (não distribuído)',res,'n3')}${l('Total do patrimônio líquido',pl,'ctbgrupo')}${l('Passivo + PL',passivo+pl,'ctbgrupo ctbfinal')}</tbody></table></div>
 <p class="caption" style="padding:0 18px 16px">${Math.abs(ativo-passivo-pl)<0.05?'✓ Ativo = Passivo + PL':`<span class="red">Diferença ${money(ativo-passivo-pl)}</span>`}</p></div></div>`}

function diarioView(){const {ini,fim:f}=periodo(),{L,plano}=diario(),q=normalized(ui.busca);const l=L.filter(e=>e.d>=ini&&e.d<=f&&(!q||normalized(e.hist).includes(q)));
 return `<div class="crmbar"><div class="searchin">${icon('search')}<input type="search" id="ctBusca" placeholder="Histórico, pedido, fornecedor…" value="${esc(ui.busca)}"></div><button class="small" data-ct-csv="diario">${icon('download')} Exportar diário (CSV para o escritório)</button></div>
 <div class="tablebox"><div class="tabletop"><h2>${l.length.toLocaleString('pt-BR')} lançamento(s)</h2></div><div class="tablewrap"><table><thead><tr><th>Data</th><th>Histórico</th><th>Conta</th><th class="num">Débito</th><th class="num">Crédito</th></tr></thead><tbody>
 ${l.slice(0,400).map(e=>e.l.map(([c,v],i)=>`<tr class="${i?'':'ctbnovo'}"><td>${i?'':new Date(e.d+'T12:00:00').toLocaleDateString('pt-BR')}</td><td>${i?'':esc(e.hist)}</td><td><span class="mono caption">${c}</span> ${esc(plano.get(c)?.n||'')}</td><td class="num">${v>0?money(v):''}</td><td class="num">${v<0?money(-v):''}</td></tr>`).join('')).join('')}</tbody></table></div>${l.length>400?'<p class="caption" style="padding:10px 18px">Mostrando os 400 primeiros — use a busca ou exporte.</p>':''}</div>`}

function razao(c){const {L,plano}=diario(),{ini,fim:f}=periodo();let saldo=0;const linhas=[];
 for(const e of L){if(e.d>f)break;for(const [cc,v] of e.l){if(cc!==c&&!cc.startsWith(c+'.'))continue;if(e.d<ini){saldo+=v;continue}linhas.push({e,v})}}
 const ant=saldo;const rows=linhas.map(({e,v})=>{saldo+=v;return `<tr><td>${new Date(e.d+'T12:00:00').toLocaleDateString('pt-BR')}</td><td>${esc(e.hist)}</td><td class="num">${v>0?money(v):''}</td><td class="num">${v<0?money(-v):''}</td><td class="num">${mf(valorNat(c,saldo))}</td></tr>`});
 modal(`Razão · ${c} ${plano.get(c)?.n||''}`,`<p class="caption">${ui.acumulado?'Acumulado de '+month.slice(0,4):mesBR(month)} · saldo anterior ${money(valorNat(c,ant))} · saldo final ${money(valorNat(c,saldo))} · ${linhas.length} lançamento(s)</p>
 <div class="tablewrap" style="max-height:60vh"><table><thead><tr><th>Data</th><th>Histórico</th><th class="num">Débito</th><th class="num">Crédito</th><th class="num">Saldo</th></tr></thead><tbody>${rows.slice(-1500).join('')||'<tr><td colspan="5" class="empty">Sem lançamentos no período.</td></tr>'}</tbody></table></div>
 <div class="modalfoot"><button data-action="close">Fechar</button></div>`)}

// Conferência: DRE automática × DRE do balancete do escritório, mês a mês, com a diferença de cada linha.
function conferencia(){const meses=[...new Set(db.orders.map(o=>o.date.slice(0,7)))].sort().slice(-7).filter(m=>m<=new Date().toISOString().slice(0,7));
 const aut=m=>{const [y,mm]=m.split('-').map(Number),{s}=saldos(new Date(y,mm,0).toLocaleDateString('sv-SE'),m+'-01'),mv=c=>{const x=s.get(c);return x?x.deb-x.cred:0};const rb=-mv('4.1'),ded=mv('4.2'),cmv=mv('5.1'),com=mv('6.1'),out=mv('6.2')+mv('6.3')+mv('6.4')+mv('6.9');return {rb,ded,cmv,com,out,op:rb-ded-cmv-com-out}};
 const esc_=m=>{try{const d=window.Gestao?.dreMes?.(m);if(d?.fonte!=='balancete')return null;const v=d.v;return {rb:v.receita||0,ded:-(v.impostos||0)-(v.devolucoes||0),cmv:-(v.cmv||0),com:-(v.comerciais||0),out:-(v.trabalhistas||0)-(v.administrativas||0)-(v.outras||0),op:v['=ebitda']||0}}catch{return null}};
 const L=[['rb','Receita bruta'],['ded','Deduções e tributos'],['cmv','CMV'],['com','Despesas comerciais (tarifas, fretes, marketing)'],['out','Demais despesas operacionais'],['op','Resultado operacional (EBITDA)']];
 const cols=meses.map(m=>({m,a:aut(m),e:esc_(m)}));
 return `<div class="notice">Mesma operação, duas visões: a <strong>automática</strong> (pedido a pedido, tarifa real de cada venda, CMV pelo custo do produto) e a do <strong>escritório</strong> (balancete importado em Resultado › Contabilidade › DRE e Contabilidade). Diferenças grandes indicam lançamento em outro mês, tarifa contabilizada por nota de serviço, custo médio diferente ou conta classificada em outra linha — bons temas para a conversa com ${esc(window.Marca?.escritorio?.()||'a contabilidade')}.</div>
 <div class="tablebox"><div class="tablewrap"><table class="ctb"><thead><tr><th>Linha</th>${cols.map(c=>`<th class="num">${new Date(c.m+'-15T12:00:00').toLocaleDateString('pt-BR',{month:'short',year:'2-digit'})}</th>`).join('')}</tr></thead><tbody>
 ${L.map(([k,t])=>`<tr class="ctbgrupo"><td>${t}</td>${cols.map(()=>'<td></td>').join('')}</tr>
  <tr class="n3"><td>Automática</td>${cols.map(c=>`<td class="num">${money(c.a[k])}</td>`).join('')}</tr>
  <tr class="n3"><td>Escritório</td>${cols.map(c=>`<td class="num">${c.e?money(c.e[k]):'<span class="caption">sem balancete</span>'}</td>`).join('')}</tr>
  <tr class="n3"><td>Diferença</td>${cols.map(c=>{if(!c.e)return '<td></td>';const d=c.a[k]-c.e[k],rel=Math.abs(c.e[k])>1?Math.abs(d/c.e[k]):0;return `<td class="num"><span class="${rel>0.1?'red':rel>0.03?'gold':'green'}">${money(d)}</span>${Math.abs(c.e[k])>1?`<br><span class="caption">${(d/c.e[k]*100).toFixed(1).replace('.',',')}%</span>`:''}</td>`}).join('')}</tr>`).join('')}</tbody></table></div></div>`}
// As duas telas (Contabilidade automática e Plano de contas) têm as mesmas abas; cada uma lembra a sua.
const abaKey=()=>page==='planocontas'?'abaPlano':'aba';
function view(){const abas=[['balancete','Balancete'],['dre','DRE'],['balanco','Balanço'],['conferencia','Conferência com o escritório'],['diario','Diário'],['plano','Plano de contas']];
 const {L}=diario(),aba=ui[abaKey()];
 return `<div class="notice"><strong>Contabilidade automática.</strong> ${L.length.toLocaleString('pt-BR')} lançamentos em partidas dobradas gerados a partir de vendas, tarifas, CMV, notas, títulos e extrato — sem digitação. É a visão gerencial do Jarvis; a escrituração oficial continua com o escritório (exporte o diário para ele).</div>
 <div class="crmbar"><div class="segtabs">${abas.map(([k,t])=>`<button class="${aba===k?'active':''}" data-ct-aba="${k}">${t}</button>`).join('')}</div><label class="check-l" style="margin:0"><input type="checkbox" class="check" id="ctAcum" ${ui.acumulado?'checked':''}> Acumulado no ano</label></div>
 ${aba==='balancete'?balancete():aba==='dre'?dre():aba==='balanco'?balanco():aba==='conferencia'?conferencia():aba==='diario'?diarioView():planoView()}`}
// Plano de contas personalizável: contas do sistema (usadas pela contabilidade automática) podem ser renomeadas e,
// se nunca tiveram lançamento, removidas; contas novas (subcontas) podem ser criadas, editadas e removidas enquanto
// estiverem sem lançamentos. As categorias do financeiro escolhem em qual conta caem. Tudo fica em gerencial.plano.
const TIPOS={A:'Ativo',P:'Passivo / PL',R:'Receita',D:'Custo / despesa'};
const podePlano=()=>['owner','member','financeiro','contador'].includes(window.Cloud?.role||'owner');
const cfgPlano=()=>{const p=db.gerencial?.plano||{};return {novas:p.novas||{},nomes:p.nomes||{},removidas:p.removidas||[]}};
function salvarPlano(p,txt,det){db.gerencial={...(db.gerencial||{}),plano:p};cache=null;audit(txt,det);save();render()}
function usoContas(){const {L}=diario(),u=new Map();for(const e of L)for(const [c] of e.l){const parts=c.split('.');for(let i=1;i<=parts.length;i++){const k=parts.slice(0,i).join('.');u.set(k,(u.get(k)||0)+1)}}return u}
const PADRAO_CODS=new Set(PLANO.map(p=>p[0]));
function proximoCodigo(pai,plano){const filhos=[...plano.keys()].filter(c=>c.startsWith(pai+'.')&&c.split('.').length===pai.split('.').length+1).map(c=>Number(c.split('.').pop())).filter(n=>!isNaN(n));
 const n=(filhos.length?Math.max(...filhos):0)+1;return pai+'.'+String(n).padStart(pai.split('.').length>=2?2:1,'0')}
function planoView(){const {plano}=diario(),uso=usoContas(),cp=cfgPlano(),inv={};for(const [k,c] of Object.entries({...CAT,...(db.gerencial?.contabil?.mapa||{})}))(inv[c]=inv[c]||[]).push(k);
 const q=normalized(ui.buscaPlano||''),lista=[...plano.values()].filter(x=>!q||normalized(x.c+' '+x.n).includes(q)).sort((a,b)=>a.c.localeCompare(b.c,undefined,{numeric:true})),ed=podePlano();
 const cats=[...new Set([...Object.keys(CAT),...(db.cadastros||[]).filter(c=>c.tipo==='cat'&&c.ativo!==false).map(c=>c.dados.nome),...(db.payables||[]).map(p=>p.categoria).filter(Boolean)])].sort();
 const analiticas=[...plano.values()].filter(x=>![...plano.keys()].some(k=>k.startsWith(x.c+'.'))).sort((a,b)=>a.c.localeCompare(b.c,undefined,{numeric:true}));
 return `<div class="crmbar"><input type="search" id="ctBuscaPlano" placeholder="Buscar conta por código ou nome…" value="${esc(ui.buscaPlano||'')}" style="min-width:260px">${ed?`<button class="primary small" data-pl="nova">${icon('plus')} Nova conta</button>`:''}<button class="small quiet" data-pl="csv">${icon('download')} Exportar plano</button>${ed&&(Object.keys(cp.novas).length||Object.keys(cp.nomes).length||cp.removidas.length)?`<button class="small quiet" data-pl="restaurar">Restaurar padrão</button>`:''}</div>
 <div class="grid two plgrid"><div class="tablebox"><div class="tabletop"><div><h2>Plano de contas</h2><p class="caption">${plano.size} contas · ${Object.keys(cp.novas).length} criadas por você · ${Object.keys(cp.nomes).length} renomeadas. Contas do sistema recebem os lançamentos automáticos: renomeie à vontade; exclua só as que nunca tiveram lançamento.</p></div></div>
 <div class="tablewrap" style="max-height:640px"><table class="pltab"><thead><tr><th>Código</th><th>Conta</th><th>Tipo</th><th class="num">Lançam.</th><th></th></tr></thead><tbody>
 ${lista.map(x=>{const nivel=x.c.split('.').length,nova=!!cp.novas[x.c],n=uso.get(x.c)||0,sint=[...plano.keys()].some(k=>k.startsWith(x.c+'.'));
  return `<tr class="${nivel<=2?'ctbgrupo':''}"><td class="mono">${x.c}</td><td style="padding-left:${8+(nivel-1)*14}px">${esc(x.n)}${nova?' <span class="badge info">sua</span>':cp.nomes[x.c]?' <span class="badge">renomeada</span>':''}${x.banco?' <span class="badge">conta bancária</span>':''}${inv[x.c]?`<br><span class="caption">${esc(inv[x.c].join(', '))}</span>`:''}</td><td class="caption">${TIPOS[x.t]||x.t}${sint?' · sintética':''}</td><td class="num caption">${n?n.toLocaleString('pt-BR'):'—'}</td>
  <td>${ed&&!x.banco?`<div class="row" style="gap:4px;justify-content:flex-end"><button class="small quiet" data-pl-sub="${esc(x.c)}" title="Criar subconta">+ Sub</button><button class="small quiet" data-pl-ed="${esc(x.c)}">Editar</button>${!n&&!sint?`<button class="small quiet" data-pl-rm="${esc(x.c)}" title="Excluir">✕</button>`:''}</div>`:''}</td></tr>`}).join('')}</tbody></table></div></div>
 <div class="tablebox"><div class="tabletop"><div><h2>Categorias → conta contábil</h2><p class="caption">Onde cada categoria do financeiro (contas a pagar e extrato) é contabilizada.</p></div></div>
 <div class="plcats">${cats.map(c=>{const atual=contaCat(c);return `<label class="plcat"><span>${esc(c)}</span>${ed?`<select data-pl-cat="${esc(c)}">${analiticas.map(a=>`<option value="${a.c}" ${a.c===atual?'selected':''}>${a.c} · ${esc(a.n)}</option>`).join('')}</select>`:`<b>${atual} · ${esc(plano.get(atual)?.n||'')}</b>`}</label>`}).join('')}</div></div></div>`}
function formConta(c,pai){const {plano}=diario(),x=c?plano.get(c):null,cp=cfgPlano(),sint=[...plano.values()].filter(y=>y.c.split('.').length<=3&&!y.banco).sort((a,b)=>a.c.localeCompare(b.c,undefined,{numeric:true}));
 const paiSel=pai||(c?c.split('.').slice(0,-1).join('.'):'6.3');
 modal(c?`Editar conta ${esc(c)}`:'Nova conta',`${c?'':`<label>Conta superior</label><select id="plPai">${sint.map(s=>`<option value="${s.c}" ${s.c===paiSel?'selected':''}>${s.c} · ${esc(s.n)}</option>`).join('')}</select>`}
 <div class="grid two"><div><label for="plCod">Código</label><input id="plCod" value="${esc(c||proximoCodigo(paiSel,plano))}" ${c?'disabled':''}></div><div><label for="plTipo">Tipo</label><select id="plTipo" ${c&&!cp.novas[c]?'disabled':''}>${Object.entries(TIPOS).map(([k,t])=>`<option value="${k}" ${(x?.t||plano.get(paiSel)?.t)===k?'selected':''}>${t}</option>`).join('')}</select></div></div>
 <label for="plNome">Nome da conta</label><input id="plNome" value="${esc(x?.n||'')}" placeholder="Ex.: Fretes de devolução">
 ${c&&!cp.novas[c]?`<p class="caption">Conta do sistema: o nome muda em todos os relatórios; o código e os lançamentos automáticos continuam os mesmos.${cp.nomes[c]?` Nome original: <b>${esc(PLANO.find(p=>p[0]===c)?.[1]||'')}</b>.`:''}</p>`:''}
 <div class="modalfoot"><button data-action="close">Cancelar</button><button class="primary" data-pl-salvar="${esc(c||'')}">${icon('check')} Salvar</button></div>`);
 const p=$('#plPai');if(p)p.onchange=()=>{$('#plCod').value=proximoCodigo(p.value,plano);const t=plano.get(p.value)?.t;if(t)$('#plTipo').value=t}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-pl],[data-pl-sub],[data-pl-ed],[data-pl-rm],[data-pl-salvar]');if(!b)return;const d=b.dataset;const cp=cfgPlano();
 if(d.pl==='nova'){formConta(null);return}if(d.plSub){formConta(null,d.plSub);return}if(d.plEd){formConta(d.plEd);return}
 if(d.pl==='csv'){const {plano}=diario();const txt=[['codigo','conta','tipo'],...[...plano.values()].sort((a,b)=>a.c.localeCompare(b.c,undefined,{numeric:true})).map(x=>[x.c,x.n,TIPOS[x.t]||x.t])].map(l=>l.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+txt],{type:'text/csv'}));a.download='plano-de-contas.csv';a.click();return}
 if(d.pl==='restaurar'){if(b.dataset.conf!=='1'){b.dataset.conf='1';b.textContent='Confirmar: voltar ao padrão';b.classList.add('danger');return}salvarPlano({novas:{},nomes:{},removidas:[]},'Plano de contas restaurado ao padrão','contas criadas, nomes e exclusões desfeitos');toast('Plano restaurado.');return}
 if(d.plRm){const c=d.plRm;if(usoContas().get(c))return toast('Esta conta tem lançamentos e não pode ser excluída.');if(b.dataset.conf!=='1'){b.dataset.conf='1';b.textContent='Excluir?';b.classList.add('danger');return}
  const novas={...cp.novas};let removidas=cp.removidas;if(novas[c])delete novas[c];else removidas=[...new Set([...removidas,c])];const nomes={...cp.nomes};delete nomes[c];salvarPlano({novas,nomes,removidas},'Conta contábil excluída',c);toast('Conta excluída.');return}
 if(d.plSalvar!==undefined){const c=d.plSalvar,nome=$('#plNome').value.trim();if(nome.length<2)return toast('Informe o nome da conta.');const {plano}=diario();
  if(c){if(cp.novas[c]){const novas={...cp.novas,[c]:{n:nome,t:$('#plTipo').value}};salvarPlano({...cp,novas},'Conta contábil editada',`${c} · ${nome}`)}else{const orig=PLANO.find(p=>p[0]===c)?.[1];const nomes={...cp.nomes};if(nome===orig)delete nomes[c];else nomes[c]=nome;salvarPlano({...cp,nomes},'Conta contábil renomeada',`${c} · ${nome}`)}}
  else{const cod=$('#plCod').value.trim();if(!/^\d+(\.\d+)+$/.test(cod))return toast('Código no formato 6.3.09 (números separados por ponto).');if(plano.has(cod))return toast('Já existe uma conta com esse código.');const pai=cod.split('.').slice(0,-1).join('.');if(!plano.has(pai))return toast(`A conta superior ${pai} não existe.`);
   salvarPlano({...cp,novas:{...cp.novas,[cod]:{n:nome,t:$('#plTipo').value}},removidas:cp.removidas.filter(x=>x!==cod)},'Conta contábil criada',`${cod} · ${nome}`)}
  closeModal();toast('Plano de contas atualizado.');return}});
document.addEventListener('change',e=>{const s=e.target.closest('[data-pl-cat]');if(!s)return;const mapa={...(db.gerencial?.contabil?.mapa||{}),[s.dataset.plCat]:s.value};db.gerencial={...(db.gerencial||{}),contabil:{...(db.gerencial?.contabil||{}),mapa}};cache=null;audit('Categoria vinculada a conta contábil',`${s.dataset.plCat} → ${s.value}`);save();toast('Vínculo salvo: os lançamentos já usam a nova conta.')});
document.addEventListener('input',e=>{if(e.target.id!=='ctBuscaPlano')return;ui.buscaPlano=e.target.value;const pos=e.target.selectionStart;render();const n=$('#ctBuscaPlano');n.focus();n.setSelectionRange(pos,pos)});
function csv(tipo){const {ini,fim:f}=periodo();let cab,linhas;
 if(tipo==='diario'){const {L,plano}=diario();cab=['data','lote','historico','conta','nome_conta','debito','credito'];linhas=[];let n=0;for(const e of L){if(e.d<ini||e.d>f)continue;n++;for(const [c,v] of e.l)linhas.push([e.d,n,e.hist,c,plano.get(c)?.n||'',v>0?v.toFixed(2).replace('.',','):'',v<0?(-v).toFixed(2).replace('.',','):''])}}
 else{const {s,plano}=saldos(f,ini);cab=['conta','nome','saldo_anterior','debitos','creditos','saldo_atual'];linhas=[...s.keys()].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(c=>{const x=s.get(c);return [c,plano.get(c)?.n||c,valorNat(c,x.ant).toFixed(2).replace('.',','),x.deb.toFixed(2).replace('.',','),x.cred.toFixed(2).replace('.',','),valorNat(c,x.ant+x.deb-x.cred).toFixed(2).replace('.',',')]})}
 const txt=[cab,...linhas].map(l=>l.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(';')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+txt],{type:'text/csv'}));a.download=`${tipo}-${ini}-a-${f}.csv`;a.click()}
document.addEventListener('click',e=>{const b=e.target.closest('[data-ct-aba],[data-ct-conta],[data-ct-csv]');if(!b)return;const d=b.dataset;if(d.ctAba){ui[abaKey()]=d.ctAba;render()}if(d.ctConta)razao(d.ctConta);if(d.ctCsv)csv(d.ctCsv)});
function bind(){const pv=$('#ctProv');if(pv)pv.onchange=()=>{cfg.provisao=pv.checked;try{localStorage.setItem('eb_contab',JSON.stringify(cfg))}catch{}cache=null;render()};const a=$('#ctAcum');if(a)a.onchange=()=>{ui.acumulado=a.checked;render()};const i=$('#ctBusca');if(i)i.oninput=e=>{ui.busca=e.target.value;const pos=e.target.selectionStart;render();const n=$('#ctBusca');n.focus();n.setSelectionRange(pos,pos)}}
addPage('planocontas','ledger','Plano de contas',view,'Contas contábeis personalizáveis: crie, renomeie e exclua contas e escolha onde cada categoria do financeiro é contabilizada.','',bind);
addPage('contabauto','ledger','Contabilidade automática',view,'Diário, razão, balancete, DRE e balanço em partidas dobradas, gerados sozinhos a partir da operação.','',bind);
window.Contab={simples,aliqSimples,contaCategoria:c=>contaCat(c),tributos:m=>{diario();return tribInfo.get(m)||null},creditoCompras:()=>{diario();return credInfo},ufGuia,diario,saldos,plano:()=>[...contas().values()],mapaCategorias:()=>({...CAT})};
})();
