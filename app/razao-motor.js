// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Razão contábil do escritório: motor PURO (sem DOM) da tela web/razao.js (Contabilidade › Importar razão e Razão).
// Pedido do dono (18/11/2026): o razão de todas as contas chega do sistema do escritório "em blocos" — a conta numa
// linha ("Conta:" com o código reduzido, a classificação e o nome), o SALDO ANTERIOR, os lançamentos embaixo, o "Total do
// mês:" e o "Total da conta:", com o cabeçalho da página (Empresa, CNPJ, Período, RAZÃO e os títulos das colunas) e o
// rodapé ("Sistema licenciado para…") repetidos. Este motor transforma o arquivo em "uma linha por lançamento" (conta,
// classificação, nome, data, número, histórico, contrapartida, centro de custo, débito, crédito e saldo), aceita também
// o razão que já vem em colunas (com o mapeamento, igual ao do balancete) e confere tudo antes de gravar:
//   • por conta: saldo anterior + débitos − créditos = saldo final (saldo devedor positivo e credor negativo; a conta
//     credora que o arquivo mostra positiva é reconhecida e virada), o saldo linha a linha e os totais da conta e do mês;
//   • as linhas que não entendeu (com o número da linha do arquivo), as datas fora da competência e do período;
//   • as partidas dobradas (soma geral dos débitos = soma geral dos créditos);
//   • o fecho com o balancete do mesmo mês: o saldo de cada conta do razão = o saldo atual da conta no balancete, pelo
//     código reduzido ou, sem ele, pela classificação (somando as contas analíticas de mesma classificação), e as contas
//     que estão só num dos dois.
// Usado no navegador (window.RazaoMotor), no Web Worker da leitura (web/razao-worker.js, self.RazaoMotor) e no Node
// (module.exports), nos testes testes/ecom_razao_*.test.mjs.
(()=>{
const r2=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
const TOL=0.005; // meio centavo: valores do arquivo têm 2 casas
const igual=(a,b)=>Math.abs(r2(a)-r2(b))<TOL;
const norm=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[_\-./:;ºª°]+/g,' ').replace(/\s+/g,' ').trim();
const txt=v=>v==null?'':typeof v==='string'?v.replace(/\s+/g,' ').trim():String(v);
const vazio=v=>txt(v)==='';
const digitos=s=>String(s??'').replace(/\D/g,'');
const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const nomeMes=m=>{const x=/^(\d{4})-(\d{2})$/.exec(m||'');return x?`${MESES[+x[2]-1]} de ${x[1]}`:String(m||'')};
const dBR=d=>d?String(d).slice(0,10).split('-').reverse().join('/'):'';
const brl=n=>Number(r2(n)).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

// ───────── Números e datas ─────────
// Número do arquivo: número de verdade (xlsx) ou texto "1.234,56", "1,234.56", "-1.234,56", "(1.234,56)", "1.234,56 D",
// "1.234,56C" (C = credor = negativo), "1.234,56-". Devolve null quando não é número.
const RX_NUM=/^(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?)$/;
function numero(v){
 if(typeof v==='number')return Number.isFinite(v)?v:null;
 let s=txt(v);if(!s)return null;let sinal=1;
 if(/^\(.*\)$/.test(s)){sinal=-1;s=s.slice(1,-1).trim()}
 const dc=s.match(/\s*([DC])$/i);if(dc){if(dc[1].toUpperCase()==='C')sinal*=-1;s=s.slice(0,-dc[0].length).trim()}
 if(s.endsWith('-')){sinal*=-1;s=s.slice(0,-1).trim()}
 s=s.replace(/^R\$\s*/,'').replace(/\s/g,'');
 if(/^[-−]/.test(s)){sinal*=-1;s=s.slice(1).replace(/^R\$/,'')}else if(s.startsWith('+'))s=s.slice(1);
 if(!RX_NUM.test(s))return null;
 let t;if(/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(s)||/^\d+,\d+$/.test(s))t=s.replace(/\./g,'').replace(',','.');
 else if(/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(s))t=s.replace(/,/g,'');else t=s;
 const n=Number(t);return Number.isFinite(n)?sinal*n:null}
const num=v=>numero(v)??0;
// "Tem cara de valor": número com casas decimais ou com D/C — distingue o valor do número do lançamento e da contrapartida.
const ehValor=v=>typeof v==='number'?!Number.isInteger(v)||Math.abs(v)>=1e6:numero(v)!=null&&/[,.]\d{1,2}\s*[DC-]?\)?$|\s[DC]$/i.test(txt(v));
const ehInteiro=v=>typeof v==='number'?Number.isInteger(v):/^\d+$/.test(txt(v));
// Data: número de série do Excel, "dd/mm/aaaa", "dd/mm/aa", "aaaa-mm-dd" (com ou sem hora) ou Date. Devolve "aaaa-mm-dd" ou "".
function data(v){
 if(v instanceof Date&&!isNaN(v))return new Date(v.getTime()-v.getTimezoneOffset()*6e4).toISOString().slice(0,10);
 if(typeof v==='number'){if(v<20000||v>80000)return '';return new Date(Math.round((v-25569)*864e5)).toISOString().slice(0,10)}
 const s=txt(v);let m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/);if(m)return valida(+m[1],+m[2],+m[3]);
 m=s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})(?:\s.*)?$/);if(m){const a=m[3].length===2?2000+Number(m[3]):Number(m[3]);return valida(a,+m[2],+m[1])}
 return ''}
function valida(a,m,d){if(a<1990||a>2100||m<1||m>12||d<1||d>31)return '';const x=new Date(Date.UTC(a,m-1,d));return x.getUTCMonth()===m-1?x.toISOString().slice(0,10):''}

// ───────── Leitura de texto (CSV/TXT) guardando o número da linha ─────────
// Separador: o mais frequente nas primeiras linhas (relatório contábil costuma ter título na 1ª linha).
function separador(t){const head=t.split(/\r?\n/).slice(0,40).join('\n');return [';','\t','|',','].map(s=>[s,head.split(s).length]).sort((a,b)=>b[1]-a[1])[0][0]}
function linhasDeTexto(t,sep){t=String(t).replace(/^﻿/,'');sep=sep||separador(t);const rows=[],linhas=[];let row=[],campo='',aspas=false,n=1,inicio=1;
 for(let i=0;i<t.length;i++){const c=t[i];
  if(c==='"'){if(aspas&&t[i+1]==='"'){campo+='"';i++}else if(aspas||campo.trim()==='')aspas=!aspas;else campo+=c}
  else if(c===sep&&!aspas){row.push(campo);campo=''}
  else if((c==='\n'||c==='\r')&&!aspas){if(c==='\r'&&t[i+1]==='\n')i++;row.push(campo);rows.push(row);linhas.push(inicio);row=[];campo='';n++;inicio=n}
  else{if(c==='\n')n++;campo+=c}}
 row.push(campo);if(row.some(x=>x.trim())){rows.push(row);linhas.push(inicio)}
 return {rows,linhas,sep}}
