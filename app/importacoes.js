// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Importações: o processo da abertura no fornecedor até a chegada na empresa. Painel com o resumo por situação (processos,
// contêineres e cargas LCL de cada etapa) e o mapa dos processos; cadastro em guias (visão geral, logística e prazos, itens
// com quantidade e valor, pagamentos com o que já foi pago e o saldo, histórico); itens novos que ainda não têm cadastro
// nem foto no Bling (foto enviada aqui, vínculo com o SKU quando o produto for cadastrado); pagamentos de todos os processos.
// Dados na tabela importacoes (sem nuvem, só neste navegador). Fotos dos itens novos no bucket privado "importacoes".
(()=>{
Object.assign(paths,{ship:'M3 14h18l-2.5 6h-13z M6 14V9h12v5 M9 9V5h6v4 M12 2v3',factory:'M3 21V10l5 3V10l5 3V10l5 3V4h3v17z M7 17h2 M12 17h2 M17 17h2'});
const hoje=()=>new Date().toLocaleDateString('sv-SE');
const nf=(v,d=0)=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:d});
const dBR=d=>d?new Date(String(d).length>10?d:d+'T12:00:00').toLocaleDateString('pt-BR'):'—';
const r2=n=>Math.round((Number(n)||0)*100)/100;
const quem=()=>window.Cloud?.session?.user?.email||'—';
const nuvem=()=>!!(window.Cloud?.client&&window.Cloud?.ws);
const podeGravar=()=>['owner','member','estoque','financeiro'].includes(window.Cloud?.role||'owner')&&!window.Perfis?.somenteLeitura?.(page);
const novoId=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
/** Número digitado: aceita 1.234,56 e 1234.56. */
function num(v){if(typeof v==='number')return Number.isFinite(v)?v:0;let s=String(v??'').trim().replace(/\s/g,'');if(!s)return 0;if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');const n=Number(s);return Number.isFinite(n)?n:0}
const dinheiro=(v,moeda='BRL')=>{try{return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:moeda||'BRL'})}catch{return `${moeda} ${nf(v,2)}`}};
const dias=(a,b)=>a&&b?Math.round((new Date(String(b).slice(0,10)+'T12:00:00')-new Date(String(a).slice(0,10)+'T12:00:00'))/864e5):null;

// ─── Regras ───
const ETAPAS=[['producao','Em produção no fornecedor','factory'],['cotacao','Em processo de cotação de frete','clipboard'],['embarque','Aguardando embarque','clock'],['navegando','Navegando','ship'],['nacionalizando','Nacionalizando','shield'],['desembaracada','Carga desembaraçada','check'],['rota','Em rota de entrega','truck'],['entregue','Entregue','box']];
const NOME_ST=Object.fromEntries([...ETAPAS.map(([k,t])=>[k,t]),['cancelado','Cancelado']]);
const TIPOS={mercadoria:'Mercadoria',amostra:'Amostra',ativo:'Ativo imobilizado',pecas:'Peças e insumos'};
const MODAL={fcl:'FCL · contêiner cheio',lcl:'LCL · carga fracionada',aereo:'Aéreo',courier:'Courier',rodoviario:'Rodoviário'};
const MOEDAS=['USD','CNY','EUR','BRL'];
const INCOTERMS=['EXW','FCA','FOB','CFR','CIF','CPT','CIP','DAP','DDP'];
const TIPOS_PAG={mercadoria:'Mercadoria (fornecedor)',frete:'Frete internacional',seguro:'Seguro',impostos:'Impostos de importação',despachante:'Despachante e taxas',armazenagem:'Armazenagem e porto',frete_nac:'Frete nacional',outros:'Outros'};
// Marcos com data prevista e real (Logística e prazos). A etapa que a carga alcança grava a data real do marco, se vazia.
const MARCOS=[['pronta','Produção pronta'],['etd','Embarque (ETD)'],['eta','Chegada ao porto (ETA)'],['desembaraco','Desembaraço'],['entrega','Entrega na empresa']];
const MARCO_DA_ETAPA={embarque:'pronta',navegando:'etd',nacionalizando:'eta',desembaracada:'desembaraco',entregue:'entrega'};
const ativo=p=>!['entregue','cancelado'].includes(p.status);

/** Processo com todos os campos (linha antiga ou do formulário). */
function normalizar(p={}){const L=p.logistica&&typeof p.logistica==='object'?p.logistica:{};
 return {...p,id:p.id||novoId('imp-'),numero:String(p.numero||'').trim(),titulo:p.titulo||'',tipo:TIPOS[p.tipo]?p.tipo:'mercadoria',modalidade:MODAL[p.modalidade]?p.modalidade:'fcl',ctns:Math.max(0,Math.trunc(num(p.ctns))),
  status:NOME_ST[p.status]?p.status:'producao',fornecedor:p.fornecedor||'',origem:p.origem||'',destino:p.destino||'',incoterm:p.incoterm||'',moeda:MOEDAS.includes(p.moeda)?p.moeda:'USD',cambio:p.cambio==null||p.cambio===''?null:num(p.cambio),
  logistica:{...L},itens:Array.isArray(p.itens)?p.itens:[],pagamentos:Array.isArray(p.pagamentos)?p.pagamentos:[],historico:Array.isArray(p.historico)?p.historico:[],observacao:p.observacao||''}}
/** Valor em reais pelo câmbio (BRL = 1); sem câmbio, null. */
function emReais(valor,moeda,cambio){if(moeda==='BRL')return r2(valor);const c=num(cambio);return c>0?r2(num(valor)*c):null}
/** Quanto da parcela já foi pago: o valor pago informado ou, com data de pagamento e sem valor, a parcela inteira. */
const pagoDe=pg=>pg.valor_pago!=null&&pg.valor_pago!==''?num(pg.valor_pago):pg.pago_em?num(pg.valor):0;
// Parcela paga em parte: o que falta vence em "venc_saldo" (a nova data combinada). Sem ela, fica "pago em parte" e
// não vencida, porque o vencimento original já foi atendido com o pagamento feito.
/** Vencimento do que ainda está em aberto na parcela (o do saldo, se já houve pagamento parcial). */
const vencAberto=pg=>pagoDe(pg)>0?(pg.venc_saldo||null):(pg.vencimento||null);
function situacaoPag(pg,d=hoje()){const v=num(pg.valor),pago=pagoDe(pg),saldo=r2(v-pago);
 if(pago>0&&saldo<=0.005)return 'pago';const venc=vencAberto(pg);if(venc&&venc<d)return 'vencido';return pago>0?'parcial':'a_vencer'}
/** Totais do processo: mercadoria (itens), parcelas, pago e saldo, na moeda do processo e em reais (estimado pelo câmbio). */
function totais(p){p=normalizar(p);const itens=p.itens,pags=p.pagamentos;
 const mercadoria=r2(itens.reduce((s,i)=>s+num(i.qtd)*num(i.unit),0)),qtd=itens.reduce((s,i)=>s+num(i.qtd),0);
 const merc=pags.filter(g=>(g.tipo||'mercadoria')==='mercadoria'&&(g.moeda||p.moeda)===p.moeda);
 const agendadoMerc=r2(merc.reduce((s,g)=>s+num(g.valor),0)),pagoMerc=r2(merc.reduce((s,g)=>s+pagoDe(g),0));
 let previsto=0,pago=0,semCambio=0;
 for(const g of pags){const m=g.moeda||p.moeda,c=g.cambio||(m===p.moeda?p.cambio:null),v=emReais(num(g.valor),m,c),pg=emReais(pagoDe(g),m,g.cambio_pago||c);if(v==null){semCambio++;continue}previsto+=v;pago+=pg||0}
 return {itens:itens.length,qtd,mercadoria,mercadoriaReais:emReais(mercadoria,p.moeda,p.cambio),agendadoMerc,pagoMerc,saldoMerc:r2(mercadoria-pagoMerc),semParcela:r2(mercadoria-agendadoMerc),
  previstoReais:r2(previsto),pagoReais:r2(pago),saldoReais:r2(previsto-pago),semCambio,
  // Saldo em reais com a mercadoria que ainda não tem parcela (pelo câmbio estimado do processo).
  saldoReaisTotal:r2(previsto-pago+Math.max(0,emReais(mercadoria-agendadoMerc,p.moeda,p.cambio)||0)),novos:itens.filter(i=>i.novo&&!i.sku).length}}
/** Resumo por situação: processos, contêineres (FCL) e cargas LCL de cada etapa, e o total em acompanhamento. */
function resumoStatus(lista){const L=(lista||[]).map(normalizar),conta=l=>({processos:l.length,ctns:l.reduce((s,p)=>s+(p.modalidade==='lcl'?0:p.ctns),0),lcl:l.filter(p=>p.modalidade==='lcl').length});
 return {total:conta(L.filter(ativo)),etapas:ETAPAS.map(([k,t,ic])=>({status:k,nome:t,ic,...conta(L.filter(p=>p.status===k))}))}}
const cargaTxt=c=>[c.ctns?`${c.ctns} CTN${c.ctns>1?'s':''}`:'',c.lcl?`${c.lcl} LCL`:''].filter(Boolean).join(' · ')||'0 CTNs';
/** Próximo número do ano: IMP001/26, IMP002/26… (o maior do ano + 1). */
function proximoNumero(lista,ano=hoje().slice(2,4),prefixo='IMP'){const re=new RegExp(`^${prefixo}(\\d+)\\/(\\d{2})$`,'i');let n=0;
 for(const p of lista||[]){const m=String(p.numero||'').trim().match(re);if(m&&m[2]===ano)n=Math.max(n,Number(m[1]))}return `${prefixo}${String(n+1).padStart(3,'0')}/${ano}`}
/** Muda a situação: registra no histórico e grava a data real do marco alcançado (se ainda vazia). */
function mudarStatus(p,para,por=quem(),em=new Date().toISOString(),obs=''){p=normalizar(p);if(!NOME_ST[para]||p.status===para)return p;
 const L={...p.logistica},marco=MARCO_DA_ETAPA[para];if(marco&&!L[marco])L[marco]=String(em).slice(0,10);
 return {...p,status:para,logistica:L,historico:[...p.historico,{em,por,de:p.status,para,obs:obs||''}]}}
/** Prazos: marco previsto e não cumprido (atrasado), cumprido com atraso, dias navegando contra o transit time contratado. */
function prazos(p,d=hoje()){p=normalizar(p);const L=p.logistica,m=MARCOS.map(([k,t])=>{const prev=L[k+'_prev']||null,real=L[k]||null;
  return {k,t,prev,real,atraso:real?(prev?Math.max(0,dias(prev,real)):0):(prev&&prev<d?dias(prev,d):0)}});
 const nav=L.etd?dias(L.etd,L.eta||d):null,tt=num(L.tt)||null;
 return {marcos:m,navegando:nav,tt,estourouTT:nav!=null&&tt!=null&&!L.eta&&nav>tt,proximo:m.find(x=>!x.real&&x.prev)||null}}
