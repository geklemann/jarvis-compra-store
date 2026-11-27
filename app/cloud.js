// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Modo nuvem (Supabase): login, carregamento do workspace e gravação incremental.
// Sem config.js preenchido, o Jarvis continua no modo local (dados neste navegador).
(()=>{
const cfg=window.CONCILIA_CONFIG||{};
const Cloud=window.Cloud={workspaces:[],enabled:!!(cfg.supabaseUrl&&cfg.supabaseAnonKey&&window.supabase),client:null,session:null,ws:null,wsName:'',role:'',state:'idle',error:'',localBackup:null,settingsVersao:null};

// ── Configurações da empresa por MESCLA (27/11/2026; migração 20261220090000_workspace_settings_mesclar.sql) ──
// O app mandava {theme, pricing, gerencial} inteiro e o último a gravar apagava o que outro navegador tinha gravado
// (ex.: as inscrições do substituto tributário em gerencial.fiscal.difal_uf). Agora manda só a diferença em relação ao
// que leu do banco: as chaves mudadas (em profundidade, objeto a objeto) e os caminhos apagados (listas de chaves,
// porque há chaves com ponto). Listas e valores simples vão inteiros. O banco mescla com o que tem (mesma regra de
// aplicarMescla) e avisa se outro lugar tinha mudado: aí o app fica com o do banco + o que é dele.
const ehObj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const copia=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
/** JSON com as chaves em ordem (o jsonb do banco reordena; a comparação não pode depender disso). */
function canonico(v){return JSON.stringify(v===undefined?null:v,(k,x)=>ehObj(x)?Object.keys(x).sort().reduce((o,c)=>(o[c]=x[c],o),{}):x)}
function porCaminho(obj,cam,v){let o=obj;for(const k of cam.slice(0,-1)){if(!ehObj(o[k]))o[k]={};o=o[k]}o[cam.at(-1)]=v}
/** O que mudou de a (o que o banco tinha) para b (o que está na tela): {patch, remover}. */
function diferencaMescla(a,b,cam=[],out={patch:{},remover:[]}){
 a=ehObj(a)?a:{};b=ehObj(b)?b:{};
 for(const k of Object.keys(b)){if(b[k]===undefined)continue;const va=a[k],vb=b[k],c=[...cam,k];
  if(va===undefined)porCaminho(out.patch,c,copia(vb));
  else if(ehObj(va)&&ehObj(vb))diferencaMescla(va,vb,c,out);
  else if(canonico(va)!==canonico(vb))porCaminho(out.patch,c,copia(vb))}
 for(const k of Object.keys(a))if(a[k]!==undefined&&b[k]===undefined)out.remover.push([...cam,k]);
 return out}
const semMudanca=d=>!Object.keys(d.patch).length&&!d.remover.length;
function mesclarProfundo(a,b){if(!ehObj(a)||!ehObj(b))return copia(b);const r={...a};for(const k of Object.keys(b))r[k]=mesclarProfundo(a[k],b[k]);return r}
/** O mesmo que o banco faz (jsonb_mesclar_profundo e depois #- de cada caminho). */
function aplicarMescla(base,d){const r=mesclarProfundo(ehObj(base)?copia(base):{},d.patch||{});
 for(const cam of d.remover||[]){let o=r;for(const k of cam.slice(0,-1)){o=ehObj(o)?o[k]:undefined;if(o===undefined)break}if(ehObj(o))delete o[cam.at(-1)]}
 return r}
Cloud.mescla={diferenca:diferencaMescla,aplicar:aplicarMescla,canonico};
document.body.classList.remove('booting');
if(!Cloud.enabled){Cloud.state='local';return}

const sb=Cloud.client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
// Dados que já estavam neste navegador (modo local) podem ser enviados para a nuvem depois do login.
if(db.orders.length||db.receipts.length)Cloud.localBackup=JSON.parse(JSON.stringify(db));

// ───────── Mapeamento entre o formato da tela e as tabelas ─────────
const n=v=>v==null?0:Number(v);
const maps={
 orders:{table:'orders',key:'id',
  toRow:o=>({id:o.id,platform:o.platform,date:o.date,gross:o.gross,fee:o.fee,nf:o.nf||null,due:o.due||null,transit:!!o.transit,note:o.note||'',source:o.source||'Importado',customer:o.customer||null,state:o.state||null,items:o.items||null,shipping:o.shipping??null,fee_source:o.feeSource||null,external:o.external||null}),
  fromRow:r=>({id:r.id,platform:r.platform,date:r.date,gross:n(r.gross),fee:n(r.fee),nf:r.nf||'',due:r.due||'',transit:!!r.transit,note:r.note||'',source:r.source,customer:r.customer||null,state:r.state||'',items:r.items||[],shipping:r.shipping==null?null:n(r.shipping),feeSource:r.fee_source||'',external:r.external||null})},
 receipts:{table:'receipts',key:'id',
  toRow:r=>({id:r.id,order_id:r.orderId||null,platform:r.platform,account:r.account,date:r.date,amount:r.amount,linked_order:r.linkedOrder||null,source:r.source||'Importado',kind:r.kind||'liberacao',description:r.description||null}),
  fromRow:r=>({id:r.id,orderId:r.order_id||'',platform:r.platform,account:r.account,date:r.date,amount:n(r.amount),linkedOrder:r.linked_order||null,source:r.source,kind:r.kind,description:r.description||''})},
 ledger:{table:'ledger',key:'id',
  toRow:l=>({id:l.id,kind:l.kind,due:l.due||null,paid_date:l.paidDate||null,amount:l.amount,status:l.status||null,category:l.category||null,contact:l.contact||null,description:l.description||null,source:l.source||'Importado'}),
  fromRow:r=>({id:r.id,kind:r.kind,due:r.due||'',paidDate:r.paid_date||'',amount:n(r.amount),status:r.status||'',category:r.category||'',contact:r.contact||'',description:r.description||'',source:r.source})},
 imports:{table:'imports',key:'id',
  toRow:i=>({id:i.id,file:i.file,type:i.type,count:i.count,format:i.format||null,time:i.time}),
  fromRow:r=>({id:r.id,file:r.file,type:r.type,count:r.count,format:r.format,time:r.time})},
 accLines:{table:'accounting_lines',key:'id',
  // reduzido (código reduzido do balancete, 20261204110000_contab_razao.sql): só vai quando existe, para não mudar as linhas antigas
  toRow:l=>({id:l.id,month:l.month,kind:l.kind,conta:l.conta,descricao:l.descricao||null,data:l.data||null,historico:l.historico||null,debito:l.debito||0,credito:l.credito||0,saldo_anterior:l.saldoAnterior??null,saldo:l.saldo??null,...(l.reduzido?{reduzido:l.reduzido}:{})}),
  fromRow:r=>({id:r.id,month:r.month,kind:r.kind,conta:r.conta,descricao:r.descricao||'',data:r.data||null,historico:r.historico||'',debito:n(r.debito),credito:n(r.credito),saldoAnterior:r.saldo_anterior==null?null:n(r.saldo_anterior),saldo:r.saldo==null?null:n(r.saldo),...(r.reduzido?{reduzido:r.reduzido}:{})})},
 accDocs:{table:'accounting_docs',key:'id',
  toRow:d=>({id:d.id,month:d.month,tipo:d.tipo,nome:d.nome,path:d.path||null,size:d.size||null,time:d.time}),
  fromRow:r=>({id:r.id,month:r.month,tipo:r.tipo,nome:r.nome,path:r.path,size:r.size,time:r.time})},
 products:{table:'pricing_products',key:'id',
  toRow:p=>({id:p.id,nome:p.nome||null,categoria:p.categoria||null,custo:p.custo||0,embalagem:p.embalagem||0,peso:p.peso??null,precos:p.precos||{},extra:p.extra||{}}),
  fromRow:r=>({id:r.id,nome:r.nome||'',categoria:r.categoria||'',custo:n(r.custo),embalagem:n(r.embalagem),peso:r.peso==null?null:n(r.peso),precos:r.precos||{},extra:r.extra||{}})},
 scenarios:{table:'pricing_scenarios',key:'id',
  toRow:s=>({id:s.id,nome:s.nome,data:s.data,time:s.time}),
  fromRow:r=>({id:r.id,nome:r.nome,data:r.data,time:r.time})},
 payables:{table:'payables',key:'id',
  toRow:t=>({id:t.id,origem:t.origem||'manual',invoice_id:t.invoiceId||null,fornecedor:t.fornecedor||null,fornecedor_doc:t.fornecedorDoc||null,descricao:t.descricao||null,documento:t.documento||null,parcela:t.parcela??null,parcelas:t.parcelas??null,emissao:t.emissao||null,vencimento:t.vencimento,valor:t.valor,juros:t.juros||0,desconto:t.desconto||0,valor_pago:t.valorPago||0,pago_em:t.pagoEm||null,status:t.status||'aberto',categoria:t.categoria||null,centro_custo:t.centroCusto||null,conta:t.conta||null,observacao:t.observacao||null,anexos:t.anexos||null,created_by:t.createdBy||null,aprovacao:t.aprovacao||null,lancado_por:t.lancadoPor||null,aprovado_por:t.aprovadoPor||null,aprovado_em:t.aprovadoEm||null,linha_digitavel:t.linhaDigitavel||null}),
  fromRow:r=>({id:r.id,origem:r.origem,invoiceId:r.invoice_id||null,fornecedor:r.fornecedor||'',fornecedorDoc:r.fornecedor_doc||'',descricao:r.descricao||'',documento:r.documento||'',parcela:r.parcela,parcelas:r.parcelas,emissao:r.emissao||'',vencimento:r.vencimento,valor:n(r.valor),juros:n(r.juros),desconto:n(r.desconto),valorPago:n(r.valor_pago),pagoEm:r.pago_em||null,status:r.status,categoria:r.categoria||'',centroCusto:r.centro_custo||'',conta:r.conta||'',observacao:r.observacao||'',anexos:r.anexos||null,createdBy:r.created_by||'',aprovacao:r.aprovacao||undefined,lancadoPor:r.lancado_por||'',aprovadoPor:r.aprovado_por||'',aprovadoEm:r.aprovado_em||null,linhaDigitavel:r.linha_digitavel||''})},
 bankAccounts:{table:'bank_accounts',key:'id',
  toRow:a=>({id:a.id,nome:a.nome,banco:a.banco||null,agencia:a.agencia||null,conta:a.conta||null,tipo:a.tipo||'corrente',saldo_inicial:a.saldoInicial||0,data_saldo_inicial:a.dataSaldoInicial||null,saldo_extrato:a.saldoExtrato??null,data_saldo_extrato:a.dataSaldoExtrato||null,ativo:a.ativo!==false}),
  fromRow:r=>({id:r.id,nome:r.nome,banco:r.banco||'',agencia:r.agencia||'',conta:r.conta||'',tipo:r.tipo,saldoInicial:n(r.saldo_inicial),dataSaldoInicial:r.data_saldo_inicial||null,saldoExtrato:r.saldo_extrato==null?null:n(r.saldo_extrato),dataSaldoExtrato:r.data_saldo_extrato||null,ativo:r.ativo})},
 bankTx:{table:'bank_transactions',key:'id',
  toRow:t=>({id:t.id,conta_id:t.contaId,data:t.data,descricao:t.descricao||null,documento:t.documento||null,valor:t.valor,fitid:t.fitid||null,origem:t.origem||'ofx',status:t.status||'pendente',vinculo:t.vinculo||null,categoria:t.categoria||null,observacao:t.observacao||null,arquivo:t.arquivo||null}),
  fromRow:r=>({id:r.id,contaId:r.conta_id,data:r.data,descricao:r.descricao||'',documento:r.documento||'',valor:n(r.valor),fitid:r.fitid,origem:r.origem,status:r.status,vinculo:r.vinculo||null,categoria:r.categoria||'',observacao:r.observacao||'',arquivo:r.arquivo||''})},
 cadastros:{table:'cadastros',key:'id',
  toRow:c=>({id:c.id,tipo:c.tipo,dados:c.dados||{},ativo:c.ativo!==false}),
  fromRow:r=>({id:r.id,tipo:r.tipo,dados:r.dados||{},ativo:r.ativo})},
 audit:{table:'audit_log',key:'id',insertOnly:true,
  toRow:a=>({id:a.id,time:a.time,action:a.action,detail:a.detail||'',actor:a.actor||Cloud.session?.user?.email||null}),
  fromRow:r=>({id:r.id,time:r.time,action:r.action,detail:r.detail,actor:r.actor})},
};
const listOf={orders:()=>db.orders,receipts:()=>db.receipts,ledger:()=>db.ledger,imports:()=>db.imports,audit:()=>db.audit,accLines:()=>db.accLines||[],accDocs:()=>db.accDocs||[],products:()=>db.products||[],scenarios:()=>db.scenarios||[],payables:()=>db.payables||[],bankAccounts:()=>db.bankAccounts||[],bankTx:()=>db.bankTx||[],cadastros:()=>db.cadastros||[]};
let snap={};           // último estado gravado: coleção → Map(id → JSON)
let flushTimer=null,flushing=null,dirty=false;

function ensureIds(){for(const i of db.imports)i.id=i.id||uid();for(const a of db.audit)a.id=a.id||uid()}
function snapshot(){ensureIds();snap={};for(const [k,m] of Object.entries(maps))snap[k]=new Map(listOf[k]().map(x=>[x[m.key],JSON.stringify(m.toRow(x))]));
 snap.crm=new Map(Object.entries(db.crm||{}).map(([id,c])=>[id,JSON.stringify(c)]));snap.accMap=new Map(Object.entries(db.accMap||{}).map(([id,c])=>[id,JSON.stringify(c)]));snap.closures=new Map(Object.entries(db.closures||{}).map(([m,c])=>[m,JSON.stringify(c)]));snap.settings=settingsOf()}
// Sempre uma cópia limpa (JSON): o snapshot não pode ser o mesmo objeto que a tela altera.
function settingsOf(){return copia({theme:db.theme,pricing:db.pricing||null,gerencial:db.gerencial||null})}

// Carga paginada: conta as linhas e baixa as páginas de 1.000 em paralelo (4 por vez), em ordem estável pelo id.
// opt.max limita às linhas mais recentes (opt.desc = coluna de data), para tabelas que só precisam do recente.
async function pageAll(table,cols='*',opt={}){const base=()=>sb.from(table).select(cols).eq('workspace_id',Cloud.ws);
 if(opt.max){const out=[];for(let from=0;from<opt.max;from+=1000){const {data,error}=await base().order(opt.desc,{ascending:false}).range(from,Math.min(opt.max,from+1000)-1);if(error)throw error;out.push(...data);if(data.length<1000)break}return out}
 const {count,error:e0}=await sb.from(table).select('*',{count:'exact',head:true}).eq('workspace_id',Cloud.ws);
 if(e0||count==null){let out=[],from=0;for(;;){const {data,error}=await base().range(from,from+999);if(error)throw error;out.push(...data);if(data.length<1000)return out;from+=1000}}
 if(count<=1000){const {data,error}=await base().range(0,999);if(error)throw error;return data}
 const paginas=Math.ceil(count/1000),res=new Array(paginas);let prox=0;
 const trab=async()=>{while(prox<paginas){const i=prox++;const {data,error}=await base().order('id').range(i*1000,i*1000+999);if(error)throw error;res[i]=data}};
 await Promise.all(Array.from({length:Math.min(4,paginas)},trab));
 // segurança: se chegou linha nova no meio da carga, a última página pode ter mais
 const out=res.flat();if(res[paginas-1]?.length===1000){let from=paginas*1000;for(;;){const {data,error}=await base().order('id').range(from,from+999);if(error)throw error;out.push(...data);if(data.length<1000)break;from+=1000}}return out}

async function load(seguro){
 Cloud.state='loading';
 const pre=Promise.all(['payables','bank_accounts','bank_transactions','cadastros'].map(t=>pageAll(t)));
 const [orders,receipts,ledger,imports,audit,crm,closures,settings,accLines,accMap,accDocs,products,scenarios]=await Promise.all(['orders','receipts','ledger','imports','audit_log','crm_contacts','closures','workspace_settings','accounting_lines','account_map','accounting_docs','pricing_products','pricing_scenarios'].map(t=>t==='audit_log'?pageAll(t,'*',{max:3000,desc:'time'}):pageAll(t)));
 const next={orders:orders.map(maps.orders.fromRow),receipts:receipts.map(maps.receipts.fromRow),ledger:ledger.map(maps.ledger.fromRow),
  imports:imports.map(maps.imports.fromRow).sort((a,b)=>b.time.localeCompare(a.time)),audit:audit.map(maps.audit.fromRow).sort((a,b)=>b.time.localeCompare(a.time)),
  crm:Object.fromEntries(crm.map(c=>[c.id,{stage:c.stage,tags:c.tags||[],notes:c.notes||'',interactions:c.interactions||[]}])),
  closures:Object.fromEntries(closures.map(c=>[c.month,c.data])),theme:window.Aparencia?.modoUsuario?.()||settings[0]?.data?.theme||db.theme||'dark',schemaVersion:2,
  accLines:accLines.map(maps.accLines.fromRow),accMap:Object.fromEntries(accMap.map(a=>[a.conta,{linha:a.linha,descricao:a.descricao||''}])),accDocs:accDocs.map(maps.accDocs.fromRow),
  products:products.map(maps.products.fromRow),scenarios:scenarios.map(maps.scenarios.fromRow),payables:(await pre)[0].map(maps.payables.fromRow),bankAccounts:(await pre)[1].map(maps.bankAccounts.fromRow),bankTx:(await pre)[2].map(maps.bankTx.fromRow),cadastros:(await pre)[3].map(maps.cadastros.fromRow),
  // Notas de entrada: só leitura (a origem é o Bling), sem o JSON bruto.
  purchases:(await pageAll('purchase_invoices','id,numero,serie,chave,emissao,fornecedor,fornecedor_doc,valor,cfop,natureza,tipo,situacao,itens,parcelas')).map(r=>({id:r.id,numero:r.numero,serie:r.serie,chave:r.chave,emissao:r.emissao,fornecedor:r.fornecedor,fornecedorDoc:r.fornecedor_doc,valor:n(r.valor),cfop:r.cfop,natureza:r.natureza,tipo:r.tipo,situacao:r.situacao,itens:r.itens||[],parcelas:r.parcelas||[]})),pricing:settings[0]?.data?.pricing||undefined,gerencial:settings[0]?.data?.gerencial||undefined};
 /* Em segundo plano: se a pessoa mexeu em algo enquanto carregava, não sobrescreve (salva e busca de novo). */
 if(seguro&&Cloud.state!=='loading')return false;
 Cloud.settingsVersao=settings[0]?(settings[0].versao??null):0;
 aplicarDados(next);salvarCache(Cloud.ws,next);return true
}
function aplicarDados(next){db=next;paymentIndex=null;snapshot();Cloud.state='saved';
 document.body.classList.toggle('light',db.theme==='light');
 const months=[...new Set(db.orders.map(o=>o.date.slice(0,7)))].sort();
 if(months.length&&!months.includes(month))month=months.at(-1)}
// ── Dados da última visita (IndexedDB, só neste navegador): o Jarvis abre na hora com eles e busca o resto em segundo
// plano. Cada empresa tem o seu; vale por 7 dias; some ao sair da conta.
const CACHE_VER=1,CACHE_MAX=7*864e5;
function idb(){return new Promise((ok,er)=>{try{const r=indexedDB.open('jarvis-cache',1);r.onupgradeneeded=()=>r.result.createObjectStore('dados');r.onsuccess=()=>ok(r.result);r.onerror=()=>er(r.error)}catch(x){er(x)}})}
async function lerCache(ws){try{const d=await idb();return await new Promise(ok=>{const q=d.transaction('dados').objectStore('dados').get('ws:'+ws);q.onsuccess=()=>{const v=q.result;ok(v&&v.ver===CACHE_VER&&v.uid===Cloud.session?.user?.id&&Date.now()-v.em<CACHE_MAX?v.db:null)};q.onerror=()=>ok(null)})}catch{return null}}
function salvarCache(ws,dados){setTimeout(async()=>{try{const d=await idb();d.transaction('dados','readwrite').objectStore('dados').put({ver:CACHE_VER,em:Date.now(),uid:Cloud.session?.user?.id,db:dados},'ws:'+ws)}catch{}},1500)}
async function limparCache(){try{const d=await idb();d.transaction('dados','readwrite').objectStore('dados').clear()}catch{}}
// Atualização em segundo plano depois de abrir com o cache: salva o que estiver pendente, busca tudo e redesenha
// (se a pessoa estiver digitando, espera ela sair do campo).
async function atualizarSegundoPlano(){Cloud.atualizando=true;paintStatus();try{for(let i=0;i<3;i++){await flush();if(await load(true))break}if(Cloud.state==='loading')Cloud.state='saved'}catch(x){console.warn('atualização em segundo plano',x);Cloud.state='saved'}Cloud.atualizando=false;Cloud.daCache=false;
 redesenharQuandoPuder()}
Cloud.reload=async()=>{await flush();await load();render()};
Cloud.switchWs=async id=>{const w=Cloud.workspaces.find(x=>x.id===id);if(!w||id===Cloud.ws)return;await flush();Cloud.ws=w.id;Cloud.wsName=w.name;Cloud.role=w.role;Cloud.paginas=w.paginas||null;Cloud.leitura=w.leitura||null;Cloud.acessos=w.acessos||null;Cloud.telasConhecidas=w.telasConhecidas||null;try{localStorage.setItem('concilia-ws',id)}catch{}await load();window.Integrations&&(Integrations.state.loaded=false);render();toast('Workspace: '+w.name)};
Cloud.renameWs=async name=>{const {error}=await sb.from('workspaces').update({name}).eq('id',Cloud.ws);if(error)throw error;Cloud.wsName=name;const w=Cloud.workspaces.find(x=>x.id===Cloud.ws);if(w)w.name=name};

async function flush(){
 if(flushing){dirty=true;return flushing}
 clearTimeout(flushTimer);
 flushing=(async()=>{
  try{
   Cloud.state='saving';paintStatus();ensureIds();const ws=Cloud.ws;
   for(const [k,m] of Object.entries(maps)){
    const cur=new Map(listOf[k]().map(x=>[x[m.key],JSON.stringify(m.toRow(x))])),old=snap[k]||new Map();
    const changed=[...cur].filter(([id,j])=>old.get(id)!==j).map(([,j])=>({workspace_id:ws,...JSON.parse(j)}));
    for(let i=0;i<changed.length;i+=500){const q=m.insertOnly?sb.from(m.table).upsert(changed.slice(i,i+500),{onConflict:'workspace_id,id',ignoreDuplicates:true}):sb.from(m.table).upsert(changed.slice(i,i+500),{onConflict:'workspace_id,id'});const {error}=await q;if(error)throw error}
    if(!m.insertOnly){const removed=[...old.keys()].filter(id=>!cur.has(id));for(let i=0;i<removed.length;i+=200){const {error}=await sb.from(m.table).delete().eq('workspace_id',ws).in('id',removed.slice(i,i+200));if(error)throw error}}
    snap[k]=cur;
   }
   const crmNow=new Map(Object.entries(db.crm||{}).map(([id,c])=>[id,JSON.stringify(c)]));
   const crmRows=[...crmNow].filter(([id,j])=>snap.crm.get(id)!==j).map(([id,j])=>{const c=JSON.parse(j);return {workspace_id:ws,id,stage:c.stage||'Novo',tags:c.tags||[],notes:c.notes||'',interactions:c.interactions||[],updated_at:new Date().toISOString()}});
   if(crmRows.length){const {error}=await sb.from('crm_contacts').upsert(crmRows,{onConflict:'workspace_id,id'});if(error)throw error}
   snap.crm=crmNow;
   const amNow=new Map(Object.entries(db.accMap||{}).map(([id,c])=>[id,JSON.stringify(c)]));
   const amRows=[...amNow].filter(([id,j])=>snap.accMap?.get(id)!==j).map(([conta,j])=>{const c=JSON.parse(j);return {workspace_id:ws,conta,linha:c.linha,descricao:c.descricao||null}});
   if(amRows.length){const {error}=await sb.from('account_map').upsert(amRows,{onConflict:'workspace_id,conta'});if(error)throw error}
   snap.accMap=amNow;
   const clNow=new Map(Object.entries(db.closures||{}).map(([m,c])=>[m,JSON.stringify(c)]));
   const clRows=[...clNow].filter(([m,j])=>snap.closures.get(m)!==j).map(([m,j])=>({workspace_id:ws,month:m,data:JSON.parse(j)}));
   if(clRows.length){const {error}=await sb.from('closures').upsert(clRows,{onConflict:'workspace_id,month'});if(error)throw error}
   const clGone=[...snap.closures.keys()].filter(m=>!clNow.has(m));
   if(clGone.length){const {error}=await sb.from('closures').delete().eq('workspace_id',ws).in('month',clGone);if(error)throw error}
   snap.closures=clNow;
   await gravarSettings(ws);
   Cloud.state='saved';Cloud.error='';
  }catch(e){Cloud.state='error';Cloud.error=e.message||String(e);console.error(e);toast('Não foi possível salvar na nuvem: '+Cloud.error)}
  finally{flushing=null;paintStatus();if(dirty){dirty=false;schedule()}}
 })();
 return flushing;
}
// Configurações: manda só a diferença para o banco mesclar (workspace_settings_mesclar). Banco sem a função (instância
// com o banco ainda não atualizado): o upsert antigo, como antes.
async function gravarSettings(ws){
 if(snap.settings===undefined)return; // ainda sem o que o banco tem (carregando): nada a comparar
 const enviado=settingsOf(),d=diferencaMescla(snap.settings,enviado);
 if(semMudanca(d))return;
 const {data:r,error}=await sb.rpc('workspace_settings_mesclar',{p_ws:ws,p_patch:d.patch,p_remover:d.remover,p_versao:Cloud.settingsVersao});
 if(error){
  if(error.code==='PGRST202'||/workspace_settings_mesclar/.test(error.message||'')&&/could not find|does not exist|não existe/i.test(error.message||'')){
   const {error:e2}=await sb.from('workspace_settings').upsert({workspace_id:ws,data:enviado});if(e2)throw e2;snap.settings=enviado;return}
  throw error}
 if(ws!==Cloud.ws)return;
 receberSettings(r?.data,r?.versao??null,{enviado,avisar:!!r?.conflito})}
/** Recebe as configurações do banco sem perder o que é desta tela: o que mudou aqui desde `enviado` (e ainda não foi
 *  gravado) é reaplicado por cima e vai na próxima gravação. Se a tela muda por causa de outro lugar, avisa. */
function receberSettings(dados,versao,{enviado=snap.settings,avisar=false}={}){
 const remoto=copia({theme:dados?.theme,pricing:dados?.pricing||null,gerencial:dados?.gerencial||null}),local=settingsOf();
 const pend=diferencaMescla(enviado,local),novo=aplicarMescla(remoto,pend);
 const tema=window.Aparencia?.modoUsuario?.()||novo.theme||db.theme;
 novo.theme=tema;
 // Só troca os objetos da tela quando o conteúdo mudou (quem guardou uma referência a db.gerencial continua valendo).
 const mudou=canonico(novo)!==canonico(local);
 if(mudou){db.theme=tema;db.pricing=novo.pricing||undefined;db.gerencial=novo.gerencial||undefined}
 // O tema escolhido pela pessoa (Aparência) é dela, não da empresa: não vira mudança a gravar.
 snap.settings={...remoto,theme:pend.patch.theme!==undefined?remoto.theme:tema};
 Cloud.settingsVersao=versao;
 if(mudou){
  document.body.classList.toggle('light',db.theme==='light');
  if(avisar)toast('As configurações foram alteradas em outro lugar; recarregamos.');
  redesenharQuandoPuder()}
 if(!semMudanca(diferencaMescla(snap.settings,settingsOf())))dirty=true}
// Redesenha sem atrapalhar: com uma janela aberta espera ela fechar; com alguém digitando, espera sair do campo.
function redesenharQuandoPuder(){const redesenhar=()=>{if(document.querySelector('.modalback'))return setTimeout(redesenhar,2000);render()};const a=document.activeElement;if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&a.closest('#view'))a.addEventListener('blur',()=>setTimeout(redesenhar,50),{once:true});else redesenhar()}
// Ao voltar para a aba (ou focar a janela), relê as configurações: se outro lugar mudou, fica com as do banco + as daqui.
let releitura=0;
async function relerSettings(){
 if(!Cloud.ws||Cloud.state==='loading'||document.visibilityState==='hidden'||Date.now()-releitura<5000)return;
 releitura=Date.now();
 try{
  if(flushing)await flushing;
  const ws=Cloud.ws,{data,error}=await sb.from('workspace_settings').select('data,versao').eq('workspace_id',ws).maybeSingle();
  if(error||ws!==Cloud.ws||flushing||Cloud.state==='loading')return;
  if(data&&data.versao===undefined)return; // banco sem a versão (ainda não atualizado): fica como antes
  const v=data?data.versao:0;
  if(Cloud.settingsVersao!=null&&v<=Cloud.settingsVersao)return;
  receberSettings(data?.data,v,{avisar:true});
  if(dirty&&!flushing){dirty=false;schedule()}
 }catch(x){console.warn('releitura das configurações',x)}}
Cloud.relerSettings=relerSettings;
window.addEventListener('focus',relerSettings);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')relerSettings()});
function schedule(){if(!Cloud.ws)return;Cloud.state='pending';paintStatus();clearTimeout(flushTimer);flushTimer=setTimeout(flush,700)}
Cloud.flush=flush;

// Em modo nuvem, save() agenda a gravação incremental em vez de usar o localStorage.
save=function(){if(!Cloud.ws)return false;schedule();return true};
window.addEventListener('beforeunload',e=>{if(Cloud.state==='pending'||Cloud.state==='saving'){flush();e.preventDefault();e.returnValue=''}});

function paintStatus(){const el=document.getElementById('cloudStatus');if(!el)return;const t=Cloud.atualizando?['Atualizando…','sync']:{pending:['Alterações pendentes','warn'],saving:['Salvando…','info'],saved:['Salvo na nuvem','ok'],error:['Erro ao salvar','bad'],loading:['Carregando…','info']}[Cloud.state]||['Nuvem','info'];el.className='badge '+t[1];el.textContent=t[0];el.title=Cloud.error||''}
Cloud.paintStatus=paintStatus;

// ───────── Tela de acesso ─────────
// Abertura e recarga: tela neutra (o formulário de login só aparece quando de fato não há sessão).
function abrindoView(msg='Abrindo o Jarvis…'){$('#app').innerHTML=`<div class="auth abrindo"><div class="authcard"><div class="authhead"><img class="authlogo" src="brand/jarvis-192.png" alt="Jarvis"><div class="authname">Jarvis</div></div><p role="status">${esc(msg)}</p></div></div>`}
// Falha ao abrir (rede, servidor ocupado): não é falta de login. Tenta de novo sozinho e oferece o botão.
let tentativas=0;
function erroAberturaView(session,msg){const espera=[5,15,30][tentativas]||0;
 $('#app').innerHTML=`<div class="auth"><div class="authcard"><div class="authhead"><img class="authlogo" src="brand/jarvis-192.png" alt="Jarvis"><div class="authname">Jarvis</div></div><h2>Não foi possível abrir agora</h2><p class="caption">${esc(msg)}</p><p class="caption" id="abrNova">${espera?`Tentando de novo em ${espera} segundos…`:'Se continuar, fale com o suporte do Jarvis.'}</p><div class="row wrap" style="margin-top:14px"><button class="primary" id="abrTentar">Tentar de novo</button><button class="quiet small" id="abrSair">Sair</button></div></div></div>`;
 let t=espera?setTimeout(()=>{tentativas++;start(session)},espera*1000):null;
 $('#abrTentar').onclick=()=>{clearTimeout(t);tentativas++;start(session)};$('#abrSair').onclick=()=>{clearTimeout(t);sb.auth.signOut({scope:'local'})}}
const CHAVE_EMAIL='jarvis-email-lembrado';
function emailLembrado(){try{return localStorage.getItem(CHAVE_EMAIL)||''}catch{return ''}}
function lembrarEmail(email){try{if(email)localStorage.setItem(CHAVE_EMAIL,String(email).trim().toLowerCase());else localStorage.removeItem(CHAVE_EMAIL)}catch{/* navegador sem armazenamento: só não lembra */}}
function loginView(msg=''){window.Assistant?.sync();
 $('#app').innerHTML=`<div class="auth"><div class="authcard"><div class="authhead"><img class="authlogo" src="brand/jarvis-192.png" alt="Jarvis"><div class="authname">Jarvis</div><div class="authslogan">O ERP do futuro, hoje · Você vende. O Jarvis cuida do resto.</div></div>
 <h1 style="font-size:24px">Entre na sua operação</h1><p>Já tem conta? Informe e-mail e senha e clique em <strong>Entrar</strong>. Primeira vez? Clique em <strong>Criar conta</strong> e teste grátis por 7 dias. Seus dados ficam protegidos na nuvem e sincronizam entre computadores.</p>
 <form id="authForm" autocomplete="on"><div id="authNomeBox" hidden><label for="authNome">Seu nome</label><input id="authNome" autocomplete="name" style="width:100%" placeholder="Nome e sobrenome"></div><label for="authEmail">E-mail</label><input id="authEmail" type="email" required autocomplete="username" autocapitalize="none" spellcheck="false" value="" style="width:100%">
 <label for="authPass">Senha</label><input id="authPass" type="password" minlength="8" autocomplete="current-password" value="" style="width:100%" placeholder="Mínimo de 8 caracteres">
 <label class="row" style="gap:8px;align-items:center;margin-top:10px"><input type="checkbox" class="check" id="authLembrar"> <span class="caption">Lembrar meu e-mail neste aparelho</span></label>
 <div class="row wrap" style="margin-top:18px"><button class="primary" type="submit" data-auth="login">Entrar</button><button type="submit" data-auth="signup">Criar conta</button><button type="submit" class="quiet small" data-auth="magic">Receber link por e-mail</button></div></form>
 <div id="authMsg" class="caption" style="margin-top:16px;min-height:20px">${esc(msg)}</div></div></div>`;
 // O e-mail abre vazio: o Jarvis não guarda nem preenche nada sozinho. Só com "Lembrar meu e-mail neste aparelho"
 // marcado o e-mail (nunca a senha) fica neste navegador; desmarcar apaga. Salvar usuário e senha é com o gerenciador
 // de senhas do navegador, escolha de cada pessoa.
 const lembrado=emailLembrado(),campo=$('#authEmail');campo.value=lembrado;$('#authPass').value='';$('#authLembrar').checked=!!lembrado;
 $('#authLembrar').onchange=e=>{if(!e.target.checked)lembrarEmail('')};
 let mode='login';
 // Veio do botão "Teste grátis" do site (jaarvis.com.br): abre já no cadastro, com "Criar conta" como botão principal (Enter cria a conta).
 if(/[?&]cadastro=1/.test(location.search)){mode='signup';$('#authNomeBox').hidden=false;$('.authcard h1').textContent='Crie sua conta e teste grátis por 7 dias';
  const bs=$('#authForm button[data-auth="signup"]'),bl=$('#authForm button[data-auth="login"]');bs.classList.add('primary');bl.classList.remove('primary');bl.textContent='Já tenho conta: entrar';bs.parentElement.prepend(bs);$('#authPass').autocomplete='new-password'}
 $('#authForm').addEventListener('click',e=>{const b=e.target.closest('button[data-auth]');if(b){mode=b.dataset.auth;if(mode==='signup')$('#authNomeBox').hidden=false}},true);
 $('#authForm').onsubmit=async e=>{e.preventDefault();const email=$('#authEmail').value.trim(),password=$('#authPass').value,out=$('#authMsg');out.textContent='Aguarde…';lembrarEmail($('#authLembrar')?.checked?email:'');
  try{let r;const redirect=location.origin+location.pathname;
   if(mode==='magic')r=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:redirect}});
   else{if(password.length<8)throw Error('Informe uma senha com pelo menos 8 caracteres.');r=mode==='signup'?await (async()=>{const nome=($('#authNome')?.value||'').trim();if(!nome){$('#authNomeBox').hidden=false;$('#authNome').focus();throw Error('Para criar a conta, informe também o seu nome.')}const sv=await import('./escritorio/motor/senhas_vazadas.js').catch(()=>null);if(sv){const c=await sv.conferirSenhaNova(password,{jaAvisada:window.__jarvisSenhaAvisada||null});if(!c.segue){window.__jarvisSenhaAvisada=c.aviso?c.marca:null;throw Error(c.mensagem)}}return sb.auth.signUp({email,password,options:{emailRedirectTo:redirect,data:{nome}}})})():await sb.auth.signInWithPassword({email,password})}
   if(r.error)throw r.error;
   if(mode==='magic')out.textContent='Enviamos um link de acesso para '+email+'.';
   else if(mode==='signup'&&!r.data.session)out.textContent='Conta criada. Confirme pelo link enviado ao seu e-mail e entre para criar a sua empresa (ou acessar a empresa que te convidou).';
  }catch(err){out.textContent=({'Invalid login credentials':'E-mail ou senha incorretos.','Signups not allowed for this instance':'Novos cadastros estão fechados. Peça ao dono do workspace para liberar seu acesso.','Signups not allowed for otp':'Novos cadastros estão fechados. Use um e-mail que já tenha conta.'})[err.message]||err.message}};
}