function decodificar(buf){const b=buf instanceof Uint8Array?buf:new Uint8Array(buf);let t=new TextDecoder('utf-8').decode(b);if(t.includes('�'))t=new TextDecoder('windows-1252').decode(b);return t}

// Planilha (xlsx/xls/ods) ou texto (csv/txt/tsv) → { abas, aba, rows, linhas }. `XLSX` = SheetJS (no worker ou na página).
// Valores crus (número é número, data é o número de série): nada de formato americano "10/1/26" no meio do caminho.
// As linhas em branco ficam (blankrows), para o número da linha ser o da planilha.
function lerArquivo(buf,ext,XLSX,aba){ext=String(ext||'').toLowerCase();
 if(['xlsx','xls','ods','xlsm'].includes(ext)){if(!XLSX)throw Error('A biblioteca de planilhas não carregou. Recarregue a página.');
  const wb=XLSX.read(buf instanceof Uint8Array?buf:new Uint8Array(buf),{type:'array',cellDates:false,cellFormula:false,cellHTML:false,cellText:false});
  const nome=aba&&wb.SheetNames.includes(aba)?aba:wb.SheetNames[0],sh=wb.Sheets[nome];if(!sh)throw Error('A planilha não tem abas.');
  const ini=sh['!ref']?XLSX.utils.decode_range(sh['!ref']).s.r:0;
  const rows=XLSX.utils.sheet_to_json(sh,{header:1,raw:true,defval:'',blankrows:true});
  return {abas:wb.SheetNames.slice(),aba:nome,rows,linhas:rows.map((_,i)=>ini+i+1)}}
 const t=decodificar(buf),{rows,linhas,sep}=linhasDeTexto(t,ext==='tsv'?'\t':null);return {abas:[],aba:'',rows,linhas,sep}}

// ───────── Reconhecimento das linhas do razão "em blocos" ─────────
const CAMPOS_COLUNA={
 data:['data','dt','data lanc','data lancamento','dt lanc'],
 numero:['numero','n','nr','num','lanc','lancamento','n lanc','nº','no','n lancto','lancto','documento','doc'],
 historico:['historico','historico complementar','complemento','descricao'],
 cpart:['cta c part','cta c partida','c part','c partida','contrapartida','contra partida','conta contrapartida','cta contrapartida','ctapart','cpart'],
 centro:['centro','centro de custo','centro custo','c custo','ccusto','cc','c c'],
 debito:['debito','debitos','valor debito','deb'],
 credito:['credito','creditos','valor credito','cred'],
 saldo:['saldo','saldo exercicio','saldo atual','saldo acumulado','saldo final'],
};
const ROT_COLUNA={data:'Data',numero:'Número',historico:'Histórico',cpart:'Contrapartida',centro:'Centro de custo',debito:'Débito',credito:'Crédito',saldo:'Saldo'};
// A linha com os títulos das colunas (Data | Número | Histórico | Cta.C.Part. | Débito | Crédito | Saldo-Exercício):
// devolve as posições ou null.
function posicoesDoCabecalho(row){const n=row.map(norm),pos={};
 for(const [k,al] of Object.entries(CAMPOS_COLUNA)){const i=n.findIndex((v,j)=>v&&al.includes(v)&&!Object.values(pos).includes(j));pos[k]=i}
 return pos.data>=0&&pos.debito>=0&&pos.credito>=0?pos:null}
const CABECALHO_PAGINA=[/^empresa\b/,/^c n p j\b/,/^cnpj\b/,/^periodo\b/,/^folha\b/,/^pagina\b/,/^pag\b/,/^emissao\b/,/^hora\b/,/^sistema licenciado\b/,
 /^a transportar\b/,/^transporte\b/,/^de transporte\b/,/^transportado\b/,/^continua\b/,/^razao( analitico| contabil| geral)?$/,/^livro razao\b/,/^inscricao\b/,/^usuario\b/];
const RX_CONTA=/^conta\s*(?::|\s(?=\d))\s*(.*)$/i; // "Conta:" ou "Conta 123" (não "Contas a pagar")
function primeira(row){for(let i=0;i<row.length;i++)if(!vazio(row[i]))return i;return -1}
const naoVazias=row=>row.map((v,i)=>[i,v]).filter(([,v])=>!vazio(v));
function contem(row,re){return row.some(v=>re.test(norm(v)))}
function periodoDe(row){const s=row.map(txt).join(' '),d=s.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:-|a|até|ate|à)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);return d?{de:data(d[1]),ate:data(d[2])}:null}
// "Conta:" | 5 | 1.1.01.01.001 | CAIXA GERAL — ou tudo numa célula: "Conta: 5 - 1.1.01.01.001 - CAIXA GERAL".
function contaDe(row){const i=primeira(row),m=RX_CONTA.exec(txt(row[i]));if(!m)return null;
 const resto=[m[1],...row.slice(i+1).map(txt)].filter(Boolean).join(' ').trim();
 const x=resto.match(/^(?:(\d+)\s*[-–]?\s*)?(?:(\d+(?:\.\d+)+)\s*[-–]?\s*)?(.*)$/);
 const reduzido=x?.[1]||'',classificacao=x?.[2]||'',nome=(x?.[3]||'').replace(/^[-–\s]+/,'').trim();
 if(!reduzido&&!classificacao)return {erro:'linha "Conta:" sem o código da conta'};
 return {reduzido,classificacao,nome}}
// Os números de uma linha, da esquerda para a direita (só os que têm cara de valor, ignorando a coluna dada).
function valoresDe(row,de=0){const out=[];for(let i=de;i<row.length;i++)if(!vazio(row[i])&&ehValor(row[i]))out.push([i,numero(row[i])]);return out}

/**
 * Lê o razão "em blocos". rows: linhas do arquivo (arrays de células); opts.linhas: o número (ou rótulo) de cada linha no
 * arquivo; opts.colunas: posições escolhidas à mão (sobrepõem as do cabeçalho).
 * Devolve { layout:'blocos', empresa, cnpj, periodo, colunas, contas, lancs, naoEntendidas, totalGeral, ignoradas }.
 */