/** Erros que impedem gravar. */
function validar(p,lista=[]){p=normalizar(p);const e=[];
 if(!p.numero)e.push('Informe o número do processo.');else if((lista||[]).some(x=>x.id!==p.id&&String(x.numero).trim().toLowerCase()===p.numero.toLowerCase()))e.push(`Já existe o processo ${p.numero}.`);
 if(!String(p.fornecedor).trim())e.push('Informe o fornecedor (parceiro do processo).');
 if(String(p.logistica.imo||'').trim()&&!imoValido(p.logistica.imo))e.push('IMO do navio inválido: são 7 dígitos e o último confere com os outros.');
 if(String(p.logistica.mmsi||'').trim()&&!mmsiValido(p.logistica.mmsi))e.push('MMSI inválido: são 9 dígitos.');
 p.itens.forEach((i,k)=>{if(!i.sku&&!String(i.nome||'').trim())e.push(`Item ${k+1}: informe o produto ou o nome do item novo.`);if(num(i.qtd)<=0)e.push(`Item ${k+1}: quantidade maior que zero.`);if(num(i.unit)<0)e.push(`Item ${k+1}: valor unitário negativo.`)});
 p.pagamentos.forEach((g,k)=>{if(num(g.valor)<=0)e.push(`Pagamento ${k+1}: valor maior que zero.`);if(!g.vencimento)e.push(`Pagamento ${k+1}: informe o vencimento.`);if(pagoDe(g)>num(g.valor)+0.005)e.push(`Pagamento ${k+1}: pago maior que o valor da parcela.`)});
 return e}
/** Parcelas da mercadoria: sinal (%) agora e o saldo no embarque, a partir do total dos itens. */
function parcelasSinalSaldo(p,pct=30,dSinal=hoje(),dSaldo=null){const t=totais(p).mercadoria;if(t<=0)return [];const sinal=r2(t*num(pct)/100);
 return [{id:novoId('pg-'),tipo:'mercadoria',descricao:`Sinal ${nf(pct)}%`,vencimento:dSinal,moeda:normalizar(p).moeda,valor:sinal},{id:novoId('pg-'),tipo:'mercadoria',descricao:'Saldo no embarque',vencimento:dSaldo||normalizar(p).logistica.etd_prev||dSinal,moeda:normalizar(p).moeda,valor:r2(t-sinal)}]}
/** Itens novos (sem SKU) dos processos que não foram cancelados. */
const itensNovos=lista=>(lista||[]).map(normalizar).filter(p=>p.status!=='cancelado').flatMap(p=>p.itens.filter(i=>i.novo&&!i.sku).map(i=>({p,i})));
/** Parcelas de todos os processos, com a situação e o saldo. */
const todasParcelas=(lista,d=hoje())=>(lista||[]).map(normalizar).filter(p=>p.status!=='cancelado').flatMap(p=>p.pagamentos.map(g=>{const m=g.moeda||p.moeda,c=g.cambio||(m===p.moeda?p.cambio:null),saldo=r2(num(g.valor)-pagoDe(g));return {p,g,moeda:m,pago:pagoDe(g),saldo,saldoReais:emReais(saldo,m,c),sit:situacaoPag(g,d)}}));

// ─── Dados: nuvem (tabela importacoes) ou este navegador ───
const st={lista:null,carregando:false,erro:'',busca:'',filtro:'ativos',ed:null,aba:'geral',erros:[],addBusca:'',fotos:{},pagFiltro:'abertos',vinc:null,vincBusca:''};
window.Reiniciar?.registrar(st,['busca','filtro','pagFiltro','vinc','vincBusca']);
const LOCAL='eb_importacoes_local';
const lerLocal=()=>{try{return JSON.parse(localStorage.getItem(LOCAL)||'[]')}catch{return []}};
const gravarLocal=l=>{try{localStorage.setItem(LOCAL,JSON.stringify(l))}catch{toast('Sem espaço neste navegador para gravar (fotos grandes?).')}};
const PAGINAS=['importacoes','impitens','imppag'];
const redesenhar=()=>{if(PAGINAS.includes(page)&&!document.querySelector('.modalback'))render()};
async function carregar(forcar){if(st.carregando||(st.lista&&!forcar))return;
 if(!nuvem()){st.lista=lerLocal().map(normalizar);return}
 st.carregando=true;
 try{const {data,error}=await Cloud.client.from('importacoes').select('*').eq('workspace_id',Cloud.ws).order('created_at',{ascending:false}).limit(1000);if(error)throw error;st.lista=(data||[]).map(normalizar);st.erro=''}
 catch(e){st.lista=st.lista||[];st.erro=e.message||String(e)}
 finally{st.carregando=false}redesenhar()}
async function gravar(p,acao){p=normalizar(p);const novo=!(st.lista||[]).some(x=>x.id===p.id),agora=new Date().toISOString();
 const row={...p,updated_at:agora,created_at:p.created_at||agora,criado_por:p.criado_por||quem()};
 if(nuvem()){const {data,error}=await Cloud.client.from('importacoes').upsert({...row,workspace_id:Cloud.ws},{onConflict:'workspace_id,id'}).select().single();if(error)throw error;Object.assign(row,data||{})}
 const l=(st.lista||[]).filter(x=>x.id!==row.id);l.unshift(normalizar(row));st.lista=l;if(!nuvem())gravarLocal(l);
 audit(acao||(novo?'Importação cadastrada':'Importação alterada'),`${row.numero} · ${row.fornecedor} · ${NOME_ST[row.status]}`);return normalizar(row)}

// ─── Fotos ───
const produtos=()=>(window.Estoque?.lista?.()||[]).filter(p=>p.formato!=='V');
const prodDe=sku=>produtos().find(p=>String(p.id)===String(sku));
function urlFoto(i){if(i.sku){const p=prodDe(i.sku);return p?.imagem||''}const f=i.foto||'';if(!f||/^data:|^https?:/.test(f))return f;
 if(st.fotos[f])return st.fotos[f];if(st.fotos[f]===undefined&&nuvem()){st.fotos[f]='';Cloud.client.storage.from('importacoes').createSignedUrl(f,3600).then(({data})=>{if(data?.signedUrl){st.fotos[f]=data.signedUrl;document.querySelectorAll(`img[data-imp-src="${CSS.escape(f)}"]`).forEach(im=>{im.src=data.signedUrl;im.hidden=false})}}).catch(()=>{})}return ''}
function thumb(i,cls='pfoto'){const u=urlFoto(i),f=!i.sku&&i.foto&&!/^data:|^https?:/.test(i.foto)?i.foto:'';
 return `<span class="${cls}" title="${esc(i.nome||i.sku||'')}">${u||f?`<img src="${esc(u)}" ${f?`data-imp-src="${esc(f)}"`:''} ${u?'':'hidden'} alt="" loading="lazy" onerror="this.remove()">`:`<span class="imp-semfoto">${icon(i.novo?'spark':'box')}</span>`}</span>`}
async function enviarFoto(p,item,arq){if(!arq)return;if(!/^image\/(jpeg|png|webp)$/.test(arq.type))return toast('Use uma foto JPG, PNG ou WebP.');if(arq.size>5*1024*1024)return toast('Foto acima de 5 MB: reduza antes de enviar.');
 if(nuvem()){const ext=arq.type.split('/')[1].replace('jpeg','jpg'),caminho=`${Cloud.ws}/${p.id}/${item.id}-${Date.now().toString(36)}.${ext}`;
  const {error}=await Cloud.client.storage.from('importacoes').upload(caminho,arq,{contentType:arq.type,upsert:false});if(error)throw error;item.foto=caminho;return}
 if(arq.size>700*1024)return toast('Sem nuvem a foto fica neste navegador: use uma de até 700 KB.');
 item.foto=await new Promise((ok,erro)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>erro(r.error);r.readAsDataURL(arq)})}

// ─── Painel ───
function filtrar(lista){const q=normalized(st.busca.trim());let l=lista;
 if(st.filtro==='ativos')l=l.filter(ativo);else if(st.filtro==='concluidos')l=l.filter(p=>!ativo(p));else if(NOME_ST[st.filtro])l=l.filter(p=>p.status===st.filtro);
 if(q)l=l.filter(p=>normalized(`${p.numero} ${p.titulo} ${p.fornecedor} ${p.origem} ${p.destino} ${p.logistica.bl||''} ${p.logistica.containers||''} ${p.itens.map(i=>`${i.sku||''} ${i.nome||''} ${i.ref||''}`).join(' ')}`).includes(q));
 return l}
/** Lista pronta para desenhar; sem ela, começa a leitura (a tela se redesenha ao chegar). Também carrega os produtos (fotos e busca). */
function pronto(){if(window.Estoque&&!window.Estoque.carregado?.()&&!window.Estoque.carregando?.())window.Estoque.carregar?.().then(redesenhar);if(!st.lista)carregar();return !!st.lista}
const CARREGANDO='<div class="empty">Carregando importações…</div>';
function painelView(){if(!pronto())return CARREGANDO;
 const R=resumoStatus(st.lista),l=filtrar(st.lista),pode=podeGravar();
 return `${!nuvem()?'<div class="notice"><strong>Modo local.</strong> Sem login na nuvem, os processos ficam só neste navegador.</div>':''}${st.erro?`<div class="notice">Não consegui ler as importações: ${esc(st.erro)}</div>`:''}
 <div class="imp-bar"><div class="searchin">${icon('search')}<input id="impBusca" type="search" placeholder="Buscar processo, parceiro, origem, BL, contêiner ou item…" value="${esc(st.busca)}" autocomplete="off"></div>
  <div class="segtabs imp-filtro" role="tablist">${[['ativos','Em acompanhamento'],['concluidos','Concluídos'],['todos','Todos']].map(([k,t])=>`<button role="tab" aria-selected="${st.filtro===k}" class="${st.filtro===k?'active':''}" data-imp-filtro="${k}">${t}</button>`).join('')}</div>
  ${pode?`<button class="primary" data-imp-novo>${icon('plus')} Novo processo</button>`:''}</div>
 <div class="imp-resumo"><button class="card imp-total ${st.filtro==='ativos'?'sel':''}" data-imp-filtro="ativos"><span class="imp-ic">${icon('ship')}</span><strong>${cargaTxt(R.total)}</strong><span>Total em acompanhamento</span><small>${R.total.processos} processo(s)</small></button>
  <div class="imp-etapas">${R.etapas.map(e=>`<button class="card imp-etapa imp-e-${e.status} ${st.filtro===e.status?'sel':''}" data-imp-filtro="${e.status}" title="${esc(e.nome)}"><span class="imp-ic">${icon(e.ic)}</span><span class="imp-et"><strong>${cargaTxt(e)}</strong><span>${esc(e.nome)}</span><small>${e.processos} processo(s)</small></span></button>`).join('')}</div></div>
 ${mar(st.lista)}
 <div class="imp-mapa-top"><h2>Mapa de processos</h2><span class="caption">${l.length} processo(s)${st.filtro!=='todos'?` · ${esc(NOME_ST[st.filtro]||(st.filtro==='ativos'?'em acompanhamento':'concluídos'))}`:''}</span></div>
 ${l.length?`<div class="imp-mapa">${l.map(cartao).join('')}</div>`:`<div class="card empty">${st.lista.length?'Nenhum processo com esse filtro.':`Nenhuma importação cadastrada.${pode?' Clique em <strong>Novo processo</strong> para abrir a primeira.':''}`}</div>`}`}