// Conta sem empresa. No site do Jarvis: cria a própria (teste grátis de 7 dias) ou espera o convite de uma empresa que
// já usa o Jarvis. Numa instância (o Jarvis da empresa, no endereço dela): pede acesso a esta empresa (pedir_acesso,
// um pedido por conta, reaberto quando foi recusado) e espera quem administra liberar. Em todos: o e-mail exato da conta
// e o endereço da instalação, para a pessoa conferir com quem libera (liberar em outra instalação não vale aqui).
const MSG_PEDIDO={pendente:'Pedido enviado. Quem administra a empresa vê em Equipe e acessos › Pedidos de acesso; quando liberar, clique em Verificar.',
 membro:'Sua conta já tem acesso: clique em Verificar.',limite:'Você já pediu várias vezes. Aguarde quem administra responder (ou tente de novo mais tarde).',
 confirmar:'Confirme o seu e-mail pelo link que chegou na sua caixa de entrada e tente de novo.',indisponivel:'Este endereço não recebe pedidos de acesso: peça a quem administra para convidar o seu e-mail.'};
async function aguardandoView(session,aviso=''){let r=null;try{const {data:req}=await sb.from('access_requests').select('status,created_at,decided_at').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(1);r=req?.[0]||null}catch{}
 const I=window.CONCILIA_CONFIG?.instancia||null,inst=I?.id,email=esc(session.user.email||''),endereco=esc(I?.dominio||location.host||''),empresa=esc(I?.nome||''),
  quando=d=>new Date(d).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}),dia=d=>new Date(d).toLocaleDateString('pt-BR');
 const conta=`<div class="notice" id="accConta" style="margin-top:12px"><span class="caption">Sua conta</span><br><strong id="accEmail" style="font-size:18px;word-break:break-all;user-select:all">${email}</strong>
  <br><span class="caption">Você está em</span><br><strong id="accOnde">${inst&&empresa?`${empresa} · `:''}${endereco}</strong>
  <p class="caption" style="margin:6px 0 0">Confira com quem libera: o acesso vale para este e-mail exatamente (um ponto ou uma letra a mais é outra conta) e só para quem entra por este endereço.</p></div>`;
 let pedido='';
 if(inst){const st=r?.status;
  pedido=st==='pendente'?`<p id="accStatus" class="caption" style="margin-top:10px"><span class="badge info">Pedido enviado</span> em ${quando(r.created_at)}. Quem administra a empresa vê em <em>Equipe e acessos › Pedidos de acesso</em>. Quando liberar, clique em Verificar.</p>`
   :st==='recusado'?`<p id="accStatus" class="caption" style="margin-top:10px"><span class="badge warn">Não aprovado</span> Um pedido de acesso anterior (${dia(r.created_at)}) não foi aprovado. Se foi engano, peça de novo.</p><div class="row wrap" style="margin-top:8px"><button class="primary" id="accPedir">Pedir de novo</button></div>`
   :`<div class="row wrap" style="margin-top:12px"><button class="primary" id="accPedir">Pedir acesso a esta empresa</button></div><p class="caption" style="margin-top:6px">Quem administra recebe o pedido em <em>Equipe e acessos</em> e escolhe as telas que você vai usar.</p>`}
 const antigo=!inst&&r&&['recusado','pendente'].includes(r.status)?`<p class="caption" style="margin-top:8px">${r.status==='recusado'?'Um pedido de acesso anterior não foi aprovado':'Há um pedido de acesso anterior aguardando'} (${dia(r.created_at)}).</p>`:'';
 $('#app').innerHTML=`<div class="auth"><div class="authcard"><div class="authhead"><img class="authlogo" src="brand/jarvis-192.png" alt="Jarvis"><div class="authname">Jarvis</div><div class="authslogan">O ERP do futuro, hoje</div></div>
 <h1 style="font-size:23px">Bem-vindo ao Jarvis</h1>${inst?`<p>Sua conta está pronta, mas ainda <strong>sem acesso</strong> à empresa${empresa?` <strong>${empresa}</strong>`:''}. Peça acesso abaixo (ou peça a quem administra para liberar o seu e-mail em <em>Equipe e acessos</em>) e, quando liberarem, clique em Verificar.</p>${conta}${pedido}`:`<p>Sua conta <strong>${email}</strong> está pronta. Crie a sua empresa e teste grátis por 7 dias: conecte o ERP e os marketplaces só para leitura e veja quanto cada venda realmente deixa.</p>
 <form id="novaEmp" class="row wrap" style="gap:8px;margin-top:14px"><label for="novaEmpNome" class="sr-only" style="position:absolute;left:-9999px">Nome da empresa</label><input id="novaEmpNome" required minlength="2" maxlength="120" placeholder="Nome da sua empresa" style="flex:1;min-width:200px"><button class="primary" type="submit">Criar minha empresa</button></form>
 <p class="caption red" id="novaEmpErro" role="alert"></p>${conta}`}
 <p class="caption" id="accAviso" role="status" style="margin-top:8px">${esc(aviso)}</p>
 <div class="notice" style="margin-top:22px">${inst?`Já liberaram o seu e-mail? Clique em Verificar.`:`<strong>Vou acessar o Jarvis de uma empresa (sou da equipe ou da contabilidade)</strong><br>Não crie empresa. Peça ao administrador dela para te convidar pelo e-mail <strong>${email}</strong> em <em>Equipe e acessos</em>. Com o convite feito, clique em Verificar.`}
  <div class="row wrap" style="margin-top:10px"><button id="accCheck">Verificar</button></div>${antigo}</div>
 <div class="row" style="margin-top:16px"><button class="quiet small" id="accOut">Sair</button></div></div></div>`;
 $('#accCheck').onclick=()=>start(session);$('#accOut').onclick=async()=>{await sb.auth.signOut({scope:'local'})};
 // Pedir acesso (instância): cria ou reabre o pedido; a função do banco limita a repetição.
 const bp=$('#accPedir');if(bp)bp.onclick=async()=>{bp.disabled=true;let msg='';
  try{const {data,error}=await sb.rpc('pedir_acesso');if(error)throw error;if(data?.status==='membro'){await start(session);return}msg=MSG_PEDIDO[data?.status]||'Pedido registrado.'}
  catch(x){msg='Não foi possível pedir agora ('+(x.message||x)+'). Tente de novo.';bp.disabled=false;const a=$('#accAviso');if(a)a.textContent=msg;return}
  await aguardandoView(session,msg)};
 // Cadastro da própria empresa: vira dono, começa o teste grátis de 7 dias e abre os primeiros passos.
 const nf=$('#novaEmp');if(nf)nf.onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button'),nome=$('#novaEmpNome').value.trim();b.disabled=true;$('#novaEmpErro').textContent='';
  try{const {error}=await sb.rpc('criar_empresa',{nome});if(error)throw error;try{sessionStorage.setItem('jarvis_primeiros_passos','1')}catch{}location.hash='#comecar';await start(session)}
  catch(x){$('#novaEmpErro').textContent=x.message||String(x);b.disabled=false}}}

