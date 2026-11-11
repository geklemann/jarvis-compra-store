// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Chegada no galpão: o caminhão chega ao galpão do e-commerce e a equipe dá entrada produto a produto — busca pelo SKU,
// pelo nome ou bipando o código de barras (Enter), informa a quantidade e clica em "Dar entrada". Cada entrada é um
// movimento do kardex (operação E, motivo "chegada", documento = código da chegada do dia, CHEG-AAAAMMDD) enviado ao
// Bling na hora; o saldo mostrado é o que o Bling devolve. A lista da carga do dia vai se acumulando, com desfazer da
// última linha (estorno pelo kardex). O id do movimento leva um código gerado ao escolher o produto: o mesmo clique
// (ou um clique duplo) nunca lança duas vezes. Sem nuvem (modo local), a lista fica só neste navegador.
(()=>{
const hoje=()=>new Date().toLocaleDateString('sv-SE');
const nf=(v,d=0)=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:d});
const hora=t=>t?new Date(t).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'';
/** Código da chegada do dia: CHEG-AAAAMMDD. */
const codigoDoDia=(d=hoje())=>'CHEG-'+String(d).slice(0,10).replace(/-/g,'');
/** id determinístico do movimento: chegada + produto + código do clique (gerado ao escolher o produto). */
const idEntrada=(codigo,sku,nonce)=>`cheg:${codigo}:${String(sku).trim()}:${nonce}`;
const novoNonce=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const podeLancar=()=>['owner','member','estoque'].includes(window.Cloud?.role||'owner');
const nuvem=()=>!!(window.Cloud?.client&&window.Cloud?.ws);
async function fn(action,body){const r=await Cloud.client.functions.invoke('integrations',{body:{workspace_id:Cloud.ws,action,...body}});if(r.error){let msg=r.error.message;try{msg=(await r.error.context.json()).error||msg}catch{}throw Error(msg)}return r.data}

const st={busca:'',sel:'',qtd:'',nonce:'',linhas:null,codigo:'',carregando:false,enviando:false,confGrande:false,confDesfazer:false,depositos:null,deposito:'',erro:''};
window.Reiniciar?.registrar(st,['busca','sel','qtd','confGrande','confDesfazer']); // estado de tela: volta ao original ao clicar no menu
const produtos=()=>(window.Estoque?.lista?.()||[]).filter(p=>p.formato!=='V'); // produto com variações: a entrada é na variação
const prod=sku=>produtos().find(p=>p.id===sku);

/** Busca do produto: SKU ou código de barras exatos primeiro (leitor de código de barras); senão, parte do SKU ou do nome. */
function achar(q,lista=produtos()){q=String(q??'').trim();if(!q)return [];
 const exato=lista.filter(p=>p.id===q||String(p.gtin||'')===q||String(p.id).toLowerCase()===q.toLowerCase());if(exato.length)return exato;
 const n=normalized(q);return lista.filter(p=>normalized(`${p.id} ${p.nome||''} ${p.gtin||''}`).includes(n)).slice(0,8)}
/** Entradas da chegada com a marca de desfeita (estorno est:<id>) e os totais (itens e unidades que valem). */
function resumo(linhas){const L=linhas||[],est=new Set(L.filter(m=>m.motivo==='estorno').map(m=>String(m.id).replace(/^est:/,'')));
 const entradas=L.filter(m=>m.motivo==='chegada').map(m=>({...m,desfeita:est.has(m.id)}));
 const valem=entradas.filter(m=>!m.desfeita);
 return {entradas,itens:valem.length,produtos:new Set(valem.map(m=>m.sku)).size,unidades:valem.reduce((s,m)=>s+Number(m.quantidade||0),0),ultima:valem.slice().sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))[0]||null}}