function cartao(p){const t=totais(p),z=prazos(p),idx=ETAPAS.findIndex(([k])=>k===p.status),pct=p.status==='cancelado'?0:Math.round(Math.max(0,idx)/(ETAPAS.length-1)*100),pode=podeGravar(),mostra=p.itens.slice(0,p.itens.length>4?3:4),resto=p.itens.length-mostra.length;
 return `<article class="card imp-card imp-e-${p.status}">
 <div class="imp-ch"><div><small>${esc(p.fornecedor||'—')} · <span class="mono">${esc(p.numero)}</span> · ${esc(TIPOS[p.tipo])}</small><strong>${esc(p.titulo||p.fornecedor||p.numero)}</strong></div><button class="small quiet" data-imp-abrir="${esc(p.id)}" aria-label="Abrir ${esc(p.numero)}">${icon('edit')}</button></div>
 <div class="imp-rota"><b>${esc(p.origem||'Origem')}</b><span class="imp-linha"><i style="width:${pct}%"></i><em style="left:calc(13px + (100% - 26px) * ${pct/100})">${icon(p.modalidade==='aereo'||p.modalidade==='courier'?'send':'ship')}</em></span><b>${esc(p.destino||'Destino')}</b></div>
 ${p.logistica.navio||p.logistica.imo||p.logistica.mmsi?`<button class="imp-cart-navio" data-imp-navio="${esc(p.id)}">${icon('ship')} <span>${esc(p.logistica.navio||'Navio')}${p.logistica.viagem?` · ${esc(p.logistica.viagem)}`:''}</span><em>ao vivo</em></button>`:''}
 <dl class="imp-dl"><div><dt>Carga</dt><dd>${p.modalidade==='lcl'?'LCL':p.ctns?`${p.ctns} CTN${p.ctns>1?'s':''}`:esc(MODAL[p.modalidade])} · ${t.itens} item(ns)</dd></div><div><dt>TT contratado</dt><dd>${z.tt?`${z.tt} dia(s)`:'—'}${z.navegando!=null&&!p.logistica.eta?` <span class="${z.estourouTT?'red':'caption'}">· ${z.navegando} navegando</span>`:''}</dd></div>
  <div><dt>${z.proximo?esc(z.proximo.t):'Prazos'}</dt><dd>${z.proximo?`${dBR(z.proximo.prev)}${z.proximo.atraso?` <span class="red">· ${z.proximo.atraso} dia(s) de atraso</span>`:''}`:p.logistica.entrega?`entregue em ${dBR(p.logistica.entrega)}`:'—'}</dd></div>
  <div><dt>Mercadoria</dt><dd>${t.mercadoria?`${dinheiro(t.mercadoria,p.moeda)}${t.saldoMerc<=0.005?' <span class="green">· paga</span>':t.pagoMerc>0?` <span class="caption">· saldo ${dinheiro(t.saldoMerc,p.moeda)}</span>`:' <span class="caption">· nada pago</span>'}`:'—'}</dd></div></dl>
 ${p.itens.length?`<div class="imp-itens">${mostra.map(i=>`<span class="imp-it">${thumb(i)}<small>${esc(i.nome||prodDe(i.sku)?.nome||i.sku||'')}</small></span>`).join('')}${resto>0?`<button class="imp-mais" data-imp-abrir="${esc(p.id)}" data-imp-aba="itens">+${resto} itens</button>`:''}</div>`:''}
 ${t.novos?`<p class="caption imp-aviso">${icon('spark')} ${t.novos} item(ns) novo(s) sem cadastro no Bling</p>`:''}
 <div class="imp-cf">${pode?`<select data-imp-status="${esc(p.id)}" aria-label="Situação de ${esc(p.numero)}">${[...ETAPAS,['cancelado','Cancelado']].map(([k,tt])=>`<option value="${k}" ${p.status===k?'selected':''}>${esc(tt)}</option>`).join('')}</select>`:`<span class="badge">${esc(NOME_ST[p.status])}</span>`}
  ${['rota','entregue'].includes(p.status)?`<button class="small" data-nav="chegada">${icon('truck')} Chegada no galpão</button>`:''}</div></article>`}

// ─── Navio ao vivo ───
// O navio do processo (nome, IMO e/ou MMSI) abre a posição real no MarineTraffic e um mapa AIS ao vivo (VesselFinder ou
// MarineTraffic, por IMO/MMSI). Com a chave da API do MarineTraffic nos segredos do Supabase, a função navio-posicao
// devolve a posição AIS e o navio do painel vai para o ponto real da rota (fração da distância origem → destino).
/** IMO: 7 dígitos, o último confere com a soma dos 6 primeiros × 7, 6, 5, 4, 3 e 2. */
function imoValido(v){const s=String(v??'').replace(/^IMO\s*/i,'').trim();if(!/^\d{7}$/.test(s))return false;return [...s.slice(0,6)].reduce((t,d,i)=>t+Number(d)*(7-i),0)%10===Number(s[6])}
/** MMSI de navio: 9 dígitos, começando por 2 a 7. */
const mmsiValido=v=>/^[2-7]\d{8}$/.test(String(v??'').trim());
const soDig=v=>String(v??'').replace(/\D/g,'');
/** Endereços do navio: página no MarineTraffic e no VesselFinder (por IMO, MMSI ou, só com o nome, a busca) e os mapas ao vivo. */
function linksNavio(L={}){const imo=imoValido(L.imo)?soDig(L.imo):'',mmsi=mmsiValido(L.mmsi)?String(L.mmsi).trim():'',nome=String(L.navio||'').split(/[\/·|]|\s+v\.?\s*\d/i)[0].trim();
 if(!imo&&!mmsi&&!nome)return null;const q=encodeURIComponent(nome);
 const mt=imo?`https://www.marinetraffic.com/en/ais/details/ships/imo:${imo}`:mmsi?`https://www.marinetraffic.com/en/ais/details/ships/mmsi:${mmsi}`:`https://www.marinetraffic.com/en/ais/index/search/all/keyword:${q}`;
 const vf=imo||mmsi?`https://www.vesselfinder.com/vessels/details/${imo||mmsi}`:`https://www.vesselfinder.com/vessels?name=${q}`;
 const mapaVf=imo||mmsi?`https://www.vesselfinder.com/aismap?zoom=6&width=100%25&height=420&names=true&${imo?`imo=${imo}`:`mmsi=${mmsi}`}&track=true&fleet=false&clicktoact=false&store_pos=false`:null;
 const mapaMt=mmsi?`https://www.marinetraffic.com/en/ais/embed/zoom:6/maptype:4/shownames:true/mmsi:${mmsi}/shipid:0/fleet:/fleet_id:/vtypes:/showmenu:false/remember:false`:null;
 return {nome,imo,mmsi,mt,vf,mapaVf,mapaMt}}
// Portos mais usados (lat, lon) para converter a posição AIS em ponto da rota. Nome sem acento, minúsculo.
const PORTOS={ningbo:[29.87,121.85],yiwu:[29.87,121.85],xangai:[30.63,122.06],shanghai:[30.63,122.06],shenzhen:[22.57,114.27],yantian:[22.57,114.27],guangzhou:[22.75,113.62],nansha:[22.75,113.62],qingdao:[36.0,120.3],tianjin:[38.98,117.78],xiamen:[24.45,118.07],hong:[22.3,114.17],busan:[35.1,129.04],singapura:[1.26,103.84],singapore:[1.26,103.84],
 itajai:[-26.9,-48.65],navegantes:[-26.89,-48.64],itapoa:[-26.12,-48.6],'sao francisco':[-26.24,-48.64],paranagua:[-25.5,-48.52],santos:[-23.98,-46.3],'rio grande':[-32.05,-52.08],'rio de janeiro':[-22.89,-43.18],suape:[-8.39,-34.96],salvador:[-12.97,-38.51],vitoria:[-20.32,-40.33],pecem:[-3.53,-38.8],manaus:[-3.14,-60.02]};
function coordPorto(nome){const n=normalized(String(nome||'')).replace(/[^a-z ]/g,' ');if(!n.trim())return null;for(const [k,c] of Object.entries(PORTOS))if(n.includes(k))return c;return null}
/** Distância em km entre dois pontos [lat, lon] (círculo máximo). */
function distKm(a,b){const r=x=>x*Math.PI/180,dl=r(b[0]-a[0]),dn=r(b[1]-a[1]),h=Math.sin(dl/2)**2+Math.cos(r(a[0]))*Math.cos(r(b[0]))*Math.sin(dn/2)**2;return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)))}
/** Ponto da rota (0 a 1) pela posição real: distância já feita ÷ (feita + que falta). null sem os dois portos. */
function fracaoPorPosicao(pos,origem,destino){const o=coordPorto(origem),d=coordPorto(destino);if(!pos||!o||!d||!Number.isFinite(pos.lat)||!Number.isFinite(pos.lon))return null;
 const a=distKm(o,[pos.lat,pos.lon]),b=distKm([pos.lat,pos.lon],d);if(a+b<=0)return null;return Math.min(0.98,Math.max(0.02,a/(a+b)))}

// ─── Ao vivo no mar ───
// Painel animado acima do mapa: cada processo navegando vira um navio na sua rota, no ponto real da viagem (do embarque
// até a chegada prevista ou o transit time); ao abrir a tela ele desliza da origem até lá e fica balançando nas ondas.
// Aguardando embarque fica atracado na origem; nacionalizando e desembaraçada, no porto de destino. Clique abre o processo.
/** Quanto da viagem já foi feito (0 a 1): pelo embarque e pela chegada prevista, ou pelo transit time; sem datas, metade. */
function progressoMar(p,d=hoje()){p=normalizar(p);const L=p.logistica;if(!L.etd)return 0.5;
 const fim=chegadaPrevista(p);if(!fim)return 0.5;const tot=dias(L.etd,fim),feito=dias(L.etd,d);
 if(!(tot>0))return 0.96;return Math.min(0.96,Math.max(0.04,feito/tot))}
/** Chegada prevista ao porto: a ETA informada ou o embarque + transit time contratado. */
function chegadaPrevista(p){const L=normalizar(p).logistica;if(L.eta_prev)return L.eta_prev;const tt=num(L.tt);
 if(!L.etd||!(tt>0))return null;const x=new Date(String(L.etd).slice(0,10)+'T12:00:00');x.setDate(x.getDate()+tt);return x.toLocaleDateString('sv-SE')}
const CORES_CTN=['#e8707e','#e0a33a','#5b8def','#3fb37f','#a77bf3'];
const vistosNoMar=new Set();
function buscarAis(L){if(!nuvem()||st.aisBuscando)return;const ids=L.filter(p=>p.status==='navegando'&&(imoValido(p.logistica.imo)||mmsiValido(p.logistica.mmsi))).map(p=>p.id).slice(0,12);
 if(!ids.length||(st.ais&&Date.now()-st.ais.em<30*60e3&&ids.every(i=>st.ais.ids.includes(i))))return;st.aisBuscando=true;
 Cloud.client.functions.invoke('navio-posicao',{body:{workspace_id:Cloud.ws,ids}}).then(({data})=>{st.ais={...(data||{configurado:false,posicoes:{}}),em:Date.now(),ids};if(Object.keys(st.ais.posicoes||{}).length)redesenhar()})
  .catch(()=>{st.ais={configurado:false,posicoes:{},em:Date.now(),ids}}).finally(()=>{st.aisBuscando=false})}