// Verificação em duas etapas: com autenticador cadastrado, os dados só abrem depois do código (o banco exige aal2).
function pedirCodigo(session){return new Promise(res=>{
 $('#app').innerHTML=`<div class="auth"><div class="authcard"><h2>Verificação em duas etapas</h2><p class="caption">Abra o app autenticador (Google Authenticator, Microsoft Authenticator, 1Password…) e digite o código de 6 dígitos do Jarvis.</p>
  <label for="mfaCod">Código</label><input id="mfaCod" inputmode="numeric" autocomplete="one-time-code" maxlength="9" style="width:100%;font-size:22px;letter-spacing:6px;text-align:center" autofocus>
  <p class="caption red" id="mfaErro"></p><div class="row" style="margin-top:12px"><button class="primary" id="mfaOk">Entrar</button><button class="quiet" id="mfaSair">Sair</button></div></div></div>`;
 const ir=async()=>{const code=$('#mfaCod').value.replace(/\D/g,'');if(code.length!==6){$('#mfaErro').textContent='Digite os 6 dígitos.';return}
  const {data:f}=await sb.auth.mfa.listFactors();const fator=(f?.totp||[]).find(x=>x.status==='verified');if(!fator){res(session);return}
  const {error}=await sb.auth.mfa.challengeAndVerify({factorId:fator.id,code});if(error){$('#mfaErro').textContent='Código inválido ou expirado. Tente o próximo.';$('#mfaCod').value='';return}
  const {data:s2}=await sb.auth.getSession();res(s2.session)};
 $('#mfaOk').onclick=ir;$('#mfaCod').onkeydown=e=>{if(e.key==='Enter')ir()};$('#mfaSair').onclick=()=>sb.auth.signOut({scope:'local'});setTimeout(()=>$('#mfaCod')?.focus(),50)})}