// ─── Dados: nuvem (kardex) ou este navegador ───
const LOCAL='eb_chegada_local';
const lerLocal=()=>{try{return JSON.parse(localStorage.getItem(LOCAL)||'{}')}catch{return {}}};
const gravarLocal=l=>{try{localStorage.setItem(LOCAL,JSON.stringify({[st.codigo]:l}))}catch{}};
async function carregar(){if(st.carregando)return;
 if(!nuvem()){st.linhas=lerLocal()[st.codigo]||[];return}
 st.carregando=true;
 try{const {data,error}=await Cloud.client.from('estoque_movimentos').select('id,sku,operacao,quantidade,motivo,referencia,deposito,bling_status,bling_erro,saldo_apos,criado_por,created_at').eq('workspace_id',Cloud.ws).eq('referencia',st.codigo).in('motivo',['chegada','estorno']).order('created_at',{ascending:true}).limit(2000);
  if(error)throw error;st.linhas=data||[];st.erro=''}
 catch(e){st.linhas=st.linhas||[];st.erro=e.message||String(e)}
 finally{st.carregando=false}
 if(page==='chegada')render()}
function carregarDepositos(){if(st.depositos||!nuvem())return;st.depositos=[];
 fn('estoque_depositos',{}).then(ds=>{st.depositos=ds||[];const salvo=(()=>{try{return localStorage.getItem('eb_cheg_dep_'+st.codigo)||''}catch{return ''}})();
  st.deposito=salvo&&ds.some(d=>String(d.id)===salvo)?salvo:String((ds.find(d=>d.padrao)||ds[0]||{}).id||'');if(page==='chegada'&&ds.length>1)render()}).catch(()=>{})}

// ─── Tela ───
const ST={pendente:['pendente','warn'],enviado:['enviado ao Bling','ok'],erro:['erro','bad'],nao_enviar:['só neste navegador','']};
function resultados(){if(st.sel||!st.busca.trim())return '';const r=achar(st.busca);
 if(!r.length)return `<p class="caption chg-nada">Nenhum produto com “${esc(st.busca.trim())}”.</p>`;
 return `<div class="chg-res" role="listbox" aria-label="Produtos encontrados">${r.map(p=>`<button type="button" class="chg-op" data-chg-sel="${esc(p.id)}" role="option">${window.Estoque?.foto?.(p.id)||''}<span><strong>${esc(p.nome||p.id)}</strong><small class="mono">${esc(p.id)}${p.gtin?' · '+esc(p.gtin):''}</small></span><em>saldo ${nf(p.saldo,3)}</em></button>`).join('')}</div>`}