function navio(p,i,escala=1,rotulo=''){const c=k=>CORES_CTN[(i+k)%CORES_CTN.length];
 return `<g class="imp-boia" style="animation-delay:-${(i*0.73).toFixed(2)}s"><g transform="scale(${escala})">
  <path class="imp-esteira" d="M-24,9 Q-40,12 -58,9"/><path class="imp-esteira" d="M-24,11 Q-36,16 -48,14"/>
  <rect class="imp-ponte" x="-21" y="-11" width="6" height="13" rx="1"/><rect class="imp-ponte" x="-20" y="-15" width="4" height="4" rx="1"/>
  <rect x="-13" y="-5" width="7" height="7" rx="1" fill="${c(0)}"/><rect x="-5" y="-5" width="7" height="7" rx="1" fill="${c(1)}"/><rect x="3" y="-5" width="7" height="7" rx="1" fill="${c(2)}"/><rect x="-9" y="-11" width="7" height="6" rx="1" fill="${c(3)}"/><rect x="-1" y="-11" width="7" height="6" rx="1" fill="${c(4)}"/>
  <path class="imp-casco" d="M-25,2 H25 L18,12 H-20 Z"/><path class="imp-faixa" d="M-23,6 H22"/></g>
  ${rotulo?`<text class="imp-navio-rot" y="${-22*escala}" text-anchor="middle">${esc(rotulo)}</text>`:''}</g>`}
function mar(lista){const L=(lista||[]).map(normalizar),d=hoje(),W=1000,H=250,x0=96,x1=904,yp=150;
 buscarAis(L);const noMar=L.filter(p=>p.status==='navegando').map(p=>{const ais=st.ais?.posicoes?.[p.id],fr=ais?fracaoPorPosicao(ais,p.origem,p.destino):null;return {p,ais:fr!=null?ais:null,t:fr!=null?fr:progressoMar(p,d),fim:chegadaPrevista(p)}}).sort((a,b)=>b.t-a.t),mostra=noMar.slice(0,8);
 const naOrigem=L.filter(p=>p.status==='embarque'),noPorto=L.filter(p=>['nacionalizando','desembaracada'].includes(p.status)),emProducao=L.filter(p=>['producao','cotacao'].includes(p.status)).length;
 if(!mostra.length&&!naOrigem.length&&!noPorto.length)return '';
 const reduzir=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,n=mostra.length;
 const origens=[...new Set([...mostra.map(x=>x.p.origem),...naOrigem.map(p=>p.origem)].filter(Boolean).map(o=>o.split(',')[0].trim()))].slice(0,2);
 const destinos=[...new Set([...mostra.map(x=>x.p.destino),...noPorto.map(p=>p.destino)].filter(Boolean))].slice(0,2);
 const prox=noMar.filter(x=>x.fim).sort((a,b)=>a.fim.localeCompare(b.fim))[0],faltam=prox?dias(d,prox.fim):null;
 const rotas=mostra.map((x,i)=>{const k=i-(n-1)/2,ya=yp+k*14,yb=yp+k*9,cy=48+i*11;return {...x,i,path:`M${x0},${ya.toFixed(1)} Q500,${cy} ${x1},${yb.toFixed(1)}`}});
 // Ondas: traços curtos em posições fixas (a mesma tela sempre igual), cada um com o seu ritmo.
 const ondas=Array.from({length:26},(_,i)=>{const x=140+((i*137)%720),y=24+((i*61)%205);return `<path class="imp-onda" style="animation-delay:-${(i*0.9)%7}s" d="M${x},${y} q8,-5 16,0 t16,0"/>`}).join('');
 const atracados=(lst,x,dir)=>lst.slice(0,4).map((p,j)=>`<g class="imp-navio imp-atracado" data-imp-navio="${esc(p.id)}" transform="translate(${x+dir*(40+j*8)},${yp-62-j*24})" role="button" tabindex="0" aria-label="${esc(p.numero)}: ${esc(NOME_ST[p.status])}"><title>${esc(p.numero)} · ${esc(p.fornecedor||'')} · ${esc(NOME_ST[p.status])}</title>${navio(p,j+3,.72,p.numero.split('/')[0])}</g>`).join('');
 const svg=`<svg class="imp-mar-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${n} navio(s) no mar">
  <defs><linearGradient id="impMarG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="imp-mar-a"/><stop offset="1" class="imp-mar-b"/></linearGradient>
   <radialGradient id="impBrilho" cx=".5" cy=".35" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#impMarG)"/><rect width="${W}" height="${H}" fill="url(#impBrilho)"/>
  <g class="imp-latitudes">${[50,100,150,200].map(y=>`<path d="M0,${y} H${W}"/>`).join('')}${[250,500,750].map(x=>`<path d="M${x},0 V${H}"/>`).join('')}</g>
  <g class="imp-ondas">${ondas}</g>
  <path class="imp-terra" d="M0,0 H64 Q88,30 76,70 Q62,112 84,150 Q104,190 74,226 Q62,240 70,${H} H0 Z"/>
  <path class="imp-terra" d="M${W},0 H936 Q914,36 926,84 Q940,128 916,168 Q898,204 926,${H} H${W} Z"/>
  ${rotas.map(r=>`<path class="imp-rota" style="animation-delay:-${r.i*0.4}s" d="${r.path}"/>`).join('')}
  <g class="imp-porto" transform="translate(${x0},${yp})"><circle class="imp-pulso" r="7"/><circle class="imp-porto-pt" r="5"/></g>
  <g class="imp-porto imp-porto-dest" transform="translate(${x1},${yp})"><circle class="imp-pulso" r="7"/><circle class="imp-porto-pt" r="5"/></g>
  <text class="imp-porto-rot" x="${x0+14}" y="${yp+34}">${esc(origens.join(' · ')||'Origem')}</text>
  <text class="imp-porto-rot" x="${x1-14}" y="${yp+34}" text-anchor="end">${esc(destinos.join(' · ')||'Destino')}</text>
  ${naOrigem.length?`<text class="imp-porto-sub" x="${x0+14}" y="${yp+50}">${naOrigem.length} aguardando embarque</text>`:emProducao?`<text class="imp-porto-sub" x="${x0+14}" y="${yp+50}">${emProducao} em produção</text>`:''}
  ${noPorto.length?`<text class="imp-porto-sub" x="${x1-14}" y="${yp+50}" text-anchor="end">${noPorto.length} no porto</text>`:''}
  ${atracados(naOrigem,x0,1)}${atracados(noPorto,x1,-1)}
  ${rotas.map(r=>{const novo=!vistosNoMar.has(r.p.id);vistosNoMar.add(r.p.id);const dur=reduzir||!novo?'0.001s':`${(1.6+r.t*1.8).toFixed(2)}s`,f=r.fim?dias(d,r.fim):null;
   const rot=`${r.p.numero.split('/')[0]}${f!=null?` · ${f>0?f+' d':f===0?'hoje':'atrasado'}`:''}${r.ais?' · AIS':''}`;
   return `<g class="imp-navio${r.ais?' imp-ais':''}" data-imp-navio="${esc(r.p.id)}" role="button" tabindex="0" aria-label="${esc(r.p.numero)}: ${Math.round(r.t*100)}% da viagem"><title>${esc(r.p.numero)} · ${esc(r.p.fornecedor||'')}${r.p.logistica.navio?` · navio ${esc(r.p.logistica.navio)}`:''}\n${esc(r.p.origem||'')} → ${esc(r.p.destino||'')}\n${Math.round(r.t*100)}% da viagem${r.ais?` (posição AIS${r.ais.velocidade!=null?`, ${nf(r.ais.velocidade,1)} nós`:''})`:' (estimada pelas datas)'}${r.fim?` · chegada prevista ${dBR(r.fim)}`:''}\nClique para ver o navio ao vivo</title>
    <animateMotion dur="${dur}" fill="freeze" calcMode="spline" keySplines=".25 .1 .25 1" keyPoints="0;${r.t.toFixed(3)}" keyTimes="0;1" path="${r.path}"/>${navio(r.p,r.i,1,rot)}</g>`}).join('')}
 </svg>`;
 return `<section class="card imp-mar" aria-label="Navios no mar agora">
  <div class="imp-mar-top"><small>Ao vivo</small><strong>${n?`${noMar.length} navio${noMar.length>1?'s':''} no mar`:'Nenhum navio no mar'}</strong>
   <span class="imp-mar-fonte">${st.ais?.configurado&&mostra.some(r=>r.ais)?'Posição real (AIS) onde há IMO/MMSI':'Posição estimada pelas datas · clique no navio para vê-lo ao vivo'}</span>
   ${prox?`<span class="imp-mar-prox">Próxima chegada: <b class="mono">${esc(prox.p.numero)}</b> · ${esc(prox.p.destino||'destino')} · ${faltam>0?`em ${faltam} dia${faltam>1?'s':''}`:faltam===0?'hoje':`${-faltam} dia(s) de atraso`} (${dBR(prox.fim)})</span>`:''}</div>
  ${svg}${noMar.length>mostra.length?`<p class="caption imp-mar-mais">+${noMar.length-mostra.length} navio(s) fora do painel: veja o mapa abaixo.</p>`:''}</section>`}

function abrirNavio(id){const p=(st.lista||[]).find(x=>x.id===id);if(!p)return;const k=linksNavio(p.logistica),ais=st.ais?.posicoes?.[p.id];
 const sub=`<p class="caption">${esc(p.numero)} · ${esc(p.fornecedor||'')} · ${esc(p.origem||'origem')} → ${esc(p.destino||'destino')} · ${esc(NOME_ST[p.status])}</p>`;
 if(!k){modal('Navio ao vivo',`${sub}<div class="notice">Cadastre o <strong>nome do navio</strong> e, se tiver, o <strong>IMO</strong> ou o <strong>MMSI</strong> (estão no BL e no booking) na guia Logística e prazos do processo: com eles o Jarvis mostra o navio em tempo real.</div><div class="modalfoot"><button data-action="close">Fechar</button><button class="primary" data-imp-abrir="${esc(p.id)}" data-imp-aba="logistica">${icon('edit')} Cadastrar o navio</button></div>`);return}
 const mapa=k.mapaVf||k.mapaMt;
 modal(`Navio ${k.nome||k.imo||k.mmsi}`,`${sub}
  <div class="imp-nav-info"><span><small>Navio</small><b>${esc(k.nome||'—')}</b></span><span><small>IMO</small><b class="mono">${esc(k.imo||'—')}</b></span><span><small>MMSI</small><b class="mono">${esc(k.mmsi||'—')}</b></span>${ais?`<span><small>Posição AIS</small><b>${nf(ais.lat,3)}, ${nf(ais.lon,3)}${ais.velocidade!=null?` · ${nf(ais.velocidade,1)} nós`:''}</b></span>`:''}</div>
  ${mapa?`<div class="segtabs imp-nav-fonte" role="tablist">${k.mapaVf?`<button role="tab" class="active" data-imp-mapa="${esc(k.mapaVf)}">VesselFinder</button>`:''}${k.mapaMt?`<button role="tab" class="${k.mapaVf?'':'active'}" data-imp-mapa="${esc(k.mapaMt)}">MarineTraffic</button>`:''}</div>
   <div class="imp-nav-mapa"><iframe id="impMapaNavio" src="${esc(mapa)}" title="Mapa ao vivo do navio" loading="lazy" referrerpolicy="no-referrer" allowfullscreen></iframe></div>
   <p class="caption">Mapa AIS público, atualizado pelos receptores costeiros e satélite; em alto-mar a última posição pode ter algumas horas.</p>`
  :`<div class="notice">Só com o nome dá para buscar o navio nos sites abaixo. Para o mapa ao vivo aqui dentro, informe o <strong>IMO</strong> (7 dígitos) ou o <strong>MMSI</strong> (9 dígitos) na guia Logística e prazos.</div>`}
  <div class="modalfoot"><button data-imp-abrir="${esc(p.id)}" data-imp-aba="logistica">${icon('edit')} Abrir o processo</button><a class="btnlink" href="${esc(k.vf)}" target="_blank" rel="noopener">VesselFinder</a><a class="btnlink primary" href="${esc(k.mt)}" target="_blank" rel="noopener">${icon('ship')} Ver no MarineTraffic</a></div>`);
 document.querySelector('.modalback .modal')?.classList.add('modalwide')}

