// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Trava de estoque nos marketplaces (Estoque › Trava nos marketplaces): o pedido não pode ser recusado no marketplace,
// então a trava é o anúncio ficar com quantidade 0 quando o saldo do Bling zera. No Mercado Livre o servidor faz isso
// sozinho logo depois de cada leitura de estoque do Bling (de hora em hora e em "Verificar agora"), só zerando — quem
// repõe é a integração multiloja do Bling. Esta tela mostra o que foi travado hoje, o alerta de anúncios com estoque no
// Mercado Livre mas sem saldo no Bling, liga/desliga (padrão: ligada) e o que falta na Shopee e na Magalu.
(()=>{
Object.assign(paths,{trava:'M6 11V8a6 6 0 0 1 12 0v3 M5 11h14v10H5z M12 15v2'});
const nf=(v,d=0)=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:d});
const quando=t=>t?new Date(t).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
const linkML=id=>`https://produto.mercadolivre.com.br/${String(id).replace(/^MLB/,'MLB-')}`;
const podeVer=()=>['owner','member','estoque','vendas','atendimento','financeiro'].includes(window.Cloud?.role||'owner');
const podeLigar=()=>['owner','member'].includes(window.Cloud?.role||'owner');
const nuvem=()=>!!(window.Cloud?.client&&window.Cloud?.ws);
async function fn(action,body){const r=await Cloud.client.functions.invoke('integrations',{body:{workspace_id:Cloud.ws,action,...body}});if(r.error){let msg=r.error.message;try{msg=(await r.error.context.json()).error||msg}catch{}throw Error(msg)}return r.data}
const st={dados:null,carregando:false,erro:'',verificando:false,ws:null};

async function carregar(){if(st.carregando||!nuvem())return;st.carregando=true;st.ws=Cloud.ws;
 try{st.dados=await fn('trava_status',{});st.erro=''}catch(e){st.erro=e.message||String(e);st.dados=st.dados||{}}finally{st.carregando=false}
 if(page==='travaestoque')render()}