function lerBlocos(rows,opts={}){const L=i=>opts.linhas?.[i]??i+1;
 const R={layout:'blocos',empresa:'',cnpj:'',periodo:null,colunas:null,contas:[],lancs:[],naoEntendidas:[],totalGeral:null,ignoradas:0,continuacoes:0};
 let pos=opts.colunas?{...opts.colunas}:null,conta=null,ultimo=null,seg={d:0,c:0};
 const nao=(i,motivo)=>{R.naoEntendidas.push({linha:L(i),texto:naoVazias(rows[i]).map(([,v])=>txt(v)).join(' | ').slice(0,240),motivo});ultimo=null};
 const fechar=()=>{conta=null;seg={d:0,c:0}};
 const lanc=(i,row,dt)=>{if(!conta){nao(i,'lançamento antes de qualquer "Conta:"');return}
  const l=lancamento(row,pos,pos?pos.data:primeira(row),conta);if(l.erro){nao(i,l.erro);return}
  l.k=conta.k;l.linha=L(i);l.data=dt;if(conta.primeiro<0)conta.primeiro=R.lancs.length;
  R.lancs.push(l);conta.lancs++;conta.debito+=l.debito;conta.credito+=l.credito;seg.d+=l.debito;seg.c+=l.credito;
  if(l.saldo!=null)conta.saldoFinal=l.saldo;conta.corrente=l.saldo!=null?l.saldo:(conta.corrente??conta.saldoAnterior??0)+l.debito-l.credito;
  ultimo=l};
 for(let i=0;i<rows.length;i++){const row=rows[i]||[],p=primeira(row);if(p<0)continue;
  // o caso comum primeiro (dezenas de milhares de linhas): a data na coluna Data = lançamento
  if(pos){const dt=data(row[pos.data]);if(dt){lanc(i,row,dt);continue}}
  const n0=norm(row[p]),cells=naoVazias(row);
  // cabeçalho e rodapé da página
  if(CABECALHO_PAGINA.some(re=>re.test(n0))){R.ignoradas++;
   if(/^empresa\b/.test(n0)&&!R.empresa)R.empresa=txt(row[p]).replace(/^empresa\s*:?\s*/i,'')||txt(cells[1]?.[1]||'');
   if(/^(c n p j|cnpj)\b/.test(n0)&&!R.cnpj)R.cnpj=(txt(row[p]).replace(/^c\.?n\.?p\.?j\.?\s*:?\s*/i,'')||txt(cells[1]?.[1]||'')).trim();
   if(/^periodo\b/.test(n0)&&!R.periodo)R.periodo=periodoDe(row);
   ultimo=null;continue}
  const ph=posicoesDoCabecalho(row);if(ph){if(!opts.colunas)pos=ph;R.colunas=R.colunas||pos;R.ignoradas++;ultimo=null;continue}
  // Conta:
  if(RX_CONTA.test(txt(row[p]))&&p<=2){const c=contaDe(row);if(c.erro){nao(i,c.erro);continue}
   conta={k:R.contas.length,reduzido:c.reduzido,classificacao:c.classificacao,nome:c.nome,linha:L(i),saldoAnterior:null,linhaSaldoAnterior:null,
    debito:0,credito:0,lancs:0,primeiro:-1,saldoFinal:null,totaisMes:[],totalConta:null,fechada:false};
   R.contas.push(conta);seg={d:0,c:0};ultimo=null;continue}
  // Lançamento
  if(!pos){const dt=data(row[p]);if(dt){lanc(i,row,dt);continue}}
  // SALDO ANTERIOR
  if(contem(row,/^saldo anterior\b/)){if(!conta){nao(i,'SALDO ANTERIOR fora de uma conta (antes de qualquer "Conta:")');continue}
   const v=pos&&pos.saldo>=0&&numero(row[pos.saldo])!=null?numero(row[pos.saldo]):(valoresDe(row).at(-1)?.[1]??(cells.length>1?numero(cells.at(-1)[1]):null));
   if(v==null){nao(i,'SALDO ANTERIOR sem valor');continue}
   if(conta.lancs){nao(i,'SALDO ANTERIOR depois dos lançamentos da conta');continue}
   conta.saldoAnterior=r2(v);conta.linhaSaldoAnterior=L(i);ultimo=null;continue}
  // Total do mês / Total da conta / Total geral
  const tot=row.map(norm).find(v=>/^total (do mes|da conta|geral|do razao|do periodo)\b/.test(v)||v==='totais'||v==='total');
  if(tot){const vs=totaisDe(row,pos);
   if(/^total do mes/.test(tot)){if(!conta){nao(i,'"Total do mês" fora de uma conta');continue}conta.totaisMes.push({d:vs.d,c:vs.c,linha:L(i),somaD:r2(seg.d),somaC:r2(seg.c)});seg={d:0,c:0}}
   else if(/^total da conta|^total do periodo/.test(tot)){if(!conta){nao(i,'"Total da conta" fora de uma conta');continue}conta.totalConta={d:vs.d,c:vs.c,linha:L(i)};conta.fechada=true;fechar()}
   else R.totalGeral={d:vs.d,c:vs.c,linha:L(i)};
   ultimo=null;continue}
  // Continuação do histórico do lançamento de cima (texto sozinho, sem data nem valor)
  if(ultimo&&cells.length===1&&numero(cells[0][1])==null&&(!pos||cells[0][0]===pos.historico||Math.abs(cells[0][0]-pos.historico)<=1)){ultimo.historico=(ultimo.historico+' '+txt(cells[0][1])).trim();R.continuacoes++;continue}
  if(conta==null&&!R.contas.length&&!pos){R.ignoradas++;continue} // título antes de tudo (nome do relatório, filtros)
  nao(i,'linha fora do padrão do razão')}
 for(const c of R.contas){c.debito=r2(c.debito);c.credito=r2(c.credito);delete c.corrente}
 return R}
function totaisDe(row,pos){
 if(pos&&numero(row[pos.debito])!=null||pos&&numero(row[pos.credito])!=null)return {d:r2(num(row[pos.debito])),c:r2(num(row[pos.credito]))};
 const vs=row.map((v,i)=>[i,numero(v)]).filter(([,v])=>v!=null);return {d:r2(vs[0]?.[1]??0),c:r2(vs[1]?.[1]??0)}}
// Há valor (número com centavos) fora das colunas Débito, Crédito e Saldo? Então as colunas desta linha não estão no lugar.
function valorFora(row,pos){for(let j=0;j<row.length;j++){if(j===pos.debito||j===pos.credito||j===pos.saldo||j===pos.numero||j===pos.cpart||j===pos.data)continue;const v=row[j];
  if(typeof v==='number'){if(!Number.isInteger(v))return true}else if(typeof v==='string'&&/\d[.,]\d{2}\s*[DC]?\)?$/i.test(v)&&numero(v)!=null&&ehValor(v))return true}return false}