function view(){const cod=codigoDoDia();if(st.codigo!==cod){st.codigo=cod;st.linhas=null;st.depositos=null}
 if(window.Estoque&&!window.Estoque.carregado()){if(!window.Estoque.carregando())window.Estoque.carregar().then(()=>{if(page==='chegada')render()});return '<div class="empty">Carregando produtos…</div>'}
 if(!produtos().length)return window.Estoque?.vazioHtml?.()||'<div class="empty">Nenhum produto.</div>';
 if(!st.linhas){carregar();if(!st.linhas)return '<div class="empty">Carregando a chegada de hoje…</div>'}
 carregarDepositos();
 const R=resumo(st.linhas),p=st.sel?prod(st.sel):null,pode=podeLancar(),deps=st.depositos||[],depFixo=R.entradas.find(m=>m.deposito)?.deposito;
 const depNome=id=>esc(deps.find(d=>String(d.id)===String(id))?.descricao||'Depósito '+id);
 return `<div class="chg">
 <p class="caption chg-aviso">${icon('alert')} Mercadoria que chegou com nota fiscal lançada no Bling com movimentação de estoque já entra por lá: dar entrada aqui também duplicaria o estoque.</p>
 ${!nuvem()?'<div class="notice"><strong>Modo local.</strong> Sem login na nuvem, a chegada fica só neste navegador e nada vai para o Bling.</div>':''}
 ${st.erro?`<div class="notice">Não consegui ler a chegada de hoje: ${esc(st.erro)}</div>`:''}
 <div class="chg-grid">
 <section class="card chg-form">
  <div class="chg-top"><div><small>Chegada de hoje</small><strong class="mono">${esc(st.codigo)}</strong></div>
   ${deps.length>1?(depFixo?`<span class="caption chg-depfixo">Depósito: <b>${depNome(depFixo)}</b></span>`:`<label class="chg-dep">Depósito<select data-chg-dep aria-label="Depósito da chegada">${deps.map(d=>`<option value="${d.id}" ${String(d.id)===String(st.deposito)?'selected':''}>${esc(d.descricao)}${d.padrao?' (padrão)':''}</option>`).join('')}</select></label>`):''}</div>
  ${pode?`${p?`<div class="lcprod chg-prod">${p.imagem?`<img src="${esc(p.imagem)}" alt="" onerror="this.remove()">`:'<span class="chg-semfoto">'+icon('box')+'</span>'}<div><strong>${esc(p.nome||p.id)}</strong><br><span class="caption mono">${esc(p.id)}${p.gtin?' · '+esc(p.gtin):''}</span>${nuvem()&&!p.bling_id?'<br><span class="caption red">Sem vínculo com o Bling: a entrada não teria para onde ir.</span>':''}</div><div class="lcsaldo"><small>Saldo atual</small><strong>${nf(p.saldo,3)}</strong></div></div>
   <button type="button" class="small quiet" data-chg-trocar>${icon('search')} Trocar produto</button>`
   :`<label for="chgBusca">Produto: SKU, nome ou código de barras</label><div class="searchin chg-busca">${icon('search')}<input id="chgBusca" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" placeholder="Bipe ou digite e tecle Enter" value="${esc(st.busca)}"></div><div id="chgRes">${resultados()}</div>`}
  <label for="chgQtd">Quantidade que chegou</label>
  <input id="chgQtd" class="chg-qtd" type="number" inputmode="numeric" min="1" step="1" enterkeyhint="done" placeholder="0" value="${esc(st.qtd)}" ${p?'':'disabled'}>
  <button type="button" class="primary chg-ok ${st.confGrande?'danger':''}" data-chg-ok ${p&&!st.enviando?'':'disabled'}>${st.enviando?'Enviando ao Bling…':st.confGrande?`${icon('check')} Confirmar entrada de ${nf(st.qtd)} unidades`:`${icon('check')} Dar entrada`}</button>`
  :'<div class="notice">Seu papel só consulta a chegada. Quem dá entrada: administrador, equipe completa e estoque.</div>'}
 </section>
 <section class="tablebox chg-lista">
  <div class="tabletop"><div><h2>Carga de hoje</h2><span class="caption">${R.itens} entrada(s) · ${R.produtos} produto(s) · <strong>${nf(R.unidades,3)}</strong> unidade(s)</span></div>
   <div class="row wrap">${R.entradas.some(m=>['pendente','erro'].includes(m.bling_status)&&!m.desfeita)&&nuvem()&&pode?`<button class="small" data-chg-reenviar>${icon('refresh')} Enviar pendentes</button>`:''}${R.ultima&&pode?`<button class="small ${st.confDesfazer?'danger':'quiet'}" data-chg-desfazer>${st.confDesfazer?'Confirmar: desfazer a última':'Desfazer a última'}</button>`:''}</div></div>
  ${R.entradas.length?`<ol class="chg-linhas">${R.entradas.slice().reverse().map(m=>{const x=prod(m.sku),[tx,tom]=m.desfeita?['desfeita','']:ST[m.bling_status]||[m.bling_status,''];
   return `<li class="${m.desfeita?'chg-desfeita':''}">${window.Estoque?.foto?.(m.sku)||''}<div class="chg-lnome"><strong>${esc(x?.nome||m.sku)}</strong><small class="mono">${esc(m.sku)} · ${hora(m.created_at)}${m.criado_por?' · '+esc(String(m.criado_por).split('@')[0]):''}</small></div>
    <span class="chg-lq">+${nf(m.quantidade,3)}</span><span class="chg-lst"><span class="badge ${tom}" ${m.bling_erro?`title="${esc(m.bling_erro)}"`:''}>${esc(tx)}</span>${m.saldo_apos!=null&&!m.desfeita?`<small>saldo depois: ${nf(m.saldo_apos,3)}</small>`:''}${m.bling_status==='erro'&&!m.desfeita?`<small class="red">${esc(String(m.bling_erro||'').slice(0,90))}</small>`:''}</span></li>`}).join('')}</ol>`
   :'<div class="empty">Nada lançado nesta chegada ainda. Bipe o primeiro produto.</div>'}
 </section></div>
 <p class="caption">Cada entrada fica em Movimentos de estoque (motivo “Chegada no galpão”, documento ${esc(st.codigo)}) e vai para o Bling na hora; se o Bling não responder, o Jarvis reenvia sozinho. Os marketplaces recebem o saldo novo pela integração do próprio Bling.</p></div>`}