async function start(session){
 Cloud.session=session;
 if(!session){Cloud.ws=null;loginView();return}
 try{const {data:aal}=await sb.auth.mfa.getAuthenticatorAssuranceLevel();if(aal?.nextLevel==='aal2'&&aal.currentLevel!=='aal2'){session=await pedirCodigo(session);Cloud.session=session}}catch{}
 try{
  abrindoView('Carregando seus dados…');
  // Convite feito pelo administrador para este e-mail (já confirmado): entra na empresa com o perfil do convite.
  try{await sb.rpc('aceitar_convites')}catch{}
  const {data:ws,error}=await sb.rpc('ensure_workspace');if(error)throw error;
  // Quem foi adicionado a uma equipe abre o workspace da equipe; a escolha fica lembrada neste navegador.
  const {data:mems,error:me}=await sb.from('workspace_members').select('workspace_id,role,paginas,leitura,acessos,telas_conhecidas,created_at,workspaces(name)').eq('user_id',session.user.id).order('created_at');if(me)throw me;
  if(!(mems||[]).length){await aguardandoView(session);return}
  Cloud.workspaces=(mems||[]).map(m=>({id:m.workspace_id,role:m.role,paginas:m.paginas||null,leitura:m.leitura||null,acessos:m.acessos||null,telasConhecidas:m.telas_conhecidas||null,name:m.workspaces?.name||'Minha operação'}));
  let pref=null;try{pref=localStorage.getItem('concilia-ws')}catch{}
  const chosen=Cloud.workspaces.find(w=>w.id===pref)||Cloud.workspaces.find(w=>w.role==='member')||Cloud.workspaces.find(w=>w.id===ws)||{id:ws,role:'owner',name:'Minha operação'};
  Cloud.ws=chosen.id;Cloud.wsName=chosen.name;Cloud.role=chosen.role;Cloud.paginas=chosen.paginas||null;Cloud.leitura=chosen.leitura||null;Cloud.acessos=chosen.acessos||null;Cloud.telasConhecidas=chosen.telasConhecidas||null;
  const doCache=await lerCache(Cloud.ws);if(doCache){Cloud.settingsVersao=null;aplicarDados(doCache);Cloud.daCache=true}else await load();
  // Ao entrar, sempre a tela inicial. Fica na tela do endereço quando a página só recarregou no meio do uso
  // (atualização automática, F5, aba que o navegador descartou para poupar memória, volta da autorização de uma
  // integração) e nos primeiros passos de quem acabou de criar a empresa.
  const h=location.hash.slice(1).split('?')[0];let manter=false;try{manter=sessionStorage.getItem('jarvis_manter_tela')==='1';sessionStorage.removeItem('jarvis_manter_tela')}catch{}
  const recarga=(()=>{try{return document.wasDiscarded||['reload','back_forward'].includes(performance.getEntriesByType('navigation')[0]?.type)||/[?&](ok|erro)=/.test(location.hash)}catch{return false}})();
  if(h&&(manter||recarga||h==='comecar'))page=decodeURIComponent(h);else{page=window.Perfis?.inicio?.()||'resumo';if(h)try{history.replaceState(null,'',location.pathname+location.search)}catch{}}
  tentativas=0;render();
  // Quem administra fica sabendo dos pedidos de acesso ao entrar (aviso e o número no menu do nome).
  if(Cloud.role==='owner')setTimeout(()=>window.Integrations?.conferirPedidos?.(true),1200);
  if(Cloud.daCache)setTimeout(atualizarSegundoPlano,300);
  if(Cloud.localBackup&&!db.orders.length&&!db.receipts.length)offerMigration();
 }catch(e){console.error(e);erroAberturaView(session,'O Jarvis não conseguiu carregar a sua empresa ('+(e.message||e)+'). Seus dados estão seguros; é só tentar de novo.')}
}