// ─── Cadastro (janela com guias) ───
const ABAS=[['geral','Visão geral'],['logistica','Logística e prazos'],['itens','Itens'],['pagamentos','Pagamentos'],['historico','Histórico']];
function abrir(id,aba='geral'){pronto();const p=id?(st.lista||[]).find(x=>x.id===id):null;if(id&&!p)return;
 st.ed=structuredClone(p?normalizar(p):normalizar({numero:proximoNumero(st.lista),logistica:{abertura:hoje()}}));st.ed._novo=!p;st.aba=aba;st.erros=[];st.addBusca='';st.verMapa=false;
 modal(p?`Importação ${p.numero}`:'Cadastrar importação',`<div id="impEd">${edHtml()}</div>`);document.querySelector('.modalback .modal')?.classList.add('modalwide')}
const campo=(f,rot,v,extra='')=>`<div class="field"><label for="impf-${f}">${rot}</label><input id="impf-${f}" data-f="${f}" value="${esc(v??'')}" ${extra}></div>`;
const escolha=(f,rot,v,ops)=>`<div class="field"><label for="impf-${f}">${rot}</label><select id="impf-${f}" data-f="${f}">${ops.map(([k,t])=>`<option value="${esc(k)}" ${String(v??'')===String(k)?'selected':''}>${esc(t)}</option>`).join('')}</select></div>`;
function edHtml(){const p=st.ed,L=p.logistica,ro=!podeGravar(),t=totais(p);
 const abas=`<div class="segtabs" role="tablist">${ABAS.filter(([k])=>k!=='historico'||!p._novo).map(([k,tt])=>`<button role="tab" aria-selected="${st.aba===k}" class="${st.aba===k?'active':''}" data-imp-aba-ed="${k}">${tt}${k==='itens'&&p.itens.length?` <span class="navbadge">${p.itens.length}</span>`:''}${k==='pagamentos'&&p.pagamentos.length?` <span class="navbadge">${p.pagamentos.length}</span>`:''}</button>`).join('')}</div>`;
 const forn=[...new Set([...(st.lista||[]).map(x=>x.fornecedor),...(db.cadastros||[]).filter(c=>c.tipo==='forn').map(c=>c.dados?.fantasia||c.dados?.razao)].filter(Boolean))].sort();
 let corpo='';
 if(st.aba==='geral')corpo=`<p class="caption imp-sub">O processo é o centro do acompanhamento: itens, prazos e pagamentos ficam nas guias ao lado.</p>
  <div class="grid three">${campo('numero','Nº do processo',p.numero,'placeholder="IMP001/26" autocomplete="off"')}${escolha('tipo','Tipo',p.tipo,Object.entries(TIPOS))}${escolha('modalidade','Modalidade',p.modalidade,Object.entries(MODAL))}</div>
  <div class="grid three">${campo('ctns','Contêineres (CTNs)',p.ctns,'type="number" min="0" step="1" inputmode="numeric"')}${escolha('status','Situação',p.status,[...ETAPAS,['cancelado','Cancelado']])}${escolha('incoterm','Incoterm',p.incoterm,[['','—'],...INCOTERMS.map(x=>[x,x])])}</div>
  ${campo('titulo','Título para identificar o processo',p.titulo,'placeholder="Ex.: Brinquedos educativos · coleção de Natal"')}
  <div class="field"><label for="impf-fornecedor">Fornecedor (exportador / parceiro do processo)</label><input id="impf-fornecedor" data-f="fornecedor" list="impForn" value="${esc(p.fornecedor)}" placeholder="Nome do fornecedor no exterior"><datalist id="impForn">${forn.map(f=>`<option value="${esc(f)}">`).join('')}</datalist></div>
  <div class="grid two">${campo('origem','Origem',p.origem,'placeholder="Ex.: Ningbo, China"')}${campo('destino','Porto / aeroporto de destino',p.destino,'placeholder="Ex.: Itajaí"')}</div>
  <div class="grid three">${escolha('moeda','Moeda da compra',p.moeda,MOEDAS.map(m=>[m,m]))}${campo('cambio','Câmbio estimado (R$ por 1 '+esc(p.moeda)+')',p.cambio??'','type="number" min="0" step="0.0001" inputmode="decimal" placeholder="Ex.: 5,40"')}<div class="field"><label>Mercadoria</label><div class="imp-tot">${dinheiro(t.mercadoria,p.moeda)}${t.mercadoriaReais!=null&&p.moeda!=='BRL'?`<small>≈ ${money(t.mercadoriaReais)}</small>`:''}</div></div></div>
  <div class="field"><label for="impf-observacao">Contexto e observações</label><textarea id="impf-observacao" data-f="observacao" rows="3" placeholder="Pendência, mudança de previsão ou informação importante…">${esc(p.observacao)}</textarea></div>`;
 else if(st.aba==='logistica'){const z=prazos(p);corpo=`<div class="grid three">${campo('logistica.abertura','Abertura do processo',L.abertura,'type="date"')}${campo('logistica.proforma','Proforma / pedido (PI)',L.proforma,'placeholder="Nº da proforma"')}${campo('logistica.trading','Trading',L.trading,'placeholder="Se a importação for por conta e ordem"')}</div>
  <div class="grid three">${campo('logistica.agente','Agente de carga',L.agente)}${campo('logistica.despachante','Despachante',L.despachante)}${campo('logistica.viagem','Viagem (voyage)',L.viagem,'placeholder="Ex.: 042E"')}</div>
  <div class="grid three">${campo('logistica.navio','Navio (ou voo)',L.navio,'placeholder="Ex.: MSC ANNA" autocomplete="off"')}${campo('logistica.imo','IMO do navio',L.imo,'inputmode="numeric" maxlength="11" placeholder="7 dígitos (no BL)"')}${campo('logistica.mmsi','MMSI',L.mmsi,'inputmode="numeric" maxlength="9" placeholder="9 dígitos"')}</div>
  ${(()=>{const k=linksNavio(L);return k?`<div class="imp-nav-links">${icon('ship')} <span>Acompanhe o navio ao vivo:</span> <a class="btnlink" href="${esc(k.mt)}" target="_blank" rel="noopener">MarineTraffic</a> <a class="btnlink" href="${esc(k.vf)}" target="_blank" rel="noopener">VesselFinder</a>${k.mapaVf||k.mapaMt?` <button type="button" class="small" data-imp-vermapa>${st.verMapa?'Esconder o mapa':'Mapa ao vivo'}</button>`:''}</div>${st.verMapa&&(k.mapaVf||k.mapaMt)?`<div class="imp-nav-mapa"><iframe src="${esc(k.mapaVf||k.mapaMt)}" title="Mapa ao vivo do navio" loading="lazy" referrerpolicy="no-referrer" allowfullscreen></iframe></div>`:''}`:'<p class="caption">Com o nome do navio e o IMO ou o MMSI (estão no BL e no booking), o Jarvis mostra o navio em tempo real.</p>'})()}
  <div class="grid three">${campo('logistica.bl','BL / AWB',L.bl)}${campo('logistica.tt','Transit time contratado (dias)',L.tt,'type="number" min="0" step="1"')}${campo('logistica.free_time','Free time (dias)',L.free_time,'type="number" min="0" step="1"')}</div>
  <div class="field"><label for="impf-logistica.containers">Contêineres (um por linha)</label><textarea id="impf-logistica.containers" data-f="logistica.containers" rows="2" placeholder="ABCU1234567">${esc(L.containers||'')}</textarea></div>
  <div class="tablewrap imp-marcos"><table><thead><tr><th>Marco</th><th>Previsto</th><th>Realizado</th><th>Prazo</th></tr></thead><tbody>${z.marcos.map(m=>`<tr><td><strong>${esc(m.t)}</strong></td><td><input type="date" data-f="logistica.${m.k}_prev" value="${esc(m.prev||'')}" aria-label="${esc(m.t)} previsto"></td><td><input type="date" data-f="logistica.${m.k}" value="${esc(m.real||'')}" aria-label="${esc(m.t)} realizado"></td><td>${m.atraso?`<span class="badge bad">${m.atraso} dia(s) de atraso</span>`:m.real?'<span class="badge ok">cumprido</span>':m.prev?'<span class="badge info">no prazo</span>':'—'}</td></tr>`).join('')}</tbody></table></div>
  ${z.navegando!=null?`<p class="caption">${z.navegando} dia(s) ${L.eta?'de viagem':'navegando'}${z.tt?` · transit time contratado ${z.tt} dia(s)${z.estourouTT?' — <span class="red">passou do contratado</span>':''}`:''}.</p>`:''}
  <p class="caption">Ao mudar a situação, a data realizada do marco alcançado é preenchida com a data do dia, se estiver vazia.</p>`}
 else if(st.aba==='itens'){const r=st.addBusca.trim()?achar(st.addBusca):[];corpo=`<p class="caption imp-sub">Produtos do catálogo ou itens novos, que ainda não têm cadastro nem foto no Bling. Valor unitário em ${esc(p.moeda)}.</p>
  <div class="tablewrap"><table class="imp-tab"><thead><tr><th>Item</th><th>Ref. fornecedor</th><th>NCM</th><th class="num">Qtd.</th><th class="num">Valor unit.</th><th class="num">Total</th><th></th></tr></thead><tbody>
  ${p.itens.map((i,k)=>{const pr=i.sku?prodDe(i.sku):null;return `<tr><td class="imp-itcel">${thumb(i)}${i.sku?`<span><strong>${esc(pr?.nome||i.nome||i.sku)}</strong><small class="mono">${esc(i.sku)}</small></span>`:`<span><input data-it="${k}" data-c="nome" value="${esc(i.nome||'')}" placeholder="Nome do item novo" aria-label="Nome do item ${k+1}"><small><span class="badge warn">novo · sem cadastro</span> ${ro?'':`<label class="imp-up">${icon('upload')} ${i.foto?'Trocar foto':'Foto'}<input type="file" accept="image/jpeg,image/png,image/webp" data-imp-foto="${k}" hidden></label>`}</small></span>`}</td>
   <td><input data-it="${k}" data-c="ref" value="${esc(i.ref||'')}" class="imp-curto" aria-label="Referência do item ${k+1}"></td><td><input data-it="${k}" data-c="ncm" value="${esc(i.ncm||'')}" class="imp-curto" inputmode="numeric" maxlength="10" aria-label="NCM do item ${k+1}"></td>
   <td class="num"><input data-it="${k}" data-c="qtd" type="number" min="0" step="1" value="${esc(i.qtd??'')}" class="ufin" aria-label="Quantidade do item ${k+1}"></td><td class="num"><input data-it="${k}" data-c="unit" type="number" min="0" step="0.0001" value="${esc(i.unit??'')}" class="ufin" aria-label="Valor unitário do item ${k+1}"></td>
   <td class="num">${dinheiro(num(i.qtd)*num(i.unit),p.moeda)}</td><td>${ro?'':`<button class="small quiet" data-imp-rmit="${k}" aria-label="Remover item ${k+1}">${icon('close')}</button>`}</td></tr>`}).join('')||'<tr><td colspan="7" class="empty">Nenhum item. Adicione produtos do catálogo ou itens novos.</td></tr>'}
  </tbody>${p.itens.length?`<tfoot><tr><td colspan="3"><strong>Total</strong></td><td class="num"><strong>${nf(t.qtd)}</strong></td><td></td><td class="num"><strong>${dinheiro(t.mercadoria,p.moeda)}</strong></td><td></td></tr></tfoot>`:''}</table></div>
  ${ro?'':`<div class="imp-add"><div class="searchin">${icon('search')}<input id="impAddBusca" type="search" placeholder="Adicionar do catálogo: SKU, nome ou código de barras" value="${esc(st.addBusca)}" autocomplete="off"></div><button class="small" data-imp-novoitem>${icon('spark')} Item novo (sem cadastro)</button></div>
  <div id="impAddRes" class="imp-addres">${r.map(x=>`<button type="button" class="chg-op" data-imp-addsku="${esc(x.id)}">${thumb({sku:x.id})}<span><strong>${esc(x.nome||x.id)}</strong><small class="mono">${esc(x.id)}${x.gtin?' · '+esc(x.gtin):''}</small></span></button>`).join('')}${st.addBusca.trim()&&!r.length?`<p class="caption">Nenhum produto com “${esc(st.addBusca.trim())}”. Se ele ainda não existe, use <strong>Item novo</strong>.</p>`:''}</div>`}`}
 else if(st.aba==='pagamentos'){corpo=`<div class="grid kpis4 imp-kp"><div class="card kpi"><span class="kpil">Mercadoria</span><span class="kpiv">${dinheiro(t.mercadoria,p.moeda)}</span><span class="kpis">${t.semParcela>0.005?`${dinheiro(t.semParcela,p.moeda)} sem parcela`:'tudo em parcelas'}</span></div><div class="card kpi"><span class="kpil">Pago da mercadoria</span><span class="kpiv green">${dinheiro(t.pagoMerc,p.moeda)}</span><span class="kpis">${t.mercadoria?nf(t.pagoMerc/t.mercadoria*100)+'%':'—'}</span></div><div class="card kpi"><span class="kpil">Saldo da mercadoria</span><span class="kpiv ${t.saldoMerc>0.005?'gold':''}">${dinheiro(t.saldoMerc,p.moeda)}</span><span class="kpis">a pagar ao fornecedor</span></div><div class="card kpi"><span class="kpil">Saldo total em reais</span><span class="kpiv">${money(t.saldoReaisTotal)}</span><span class="kpis">${t.semCambio?`${t.semCambio} parcela(s) sem câmbio`:t.semParcela>0.005?'inclui a mercadoria sem parcela':`de ${money(t.previstoReais)} previsto`}</span></div></div>
  <div class="tablewrap"><table class="imp-tab imp-pgtab"><thead><tr><th>Tipo e descrição</th><th>Vencimento</th><th class="num">Valor</th><th class="num">Câmbio</th><th>Pagamento</th><th class="num">Saldo</th><th></th></tr></thead><tbody>
  ${p.pagamentos.map((g,k)=>{const sit=situacaoPag(g);return `<tr><td><div class="imp-pilha"><select data-pg="${k}" data-c="tipo" aria-label="Tipo do pagamento ${k+1}">${Object.entries(TIPOS_PAG).map(([x,tt])=>`<option value="${x}" ${(g.tipo||'mercadoria')===x?'selected':''}>${esc(tt)}</option>`).join('')}</select><input data-pg="${k}" data-c="descricao" value="${esc(g.descricao||'')}" placeholder="Sinal, saldo, frete…" aria-label="Descrição do pagamento ${k+1}"></div></td>
   <td><input type="date" data-pg="${k}" data-c="vencimento" value="${esc(g.vencimento||'')}" aria-label="Vencimento do pagamento ${k+1}"></td>
   <td class="num"><div class="imp-valor"><select data-pg="${k}" data-c="moeda" aria-label="Moeda do pagamento ${k+1}">${MOEDAS.map(m=>`<option ${(g.moeda||p.moeda)===m?'selected':''}>${m}</option>`).join('')}</select><input type="number" min="0" step="0.01" data-pg="${k}" data-c="valor" value="${esc(g.valor??'')}" class="ufin" aria-label="Valor do pagamento ${k+1}"></div></td>
   <td class="num"><input type="number" min="0" step="0.0001" data-pg="${k}" data-c="cambio" value="${esc(g.cambio??'')}" class="ufin" placeholder="${p.cambio?esc(p.cambio):''}" aria-label="Câmbio do pagamento ${k+1}"></td>
   <td><div class="imp-pilha"><input type="date" data-pg="${k}" data-c="pago_em" value="${esc(g.pago_em||'')}" aria-label="Pago em, pagamento ${k+1}"><input type="number" min="0" step="0.01" data-pg="${k}" data-c="valor_pago" value="${esc(g.valor_pago??'')}" class="ufin" placeholder="${g.pago_em?'valor pago: '+esc(g.valor??''):'valor pago'}" aria-label="Valor pago do pagamento ${k+1}">${pagoDe(g)>0&&sit!=='pago'?`<label class="imp-vsaldo"><span>saldo vence em</span><input type="date" data-pg="${k}" data-c="venc_saldo" value="${esc(g.venc_saldo||'')}" aria-label="Vencimento do saldo do pagamento ${k+1}" ${ro?'disabled':''}></label>`:''}</div></td>
   <td class="num">${dinheiro(num(g.valor)-pagoDe(g),g.moeda||p.moeda)}<br>${badgePag(sit)}</td><td>${ro?'':`<button class="small quiet" data-imp-rmpg="${k}" aria-label="Remover pagamento ${k+1}">${icon('close')}</button>`}</td></tr>`}).join('')||'<tr><td colspan="7" class="empty">Nenhum pagamento previsto.</td></tr>'}
  </tbody></table></div>
  ${ro?'':`<div class="row wrap imp-add"><button class="small" data-imp-novopg>${icon('plus')} Pagamento</button>${t.mercadoria>0&&!p.pagamentos.some(g=>(g.tipo||'mercadoria')==='mercadoria')?`<button class="small" data-imp-sinal>${icon('wallet')} Sinal 30% + saldo no embarque</button>`:''}</div>`}
  <p class="caption">Ao pagar, preencha "Pago em" (e o valor pago, se foi parte da parcela; aí informe quando vence o saldo). Sem câmbio na parcela, vale o câmbio estimado do processo. Este controle não lança nada no Contas a pagar.</p>`}
 else corpo=p.historico.length?`<div class="timeline">${p.historico.slice().reverse().map(h=>`<div class="event"><strong>${esc(NOME_ST[h.para]||h.para)}</strong><p>${new Date(h.em).toLocaleString('pt-BR')} · ${esc(h.por||'')}${h.de?` · antes: ${esc(NOME_ST[h.de]||h.de)}`:''}${h.obs?`<br>${esc(h.obs)}`:''}</p></div>`).join('')}</div>`:'<div class="empty">Nenhuma mudança de situação ainda.</div>';
 return `${abas}${st.erros.length?`<div class="notice imp-erros" role="alert"><strong>Confira antes de salvar:</strong><br>${st.erros.map(esc).join('<br>')}</div>`:''}<div class="imp-corpo">${corpo}</div>
  <div class="modalfoot">${!p._novo&&!ro?`<button class="quiet" data-imp-excluir style="margin-right:auto">${icon('trash')} Excluir</button>`:''}<button data-action="close">${ro?'Fechar':'Cancelar'}</button>${ro?'':`<button data-imp-salvar="continuar">Salvar e continuar</button><button class="primary" data-imp-salvar="fechar">Salvar processo</button>`}</div>`}