function bind(){if(page!=='chegada')return;const alvo=st.sel?$('#chgQtd'):$('#chgBusca');if(alvo&&!document.querySelector('.modalback')&&!st.enviando)setTimeout(()=>alvo.focus(),30)}

// ─── Ações ───
function escolher(sku){st.sel=sku;st.busca='';st.qtd='';st.nonce=novoNonce();st.confGrande=false;render()}
function procurar(){const r=achar(st.busca);if(r.length===1)return escolher(r[0].id);
 if(!r.length)toast(`Nenhum produto com “${st.busca.trim()}”.`);else toast('Mais de um produto encontrado: toque no certo.')}
async function darEntrada(){if(st.enviando||!podeLancar())return;const p=prod(st.sel),q=Number(String(st.qtd).replace(',','.'));
 if(!p)return toast('Escolha o produto.');if(!(q>0))return toast('Informe a quantidade.');
 if(nuvem()&&!p.bling_id)return toast('Produto sem vínculo com o Bling: vincule o produto antes de dar entrada.');
 // Quantidade fora do comum (ex.: código de barras bipado no campo da quantidade): pede um segundo clique.
 if(q>=1000&&!st.confGrande){st.confGrande=true;render();return}
 if(!st.nonce)st.nonce=novoNonce();
 const id=idEntrada(st.codigo,p.id,st.nonce),dep=(st.depositos||[]).length>1?(resumo(st.linhas).entradas.find(m=>m.deposito)?.deposito||st.deposito):'';
 st.enviando=true;st.confGrande=false;render();
 try{if(nuvem()){const r=await window.Kardex.registrar([{id,sku:p.id,operacao:'E',quantidade:q,motivo:'chegada',origem:'manual',referencia:st.codigo,documento:st.codigo,deposito:dep||null}],{recarregar:false});
   const d=(r.detalhes||[]).find(x=>x.id===id);if(d?.ok&&d.saldo!=null)p.saldo=d.saldo;
   audit('Chegada no galpão',`${p.id} · +${q} · ${st.codigo}${d?.ok?' · enviado ao Bling':' · a enviar ao Bling'}`);
   toast(d?.ok?`Entrada de ${nf(q,3)} un. no Bling.${d.saldo!=null?` Saldo agora: ${nf(d.saldo,3)}.`:''}`:r.falha?`Entrada registrada; o envio ao Bling falhou (${r.falha}) — o Jarvis tenta de novo sozinho.`:d?.erro?`Entrada registrada, mas o Bling recusou: ${d.erro}`:'Entrada registrada.');
   st.sel='';st.qtd='';st.nonce='';await carregar()}
  else{const L=st.linhas||[];if(!L.some(m=>m.id===id)){p.saldo=Number(p.saldo||0)+q;L.push({id,sku:p.id,operacao:'E',quantidade:q,motivo:'chegada',referencia:st.codigo,bling_status:'nao_enviar',saldo_apos:p.saldo,created_at:new Date().toISOString()});st.linhas=L;gravarLocal(L)}
   audit('Chegada no galpão',`${p.id} · +${q} · ${st.codigo} · só neste navegador`);toast(`Entrada de ${nf(q,3)} un. registrada neste navegador.`);st.sel='';st.qtd='';st.nonce=''}}
 catch(e){toast(e.message||String(e))}
 finally{st.enviando=false;window.Estoque?.recalc?.();if(page==='chegada')render()}}