// Um lançamento: pelas posições dos títulos (xlsx/csv) ou, sem elas ou com os valores fora do lugar (PDF), pelo conteúdo.
function lancamento(row,pos,iData,conta){
 if(pos){const d=numero(row[pos.debito]),c=numero(row[pos.credito]),s=pos.saldo>=0?numero(row[pos.saldo]):null;
  if(d!=null||c!=null){
   if(!valorFora(row,pos))return {numero:pos.numero>=0?txt(row[pos.numero]):'',historico:pos.historico>=0?historicoDe(row,pos):'',cpart:pos.cpart>=0?txt(row[pos.cpart]):'',centro:pos.centro>=0?txt(row[pos.centro]):'',
    debito:r2(d??0),credito:r2(c??0),saldo:s==null?null:r2(s)}}}
 // pelo conteúdo: data | número | histórico | contrapartida | valor(es) | saldo
 const cells=naoVazias(row).filter(([j])=>j>iData);let vals=[];for(let j=cells.length-1;j>=0&&ehValor(cells[j][1]);j--)vals.unshift(cells[j]);
 const resto=cells.slice(0,cells.length-vals.length);let numeroL='',cpart='',hist=[];
 if(resto.length&&ehInteiro(resto[0][1])){numeroL=txt(resto.shift()[1])}
 if(resto.length&&ehInteiro(resto.at(-1)[1])&&resto.length>1||resto.length===1&&ehInteiro(resto[0][1])&&numeroL)cpart=txt(resto.pop()[1]);
 hist=resto.map(([,v])=>txt(v));
 if(!vals.length)return {erro:'lançamento sem valor'};
 const nums=vals.map(([,v])=>numero(v));let d=0,c=0,s=null;
 if(nums.length>=3){d=Math.abs(nums[0]);c=Math.abs(nums[1]);s=nums.at(-1)}
 else if(nums.length===2){const v=Math.abs(nums[0]);s=nums[1];const ant=conta.corrente??conta.saldoAnterior??0;
  if(igual(ant+v,s))d=v;else if(igual(ant-v,s))c=v;
  else return {erro:'não deu para saber se o valor é débito ou crédito (o saldo não fecha nem somando nem subtraindo)'}}
 else return {erro:'lançamento com um valor só: não dá para saber se é débito ou crédito'};
 return {numero:numeroL,historico:hist.join(' '),cpart,centro:'',debito:r2(d),credito:r2(c),saldo:s==null?null:r2(s)}}
function historicoDe(row,pos){const fim=[pos.cpart,pos.debito,pos.credito,pos.saldo,pos.centro].filter(x=>x>pos.historico).sort((a,b)=>a-b)[0]??row.length;
 const partes=[];for(let j=pos.historico;j<fim;j++)if(!vazio(row[j]))partes.push(txt(row[j]));return partes.join(' ')}

// ───────── Razão já em colunas (uma linha por lançamento, a conta numa coluna) ─────────
const CAMPOS_COLUNAS=[
 {key:'conta',label:'Conta (reduzido ou classificação)',required:true,aliases:['conta','codigo','cod conta','conta contabil','reduzido','cod reduzido','codigo reduzido','cta']},
 {key:'classificacao',label:'Classificação',aliases:['classificacao','classif','conta classificacao','mascara']},
 {key:'nome',label:'Nome da conta',aliases:['nome da conta','descricao da conta','nome conta','nome']},
 {key:'data',label:'Data',aliases:['data','dt','data lancamento','data lanc']},
 {key:'numero',label:'Número do lançamento',aliases:['numero','lancamento','lanc','n lanc','nr','documento','doc']},
 {key:'historico',label:'Histórico',aliases:['historico','complemento','historico complementar','descricao']},
 {key:'cpart',label:'Contrapartida',aliases:['contrapartida','contra partida','cta c part','c part','conta contrapartida']},
 {key:'centro',label:'Centro de custo',aliases:['centro de custo','centro','c custo','ccusto','cc']},
 {key:'debito',label:'Débito',aliases:['debito','valor debito','deb','debitos']},
 {key:'credito',label:'Crédito',aliases:['credito','valor credito','cred','creditos']},
 {key:'valor',label:'Valor (com D/C ou sinal)',aliases:['valor','valor lancamento']},
 {key:'dc',label:'D/C',aliases:['d c','dc','natureza','tipo','deb cred']},
 {key:'saldo',label:'Saldo',aliases:['saldo','saldo atual','saldo acumulado']},
];
// Linha dos títulos: a primeira (nas 60 de cima) com Conta e Débito/Crédito ou Valor.
function cabecalhoColunas(rows){for(let i=0;i<Math.min(60,rows.length);i++){const n=(rows[i]||[]).map(norm),tem=k=>CAMPOS_COLUNAS.find(x=>x.key===k).aliases.some(a=>n.includes(a));
  if(tem('conta')&&(tem('debito')&&tem('credito')||tem('valor')))return i}return 0}
function mapaAutomatico(row){const n=(row||[]).map(norm),m={},usados=new Set();
 for(const f of CAMPOS_COLUNAS){const al=f.aliases.concat(norm(f.label));const i=n.findIndex((v,j)=>v&&!usados.has(j)&&al.includes(v));m[f.key]=i;if(i>=0)usados.add(i)}return m}
