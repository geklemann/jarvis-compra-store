// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// DRE e Contabilidade › Importar razão (ajuste e validação do arquivo do escritório) e a aba Razão (consulta e exportação).
// Pedido do dono (18/11/2026): o razão de todas as contas chega "em blocos" (a conta numa linha e os lançamentos embaixo)
// e o sistema não entendia. A importação:
//   1. lê o arquivo (.xlsx .xls .ods .csv .txt .pdf com texto) num Web Worker (web/razao-worker.js), sem travar a página;
//   2. reconhece o formato "em blocos" (ou o razão já em colunas, com o mapeamento igual ao do balancete), mostra o
//      arquivo transformado em uma linha por lançamento (prévia paginada, com o filtro por conta, a busca e o centro de
//      custo editável ou por regra) e a conferência com o porquê de cada diferença (motor web/razao-motor.js), inclusive
//      o fecho com o balancete do mesmo mês, se já importado;
//   3. grava só depois do "Confirmar", em blocos, com barra de progresso, trocando o razão do mesmo mês de uma vez (as
//      funções contab_razao_* da migração 20261204110000_contab_razao.sql) e guarda o arquivo original no espaço
//      "contabil" (Documentos do mês). O resumo por conta vai para as linhas "razão" da DRE (db.accLines), que a DRE usa
//      quando o mês ainda não tem balancete.
// Modo local e demonstração: o razão fica só nesta sessão (o navegador não guarda dezenas de milhares de linhas).
(()=>{
const M=window.RazaoMotor;
const VER=(document.currentScript?.src||'').match(/[?&]v=([^&#]+)/)?.[1]||'';
const PAG=100,BLOCO=1000,PARALELO=4;
const r2=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
const nuvem=()=>!!(window.Cloud?.ws&&window.Cloud?.client);
const brl=n=>money(n||0);
const vNum=v=>v==null||v===''?'':brl(v);
const mesRot=m=>M.nomeMes(m);
let st=null;                         // estado da janela de importação
const cache=new Map();               // competência → { carga|null, carregando, erro } (nuvem)
const local=new Map();               // competência → { carga, linhas } (modo local: só nesta sessão)
const ui={m:'',conta:'',de:'',ate:'',centro:'',busca:'',pagina:0,res:null,chave:'',exportando:false};
window.Reiniciar?.registrar(ui,['conta','de','ate','centro','busca','pagina']);

// ───────── Leitura: Web Worker, ou na própria página quando o navegador não tem worker ─────────
let worker=null,seq=0;const pend=new Map();const inl={rows:null,linhas:null};
function inline(m){const resp=()=>({total:inl.rows.length,amostra:inl.rows.slice(0,80),layout:M.detectar(inl.rows),cabecalho:M.cabecalhoColunas(inl.rows)});
 if(m.tipo==='ler'){const a=M.lerArquivo(m.buf,m.ext,window.XLSX,m.aba);inl.rows=a.rows;inl.linhas=a.linhas;return {abas:a.abas,aba:a.aba,...resp()}}
 if(m.tipo==='linhas'){inl.rows=m.rows;inl.linhas=m.linhas||null;return {abas:[],aba:'',...resp()}}
 if(m.tipo==='processar'){if(!inl.rows)throw Error('Selecione o arquivo de novo.');const o=m.opts||{};const R=M.ler(inl.rows,{layout:o.layout,header:o.header,map:o.map,colunas:o.colunas,linhas:inl.linhas});
  if(o.regras?.length)M.aplicarCentros(R,o.regras);return {R,V:M.validar(R,{competencia:o.competencia,balancete:o.balancete||[]})}}
 throw Error('mensagem desconhecida')}
function chamar(msg){
 if(worker===null&&typeof Worker==='function'){try{worker=new Worker('razao-worker.js'+(VER?'?v='+encodeURIComponent(VER):''));
   worker.onmessage=e=>{const p=pend.get(e.data?.id);if(!p)return;pend.delete(e.data.id);e.data.ok?p.ok(e.data):p.er(Error(e.data.erro))};
   // o worker não subiu (bloqueado, sem a biblioteca): o que estava esperando roda aqui mesmo
   worker.onerror=e=>{e.preventDefault?.();worker=false;for(const [id,p] of pend){pend.delete(id);try{p.ok(inline(p.msg))}catch(x){p.er(x)}}}}
  catch{worker=false}}
 if(!worker){try{return Promise.resolve(inline(msg))}catch(x){return Promise.reject(x)}}
 const id=++seq;return new Promise((ok,er)=>{pend.set(id,{ok,er,msg});worker.postMessage({...msg,id,v:VER})})}

// PDF: o texto de cada página, linha a linha (o mesmo jeito do importador, sem o limite de 100 páginas: o razão é longo).
async function linhasDoPdf(buf,prog){const pdfjs=await import('./vendor/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='./vendor/pdf.worker.mjs';
 const task=pdfjs.getDocument({data:new Uint8Array(buf),isEvalSupported:false,useSystemFonts:true});let pdf;const rows=[],linhas=[];
 try{pdf=await task.promise;if(pdf.numPages>3000)throw Error('O PDF tem mais de 3.000 páginas. Peça ao escritório a planilha (.xlsx) do razão.');
  for(let n=1;n<=pdf.numPages;n++){prog?.(n,pdf.numPages);const page=await pdf.getPage(n),content=await page.getTextContent(),ls=[];
   for(const it of content.items){if(!it.str?.trim())continue;const y=it.transform[5];let l=ls.find(x=>Math.abs(x.y-y)<3);if(!l){l={y,items:[]};ls.push(l)}l.items.push(it)}
   ls.sort((a,b)=>b.y-a.y);let k=0;
   for(const l of ls){l.items.sort((a,b)=>a.transform[4]-b.transform[4]);const cells=[];let cell='',end=null;
    for(const it of l.items){const x=it.transform[4],gap=end===null?0:x-end;if(end!==null&&gap>Math.max(12,Math.abs(it.height||10)*1.1)){cells.push(cell);cell=''}else if(cell&&!cell.endsWith(' '))cell+=' ';cell+=it.str;end=x+(it.width||0)}
    if(cell)cells.push(cell);if(cells.length){rows.push(cells);linhas.push(`pág. ${n}, linha ${++k}`)}}
   page.cleanup()}
  if(!rows.length)throw Error('Não encontramos texto selecionável. Este PDF pode ser escaneado: peça a planilha ao escritório.');
  return {rows,linhas}}finally{if(pdf)await pdf.destroy();else await task.destroy()}}

// ───────── Janela de importação ─────────
function balanceteDe(m){return (db.accLines||[]).filter(l=>l.month===m&&(l.kind||'balancete')==='balancete').map(l=>({conta:l.conta,descricao:l.descricao,reduzido:l.reduzido||'',debito:l.debito,credito:l.credito,saldoAnterior:l.saldoAnterior,saldo:l.saldo}))}
function importar(){st={fase:'arquivo',file:null,nome:'',ext:'',abas:[],aba:'',total:0,amostra:[],layoutDetectado:'',layout:'',header:0,map:{},colunas:null,
  competencia:typeof month==='string'?month:'',R:null,V:null,aba2:'lanc',pagina:0,conta:'',busca:'',soProblemas:false,regras:[],edicoes:{},msg:'',prog:null,comErros:false,filtroIx:null};
 modal(`Importar razão · ${mesRot(st.competencia)}`,'<div id="rzBody"></div>');document.querySelector('.modalback .modal')?.classList.add('modalwide');paint()}
async function lerArquivo(file){if(!file||!st)return;st.file=file;st.nome=file.name;st.ext=file.name.split('.').pop().toLowerCase();st.R=st.V=null;st.fase='lendo';st.msg='Lendo o arquivo…';paint();
 try{if(file.size>60*1024*1024)throw Error('Arquivo acima de 60 MB. Peça ao escritório o razão em planilha (.xlsx).');
  if(!['xlsx','xls','ods','xlsm','csv','txt','tsv','pdf'].includes(st.ext))throw Error('Formato não aceito. Use .xlsx, .xls, .ods, .csv, .txt ou .pdf com texto.');
  const buf=await file.arrayBuffer();let r;
  if(st.ext==='pdf'){const p=await linhasDoPdf(buf,(n,t)=>{st.msg=`Lendo o PDF: página ${n} de ${t}…`;paintMsg()});r=await chamar({tipo:'linhas',rows:p.rows,linhas:p.linhas})}
  else r=await chamar({tipo:'ler',buf,ext:st.ext});
  aplicarLeitura(r);await processar()}
 catch(e){st.fase='arquivo';st.msg='Não foi possível ler: '+(e.message||e);paint()}}
function aplicarLeitura(r){Object.assign(st,{abas:r.abas||[],aba:r.aba||'',total:r.total,amostra:r.amostra||[],layoutDetectado:r.layout,layout:r.layout,header:r.cabecalho||0,map:{},colunas:null});
 st.map=M.mapaAutomatico(st.amostra[st.header]);st.msg=`${r.total.toLocaleString('pt-BR')} linhas no arquivo · formato ${r.layout==='blocos'?'em blocos (a conta numa linha e os lançamentos embaixo)':'em colunas'} reconhecido.`;
 // o período do cabeçalho ("Período: 01/10/2026 - 31/10/2026"): sendo um mês só, a competência vai para ele
 const per=M.lerBlocos(st.amostra).periodo,pm=per?.de?.slice(0,7);
 if(pm&&pm===per.ate?.slice(0,7)&&pm!==st.competencia){st.competencia=pm;st.msg+=` A competência foi ajustada para ${mesRot(pm)}, o período do arquivo (dá para trocar abaixo).`;const h=document.querySelector('.modalhead h2');if(h)h.textContent=`Importar razão · ${mesRot(pm)}`}}
async function trocarAba(aba){if(!st?.file)return;st.fase='lendo';st.msg='Lendo a aba…';paint();try{const r=await chamar({tipo:'ler',buf:await st.file.arrayBuffer(),ext:st.ext,aba});aplicarLeitura(r);await processar()}catch(e){st.fase='ajuste';st.msg='Não foi possível ler: '+(e.message||e);paint()}}
async function processar(){if(!st)return;st.fase='lendo';st.msg=st.msg||'Transformando…';paintMsg();
 try{const r=await chamar({tipo:'processar',opts:{layout:st.layout,header:st.header,map:st.map,colunas:st.colunas,competencia:st.competencia,balancete:balanceteDe(st.competencia),regras:st.regras}});
  if(!st)return;st.R=r.R;st.V=r.V;
  for(const l of st.R.lancs)if(Object.prototype.hasOwnProperty.call(st.edicoes,l.linha))l.centro=st.edicoes[l.linha];
  if(st.layout==='blocos'&&!st.colunas&&st.R.colunas)st.colunasDetectadas=st.R.colunas;
  st.fase='ajuste';st.pagina=0;st.filtroIx=null;st.comErros=false}
 catch(e){st.fase='ajuste';st.R=st.V=null;st.msg='Não deu para transformar: '+(e.message||e)}
 paint()}

const MET=(l,v,cap='',tom='')=>`<div class="card metric"><div class="label">${l}</div><div class="value ${tom}" style="font-size:19px">${v}</div>${cap?`<small>${cap}</small>`:''}</div>`;
const letra=i=>{let s='';i++;while(i>0){const r=(i-1)%26;s=String.fromCharCode(65+r)+s;i=Math.floor((i-1)/26)}return s};
function paintMsg(){const el=document.querySelector('#rzMsg');if(el)el.textContent=st?.msg||''}
function paint(){const el=document.querySelector('#rzBody');if(!el||!st)return;el.innerHTML=corpo();if(st.fase==='ajuste')paintTabela()}
function corpo(){const s=st;const lendo=s.fase==='lendo';
 if(s.fase==='gravando'||s.fase==='pronto')return gravandoHtml();
 return `<div class="notice">O razão do escritório costuma vir <strong>em blocos</strong>: a conta numa linha e os lançamentos embaixo, com o cabeçalho de cada página repetido. O Jarvis transforma em <strong>uma linha por lançamento</strong> (conta, data, número, histórico, contrapartida, centro, débito, crédito e saldo), confere conta por conta e com o balancete do mês e só grava quando você confirmar.</div>
 <label class="dropzone" for="rzArq" style="margin:8px 0 10px;padding:${s.nome?'14px':'22px'}">${icon('upload')}<h3>${s.nome?esc(s.nome):'Selecione o arquivo do razão'}</h3><p class="caption">.xlsx · .xls · .ods · .csv · .txt · .pdf com texto</p><input type="file" id="rzArq" data-rz-arq accept=".xlsx,.xls,.ods,.xlsm,.csv,.tsv,.txt,.pdf" style="margin-top:10px;width:100%"></label>
 <p class="caption" id="rzMsg" role="status">${esc(s.msg)}</p>
 ${s.total&&!lendo?ajusteHtml():''}${lendo?'<div class="empty">Lendo e transformando… a página continua livre.</div>':''}
 ${s.R&&s.V&&!lendo?resultadoHtml():''}
 <div class="modalfoot" style="flex-wrap:wrap;align-items:center">${s.V&&!s.V.resumo.ok&&!lendo?`<label class="row caption" style="margin:0;margin-right:auto"><input type="checkbox" class="check" data-rz-comerros ${s.comErros?'checked':''}> Conferi as diferenças e quero gravar assim mesmo</label>`:''}<button data-action="close">Cancelar</button><button class="primary" data-rz="confirmar" ${!s.R||!s.R.lancs.length||lendo||(!s.V.resumo.ok&&!s.comErros)?'disabled':''}>${icon('check')} Confirmar e gravar</button></div>`}

function ajusteHtml(){const s=st,h=s.amostra[s.header]||[],cols=Math.max(...s.amostra.slice(0,80).map(r=>r.length),h.length,1);
 const opcoesCol=(sel,vazio)=>`<option value="-1">${vazio}</option>`+Array.from({length:cols},(_,i)=>`<option value="${i}" ${sel===i?'selected':''}>${letra(i)}${h[i]!==undefined&&String(h[i]).trim()?' · '+esc(String(h[i]).slice(0,30)):''}</option>`).join('');
 const blocosCols=s.colunas||s.colunasDetectadas||{},hb=s.amostra.find(r=>M.posicoesDoCabecalho(r))||[];
 const opcoesB=(sel)=>`<option value="-1">Não tem</option>`+Array.from({length:cols},(_,i)=>`<option value="${i}" ${sel===i?'selected':''}>Coluna ${letra(i)}${hb[i]!==undefined&&String(hb[i]).trim()?' · '+esc(String(hb[i]).slice(0,24)):''}</option>`).join('');
 return `<div class="grid three" style="margin-top:6px">
  ${s.abas.length>1?`<div><label for="rzAba">Aba</label><select id="rzAba" data-rz-aba style="width:100%">${s.abas.map(n=>`<option ${n===s.aba?'selected':''}>${esc(n)}</option>`).join('')}</select></div>`:''}
  <div><label for="rzLayout">Formato do arquivo</label><select id="rzLayout" data-rz-layout style="width:100%"><option value="blocos" ${s.layout==='blocos'?'selected':''}>Em blocos (a conta numa linha e os lançamentos embaixo)${s.layoutDetectado==='blocos'?' · reconhecido':''}</option><option value="colunas" ${s.layout==='colunas'?'selected':''}>Em colunas (uma linha por lançamento, a conta numa coluna)${s.layoutDetectado==='colunas'?' · reconhecido':''}</option></select></div>
  <div><label for="rzComp">Competência</label><input type="month" id="rzComp" data-rz-comp value="${esc(s.competencia)}" style="width:100%"></div></div>
 ${s.R?.periodo?.de&&s.R.periodo.de.slice(0,7)!==s.competencia&&s.R.periodo.de.slice(0,7)===s.R.periodo.ate.slice(0,7)?`<div class="notice" style="margin-top:10px">O arquivo é de <strong>${esc(mesRot(s.R.periodo.de.slice(0,7)))}</strong> e a competência escolhida é ${esc(mesRot(s.competencia))}. <button class="small" data-rz="usar-periodo">Usar ${esc(mesRot(s.R.periodo.de.slice(0,7)))}</button></div>`:''}
 ${s.R&&(s.R.empresa||s.R.cnpj||s.R.periodo)?`<p class="caption" style="margin-top:8px">No arquivo: ${[s.R.empresa&&'empresa '+esc(s.R.empresa),s.R.cnpj&&'CNPJ '+esc(s.R.cnpj),s.R.periodo?.de&&`período ${M.dBR(s.R.periodo.de)} a ${M.dBR(s.R.periodo.ate)}`].filter(Boolean).join(' · ')}. Confira se é a empresa certa.</p>`:''}
 ${s.layout==='blocos'?`<details style="margin-top:10px"><summary class="caption" style="cursor:pointer">Ajustar as colunas do razão em blocos (reconhecidas pelos títulos ${Object.keys(M.ROT_COLUNA).filter(k=>blocosCols[k]>=0).map(k=>M.ROT_COLUNA[k]).join(', ')||'— sem a linha de títulos: pelo conteúdo'})</summary>
  <div class="grid three">${Object.entries(M.ROT_COLUNA).map(([k,l])=>`<div><label for="rzB-${k}">${l}</label><select id="rzB-${k}" data-rz-bcol="${k}" style="width:100%">${opcoesB(blocosCols[k]??-1)}</select></div>`).join('')}</div>
  <p class="caption">O lançamento é a linha com a data na coluna Data; "Conta:", "SALDO ANTERIOR", "Total do mês:" e "Total da conta:" são achados pelo texto. Sem a linha de títulos (PDF), os valores são lidos pelo conteúdo e o lado (débito ou crédito) pelo saldo.</p></details>`
 :`<label for="rzHeader">Linha com os nomes das colunas</label><select id="rzHeader" data-rz-header style="width:100%">${s.amostra.slice(0,60).map((r,i)=>`<option value="${i}" ${i===s.header?'selected':''}>Linha ${i+1} — ${esc(r.map(v=>String(v??'')).join(' | ').slice(0,110))}</option>`).join('')}</select>
  <div class="grid three" style="margin-top:8px">${M.CAMPOS_COLUNAS.map(f=>`<div><label for="rzM-${f.key}">${esc(f.label)}${f.required?' *':''}</label><select id="rzM-${f.key}" data-rz-map="${f.key}" style="width:100%">${opcoesCol(s.map[f.key]??-1,f.required?'Selecione…':'Não informado')}</select></div>`).join('')}</div>
  <p class="caption">Linhas sem conta herdam a conta de cima. Use Débito e Crédito, ou Valor com a coluna D/C (ou o sinal).</p>`}`}

function resultadoHtml(){const s=st,V=s.V,R=s.R,x=V.resumo,f=x.fecho;
 const tabs=[['lanc',`Lançamentos (${x.lancamentos.toLocaleString('pt-BR')})`],['contas',`Contas (${x.contas})`],['problemas',`Problemas (${V.problemas.filter(p=>p.grav!=='info').length})`],['fecho','Fecho com o balancete'],['nao',`Não entendidas (${x.naoEntendidas})`]];
 return `<h3 style="margin-top:18px">Arquivo transformado e conferido</h3>
 <div class="grid metrics" style="margin-top:10px">${MET('Contas',x.contas.toLocaleString('pt-BR'),x.contasQueNaoFecham?`${x.contasQueNaoFecham} não fecham`:'todas fecham',x.contasQueNaoFecham?'red':'green')}${MET('Lançamentos',x.lancamentos.toLocaleString('pt-BR'),`${R.naoEntendidas.length} linha(s) não entendidas`,R.naoEntendidas.length?'gold':'')}
 ${MET('Débitos × créditos',brl(x.debito),M.igual(x.debito,x.credito)?'créditos iguais: partidas dobradas ok':`créditos ${brl(x.credito)} · diferença ${brl(x.diferenca)}`,M.igual(x.debito,x.credito)?'green':'red')}
 ${MET('Balancete',f.semBalancete?'—':`${f.fecham} de ${f.comparadas}`,f.semBalancete?'balancete do mês não importado':f.diferencas||f.soNoBalancete?`${f.diferencas} com diferença · ${f.soNoBalancete} só no balancete · ${f.soNoRazao} só no razão`:'contas que fecham com o balancete',f.semBalancete?'':f.diferencas||f.soNoBalancete?'red':'green')}</div>
 <div class="notice" style="${x.ok?'':'border-color:var(--red)'}">${x.ok?`<strong>Tudo confere.</strong> ${esc(M.textoResumo(V))}.`:`<strong>${x.erros} diferença(s) para olhar antes de gravar.</strong> ${esc(M.textoResumo(V))}. Veja o porquê em Problemas${f.semBalancete?'':' e Fecho com o balancete'}.`}${x.avisos?` ${x.avisos} aviso(s).`:''}</div>
 <div class="segtabs" role="tablist">${tabs.map(([k,l])=>`<button role="tab" class="${s.aba2===k?'active':''}" data-rz-tab="${k}">${l}</button>`).join('')}</div>
 <div id="rzTab">${s.aba2==='lanc'?lancHtml():s.aba2==='contas'?contasHtml():s.aba2==='problemas'?problemasHtml():s.aba2==='fecho'?fechoHtml(V.fecho,R):naoHtml()}</div>`}

function lancHtml(){const s=st,R=s.R;
 return `<div class="filters" style="margin-bottom:8px"><select data-rz-fconta aria-label="Conta" style="max-width:360px"><option value="">Todas as contas</option>${R.contas.map(c=>`<option value="${c.k}" ${String(c.k)===s.conta?'selected':''}>${esc(M.rotuloConta(c).slice(0,70))}</option>`).join('')}</select>
 <input type="search" data-rz-busca placeholder="Buscar no histórico, número, contrapartida ou centro…" value="${esc(s.busca)}" aria-label="Buscar"><label class="row caption" style="margin:0"><input type="checkbox" class="check" data-rz-soprob ${s.soProblemas?'checked':''}> Só com problema</label></div>
 <details style="margin-bottom:8px"><summary class="caption" style="cursor:pointer">Centro de custo por regra (preenche só o centro vazio)</summary><div class="row wrap" style="margin-top:8px"><input id="rzRConta" placeholder="Conta (reduzido ou classificação), opcional" style="min-width:220px"><input id="rzRHist" placeholder="Histórico contém, opcional" style="min-width:200px"><input id="rzRCentro" placeholder="Centro de custo" style="min-width:150px"><button class="small" data-rz="regra">Aplicar</button></div>
 ${s.regras.length?`<p class="caption">${s.regras.map(r=>`${esc(r.centro)} ← ${[r.conta&&'conta '+esc(r.conta),r.contem&&'histórico com "'+esc(r.contem)+'"'].filter(Boolean).join(' e ')} (${r.n} lançamento(s))`).join(' · ')}</p>`:''}</details>
 <div id="rzTabela"></div>`}
function filtrados(){const s=st,R=s.R,chave=[s.conta,s.busca,s.soProblemas,R.lancs.length].join('|');if(s.filtroIx&&s.filtroIx.chave===chave)return s.filtroIx.ix;
 const q=M.norm(s.busca),k=s.conta===''?null:Number(s.conta),ruins=s.V.linhasComProblema,ix=[];
 for(let i=0;i<R.lancs.length;i++){const l=R.lancs[i];if(k!=null&&l.k!==k)continue;if(s.soProblemas&&!ruins.has(i))continue;if(q&&!M.norm(`${l.historico} ${l.numero} ${l.cpart} ${l.centro}`).includes(q))continue;ix.push(i)}
 s.filtroIx={chave,ix};return ix}
function paintTabela(){const el=document.querySelector('#rzTabela');if(!el||!st?.R)return;const s=st,R=s.R,ix=filtrados(),tot=ix.length,pags=Math.max(1,Math.ceil(tot/PAG));if(s.pagina>=pags)s.pagina=pags-1;
 const de=s.pagina*PAG,cps=M.indiceContas(R),ruins=s.V.linhasComProblema;
 el.innerHTML=`<div class="tablewrap" style="max-height:52vh"><table><thead><tr><th>Linha</th><th>Conta</th><th>Data</th><th>Número</th><th>Histórico</th><th>Contrapartida</th><th>Centro</th><th class="num">Débito</th><th class="num">Crédito</th><th class="num">Saldo</th></tr></thead><tbody>${ix.slice(de,de+PAG).map(i=>{const l=R.lancs[i],c=R.contas[l.k],cp=M.contrapartidaDe(R,l,cps),ruim=ruins.has(i);
  return `<tr${ruim?' style="background:#ff8d9f14"':''}><td class="caption">${esc(l.linha)}</td><td><strong>${esc(c.reduzido||'')}</strong> ${esc(c.classificacao||'')}<br><span class="caption">${esc(c.nome.slice(0,40))}</span></td><td>${esc(M.dBR(l.data))}</td><td>${esc(l.numero)}</td><td style="white-space:normal;min-width:220px">${esc(l.historico)}</td><td>${esc(l.cpart)}${cp?`<br><span class="caption">${esc(cp.classificacao)} ${esc(cp.nome.slice(0,30))}</span>`:''}</td><td><input data-rz-centro="${i}" value="${esc(l.centro)}" aria-label="Centro de custo da linha ${esc(l.linha)}" style="width:110px;padding:5px 7px"></td><td class="num">${l.debito?brl(l.debito):''}</td><td class="num">${l.credito?brl(l.credito):''}</td><td class="num ${ruim?'red':''}">${vNum(l.saldo)}</td></tr>`}).join('')||'<tr><td colspan="10" class="empty">Nenhum lançamento com esses filtros.</td></tr>'}</tbody></table></div>
 <div class="row" style="justify-content:space-between;margin-top:8px"><span class="caption">${tot?`Linhas ${(de+1).toLocaleString('pt-BR')}–${Math.min(tot,de+PAG).toLocaleString('pt-BR')} de ${tot.toLocaleString('pt-BR')}`:'0 linhas'}</span><div class="row"><button class="small" data-rz="pag-" ${s.pagina?'':'disabled'} aria-label="Página anterior">‹</button><span class="caption">página ${s.pagina+1} de ${pags}</span><button class="small" data-rz="pag+" ${s.pagina<pags-1?'':'disabled'} aria-label="Próxima página">›</button></div></div>`}
function contasHtml(){const V=st.V,lista=V.contas.slice().sort((a,b)=>(a.ok?1:0)-(b.ok?1:0)||a.k-b.k);
 return `<div class="tablewrap" style="max-height:56vh"><table><thead><tr><th>Conta</th><th class="num">Saldo anterior</th><th class="num">Débitos</th><th class="num">Créditos</th><th class="num">Saldo final</th><th class="num">Total da conta</th><th class="num">Lançamentos</th><th>Situação</th></tr></thead><tbody>${lista.slice(0,2000).map(c=>`<tr><td><strong>${esc(c.reduzido)}</strong> ${esc(c.classificacao)}<br><span class="caption">${esc(c.nome)}</span></td><td class="num">${vNum(c.saldoAnterior??0)}</td><td class="num">${brl(c.debito)}</td><td class="num">${brl(c.credito)}</td><td class="num">${brl(c.saldoFinal)} <span class="caption">${c.natureza}</span></td><td class="num caption">${c.totalConta?`${brl(c.totalConta.d)}<br>${brl(c.totalConta.c)}`:'—'}</td><td class="num">${c.lancs.toLocaleString('pt-BR')}</td><td style="white-space:normal;min-width:240px">${c.ok?'<span class="badge ok">Fecha</span>':'<span class="badge bad">Não fecha</span>'}${c.problemas.map(p=>`<br><span class="caption ${p.grav==='erro'?'red':''}">${esc(p.texto)}</span>`).join('')}</td></tr>`).join('')}</tbody></table></div>`}
function problemasHtml(){const P=st.V.problemas,ord={erro:0,aviso:1,info:2};const l=P.slice().sort((a,b)=>ord[a.grav]-ord[b.grav]);
 if(!l.length)return '<div class="empty">Nenhum problema: todas as contas fecham, o saldo bate linha a linha e os totais conferem.</div>';
 return `<div class="tablewrap" style="max-height:56vh"><table><tbody>${l.slice(0,600).map(p=>`<tr><td><span class="badge ${p.grav==='erro'?'bad':p.grav==='aviso'?'warn':'info'}">${p.grav==='erro'?'Diferença':p.grav==='aviso'?'Aviso':'Informação'}</span></td><td style="white-space:normal">${esc(p.texto)}</td><td>${p.k!=null?`<button class="small quiet" data-rz-verconta="${p.k}">Ver a conta</button>`:''}</td></tr>`).join('')}</tbody></table></div>${l.length>600?`<p class="caption">Mostrando 600 de ${l.length}.</p>`:''}`}
function fechoHtml(F,R){if(F.semBalancete)return `<div class="empty">O balancete de ${esc(mesRot(st?.competencia||ui.m))} ainda não foi importado. Importe o balancete em Documentos do mês: o fecho aparece aqui e na aba Razão.</div>`;
 const modo=F.modo==='classificacao'?'pela classificação (somando as contas analíticas de mesma classificação)':'pelo código reduzido';
 return `<p class="caption">Ligação ${modo}: ${F.fecham} de ${F.comparadas} conta(s) fecham.</p>
 ${F.diferencas.length?`<h3 style="margin:12px 0 6px">Com diferença (${F.diferencas.length})</h3><div class="tablewrap"><table><thead><tr><th>Conta</th><th class="num">Razão</th><th class="num">Balancete</th><th class="num">Diferença</th><th>Por quê</th></tr></thead><tbody>${F.diferencas.map(d=>`<tr><td>${esc(d.codigo)} · ${esc(d.nome)}</td><td class="num">${brl(d.razao)}</td><td class="num">${brl(d.balancete)}</td><td class="num red">${brl(d.dif)}</td><td style="white-space:normal">${esc(d.texto)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="caption green">Nenhuma diferença de saldo entre o razão e o balancete.</p>'}
 ${F.soNoBalancete.length?`<h3 style="margin:12px 0 6px">Só no balancete (${F.soNoBalancete.length})</h3>${F.soNoBalancete.map(x=>`<div class="listline"><span>${esc(x.texto)}</span><span class="badge ${x.grav==='erro'?'bad':'warn'}">${x.grav==='erro'?'falta no razão':'sem movimento'}</span></div>`).join('')}`:''}
 ${F.soNoRazao.length?`<h3 style="margin:12px 0 6px">Só no razão (${F.soNoRazao.length})</h3>${F.soNoRazao.slice(0,300).map(x=>`<div class="listline"><span>${esc(x.texto)}</span><span class="badge warn">não está no balancete</span></div>`).join('')}`:''}`}
function naoHtml(){const N=st.R.naoEntendidas;if(!N.length)return '<div class="empty">Todas as linhas do arquivo foram entendidas (cabeçalhos e rodapés das páginas ficam de fora).</div>';
 return `<div class="tablewrap" style="max-height:56vh"><table><thead><tr><th>Linha do arquivo</th><th>Por quê</th><th>O que tem na linha</th></tr></thead><tbody>${N.slice(0,1000).map(x=>`<tr><td>${esc(x.linha)}</td><td style="white-space:normal">${esc(x.motivo)}</td><td style="white-space:normal">${esc(x.texto)}</td></tr>`).join('')}</tbody></table></div>`}
function gravandoHtml(){const p=st.prog||{feito:0,total:1,etapa:''},pc=p.total?Math.round(p.feito/p.total*100):0;
 if(st.fase==='pronto')return `<div class="notice"><strong>Razão gravado.</strong> ${esc(st.msg)}</div><div class="modalfoot"><button class="primary" data-rz="ver">Abrir o razão</button><button data-action="close">Fechar</button></div>`;
 return `<h3>Gravando o razão de ${esc(mesRot(st.competencia))}</h3><p class="caption" id="rzEtapa">${esc(p.etapa)}</p><div class="bar" style="height:8px" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pc}"><i id="rzBarra" style="width:${pc}%;background:var(--accent)"></i></div><p class="caption" id="rzProg">${p.feito.toLocaleString('pt-BR')} de ${p.total.toLocaleString('pt-BR')} lançamentos</p><p class="caption">O razão anterior do mês continua valendo até o fim; se algo falhar no meio, nada é trocado.</p>`}
function paintProg(){const p=st?.prog;if(!p)return;const pc=p.total?Math.round(p.feito/p.total*100):0,b=document.querySelector('#rzBarra'),t=document.querySelector('#rzProg'),e=document.querySelector('#rzEtapa');
 if(b)b.style.width=pc+'%';b?.parentElement?.setAttribute('aria-valuenow',String(pc));if(t)t.textContent=`${p.feito.toLocaleString('pt-BR')} de ${p.total.toLocaleString('pt-BR')} lançamentos`;if(e)e.textContent=p.etapa||''}

// ───────── Gravar ─────────
function cargaDe(V,s,extra={}){const x=V.resumo;return {competencia:s.competencia,arquivo:s.nome,layout:s.R.layout,contas:x.contas,lancamentos:x.lancamentos,total_debito:x.debito,total_credito:x.credito,
 contas_resumo:M.resumoContas(V),validacao:{ok:x.ok,erros:x.erros,avisos:x.avisos,texto:M.textoResumo(V),naoEntendidas:x.naoEntendidas,fecho:x.fecho,contasQueNaoFecham:x.contasQueNaoFecham,
  empresa:s.R.empresa||'',periodo:s.R.periodo||null,problemas:V.problemas.filter(p=>p.grav==='erro').slice(0,50).map(p=>p.texto)},criado_em:new Date().toISOString(),criado_por_email:window.Cloud?.session?.user?.email||'',...extra}}
async function confirmar(){const s=st;if(!s?.R||!s.V)return;if(!/^\d{4}-\d{2}$/.test(s.competencia))return toast('Escolha a competência.');if(!s.V.resumo.ok&&!s.comErros)return toast('Marque que conferiu as diferenças para gravar assim mesmo.');
 const linhas=M.paraBanco(s.R,s.competencia),V=s.V,comp=s.competencia;s.fase='gravando';s.prog={feito:0,total:linhas.length,etapa:'Preparando…'};paint();
 try{let carga;
  if(nuvem()){carga=await gravarNuvem(s,linhas)}
  else{carga=cargaDe(V,s,{id:uid(),status:'ativa',concluido_em:new Date().toISOString()});local.set(comp,{carga,linhas});s.prog.feito=linhas.length;paintProg()}
  // a DRE usa o resumo por conta quando o mês não tem balancete; o arquivo fica em Documentos do mês
  db.accLines=(db.accLines||[]).filter(l=>!(l.month===comp&&l.kind==='razao')).concat(M.linhasDRE(V,comp));
  const doc={id:`razao-arquivo-${comp}`,month:comp,tipo:'razao',nome:s.nome,size:s.file?.size||null,time:new Date().toISOString(),path:carga.arquivo_path||null};
  const velho=(db.accDocs||[]).find(d=>d.id===doc.id);if(velho?.path&&velho.path!==doc.path&&nuvem())Cloud.client.storage.from('contabil').remove([velho.path]).catch?.(()=>{});
  db.accDocs=(db.accDocs||[]).filter(d=>d.id!==doc.id).concat(doc);
  if(!nuvem())audit('Razão importado',`${s.nome}: ${M.textoResumo(V)} · ${comp}`);else save();
  cache.set(comp,{carga,carregando:false});ui.res=null;ui.chave='';
  s.fase='pronto';s.msg=`${M.textoResumo(V)}.${nuvem()?'':' Modo local: o razão completo fica só nesta sessão do navegador.'}`;paint();render()}
 catch(e){s.fase='ajuste';s.msg='Não foi possível gravar: '+(e.message||e)+' Nada foi trocado.';paint()}}
async function gravarNuvem(s,linhas){const sb=Cloud.client,ws=Cloud.ws,comp=s.competencia,V=s.V,x=V.resumo;let path=null;
 s.prog.etapa='Guardando o arquivo original…';paintProg();
 if(s.file){const p=`${ws}/${comp}/razao-${uid()}-${s.nome.replace(/[^\w.\-]+/g,'_')}`;const {error}=await sb.storage.from('contabil').upload(p,s.file,{upsert:false});if(!error)path=p;else toast('O arquivo original não foi guardado ('+error.message+'); o razão será gravado mesmo assim.')}
 const c=cargaDe(V,s,{arquivo_path:path});
 const {data:id,error:e0}=await sb.rpc('contab_razao_iniciar',{p_ws:ws,p_competencia:comp,p_arquivo:s.nome,p_arquivo_path:path,p_layout:s.R.layout,p_contas:x.contas,p_lancamentos:linhas.length,
  p_debito:r2(linhas.reduce((a,l)=>a+l.debito,0)),p_credito:r2(linhas.reduce((a,l)=>a+l.credito,0)),p_contas_resumo:c.contas_resumo,p_validacao:c.validacao});
 if(e0){if(path)sb.storage.from('contabil').remove([path]);throw e0}
 try{s.prog.etapa='Enviando os lançamentos…';paintProg();const blocos=[];for(let i=0;i<linhas.length;i+=BLOCO)blocos.push(linhas.slice(i,i+BLOCO));let prox=0,falha=null;
  const trab=async()=>{while(prox<blocos.length&&!falha){const b=blocos[prox++];const {error}=await sb.from('contab_razao').insert(b.map(l=>({workspace_id:ws,carga_id:id,...l})));if(error){falha=error;return}s.prog.feito+=b.length;paintProg()}};
  await Promise.all(Array.from({length:Math.min(PARALELO,blocos.length)},trab));if(falha)throw falha;
  s.prog.etapa='Conferindo e trocando o razão do mês…';paintProg();
  const {error:e1}=await sb.rpc('contab_razao_concluir',{p_carga:id});if(e1)throw e1}
 catch(e){await sb.rpc('contab_razao_cancelar',{p_carga:id});if(path)await sb.storage.from('contabil').remove([path]);throw e}
 return {...c,id,status:'ativa',concluido_em:new Date().toISOString()}}

// ───────── Aba Razão (consulta) ─────────
function info(m){if(!nuvem())return {carga:local.get(m)?.carga||null,carregando:false};const x=cache.get(m);if(x)return x;const novo={carga:null,carregando:true};cache.set(m,novo);carregar(m);return novo}
async function carregar(m){const ws=Cloud.ws;try{const {data,error}=await Cloud.client.from('contab_razao_cargas').select('*').eq('workspace_id',ws).eq('competencia',m).eq('status','ativa').limit(1);if(error)throw error;
  cache.set(m,{carga:data?.[0]||null,carregando:false})}catch(e){cache.set(m,{carga:null,carregando:false,erro:e.message||String(e)})}
 if(Cloud.ws===ws&&typeof page==='string'&&page==='contabil')render()}
/** Lançamentos do razão gravado do mês (para Documentos do mês). null = sem razão novo (vale a contagem antiga). */
function lancamentos(m){const x=info(m);return x.carga?Number(x.carga.lancamentos)||0:null}
function filtroAtual(){return {conta:ui.conta,de:ui.de,ate:ui.ate,centro:ui.centro.trim(),busca:ui.busca.trim()}}
const COLS='linha,conta,classificacao,conta_nome,data,numero,historico,contrapartida,contrapartida_classificacao,centro,debito,credito,saldo,linha_origem';
function consulta(cargaId,f){let q=Cloud.client.from('contab_razao').select(COLS,{count:'exact'}).eq('carga_id',cargaId);
 if(f.conta)q=q.eq('conta',f.conta);if(f.de)q=q.gte('data',f.de);if(f.ate)q=q.lte('data',f.ate);if(f.centro)q=q.ilike('centro',`%${f.centro.replace(/[%_]/g,'')}%`);
 if(f.busca){const b=f.busca.replace(/[^\p{L}\p{N} \-/]/gu,' ').replace(/\s+/g,' ').trim();if(b)q=q.or(`historico.ilike.*${b}*,numero.eq.${b.replace(/ /g,'')},contrapartida.eq.${b.replace(/ /g,'')}`)}
 return q.order('linha')}
function filtrarLocal(linhas,f){const q=M.norm(f.busca),cc=M.norm(f.centro);return linhas.filter(l=>(!f.conta||l.conta===f.conta)&&(!f.de||(l.data||'')>=f.de)&&(!f.ate||(l.data||'')<=f.ate)&&(!cc||M.norm(l.centro).includes(cc))&&(!q||M.norm(`${l.historico} ${l.numero} ${l.contrapartida}`).includes(q)))}
// Uma página de lançamentos com os filtros. Modo local: na hora (sem redesenhar); nuvem: busca e redesenha quando chega.
function buscarPagina(m,carga){const f=filtroAtual(),chave=JSON.stringify([m,carga.id,f,ui.pagina]);if(ui.chave===chave&&ui.res)return;ui.chave=chave;
 if(!nuvem()){const L=filtrarLocal(local.get(m)?.linhas||[],f);ui.res={linhas:L.slice(ui.pagina*PAG,ui.pagina*PAG+PAG),total:L.length};return}
 ui.res={carregando:true,linhas:[],total:0};
 (async()=>{try{const {data,count,error}=await consulta(carga.id,f).range(ui.pagina*PAG,ui.pagina*PAG+PAG-1);if(error)throw error;if(ui.chave!==chave)return;ui.res={linhas:data||[],total:count??(data||[]).length}}
  catch(e){if(ui.chave!==chave)return;ui.res={linhas:[],total:0,erro:e.message||String(e)}}
  if(typeof page==='string'&&page==='contabil')render()})()}
function view(m){ui.m=m;const x=info(m),c=x.carga;
 if(x.carregando)return '<div class="empty">Carregando o razão…</div>';
 if(x.erro)return `<div class="notice">Não foi possível abrir o razão: ${esc(x.erro)}</div>`;
 if(!c)return `<div class="empty">Nenhum razão importado em ${esc(mesRot(m))}.<br><button class="primary small" style="margin-top:12px" data-rz="importar">${icon('upload')} Importar razão</button>${(db.accLines||[]).some(l=>l.month===m&&l.kind==='razao')?'<p class="caption">Há linhas de razão da importação antiga neste mês (só os totais na DRE). Importe de novo para conferir e consultar lançamento a lançamento.</p>':''}</div>`;
 const v=c.validacao||{},contas=c.contas_resumo||[],F=fechoAgora(m,contas);
 buscarPagina(m,c);
 const r=ui.res||{linhas:[],total:0,carregando:true},pags=Math.max(1,Math.ceil((r.total||0)/PAG));
 return `<div class="notice"><strong>Razão de ${esc(mesRot(m))}</strong> · ${esc(c.arquivo||'')} · importado ${c.concluido_em||c.criado_em?'em '+esc(new Date(c.concluido_em||c.criado_em).toLocaleString('pt-BR')):''}${c.criado_por_email?' por '+esc(c.criado_por_email):''}.<br>${esc(v.texto||`${c.contas} contas, ${c.lancamentos} lançamentos`)}.${v.ok===false?' <span class="badge bad">Gravado com diferenças</span>':' <span class="badge ok">Conferido</span>'}${nuvem()?'':' <span class="badge warn">Só nesta sessão (modo local)</span>'}</div>
 <div class="grid metrics">${MET('Contas',Number(c.contas).toLocaleString('pt-BR'))}${MET('Lançamentos',Number(c.lancamentos).toLocaleString('pt-BR'))}${MET('Débitos',brl(c.total_debito))}${MET('Créditos',brl(c.total_credito),M.igual(c.total_debito,c.total_credito)?'iguais aos débitos':'diferença '+brl(c.total_debito-c.total_credito),M.igual(c.total_debito,c.total_credito)?'':'red')}</div>
 <div class="card" style="margin-bottom:18px"><div class="cardhead"><h2>Fecho com o balancete de ${esc(mesRot(m))}</h2>${F.semBalancete?'<span class="badge warn">Sem balancete</span>':F.diferencas.length||F.soNoBalancete.some(x=>x.grav==='erro')?'<span class="badge bad">Não fecha</span>':'<span class="badge ok">Fecha</span>'}</div>${fechoHtml(F,null)}</div>
 <div class="tablebox" style="margin-bottom:18px"><div class="tabletop"><h2>Lançamentos</h2><div class="row wrap"><button class="small" data-rz="exportar-xlsx" ${ui.exportando?'disabled':''}>${icon('download')} Excel</button><button class="small" data-rz="exportar-csv" ${ui.exportando?'disabled':''}>${icon('download')} CSV</button><button class="small primary" data-rz="importar">${icon('upload')} Importar de novo</button></div></div>
 <div class="filters" style="padding:0 20px"><select data-rz-cconta aria-label="Conta" style="max-width:340px"><option value="">Todas as contas</option>${contas.map(x=>{const cod=x.reduzido||x.classificacao;return `<option value="${esc(cod)}" ${ui.conta===cod?'selected':''}>${esc([x.reduzido,x.classificacao,x.nome].filter(Boolean).join(' · ').slice(0,70))}</option>`}).join('')}</select>
 <input type="date" data-rz-cde value="${esc(ui.de)}" aria-label="De"><input type="date" data-rz-cate value="${esc(ui.ate)}" aria-label="Até"><input data-rz-ccentro value="${esc(ui.centro)}" placeholder="Centro de custo" aria-label="Centro de custo" style="max-width:160px"><input type="search" data-rz-cbusca value="${esc(ui.busca)}" placeholder="Histórico, número ou contrapartida…" aria-label="Buscar"><button class="small quiet" data-rz="limpar-filtros">Limpar</button></div>
 ${r.erro?`<div class="notice" style="margin:0 20px 12px">Não foi possível buscar: ${esc(r.erro)}</div>`:''}
 <div class="tablewrap"><table><thead><tr><th>Conta</th><th>Data</th><th>Número</th><th>Histórico</th><th>Contrapartida</th><th>Centro</th><th class="num">Débito</th><th class="num">Crédito</th><th class="num">Saldo</th></tr></thead><tbody>${r.carregando?'<tr><td colspan="9" class="empty">Buscando…</td></tr>':r.linhas.map(l=>`<tr><td><strong>${esc(l.conta)}</strong> ${esc(l.classificacao||'')}<br><span class="caption">${esc(String(l.conta_nome||'').slice(0,40))}</span></td><td>${esc(M.dBR(l.data))}</td><td>${esc(l.numero||'')}</td><td style="white-space:normal;min-width:240px">${esc(l.historico||'')}</td><td>${esc(l.contrapartida||'')}${l.contrapartida_classificacao?`<br><span class="caption">${esc(l.contrapartida_classificacao)}</span>`:''}</td><td>${esc(l.centro||'')}</td><td class="num">${Number(l.debito)?brl(l.debito):''}</td><td class="num">${Number(l.credito)?brl(l.credito):''}</td><td class="num">${vNum(l.saldo)}</td></tr>`).join('')||'<tr><td colspan="9" class="empty">Nenhum lançamento com esses filtros.</td></tr>'}</tbody></table></div>
 <div class="row" style="justify-content:space-between;padding:12px 20px"><span class="caption">${(r.total||0).toLocaleString('pt-BR')} lançamento(s)</span><div class="row"><button class="small" data-rz="cpag-" ${ui.pagina?'':'disabled'} aria-label="Página anterior">‹</button><span class="caption">página ${ui.pagina+1} de ${pags}</span><button class="small" data-rz="cpag+" ${ui.pagina<pags-1?'':'disabled'} aria-label="Próxima página">›</button></div></div></div>
 <div class="tablebox"><div class="tabletop"><h2>Saldos por conta</h2><span class="caption">Clique numa conta para ver os lançamentos dela</span></div><div class="tablewrap"><table><thead><tr><th>Conta</th><th class="num">Saldo anterior</th><th class="num">Débitos</th><th class="num">Créditos</th><th class="num">Saldo final</th><th class="num">Lançamentos</th><th></th></tr></thead><tbody>${contas.map(x=>{const cod=x.reduzido||x.classificacao;return `<tr><td><button class="quiet small" data-rz-cver="${esc(cod)}" style="padding:2px 4px;text-align:left;justify-content:flex-start"><strong>${esc(x.reduzido||'')}</strong>&nbsp;${esc(x.classificacao||'')} · ${esc(x.nome||'')}</button></td><td class="num">${brl(x.saldo_anterior)}</td><td class="num">${brl(x.debito)}</td><td class="num">${brl(x.credito)}</td><td class="num">${brl(x.saldo_final)}</td><td class="num">${Number(x.lancamentos).toLocaleString('pt-BR')}</td><td>${x.ok===false?'<span class="badge bad">não fecha</span>':''}</td></tr>`}).join('')}</tbody></table></div></div>`}
// O fecho com o balancete calculado agora (o balancete pode ter chegado depois do razão).
function fechoAgora(m,contas){const cs=contas.map((x,k)=>({k,reduzido:x.reduzido||'',classificacao:x.classificacao||'',nome:x.nome||'',saldoFinal:Number(x.saldo_final)||0,debito:Number(x.debito)||0,credito:Number(x.credito)||0}));
 return M.fechoBalancete({contas:cs},cs,balanceteDe(m))}
async function exportar(tipo){const m=ui.m,c=info(m).carga;if(!c)return;ui.exportando=true;render();
 try{const f=filtroAtual();let L=[];
  if(!nuvem())L=filtrarLocal(local.get(m)?.linhas||[],f);
  else{const {count,error}=await consulta(c.id,f).range(0,0);if(error)throw error;const n=count||0,pags=Math.ceil(n/1000),res=new Array(pags);let prox=0;
   const trab=async()=>{while(prox<pags){const i=prox++;const {data,error}=await consulta(c.id,f).range(i*1000,i*1000+999);if(error)throw error;res[i]=data||[]}};
   await Promise.all(Array.from({length:Math.min(4,pags)},trab));L=res.flat()}
  const cab=['Conta (reduzido)','Classificação','Nome da conta','Data','Número','Histórico','Contrapartida','Classificação da contrapartida','Centro de custo','Débito','Crédito','Saldo','Linha no arquivo'];
  const nome=`Jarvis - Razão - ${mesRot(m)}${f.conta?' - conta '+f.conta:''}`.replace(/[\\/:*?"<>|]+/g,'-');
  if(tipo==='xlsx'){if(!window.XLSX)throw Error('A biblioteca do Excel não carregou. Recarregue a página.');
   const aoa=[cab,...L.map(l=>[l.conta,l.classificacao||'',l.conta_nome||'',l.data?new Date(l.data+'T12:00:00Z'):'',l.numero||'',l.historico||'',l.contrapartida||'',l.contrapartida_classificacao||'',l.centro||'',Number(l.debito)||0,Number(l.credito)||0,l.saldo==null?'':Number(l.saldo),l.linha_origem||''])];
   const ws=XLSX.utils.aoa_to_sheet(aoa,{cellDates:true,dateNF:'dd/mm/yyyy'});ws['!cols']=[10,16,30,11,10,50,12,16,14,14,14,14,10].map(w=>({wch:w}));
   for(let r=1;r<aoa.length;r++)for(const col of [9,10,11]){const ref=XLSX.utils.encode_cell({r,c:col});if(ws[ref]&&ws[ref].t==='n')ws[ref].z='#,##0.00'}
   const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Razão');XLSX.writeFile(wb,nome+'.xlsx')}
  else{const n=v=>v==null||v===''?'':String(r2(v)).replace('.',',');download(nome+'.csv',csv([cab,...L.map(l=>[l.conta,l.classificacao||'',l.conta_nome||'',M.dBR(l.data),l.numero||'',l.historico||'',l.contrapartida||'',l.contrapartida_classificacao||'',l.centro||'',n(l.debito),n(l.credito),n(l.saldo),l.linha_origem||''])]))}
  toast(`${L.length.toLocaleString('pt-BR')} lançamento(s) exportado(s).`)}
 catch(e){toast('Não foi possível exportar: '+(e.message||e))}
 ui.exportando=false;render()}
async function limpar(m){if(nuvem()){const {error}=await Cloud.client.rpc('contab_razao_excluir',{p_ws:Cloud.ws,p_competencia:m});if(error){toast('Não foi possível remover o razão: '+error.message);return false}}
 local.delete(m);cache.delete(m);if(ui.m===m){ui.res=null;ui.chave=''}return true}

// ───────── Eventos ─────────
document.addEventListener('click',e=>{const b=e.target.closest?.('button');if(!b)return;const d=b.dataset;
 if(d.rzTab&&st){st.aba2=d.rzTab;paint();return}
 if(d.rzVerconta!=null&&st){st.aba2='lanc';st.conta=String(d.rzVerconta);st.pagina=0;st.filtroIx=null;paint();return}
 if(d.rzCver!=null){ui.conta=d.rzCver;ui.pagina=0;render();return}
 switch(d.rz){
  case'importar':importar();break;
  case'confirmar':confirmar();break;
  case'usar-periodo':if(st?.R?.periodo){st.competencia=st.R.periodo.de.slice(0,7);const h=document.querySelector('.modalhead h2');if(h)h.textContent=`Importar razão · ${mesRot(st.competencia)}`;processar()}break;
  case'pag-':if(st){st.pagina=Math.max(0,st.pagina-1);paintTabela()}break;
  case'pag+':if(st){st.pagina++;paintTabela()}break;
  case'regra':{if(!st?.R)break;const r={conta:(document.querySelector('#rzRConta')?.value||'').trim(),contem:(document.querySelector('#rzRHist')?.value||'').trim(),centro:(document.querySelector('#rzRCentro')?.value||'').trim()};
   if(!r.centro||!(r.conta||r.contem)){toast('Informe o centro e a conta ou o texto do histórico.');break}r.n=M.aplicarCentros(st.R,[r]);st.regras.push(r);st.filtroIx=null;toast(`${r.n} lançamento(s) receberam o centro ${r.centro}.`);paint();break}
  case'ver':{const comp=st?.competencia;closeModal();st=null;Object.assign(ui,{conta:'',de:'',ate:'',centro:'',busca:'',pagina:0,res:null,chave:''});if(comp&&typeof month==='string'&&comp!==month)month=comp;window.Gestao?.abrirAba?.('razao');break}
  case'cpag-':ui.pagina=Math.max(0,ui.pagina-1);render();break;
  case'cpag+':ui.pagina++;render();break;
  case'limpar-filtros':Object.assign(ui,{conta:'',de:'',ate:'',centro:'',busca:'',pagina:0});render();break;
  case'exportar-xlsx':exportar('xlsx');break;
  case'exportar-csv':exportar('csv');break;
 }});
document.addEventListener('change',e=>{const t=e.target,d=t.dataset||{};
 if(d.rzArq!=null&&st){lerArquivo(t.files?.[0]);return}
 if(d.rzAba!=null&&st){trocarAba(t.value);return}
 if(d.rzLayout!=null&&st){st.layout=t.value;if(st.layout==='colunas'){st.header=M.cabecalhoColunas(st.amostra);st.map=M.mapaAutomatico(st.amostra[st.header])}st.msg='';processar();return}
 if(d.rzComp!=null&&st){if(/^\d{4}-\d{2}$/.test(t.value)){st.competencia=t.value;const h=document.querySelector('.modalhead h2');if(h)h.textContent=`Importar razão · ${mesRot(st.competencia)}`;processar()}return}
 if(d.rzHeader!=null&&st){st.header=Number(t.value);st.map=M.mapaAutomatico(st.amostra[st.header]);processar();return}
 if(d.rzMap!=null&&st){st.map={...st.map,[d.rzMap]:Number(t.value)};processar();return}
 if(d.rzBcol!=null&&st){st.colunas={...(st.colunas||st.colunasDetectadas||{}),[d.rzBcol]:Number(t.value)};processar();return}
 if(d.rzFconta!=null&&st){st.conta=t.value;st.pagina=0;paintTabela();return}
 if(d.rzSoprob!=null&&st){st.soProblemas=t.checked;st.pagina=0;paintTabela();return}
 if(d.rzComerros!=null&&st){st.comErros=t.checked;const b=document.querySelector('[data-rz="confirmar"]');if(b)b.disabled=!st.comErros&&!st.V?.resumo.ok;return}
 if(d.rzCentro!=null&&st?.R){const l=st.R.lancs[Number(d.rzCentro)];if(l){l.centro=t.value.trim();st.edicoes[l.linha]=l.centro}return}
 if(d.rzCconta!=null){ui.conta=t.value;ui.pagina=0;render();return}
 if(d.rzCde!=null){ui.de=t.value;ui.pagina=0;render();return}
 if(d.rzCate!=null){ui.ate=t.value;ui.pagina=0;render();return}
 if(d.rzCcentro!=null){ui.centro=t.value;ui.pagina=0;render();return}
 if(d.rzCbusca!=null){ui.busca=t.value;ui.pagina=0;render();return}});
let tBusca=null;
document.addEventListener('input',e=>{const t=e.target,d=t.dataset||{};if(d.rzBusca!=null&&st){st.busca=t.value;st.pagina=0;clearTimeout(tBusca);tBusca=setTimeout(paintTabela,180)}});

window.Razao={importar,view,info,lancamentos,limpar,exportar,fechoAgora,ui,
 _estado:()=>st,_processar:processar,_chamar:chamar,_lerLinhas:async(rows,linhas,nome='teste.xlsx')=>{if(!st)importar();st.nome=nome;const r=await chamar({tipo:'linhas',rows,linhas});aplicarLeitura(r);await processar()},_local:local,_cache:cache};
})();