async function desfazer(){const u=resumo(st.linhas).ultima;if(!u||st.enviando)return;if(!st.confDesfazer){st.confDesfazer=true;render();return}
 st.confDesfazer=false;st.enviando=true;render();const p=prod(u.sku);
 try{if(nuvem()){const id=`est:${u.id}`,r=await window.Kardex.registrar([{id,sku:u.sku,operacao:'S',quantidade:u.quantidade,motivo:'estorno',origem:'manual',referencia:st.codigo,documento:`Estorno de: Chegada no galpão · ${st.codigo}`,deposito:u.deposito||null}],{recarregar:false});
   const d=(r.detalhes||[]).find(x=>x.id===id);if(d?.ok&&d.saldo!=null&&p)p.saldo=d.saldo;
   audit('Estorno de chegada no galpão',`${u.sku} · −${u.quantidade} · ${st.codigo}`);toast(d?.ok?'Última entrada desfeita no Bling.':'Estorno registrado; o Jarvis envia ao Bling.');await carregar()}
  else{const L=(st.linhas||[]);L.push({id:`est:${u.id}`,sku:u.sku,operacao:'S',quantidade:u.quantidade,motivo:'estorno',referencia:st.codigo,bling_status:'nao_enviar',created_at:new Date().toISOString()});if(p)p.saldo=Number(p.saldo||0)-Number(u.quantidade||0);gravarLocal(L);audit('Estorno de chegada no galpão',`${u.sku} · −${u.quantidade} · ${st.codigo} · só neste navegador`);toast('Última entrada desfeita.')}}
 catch(e){toast(e.message||String(e))}
 finally{st.enviando=false;window.Estoque?.recalc?.();if(page==='chegada')render()}}
async function reenviar(b){const ids=resumo(st.linhas).entradas.filter(m=>['pendente','erro'].includes(m.bling_status)&&!m.desfeita).map(m=>m.id);if(!ids.length)return;b.disabled=true;
 try{const r=await fn('estoque_mov_enviar',{dados:{ids}});for(const d of r.detalhes||[]){const m=st.linhas.find(x=>x.id===d.id),p=m&&prod(m.sku);if(d.ok&&d.saldo!=null&&p)p.saldo=d.saldo}toast(`${r.enviados||0} enviada(s) ao Bling${r.erros?` · ${r.erros} com erro`:''}.`)}catch(e){toast(e.message)}
 await carregar()}

document.addEventListener('click',e=>{if(page!=='chegada')return;const b=e.target.closest('[data-chg-sel],[data-chg-trocar],[data-chg-ok],[data-chg-desfazer],[data-chg-reenviar]');
 if(!b){if(st.confDesfazer&&!e.target.closest('[data-chg-desfazer]')){st.confDesfazer=false;render()}return}
 const d=b.dataset;if(d.chgSel)return escolher(d.chgSel);if(d.chgTrocar!=null){st.sel='';st.qtd='';st.nonce='';st.confGrande=false;return render()}
 if(d.chgOk!=null)return darEntrada();if(d.chgDesfazer!=null)return desfazer();if(d.chgReenviar!=null)return reenviar(b)});
document.addEventListener('input',e=>{if(page!=='chegada')return;
 if(e.target.id==='chgBusca'){st.busca=e.target.value;const r=$('#chgRes');if(r)r.innerHTML=resultados()}
 else if(e.target.id==='chgQtd'){st.qtd=e.target.value;if(st.confGrande){st.confGrande=false;const b=$('[data-chg-ok]');if(b){b.classList.remove('danger');b.innerHTML=`${icon('check')} Dar entrada`}}}});
document.addEventListener('keydown',e=>{if(page!=='chegada'||e.key!=='Enter')return;
 if(e.target.id==='chgBusca'){e.preventDefault();st.busca=e.target.value;procurar()}
 else if(e.target.id==='chgQtd'){e.preventDefault();st.qtd=e.target.value;darEntrada()}});
document.addEventListener('change',e=>{if(page!=='chegada'||!e.target.matches('[data-chg-dep]'))return;st.deposito=e.target.value;try{localStorage.setItem('eb_cheg_dep_'+st.codigo,st.deposito)}catch{}});
addPage('chegada','truck','Chegada no galpão',view,'Dê entrada no estoque do que chegou no caminhão: bipe o produto, informe a quantidade e o Bling é atualizado na hora.','',bind);
window.Chegada={codigoDoDia,idEntrada,achar,resumo};
})();