function lerColunas(rows,{header=0,map={},linhas}={}){const L=i=>linhas?.[i]??i+1,col=(r,k)=>map[k]>=0?r[map[k]]:'';
 const R={layout:'colunas',empresa:'',cnpj:'',periodo:null,colunas:null,contas:[],lancs:[],naoEntendidas:[],totalGeral:null,ignoradas:0,continuacoes:0};
 const idx=new Map();let atual='',nomeAtual='';
 const contaPor=(cod,classif,nome,i)=>{const dotted=/\./.test(cod),reduzido=dotted?'':cod,classificacao=classif||(dotted?cod:'');const chave=reduzido||classificacao;
  let c=idx.get(chave);if(!c){c={k:R.contas.length,reduzido,classificacao,nome:nome||'',linha:L(i),saldoAnterior:null,saldoAnteriorInferido:false,linhaSaldoAnterior:null,debito:0,credito:0,lancs:0,primeiro:-1,saldoFinal:null,totaisMes:[],totalConta:null,fechada:false};idx.set(chave,c);R.contas.push(c)}
  if(!c.nome&&nome)c.nome=nome;if(!c.classificacao&&classificacao)c.classificacao=classificacao;return c};
 for(let i=header+1;i<rows.length;i++){const r=(rows[i]||[]).map(v=>v==null?'':v);if(r.every(vazio))continue;
  let cod=txt(col(r,'conta'));const nome=txt(col(r,'nome'));if(cod){atual=cod;nomeAtual=nome||''}else{cod=atual}
  const n=r.map(norm);
  let d=map.debito>=0?numero(col(r,'debito')):null,c=map.credito>=0?numero(col(r,'credito')):null;
  if(d==null&&c==null&&map.valor>=0){const v=numero(col(r,'valor'));if(v!=null){const t=norm(col(r,'dc'));if(t.startsWith('d'))d=Math.abs(v);else if(t.startsWith('c'))c=Math.abs(v);else if(v>=0)d=v;else c=-v}}
  const s=map.saldo>=0?numero(col(r,'saldo')):null,dt=data(col(r,'data'));
  if(n.some(v=>/^saldo anterior\b/.test(v))){if(!cod){R.naoEntendidas.push({linha:L(i),texto:r.map(txt).filter(Boolean).join(' | ').slice(0,240),motivo:'SALDO ANTERIOR sem conta'});continue}
   const cc=contaPor(cod,txt(col(r,'classificacao')),nome||nomeAtual,i),v=s??d??(c!=null?-c:null);if(v!=null&&!cc.lancs){cc.saldoAnterior=r2(v);cc.linhaSaldoAnterior=L(i)}continue}
  if(n.some(v=>/^total\b|^totais\b/.test(v))){R.ignoradas++;continue}
  if(d==null&&c==null){if(cod&&!dt&&r.filter(v=>!vazio(v)).length<=3){if(txt(col(r,'conta')))contaPor(cod,txt(col(r,'classificacao')),nome,i);R.ignoradas++;continue}
   R.naoEntendidas.push({linha:L(i),texto:r.map(txt).filter(Boolean).join(' | ').slice(0,240),motivo:'linha sem débito nem crédito'});continue}
  if(!cod){R.naoEntendidas.push({linha:L(i),texto:r.map(txt).filter(Boolean).join(' | ').slice(0,240),motivo:'lançamento sem conta'});continue}
  const cc=contaPor(cod,txt(col(r,'classificacao')),nome||nomeAtual,i);
  const l={k:cc.k,linha:L(i),data:dt,numero:txt(col(r,'numero')),historico:txt(col(r,'historico')),cpart:txt(col(r,'cpart')),centro:txt(col(r,'centro')),debito:r2(Math.abs(d??0)),credito:r2(Math.abs(c??0)),saldo:s==null?null:r2(s)};
  if(cc.primeiro<0){cc.primeiro=R.lancs.length;if(cc.saldoAnterior==null&&l.saldo!=null){cc.saldoAnterior=r2(l.saldo-l.debito+l.credito);cc.saldoAnteriorInferido=true}}
  R.lancs.push(l);cc.lancs++;cc.debito+=l.debito;cc.credito+=l.credito;if(l.saldo!=null)cc.saldoFinal=l.saldo}
 // Lançamentos da mesma conta espalhados pelo arquivo: agrupa por conta mantendo a ordem de cada uma.
 const ord=R.lancs.map((l,i)=>[l,i]).sort((a,b)=>a[0].k-b[0].k||a[1]-b[1]).map(([l])=>l);R.lancs=ord;const prim=new Map();ord.forEach((l,i)=>{if(!prim.has(l.k))prim.set(l.k,i)});
 for(const c of R.contas){c.debito=r2(c.debito);c.credito=r2(c.credito);c.primeiro=prim.has(c.k)?prim.get(c.k):-1}
 return R}

// Qual dos dois formatos: "Conta:" seguido de lançamentos = em blocos.
function detectar(rows){let contas=0,datas=0,saldoAnt=0;for(let i=0;i<Math.min(rows.length,5000);i++){const r=rows[i]||[],p=primeira(r);if(p<0)continue;
  if(RX_CONTA.test(txt(r[p]))&&p<=2&&contaDe(r)&&!contaDe(r).erro)contas++;else if(contem(r,/^saldo anterior\b/))saldoAnt++;else if(data(r[p]))datas++}
 return contas>=1&&(datas>=1||saldoAnt>=1)?'blocos':'colunas'}

function ler(rows,opts={}){const layout=opts.layout||detectar(rows);return layout==='blocos'?lerBlocos(rows,opts):lerColunas(rows,opts)}

// ───────── Conferência ─────────
const chaveConta=c=>c.reduzido||c.classificacao;
const rotuloConta=c=>[c.reduzido,c.classificacao,c.nome].filter(Boolean).join(' · ');
// O índice das contas do próprio razão pelo reduzido e pela classificação (para mostrar a contrapartida).
function indiceContas(R){const m=new Map();for(const c of R.contas){if(c.reduzido&&!m.has('r:'+c.reduzido))m.set('r:'+c.reduzido,c);if(c.classificacao&&!m.has('c:'+digitos(c.classificacao)))m.set('c:'+digitos(c.classificacao),c)}return m}
function contrapartidaDe(R,l,ix=indiceContas(R)){const v=txt(l.cpart);if(!v)return null;return ix.get('r:'+v)||(/\./.test(v)?ix.get('c:'+digitos(v)):null)||null}

/**
 * Confere o razão lido. opts: { competencia:'aaaa-mm', balancete:[linhas do balancete do mês (db.accLines kind balancete)] }.
 * Devolve { contas:[…com status e o porquê], problemas:[{grav:'erro'|'aviso'|'info', tipo, k?, linha?, texto}],
 *  linhasComProblema:Set(índice do lançamento), fecho, resumo }. Normaliza os saldos de R (conta credora positiva no
 *  arquivo vira negativa) — chame uma vez por leitura.
 */