const BADGE_PAG={pago:['pago','ok'],parcial:['pago em parte','info'],vencido:['vencido','bad'],a_vencer:['a vencer','warn']};
const badgePag=s=>{const [t,c]=BADGE_PAG[s]||[s,''];return `<span class="badge ${c}">${t}</span>`};
function achar(q){q=String(q||'').trim();if(!q)return [];const L=produtos(),ex=L.filter(p=>String(p.id).toLowerCase()===q.toLowerCase()||String(p.gtin||'')===q);if(ex.length)return ex;const n=normalized(q);return L.filter(p=>normalized(`${p.id} ${p.nome||''} ${p.gtin||''}`).includes(n)).slice(0,8)}
/** Lê os campos da guia aberta para o rascunho. */
function coletar(){const p=st.ed,root=$('#impEd');if(!p||!root)return;
 root.querySelectorAll('[data-f]').forEach(el=>{const f=el.dataset.f,v=el.value;if(f.startsWith('logistica.'))p.logistica[f.slice(10)]=v;else p[f]=['ctns'].includes(f)?Math.max(0,Math.trunc(num(v))):f==='cambio'?(v===''?null:num(v)):v});
 root.querySelectorAll('[data-it]').forEach(el=>{const i=p.itens[+el.dataset.it];if(!i)return;const c=el.dataset.c;i[c]=['qtd','unit'].includes(c)?(el.value===''?'':num(el.value)):el.value});
 root.querySelectorAll('[data-pg]').forEach(el=>{const g=p.pagamentos[+el.dataset.pg];if(!g)return;const c=el.dataset.c;g[c]=['valor','cambio','valor_pago'].includes(c)?(el.value===''?null:num(el.value)):el.value})}
/** Seletor do campo com foco, para voltar a ele depois de redesenhar a guia (Tab entre quantidade e valor). */
const chave=el=>{const d=el?.dataset||{};return d.it!=null?`[data-it="${d.it}"][data-c="${d.c}"]`:d.pg!=null?`[data-pg="${d.pg}"][data-c="${d.c}"]`:d.f?`[data-f="${d.f}"]`:''};
function redesenharEd(){const el=$('#impEd');if(el){const y=el.closest('.modal')?.scrollTop;el.innerHTML=edHtml();const m=el.closest('.modal');if(m&&y!=null)m.scrollTop=y}}
async function salvar(fechar){coletar();const p=st.ed,antes=(st.lista||[]).find(x=>x.id===p.id);
 const limpo=normalizar({...p,itens:p.itens.map(i=>({...i,qtd:num(i.qtd),unit:num(i.unit)})),pagamentos:p.pagamentos.map(g=>({...g,valor:num(g.valor),moeda:g.moeda||p.moeda}))});delete limpo._novo;
 st.erros=validar(limpo,st.lista);if(st.erros.length)return redesenharEd();
 // Situação mudou no formulário: entra no histórico (e grava a data do marco).
 let final=limpo;if(antes&&antes.status!==limpo.status)final=mudarStatus({...limpo,status:antes.status},limpo.status);else if(!antes)final={...limpo,historico:[{em:new Date().toISOString(),por:quem(),de:null,para:limpo.status,obs:'Processo aberto'}]};
 const b=$('[data-imp-salvar="'+(fechar?'fechar':'continuar')+'"]');if(b){b.disabled=true;b.textContent='Salvando…'}
 try{const g=await gravar(final);toast(`Processo ${g.numero} salvo.`);if(fechar){st.ed=null;closeModal();render()}else{st.ed={...structuredClone(g),_novo:false};redesenharEd();render()}}
 catch(e){toast(e.message||String(e));redesenharEd()}}