function offerMigration(){const b=Cloud.localBackup;modal('Levar dados deste navegador para a nuvem',`<div class="notice">Encontramos ${b.orders.length} pedidos e ${b.receipts.length} liberações salvos apenas neste navegador. Deseja copiá-los para o seu workspace na nuvem?</div><div class="modalfoot"><button data-action="close">Agora não</button><button class="primary" data-cloud="migrate">${icon('upload')} Copiar para a nuvem</button></div>`)}

document.addEventListener('click',async e=>{const b=e.target.closest('button[data-cloud]');if(!b)return;
 const a=b.dataset.cloud;
 if(a==='migrate'){const src=Cloud.localBackup;db.orders=src.orders;db.receipts=src.receipts;db.imports=src.imports||[];db.closures=src.closures||{};db.ledger=src.ledger||[];db.crm=src.crm||{};db.audit=[...(src.audit||[]),...db.audit];Cloud.localBackup=null;audit('Dados locais enviados à nuvem',`${src.orders.length} pedidos e ${src.receipts.length} liberações copiados deste navegador.`);closeModal();render();await flush();toast('Dados copiados para a nuvem.')}
 if(a==='logout'){await flush();await sb.auth.signOut({scope:'local'});db=seed();snap={};Cloud.settingsVersao=null;render()}
 if(a==='reload'){b.disabled=true;await Cloud.reload();toast('Dados atualizados.')}
});

const renderSignedIn=render;
// Enquanto a empresa carrega (há sessão, mas ainda sem Cloud.ws), um render() não pode trocar a tela pelo login.
render=function(){if(!Cloud.ws){if(!Cloud.session)loginView();return}renderSignedIn()};

let started=false;
sb.auth.onAuthStateChange((event,session)=>{
 if(event==='INITIAL_SESSION'){if(started&&Cloud.session?.user?.id===session?.user?.id)return;started=true;start(session);return}
 if(event==='SIGNED_IN'&&(!Cloud.session||Cloud.session.user.id!==session.user.id)){start(session);return}
 if(event==='SIGNED_OUT'){limparCache();start(null);return}
 if(session)Cloud.session=session;
});
setTimeout(()=>{if(!started){started=true;sb.auth.getSession().then(({data})=>start(data.session))}},3000);
// Enquanto não há login, a tela do app não deve aparecer com dados locais.
abrindoView();
})();