function validar(R,opts={}){const P=[],ruins=new Set(),comp=opts.competencia||'';
 const add=(grav,tipo,texto,extra={})=>{P.push({grav,tipo,texto,...extra})};
 const lancsDe=c=>c.primeiro<0?[]:R.lancs.slice(c.primeiro,c.primeiro+c.lancs);
 const contas=R.contas.map(c=>{const ls=lancsDe(c),probs=[];let conv='sinal';
  const anterior=c.saldoAnterior;
  if(anterior==null&&R.layout==='blocos')probs.push(['aviso','sem SALDO ANTERIOR no arquivo: considerado zero']);
  // A conta credora que o arquivo mostra positiva: os saldos fecham ao contrário (saldo = anterior − débito + crédito).
  const comSaldo=ls.filter(l=>l.saldo!=null);
  if(comSaldo.length){const falhas=sinal=>{let ant=sinal*(anterior??0),f=0;for(const l of ls){if(l.saldo==null){ant+=l.debito-l.credito;continue}if(!igual(ant+l.debito-l.credito,sinal*l.saldo))f++;ant=sinal*l.saldo}return f};
   const fS=falhas(1),fI=falhas(-1);if(fS>0&&fI<fS&&fI===0){conv='credora positiva';for(const l of ls)if(l.saldo!=null)l.saldo=r2(-l.saldo);if(c.saldoAnterior!=null)c.saldoAnterior=r2(-c.saldoAnterior);if(c.saldoFinal!=null)c.saldoFinal=r2(-c.saldoFinal);
    probs.push(['info','o arquivo mostra o saldo desta conta credora positivo; considerado credor (negativo)'])}}
  // saldo linha a linha
  let ant=c.saldoAnterior??0,falhasLinha=0;
  for(let j=0;j<ls.length;j++){const l=ls[j],esp=r2(ant+l.debito-l.credito);if(l.saldo!=null){if(!igual(esp,l.saldo)){falhasLinha++;ruins.add(c.primeiro+j);
    if(falhasLinha<=20)add('erro','saldo_linha',`Conta ${rotuloConta(c)}: na linha ${l.linha} o saldo devia ser ${brl(esp)} (${brl(ant)} + ${brl(l.debito)} − ${brl(l.credito)}) e o arquivo mostra ${brl(l.saldo)}.`,{k:c.k,linha:l.linha})}ant=l.saldo}else ant=esp}
  if(falhasLinha>20)add('erro','saldo_linha',`Conta ${rotuloConta(c)}: mais ${falhasLinha-20} linha(s) com o saldo que não bate com a linha de cima.`,{k:c.k});
  if(falhasLinha)probs.push(['erro',`${falhasLinha} linha(s) com o saldo que não bate com a linha de cima`]);
  const calc=r2((c.saldoAnterior??0)+c.debito-c.credito),final=c.saldoFinal!=null?c.saldoFinal:(ls.length?null:c.saldoAnterior);
  if(final!=null&&!igual(calc,final)){const t=`saldo anterior ${brl(c.saldoAnterior??0)} + débitos ${brl(c.debito)} − créditos ${brl(c.credito)} = ${brl(calc)}, mas o saldo final no arquivo é ${brl(final)} (diferença ${brl(final-calc)})`;probs.push(['erro','não fecha: '+t]);add('erro','saldo_final',`Conta ${rotuloConta(c)} não fecha: ${t}.`,{k:c.k})}
  if(final==null&&ls.length)probs.push(['info','o arquivo não traz o saldo: o saldo final é o calculado']);
  // totais
  if(c.totalConta){for(const [lado,soma,tot] of [['débitos',c.debito,c.totalConta.d],['créditos',c.credito,c.totalConta.c]])if(!igual(soma,tot)){const t=`os ${lado} dos lançamentos somam ${brl(soma)} e o "Total da conta" (linha ${c.totalConta.linha}) mostra ${brl(tot)} (diferença ${brl(tot-soma)})`;probs.push(['erro',t]);add('erro','total_conta',`Conta ${rotuloConta(c)}: ${t}.`,{k:c.k,linha:c.totalConta.linha})}}
  else if(R.layout==='blocos'&&ls.length)probs.push(['aviso','sem "Total da conta" no arquivo para conferir os totais']);
  for(const t of c.totaisMes)for(const [lado,soma,tot] of [['débitos',t.somaD,t.d],['créditos',t.somaC,t.c]])if(!igual(soma,tot)){const x=`os ${lado} do mês somam ${brl(soma)} e o "Total do mês" (linha ${t.linha}) mostra ${brl(tot)}`;probs.push(['erro',x]);add('erro','total_mes',`Conta ${rotuloConta(c)}: ${x}.`,{k:c.k,linha:t.linha})}
  if(!ls.length&&R.layout==='blocos')probs.push(['info','sem lançamentos no período']);
  const natureza=final!=null?(final<0?'C':final>0?'D':''):(calc<0?'C':calc>0?'D':'');
  return {k:c.k,reduzido:c.reduzido,classificacao:c.classificacao,nome:c.nome,linha:c.linha,saldoAnterior:c.saldoAnterior,debito:c.debito,credito:c.credito,
   saldoCalculado:calc,saldoFinal:final!=null?final:calc,saldoNoArquivo:final!=null,lancs:c.lancs,convencao:conv,natureza,
   totalConta:c.totalConta,problemas:probs.map(([grav,texto])=>({grav,texto})),ok:!probs.some(([g])=>g==='erro')}});
 // linhas que não entendeu
 for(const x of R.naoEntendidas)add('aviso','nao_entendida',`Linha ${x.linha}: ${x.motivo} — "${x.texto}"`,{linha:x.linha});
 // datas
 const foraMes=[],foraPeriodo=[],semData=[];R.lancs.forEach((l,i)=>{if(!l.data){semData.push(i);ruins.add(i);return}if(comp&&l.data.slice(0,7)!==comp){foraMes.push(i);ruins.add(i)}if(R.periodo&&R.periodo.de&&R.periodo.ate&&(l.data<R.periodo.de||l.data>R.periodo.ate))foraPeriodo.push(i)});
 if(R.periodo&&comp&&R.periodo.de&&(R.periodo.de.slice(0,7)!==comp||R.periodo.ate.slice(0,7)!==comp))add('aviso','periodo',`O arquivo é do período ${dBR(R.periodo.de)} a ${dBR(R.periodo.ate)} e a competência escolhida é ${nomeMes(comp)}.`);
 const listaL=ix=>ix.slice(0,12).map(i=>R.lancs[i].linha).join(', ')+(ix.length>12?'…':'');
 if(foraMes.length)add('aviso','fora_mes',`${foraMes.length} lançamento(s) com data fora de ${nomeMes(comp)} (linhas ${listaL(foraMes)}).`);
 if(foraPeriodo.length)add('aviso','fora_periodo',`${foraPeriodo.length} lançamento(s) com data fora do período do arquivo (linhas ${listaL(foraPeriodo)}).`);
 if(semData.length)add('aviso','sem_data',`${semData.length} lançamento(s) sem data (linhas ${listaL(semData)}).`);
 // partidas dobradas
 const totD=r2(R.contas.reduce((a,c)=>a+c.debito,0)),totC=r2(R.contas.reduce((a,c)=>a+c.credito,0)),dif=r2(totD-totC);
 if(!igual(totD,totC))add('erro','partidas',`Partidas dobradas: a soma dos débitos (${brl(totD)}) é diferente da soma dos créditos (${brl(totC)}) — diferença de ${brl(Math.abs(dif))} a mais de ${dif>0?'débito':'crédito'}. Costuma ser uma conta que faltou no arquivo ou uma linha que não foi entendida.`);
 if(R.totalGeral){if(!igual(R.totalGeral.d,totD)||!igual(R.totalGeral.c,totC))add('erro','total_geral',`O total geral do arquivo (débitos ${brl(R.totalGeral.d)}, créditos ${brl(R.totalGeral.c)}, linha ${R.totalGeral.linha}) não bate com a soma das contas (débitos ${brl(totD)}, créditos ${brl(totC)}).`,{linha:R.totalGeral.linha})}
 // contrapartidas que não estão no razão
 const ix=indiceContas(R);let semCp=0;for(const l of R.lancs)if(l.cpart&&!contrapartidaDe(R,l,ix))semCp++;
 if(semCp)add('info','contrapartida',`${semCp} lançamento(s) com a contrapartida (${R.lancs.find(l=>l.cpart&&!contrapartidaDe(R,l,ix))?.cpart}…) que não é conta deste razão: a contrapartida fica só com o código.`);
 // balancete
 const fecho=fechoBalancete(R,contas,opts.balancete||[]);
 if(fecho.semBalancete)add('info','sem_balancete',`O balancete de ${nomeMes(comp)||'da competência'} ainda não foi importado: o fecho com o balancete fica para depois (importe o balancete e abra o razão de novo).`);
 for(const x of fecho.diferencas)add('erro','fecho',`Fecho com o balancete: ${x.texto}`,{k:x.k});
 for(const x of fecho.soNoBalancete)add(x.grav,'so_balancete',`Conta do balancete que não está no razão: ${x.texto}`);
 for(const x of fecho.soNoRazao)add('aviso','so_razao',`Conta do razão que não está no balancete: ${x.texto}`,{k:x.k});
 for(const c of contas){if(fecho.porConta.has(c.k)){const f=fecho.porConta.get(c.k);c.fecho=f;if(f.status==='diferente'){c.ok=false;c.problemas.push({grav:'erro',texto:f.texto})}else if(f.status==='so_razao')c.problemas.push({grav:'aviso',texto:'não está no balancete'});else if(f.nota)c.problemas.push({grav:'info',texto:f.nota})}}
 const erros=P.filter(p=>p.grav==='erro').length,avisos=P.filter(p=>p.grav==='aviso').length;
 const resumo={contas:R.contas.length,lancamentos:R.lancs.length,debito:totD,credito:totC,diferenca:dif,erros,avisos,naoEntendidas:R.naoEntendidas.length,foraDoMes:foraMes.length,
  contasQueNaoFecham:contas.filter(c=>c.problemas.some(p=>p.grav==='erro'&&!/balancete/.test(p.texto))).length,
  fecho:{semBalancete:fecho.semBalancete,modo:fecho.modo,comparadas:fecho.comparadas,fecham:fecho.fecham,diferencas:fecho.diferencas.length,soNoRazao:fecho.soNoRazao.length,soNoBalancete:fecho.soNoBalancete.length},
  ok:erros===0};
 return {contas,problemas:P,linhasComProblema:ruins,fecho,resumo}}