function cartaoML(ml){const t=ml?.trava||{},r=t.resumo||{},ig=r.ignorados||{},trav=t.travados||[],al=t.alerta||[];
 if(!ml?.conectado)return `<section class="card"><h2>Mercado Livre</h2><p>O Mercado Livre não está conectado. Conecte em <a href="#" data-nav="integracoes">Integrações</a> para a trava funcionar.</p></section>`;
 return `<section class="card trv-ml"><div class="cardhead"><div><h2>Mercado Livre</h2><p class="caption">Última verificação: ${quando(t.em)}${t.erro?` · <span class="red">${esc(t.erro)}</span>`:''}</p></div>
  <div class="row wrap"><span class="badge ${ml.ativo?'ok':'warn'}">${ml.ativo?'Trava ligada':'Trava desligada'}</span>${podeLigar()?`<button class="small" data-trv-ligar="${ml.ativo?'0':'1'}">${ml.ativo?'Desligar':'Ligar'}</button>`:''}</div></div>
  <div class="grid kpis4"><div class="card kpi"><span class="kpil">Travados hoje</span><span class="kpiv ${trav.length?'gold':''}">${trav.length}</span><span class="kpis">anúncio(s) zerado(s)</span></div>
  <div class="card kpi"><span class="kpil">Alerta</span><span class="kpiv ${al.length?'red':''}">${al.length}</span><span class="kpis">com estoque no ML e sem saldo no Bling</span></div>
  <div class="card kpi"><span class="kpil">Anúncios ativos lidos</span><span class="kpiv">${nf(r.anuncios)}</span><span class="kpis">${nf(r.avaliados)} com SKU e saldo no Bling</span></div>
  <div class="card kpi"><span class="kpil">Fora da trava</span><span class="kpiv">${nf((ig.full||0)+(ig.sem_sku||0)+(ig.sem_saldo_lido||0))}</span><span class="kpis">${nf(ig.full)} no Full · ${nf(ig.sem_sku)} sem SKU · ${nf(ig.sem_saldo_lido)} SKU fora do Bling</span></div></div>
  ${r.freio?'<div class="notice"><strong>Freio acionado.</strong> Muitos anúncios ficariam zerados de uma vez; isso costuma ser leitura errada do estoque no Bling. Nada foi travado: confira o estoque no Bling e verifique de novo.</div>':''}
  ${al.length?`<div class="tablebox trv-alerta"><div class="tabletop"><div><h2>${icon('alert')} Anúncios com estoque no ML mas sem saldo no Bling</h2><span class="caption">Ainda vendendo o que não existe. Motivo de não ter travado ao lado.</span></div></div><div class="tablewrap"><table><thead><tr><th>Anúncio</th><th>SKU</th><th class="num">No ML</th><th class="num">Saldo no Bling</th><th>Por que não travou</th></tr></thead><tbody>
   ${al.map(a=>`<tr><td><a href="${esc(linkML(a.item_id))}" target="_blank" rel="noopener">${esc(String(a.titulo||a.item_id).slice(0,60))}</a><br><span class="caption mono">${esc(a.item_id)}${a.variacao?' · variação '+esc(a.variacao):''}</span></td><td class="mono">${esc(a.sku)}</td><td class="num">${nf(a.antes)}</td><td class="num red">${nf(a.saldo,3)}</td><td class="caption trv-motivo">${esc(a.motivo||'')}</td></tr>`).join('')}</tbody></table></div></div>`:''}
  <div class="tablebox"><div class="tabletop"><div><h2>Travados hoje</h2><span class="caption">Quantidade zerada no Mercado Livre porque o saldo do Bling acabou. Volta sozinha quando o Bling tiver saldo de novo.</span></div></div>
  ${trav.length?`<div class="tablewrap"><table><thead><tr><th>Quando</th><th>Anúncio</th><th>SKU</th><th class="num">ML antes → agora</th><th class="num">Saldo no Bling</th></tr></thead><tbody>
   ${trav.map(a=>`<tr><td>${quando(a.em)}</td><td><a href="${esc(linkML(a.item_id))}" target="_blank" rel="noopener">${esc(String(a.titulo||a.item_id).slice(0,60))}</a><br><span class="caption mono">${esc(a.item_id)}${a.variacao?' · variação '+esc(a.variacao):''}</span></td><td class="mono">${esc(a.sku)}</td><td class="num">${nf(a.antes)} → 0</td><td class="num">${nf(a.saldo,3)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Nenhum anúncio travado hoje.</div>'}</div></section>`}
function cartaoSemEscrita(nome,c,extra=''){return `<section class="card trv-canal"><div class="cardhead"><h2>${nome}</h2><span class="badge">Não disponível</span></div>
 <p>${esc(c?.motivo||'')}</p><p class="caption"><strong>Para liberar:</strong> ${esc(c?.precisa||'')}</p>${extra}</section>`}
function view(){if(!nuvem())return `<div class="notice"><strong>Modo local.</strong> A trava de estoque roda no servidor, com o Bling e o Mercado Livre conectados. Entre na sua conta para ver o estado dela.</div>`;
 if(!podeVer())return '<div class="notice">Seu papel não acessa o estoque.</div>';
 if(st.ws!==Cloud.ws){st.dados=null;st.ws=Cloud.ws}
 if(!st.dados){carregar();return '<div class="empty">Carregando a trava de estoque…</div>'}
 const d=st.dados,sh=d.shopee||{};
 const sinal=sh.pedidos_sem_saldo?`<div class="notice trv-sinal"><strong>${nf(sh.pedidos_sem_saldo)} pedido(s) da Shopee nos últimos 7 dias</strong> vieram com SKU que hoje está sem saldo no Bling${sh.skus?.length?` (${sh.skus.slice(0,6).map(s=>`${esc(s.sku)} ×${s.pedidos}`).join(', ')})`:''}. Confira no Bling se a sincronização de estoque multiloja com a Shopee está ligada para esses produtos.</div>`
  :`<p class="caption">Nos últimos 7 dias, ${nf(sh.pedidos_7d)} pedido(s) da Shopee e nenhum com SKU que hoje está sem saldo no Bling.</p>`;
 return `${st.erro?`<div class="notice">Não consegui ler a trava: ${esc(st.erro)}</div>`:''}
 <div class="row wrap trv-acoes"><p class="caption" style="flex:1;min-width:240px;margin:0">O marketplace não deixa recusar pedido: a trava deixa o anúncio com quantidade 0 quando o saldo do Bling zera. Só zera, nunca aumenta (quem repõe é o próprio Bling). Anúncios no Full ficam de fora.</p>
  <button class="small" data-trv-recarregar>${icon('refresh')} Atualizar</button><button class="small primary" data-trv-verificar ${st.verificando?'disabled':''}>${st.verificando?'Lendo o estoque do Bling…':`${icon('trava')} Verificar agora`}</button></div>
 ${cartaoML(d.ml)}
 <div class="grid two trv-canais">${cartaoSemEscrita('Shopee',sh,sinal)}${cartaoSemEscrita('Magalu',d.magalu)}</div>`}

document.addEventListener('click',async e=>{if(page!=='travaestoque')return;const b=e.target.closest('[data-trv-ligar],[data-trv-recarregar],[data-trv-verificar]');if(!b)return;const d=b.dataset;
 if(d.trvRecarregar!=null){st.dados=null;render();return}
 if(d.trvLigar!=null){const ativo=d.trvLigar==='1';if(!ativo&&b.dataset.conf!=='1'){b.dataset.conf='1';b.textContent='Confirmar: desligar';b.classList.add('danger');return}
  b.disabled=true;try{await fn('trava_config',{dados:{ativo}});toast(ativo?'Trava ligada: na próxima leitura do estoque os anúncios sem saldo ficam com quantidade 0.':'Trava desligada.');st.dados=null;render()}catch(x){b.disabled=false;toast(x.message)}return}
 if(d.trvVerificar!=null){st.verificando=true;render();
  try{const r=await fn('estoque_sync',{});const t=r?.trava||{};toast(t.erro?`Estoque lido; a trava falhou: ${t.erro}`:t.sem_ml?'Estoque lido. Mercado Livre não conectado.':`Estoque lido: ${nf(r.produtos)} produto(s). ${nf(t.travados_agora)} anúncio(s) travado(s) agora.`);window.Estoque?.carregar?.()}
  catch(x){toast(x.message)}st.verificando=false;st.dados=null;render()}});
addPage('travaestoque','trava','Trava nos marketplaces',view,'Anúncios zerados sozinhos no Mercado Livre quando o saldo do Bling acaba — para não vender o que não tem e não precisar cancelar.','',()=>{});
})();