// ─── Itens novos ───
function itensView(){if(!pronto())return CARREGANDO;
 const L=itensNovos(st.lista),semFoto=L.filter(x=>!x.i.foto).length,pode=podeGravar(),r=st.vinc&&st.vincBusca.trim()?achar(st.vincBusca):[];
 return `<p class="caption imp-sub">Itens que vêm na importação e ainda não existem no Bling. Mande a foto aqui; quando o produto for cadastrado no Bling e sincronizar, vincule o SKU: a chegada no galpão e o estoque passam a usar o cadastro.</p>
 <div class="grid kpis4"><div class="card kpi"><span class="kpil">Itens sem cadastro</span><span class="kpiv ${L.length?'gold':''}">${L.length}</span><span class="kpis">em ${new Set(L.map(x=>x.p.id)).size} processo(s)</span></div><div class="card kpi"><span class="kpil">Sem foto</span><span class="kpiv ${semFoto?'red':''}">${semFoto}</span><span class="kpis">envie pela linha</span></div><div class="card kpi"><span class="kpil">Unidades</span><span class="kpiv">${nf(L.reduce((s,x)=>s+num(x.i.qtd),0))}</span><span class="kpis">a cadastrar</span></div><div class="card kpi"><span class="kpil">Próxima chegada</span>${(()=>{const ds=L.filter(x=>!x.p.logistica.eta&&!x.p.logistica.entrega).map(x=>x.p.logistica.eta_prev||x.p.logistica.entrega_prev).filter(Boolean).sort(),h=hoje(),fut=ds.find(d=>d>=h),pass=ds.filter(d=>d<h).pop(); // a próxima futura; só previsão vencida = atrasada
  return fut?`<span class="kpiv">${dBR(fut)}</span><span class="kpis">previsão no porto${pass?` · outra atrasada (${dBR(pass)})`:''}</span>`:pass?`<span class="kpiv red">atrasada</span><span class="kpis">previsão era ${dBR(pass)}: atualize no processo</span>`:'<span class="kpiv">—</span><span class="kpis">previsão no porto</span>'})()}</div></div>
 <div class="tablebox"><div class="tablewrap"><table><thead><tr><th>Item</th><th>Ref. fornecedor</th><th>NCM</th><th class="num">Qtd.</th><th class="num">Valor unit.</th><th>Processo</th><th></th></tr></thead><tbody>
 ${L.map(({p,i})=>`<tr><td class="imp-itcel">${thumb(i)}<span><strong>${esc(i.nome||'Item sem nome')}</strong>${pode?`<small><label class="imp-up">${icon('upload')} ${i.foto?'Trocar foto':'Enviar foto'}<input type="file" accept="image/jpeg,image/png,image/webp" data-imp-fotol="${esc(p.id)}|${esc(i.id)}" hidden></label></small>`:''}</span></td><td>${esc(i.ref||'—')}</td><td class="mono">${esc(i.ncm||'—')}</td><td class="num">${nf(i.qtd)}</td><td class="num">${dinheiro(i.unit,p.moeda)}</td>
  <td><button class="small quiet" data-imp-abrir="${esc(p.id)}" data-imp-aba="itens"><span class="mono">${esc(p.numero)}</span></button><br><span class="caption">${esc(NOME_ST[p.status])}</span></td>
  <td>${pode?(st.vinc===`${p.id}|${i.id}`?`<div class="imp-vinc"><input id="impVinc" type="search" placeholder="SKU, nome ou EAN" value="${esc(st.vincBusca)}" autocomplete="off">${r.map(x=>`<button type="button" class="chg-op" data-imp-vincsku="${esc(x.id)}">${thumb({sku:x.id})}<span><strong>${esc(x.nome||x.id)}</strong><small class="mono">${esc(x.id)}</small></span></button>`).join('')}${st.vincBusca.trim()&&!r.length?'<small class="caption">Nenhum produto. Ainda não sincronizou do Bling?</small>':''}<button class="small quiet" data-imp-vinc="">Cancelar</button></div>`:`<button class="small" data-imp-vinc="${esc(p.id)}|${esc(i.id)}">${icon('link')} Vincular ao cadastro</button>`):''}</td></tr>`).join('')||'<tr><td colspan="7" class="empty">Nenhum item novo sem cadastro. Itens novos entram pela guia Itens do processo.</td></tr>'}
 </tbody></table></div></div>`}

// ─── Pagamentos ───
function pagView(){if(!pronto())return CARREGANDO;
 const d=hoje(),em30=new Date(Date.now()+30*864e5).toLocaleDateString('sv-SE'),mes=d.slice(0,7),T=todasParcelas(st.lista,d),abertas=T.filter(x=>x.sit!=='pago');
 const soma=(l,f)=>r2(l.reduce((s,x)=>s+(f(x)||0),0)),semCambio=abertas.filter(x=>x.saldoReais==null).length;
 const l=(st.pagFiltro==='abertos'?abertas:st.pagFiltro==='pagos'?T.filter(x=>x.pago>0):T).slice().sort((a,b)=>String(vencAberto(a.g)||a.g.vencimento||'').localeCompare(String(vencAberto(b.g)||b.g.vencimento||'')));
 const proc=(st.lista||[]).filter(p=>p.status!=='cancelado').map(p=>({p,t:totais(p)})).filter(x=>x.t.mercadoria||x.p.pagamentos.length);
 const brlPago=x=>{const c=x.g.cambio_pago||x.g.cambio||(x.moeda===x.p.moeda?x.p.cambio:null);return emReais(x.pago,x.moeda,c)};
 return `<div class="grid kpis4"><div class="card kpi"><span class="kpil">Saldo a pagar</span><span class="kpiv">${money(soma(abertas,x=>x.saldoReais))}</span><span class="kpis">${abertas.length} parcela(s)${semCambio?` · ${semCambio} sem câmbio`:''}</span></div>
  <div class="card kpi"><span class="kpil">Vencidas</span><span class="kpiv ${abertas.some(x=>x.sit==='vencido')?'red':''}">${money(soma(abertas.filter(x=>x.sit==='vencido'),x=>x.saldoReais))}</span><span class="kpis">${abertas.filter(x=>x.sit==='vencido').length} parcela(s)</span></div>
  <div class="card kpi"><span class="kpil">Vencem em 30 dias</span><span class="kpiv gold">${money(soma(abertas.filter(x=>x.sit!=='vencido'&&vencAberto(x.g)&&vencAberto(x.g)<=em30),x=>x.saldoReais))}</span><span class="kpis">até ${dBR(em30)}</span></div>
  <div class="card kpi"><span class="kpil">Pago no mês</span><span class="kpiv green">${money(soma(T.filter(x=>String(x.g.pago_em||'').startsWith(mes)),brlPago))}</span><span class="kpis">valores em reais pelo câmbio</span></div></div>
 <div class="segtabs" role="tablist">${[['abertos','Em aberto'],['pagos','Pagos'],['todos','Todos']].map(([k,t])=>`<button role="tab" aria-selected="${st.pagFiltro===k}" class="${st.pagFiltro===k?'active':''}" data-imp-pagf="${k}">${t}</button>`).join('')}</div>
 <div class="tablebox"><div class="tablewrap"><table><thead><tr><th>Vencimento</th><th>Processo</th><th>Tipo</th><th class="num">Valor</th><th class="num">Pago</th><th class="num">Saldo</th><th class="num">Saldo em R$</th><th>Situação</th><th></th></tr></thead><tbody>
 ${l.map(x=>`<tr><td>${x.sit==='parcial'||(x.pago>0&&x.sit==='vencido')?`${x.g.venc_saldo?dBR(x.g.venc_saldo):'—'}<br><span class="caption">saldo · parcela de ${dBR(x.g.vencimento)}</span>`:dBR(x.g.vencimento)}</td><td><button class="small quiet" data-imp-abrir="${esc(x.p.id)}" data-imp-aba="pagamentos"><span class="mono">${esc(x.p.numero)}</span></button><br><span class="caption">${esc(x.p.fornecedor)}</span></td><td>${esc(TIPOS_PAG[x.g.tipo||'mercadoria']||x.g.tipo)}${x.g.descricao?`<br><span class="caption">${esc(x.g.descricao)}</span>`:''}</td>
  <td class="num">${dinheiro(x.g.valor,x.moeda)}</td><td class="num">${x.pago?dinheiro(x.pago,x.moeda):'—'}${x.g.pago_em?`<br><span class="caption">${dBR(x.g.pago_em)}</span>`:''}</td><td class="num">${dinheiro(x.saldo,x.moeda)}</td><td class="num">${x.saldoReais==null?'<span class="caption">sem câmbio</span>':money(x.saldoReais)}</td><td>${badgePag(x.sit)}</td>
  <td>${podeGravar()&&x.sit!=='pago'?`<button class="small" data-imp-pagar="${esc(x.p.id)}|${esc(x.g.id)}">${icon('check')} Registrar pagamento</button>`:''}</td></tr>`).join('')||`<tr><td colspan="9" class="empty">${st.pagFiltro==='abertos'?'Nada a pagar.':'Nenhum pagamento.'}</td></tr>`}
 </tbody></table></div></div>
 ${proc.length?`<div class="tablebox" style="margin-top:16px"><div class="tabletop"><h2>Por processo</h2><span class="caption">mercadoria na moeda da compra</span></div><div class="tablewrap"><table><thead><tr><th>Processo</th><th>Situação</th><th class="num">Mercadoria</th><th class="num">Pago</th><th class="num">Saldo</th><th class="num">Sem parcela</th><th class="num">Saldo total em R$</th></tr></thead><tbody>
 ${proc.map(({p,t})=>`<tr class="clickrow" data-imp-abrir="${esc(p.id)}" data-imp-aba="pagamentos"><td><strong class="mono">${esc(p.numero)}</strong><br><span class="caption">${esc(p.fornecedor)}</span></td><td>${esc(NOME_ST[p.status])}</td><td class="num">${dinheiro(t.mercadoria,p.moeda)}</td><td class="num">${dinheiro(t.pagoMerc,p.moeda)}</td><td class="num">${dinheiro(t.saldoMerc,p.moeda)}</td><td class="num ${t.semParcela>0.005?'gold':''}">${t.semParcela>0.005?dinheiro(t.semParcela,p.moeda):'—'}</td><td class="num">${money(t.saldoReaisTotal)}</td></tr>`).join('')}</tbody></table></div></div>`:''}`}