/**
 * Fecho com o balancete do mês. balancete: [{conta, descricao, reduzido?, debito, credito, saldoAnterior, saldo}] (as linhas
 * importadas do balancete). Liga pelo código reduzido quando o balancete o traz (coluna própria, ou a coluna "Conta" só
 * com números que batem com os reduzidos do razão); senão pela classificação, somando as contas de mesma classificação dos
 * dois lados. Compara o saldo final (e, quando o balancete traz, os débitos e os créditos do mês).
 */
function fechoBalancete(R,contas,balancete){const F={semBalancete:!balancete.length,modo:'',comparadas:0,fecham:0,diferencas:[],soNoRazao:[],soNoBalancete:[],porConta:new Map()};if(F.semBalancete)return F;
 const reds=new Set(R.contas.map(c=>c.reduzido).filter(Boolean));
 const temRed=balancete.filter(b=>txt(b.reduzido)).length,codigoRed=balancete.filter(b=>/^\d+$/.test(txt(b.conta))&&reds.has(txt(b.conta))).length;
 const modo=F.modo=temRed>=balancete.length/2?'reduzido':codigoRed>=Math.max(1,balancete.length/3)?'reduzido_conta':'classificacao';
 const chaveB=b=>modo==='reduzido'?txt(b.reduzido):modo==='reduzido_conta'?txt(b.conta):digitos(b.conta);
 const chaveR=c=>modo==='classificacao'?digitos(c.classificacao):c.reduzido;
 const nomeB=new Map(),B=new Map();for(const b of balancete){const k=chaveB(b);if(!k)continue;const x=B.get(k)||{k,codigo:txt(modo==='reduzido'?b.reduzido:b.conta),classificacao:txt(b.conta),nome:txt(b.descricao),saldo:0,debito:0,credito:0,temSaldo:false,temMov:false,n:0};
  x.n++;if(b.saldo!=null&&b.saldo!==''){x.saldo+=Number(b.saldo)||0;x.temSaldo=true}x.debito+=Number(b.debito)||0;x.credito+=Number(b.credito)||0;if(Number(b.debito)||Number(b.credito))x.temMov=true;B.set(k,x);nomeB.set(k,x.nome)}
 // contas analíticas do balancete: as que não são o começo de outra (classificação com pontos; reduzido é sempre analítica)
 const codigos=[...B.values()].map(x=>x.classificacao);
 const ehAnalitica=x=>modo!=='classificacao'?true:!codigos.some(o=>o!==x.classificacao&&(o.startsWith(x.classificacao+'.')||(!/\./.test(x.classificacao)&&o.length>x.classificacao.length&&o.startsWith(x.classificacao))));
 const G=new Map();for(const c of contas){const k=chaveR(c);if(!k){F.soNoRazao.push({k:c.k,texto:`${rotuloConta(c)} (sem ${modo==='classificacao'?'classificação':'código reduzido'} para ligar)`});F.porConta.set(c.k,{status:'so_razao'});continue}
  const g=G.get(k)||{k,contas:[],saldo:0,debito:0,credito:0};g.contas.push(c);g.saldo+=c.saldoFinal;g.debito+=c.debito;g.credito+=c.credito;G.set(k,g)}
 for(const g of G.values()){const b=B.get(g.k),rot=g.contas.length>1?`${g.contas[0].classificacao||g.k} · ${g.contas[0].nome} (${g.contas.length} contas analíticas somadas)`:rotuloConta(g.contas[0]);
  if(!b){for(const c of g.contas){F.soNoRazao.push({k:c.k,texto:`${rotuloConta(c)} — saldo final ${brl(c.saldoFinal)}`});F.porConta.set(c.k,{status:'so_razao'})}continue}
  F.comparadas++;const sr=r2(g.saldo),sb=r2(b.saldo),difs=[];let nota='';
  if(b.temSaldo&&!igual(sr,sb)){if(igual(Math.abs(sr),Math.abs(sb)))nota=`fecha com o balancete (${brl(Math.abs(sb))}); o balancete traz o saldo sem o sinal da natureza`;else difs.push(`saldo final no razão ${brl(sr)} e no balancete ${brl(sb)} (diferença ${brl(sr-sb)})`)}
  if(b.temMov){if(!igual(g.debito,b.debito))difs.push(`débitos do mês no razão ${brl(g.debito)} e no balancete ${brl(b.debito)}`);if(!igual(g.credito,b.credito))difs.push(`créditos do mês no razão ${brl(g.credito)} e no balancete ${brl(b.credito)}`)}
  if(!b.temSaldo&&!b.temMov)nota='o balancete não traz o saldo desta conta para comparar';
  b.usada=true;
  if(difs.length){const texto=`${rot}: ${difs.join('; ')}.`;F.diferencas.push({k:g.contas[0].k,codigo:b.codigo||g.k,nome:b.nome||g.contas[0].nome,razao:sr,balancete:sb,dif:r2(sr-sb),texto});for(const c of g.contas)F.porConta.set(c.k,{status:'diferente',texto:'não fecha com o balancete: '+difs.join('; ')})}
  else{F.fecham++;for(const c of g.contas)F.porConta.set(c.k,{status:'fecha',nota})}}
 for(const b of B.values()){if(b.usada||!ehAnalitica(b))continue;if(!b.temMov&&!(b.temSaldo&&!igual(b.saldo,0)))continue;
  F.soNoBalancete.push({grav:b.temMov?'erro':'aviso',codigo:b.codigo,nome:b.nome,saldo:r2(b.saldo),texto:`${b.codigo} · ${b.nome} — ${b.temMov?`tem movimento no mês (débitos ${brl(b.debito)}, créditos ${brl(b.credito)})`:`saldo ${brl(b.saldo)} sem movimento (o razão pode ter deixado de fora as contas paradas)`}`})}
 return F}

// ───────── Centro de custo por regra ─────────
// regra: { conta: reduzido ou começo da classificação (opcional), contem: texto do histórico (opcional), centro }.
// Só preenche o centro vazio; devolve quantos lançamentos receberam.
function aplicarCentros(R,regras){let n=0;const rs=(regras||[]).filter(r=>txt(r.centro)&&(txt(r.conta)||txt(r.contem)));
 for(const l of R.lancs){if(txt(l.centro))continue;const c=R.contas[l.k];
  for(const r of rs){const ct=txt(r.conta),h=norm(r.contem);
   if(ct&&!(c.reduzido===ct||c.classificacao===ct||c.classificacao.startsWith(ct+'.')))continue;
   if(h&&!norm(l.historico).includes(h))continue;l.centro=txt(r.centro);n++;break}}
 return n}

// ───────── Gravação ─────────
// As linhas da tabela contab_razao (sem workspace_id e carga_id, que a tela põe).
function paraBanco(R,competencia){const ix=indiceContas(R);return R.lancs.map((l,i)=>{const c=R.contas[l.k],cp=contrapartidaDe(R,l,ix);
 return {competencia,linha:i+1,conta:c.reduzido||c.classificacao,classificacao:c.classificacao||null,conta_nome:c.nome||null,data:l.data||null,numero:l.numero||null,historico:l.historico||null,
  contrapartida:l.cpart||null,contrapartida_classificacao:cp?(cp.classificacao||null):null,centro:l.centro||null,debito:l.debito,credito:l.credito,saldo:l.saldo,linha_origem:String(l.linha)}})}
// O resumo por conta (contab_razao_cargas.contas_resumo e o razão na DRE quando não há balancete).
function resumoContas(V){return V.contas.map(c=>({reduzido:c.reduzido,classificacao:c.classificacao,nome:c.nome,saldo_anterior:c.saldoAnterior??0,debito:c.debito,credito:c.credito,saldo_final:c.saldoFinal,lancamentos:c.lancs,ok:c.ok}))}
// As linhas "razao" de db.accLines (uma por conta), para a DRE usar o razão quando o mês não tem balancete.
function linhasDRE(V,month){return V.contas.map(c=>({id:`razao-${month}-${c.reduzido||digitos(c.classificacao)||c.k}-${c.k}`,month,kind:'razao',conta:c.classificacao||c.reduzido,descricao:c.nome,data:null,historico:'',debito:c.debito,credito:c.credito,saldoAnterior:c.saldoAnterior??0,saldo:c.saldoFinal}))}
// Texto curto do que não fechou (para o resumo do Confirmar e a auditoria).
function textoResumo(V){const s=V.resumo,p=[];p.push(`${s.contas} contas, ${s.lancamentos.toLocaleString('pt-BR')} lançamentos, débitos ${brl(s.debito)} e créditos ${brl(s.credito)}`);
 if(!igual(s.debito,s.credito))p.push(`diferença de ${brl(Math.abs(s.diferenca))} entre débitos e créditos`);
 if(s.contasQueNaoFecham)p.push(`${s.contasQueNaoFecham} conta(s) que não fecham`);if(s.naoEntendidas)p.push(`${s.naoEntendidas} linha(s) não entendidas`);if(s.foraDoMes)p.push(`${s.foraDoMes} lançamento(s) fora do mês`);
 if(!s.fecho.semBalancete)p.push(s.fecho.diferencas||s.fecho.soNoBalancete?`fecho com o balancete: ${s.fecho.fecham} de ${s.fecho.comparadas} contas fecham, ${s.fecho.diferencas} com diferença, ${s.fecho.soNoBalancete} só no balancete`:`fecha com o balancete (${s.fecho.fecham} contas)`);
 return p.join('; ')}

const M={r2,igual,norm,numero,num,data,dBR,brl,nomeMes,digitos,linhasDeTexto,separador,decodificar,lerArquivo,posicoesDoCabecalho,contaDe,lerBlocos,lerColunas,cabecalhoColunas,mapaAutomatico,
 detectar,ler,validar,fechoBalancete,aplicarCentros,paraBanco,resumoContas,linhasDRE,textoResumo,indiceContas,contrapartidaDe,rotuloConta,chaveConta,CAMPOS_COLUNA,ROT_COLUNA,CAMPOS_COLUNAS};
if(typeof self!=='undefined')self.RazaoMotor=M;
if(typeof window!=='undefined')window.RazaoMotor=M;
if(typeof module!=='undefined'&&module.exports)module.exports=M;
})();