function registrarPagamento(pid,gid){const p=(st.lista||[]).find(x=>x.id===pid),g=p?.pagamentos.find(x=>x.id===gid);if(!g)return;const m=g.moeda||p.moeda,saldo=r2(num(g.valor)-pagoDe(g));
 modal('Registrar pagamento',`<p><strong>${esc(p.numero)}</strong> · ${esc(p.fornecedor)} · ${esc(TIPOS_PAG[g.tipo||'mercadoria'])}${g.descricao?' · '+esc(g.descricao):''}</p>
 <div class="grid three"><div class="field"><label for="impPgData">Pago em</label><input id="impPgData" type="date" value="${hoje()}"></div><div class="field"><label for="impPgValor">Valor pago agora (${esc(m)})</label><input id="impPgValor" type="number" min="0" step="0.01" value="${saldo}"></div>${m==='BRL'?'':`<div class="field"><label for="impPgCambio">Câmbio do pagamento</label><input id="impPgCambio" type="number" min="0" step="0.0001" value="${esc(g.cambio||p.cambio||'')}"></div>`}</div>
 <div class="field"><label for="impPgVencSaldo">Se pagar só uma parte: quando vence o restante?</label><input id="impPgVencSaldo" type="date" value="${esc(g.venc_saldo||normalizar(p).logistica.etd_prev||'')}"><small class="caption">Sem data, o restante fica como "pago em parte", sem aparecer como vencido.</small></div>
 <p class="caption">Saldo da parcela: ${dinheiro(saldo,m)}. Só registra aqui no controle da importação; não lança no Contas a pagar nem no banco.</p>
 <div class="modalfoot"><button data-action="close">Cancelar</button><button class="primary" data-imp-pagok="${esc(pid)}|${esc(gid)}">${icon('check')} Confirmar pagamento</button></div>`)}
async function confirmarPagamento(pid,gid){const p=structuredClone((st.lista||[]).find(x=>x.id===pid)),g=p?.pagamentos.find(x=>x.id===gid);if(!g)return;
 const v=num($('#impPgValor')?.value),dt=$('#impPgData')?.value,c=$('#impPgCambio')?.value;const saldo=r2(num(g.valor)-pagoDe(g));
 if(!dt)return toast('Informe a data do pagamento.');if(v<=0)return toast('Informe o valor pago.');if(v>saldo+0.005)return toast(`O valor passa do saldo da parcela (${dinheiro(saldo,g.moeda||p.moeda)}).`);
 g.valor_pago=r2(pagoDe(g)+v);g.pago_em=dt;if(c)g.cambio_pago=num(c);if(r2(num(g.valor)-g.valor_pago)>0.005)g.venc_saldo=$('#impPgVencSaldo')?.value||null;
 try{await gravar(p,'Pagamento de importação registrado');toast('Pagamento registrado.');closeModal();render()}catch(e){toast(e.message||String(e))}}

// ─── Eventos ───
document.addEventListener('click',async e=>{const b=e.target.closest('[data-imp-navio],[data-imp-mapa],[data-imp-vermapa],[data-imp-filtro],[data-imp-novo],[data-imp-abrir],[data-imp-aba-ed],[data-imp-salvar],[data-imp-excluir],[data-imp-rmit],[data-imp-rmpg],[data-imp-novoitem],[data-imp-addsku],[data-imp-novopg],[data-imp-sinal],[data-imp-pagf],[data-imp-pagar],[data-imp-pagok],[data-imp-vinc],[data-imp-vincsku]');if(!b)return;const d=b.dataset;
 if(d.impFiltro!=null){st.filtro=d.impFiltro===st.filtro&&d.impFiltro!=='ativos'?'ativos':d.impFiltro;return render()}
 if(d.impNovo!=null)return abrir(null);
 if(d.impNavio!=null){e.stopPropagation();return abrirNavio(d.impNavio)}
 if(d.impVermapa!=null){coletar();st.verMapa=!st.verMapa;return redesenharEd()}
 if(d.impMapa!=null){const f=$('#impMapaNavio');if(f)f.src=d.impMapa;b.parentElement.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));return}
 if(d.impAbrir!=null){e.stopPropagation();return abrir(d.impAbrir,d.impAba||'geral')}
 if(d.impPagf!=null){st.pagFiltro=d.impPagf;return render()}
 if(d.impPagar!=null){const [p,g]=d.impPagar.split('|');return registrarPagamento(p,g)}
 if(d.impPagok!=null){const [p,g]=d.impPagok.split('|');return confirmarPagamento(p,g)}
 if(d.impVinc!=null){st.vinc=d.impVinc||null;st.vincBusca='';render();if(st.vinc)setTimeout(()=>$('#impVinc')?.focus(),0);return}
 if(d.impVincsku!=null){const [pid,iid]=String(st.vinc||'').split('|'),p=structuredClone((st.lista||[]).find(x=>x.id===pid)),it=p?.itens.find(x=>x.id===iid),pr=prodDe(d.impVincsku);if(!it||!pr)return;
  const antes=it.nome;Object.assign(it,{sku:pr.id,novo:false,nome:pr.nome||it.nome,nome_importacao:antes||null});st.vinc=null;st.vincBusca='';
  try{await gravar(p,'Item de importação vinculado ao cadastro');toast(`${antes||'Item'} vinculado a ${pr.id}.`)}catch(x){toast(x.message||String(x))}return render()}
 if(!st.ed||!b.closest('#impEd'))return;
 if(d.impAbaEd){coletar();st.aba=d.impAbaEd;return redesenharEd()}
 if(d.impSalvar)return salvar(d.impSalvar==='fechar');
 if(d.impExcluir!=null){const p=st.ed;if(!b.dataset.conf){b.dataset.conf='1';b.classList.add('danger');b.innerHTML=`${icon('trash')} Confirmar exclusão de ${esc(p.numero)}`;return}
  try{if(nuvem()){const {error}=await Cloud.client.from('importacoes').delete().eq('workspace_id',Cloud.ws).eq('id',p.id);if(error)throw error}st.lista=(st.lista||[]).filter(x=>x.id!==p.id);if(!nuvem())gravarLocal(st.lista);audit('Importação excluída',`${p.numero} · ${p.fornecedor}`);st.ed=null;closeModal();render();toast('Processo excluído.')}catch(x){toast(x.message||String(x))}return}
 coletar();
 if(d.impRmit!=null)st.ed.itens.splice(+d.impRmit,1);
 else if(d.impRmpg!=null)st.ed.pagamentos.splice(+d.impRmpg,1);
 else if(d.impNovoitem!=null)st.ed.itens.push({id:novoId('it-'),sku:null,novo:true,nome:st.addBusca.trim(),ref:'',ncm:'',qtd:'',unit:''});
 else if(d.impAddsku!=null){const pr=prodDe(d.impAddsku);if(pr){const ja=st.ed.itens.find(i=>i.sku===pr.id);if(ja)toast(`${pr.id} já está no processo: ajuste a quantidade.`);else st.ed.itens.push({id:novoId('it-'),sku:pr.id,novo:false,nome:pr.nome||'',ref:'',ncm:pr.ncm||'',qtd:'',unit:''})}st.addBusca=''}
 else if(d.impNovopg!=null)st.ed.pagamentos.push({id:novoId('pg-'),tipo:st.ed.pagamentos.some(g=>(g.tipo||'mercadoria')==='mercadoria')?'frete':'mercadoria',descricao:'',vencimento:'',moeda:st.ed.moeda,valor:null});
 else if(d.impSinal!=null)st.ed.pagamentos.push(...parcelasSinalSaldo(st.ed));
 redesenharEd()});
document.addEventListener('input',e=>{const t=e.target;
 if(t.id==='impBusca'&&page==='importacoes'){st.busca=t.value;clearTimeout(st._t);st._t=setTimeout(()=>{render();const i=$('#impBusca');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},250);return}
 if(t.id==='impVinc'){st.vincBusca=t.value;clearTimeout(st._t);st._t=setTimeout(()=>{render();const i=$('#impVinc');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},200);return}
 if(t.id==='impAddBusca'&&st.ed){st.addBusca=t.value;const r=achar(t.value),box=$('#impAddRes');if(box)box.innerHTML=r.map(x=>`<button type="button" class="chg-op" data-imp-addsku="${esc(x.id)}">${thumb({sku:x.id})}<span><strong>${esc(x.nome||x.id)}</strong><small class="mono">${esc(x.id)}${x.gtin?' · '+esc(x.gtin):''}</small></span></button>`).join('')+(t.value.trim()&&!r.length?`<p class="caption">Nenhum produto com “${esc(t.value.trim())}”. Se ele ainda não existe, use <strong>Item novo</strong>.</p>`:'')}});
document.addEventListener('change',async e=>{const t=e.target;
 if(t.matches('[data-imp-status]')){const p=(st.lista||[]).find(x=>x.id===t.dataset.impStatus);if(!p)return;t.disabled=true;
  try{const g=await gravar(mudarStatus(p,t.value),'Situação da importação alterada');toast(`${g.numero}: ${NOME_ST[g.status]}.`)}catch(x){toast(x.message||String(x))}return render()}
 if(st.ed&&t.closest('#impEd')){
  if(t.matches('[data-imp-foto]')){coletar();const it=st.ed.itens[+t.dataset.impFoto];try{await enviarFoto(st.ed,it,t.files?.[0])}catch(x){toast('Foto não enviada: '+(x.message||x))}return redesenharEd()}
  // Totais e moeda: recalcula ao sair do campo.
  if(t.matches('[data-it][data-c="qtd"],[data-it][data-c="unit"],[data-pg],[data-f="moeda"],[data-f="cambio"],[data-f="logistica.navio"],[data-f="logistica.imo"],[data-f="logistica.mmsi"]'))setTimeout(()=>{const k=chave(document.activeElement);coletar();redesenharEd();if(k)$('#impEd '+k)?.focus()},0);return}
 if(t.matches('[data-imp-fotol]')){const [pid,iid]=t.dataset.impFotol.split('|'),p=structuredClone((st.lista||[]).find(x=>x.id===pid)),it=p?.itens.find(x=>x.id===iid);if(!it)return;
  try{await enviarFoto(p,it,t.files?.[0]);if(it.foto){await gravar(p,'Foto de item de importação enviada');toast('Foto enviada.')}}catch(x){toast('Foto não enviada: '+(x.message||x))}render()}});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('.imp-navio[data-imp-navio]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));return}
 if(e.key==='Enter'&&e.target.id==='impAddBusca'&&st.ed){e.preventDefault();const r=achar(e.target.value);if(r.length===1)$(`[data-imp-addsku="${CSS.escape(r[0].id)}"]`)?.click()}});

addPage('importacoes','ship','Painel de importações',painelView,'Cada importação da abertura no fornecedor até a chegada na empresa: resumo por situação e o mapa dos processos.','',()=>{});
addPage('impitens','spark','Itens sem cadastro',itensView,'Itens que vêm na importação e ainda não têm cadastro nem foto no Bling.','',()=>{});
addPage('imppag','wallet','Pagamentos',pagView,'Parcelas de todas as importações: o que já foi pago e o saldo a pagar.','',()=>{});
window.Importacoes={vencAberto,imoValido,mmsiValido,linksNavio,coordPorto,distKm,fracaoPorPosicao,progressoMar,chegadaPrevista,ETAPAS,NOME_ST,num,normalizar,emReais,pagoDe,situacaoPag,totais,resumoStatus,cargaTxt,proximoNumero,mudarStatus,prazos,validar,parcelasSinalSaldo,itensNovos,todasParcelas,recarregar:()=>carregar(true)};
})();
