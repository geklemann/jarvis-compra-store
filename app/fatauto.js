// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Faturamento › Automático: liga e regula a emissão automática de NF-e (Focus) dos pedidos pagos, que o servidor faz
// de 15 em 15 minutos (supabase/functions/_shared/faturamento_auto.ts). Só o dono liga, muda o modo e retoma depois
// de uma pausa; os demais acompanham. Modo "ensaio": confere os pedidos e mostra o que emitiria, sem emitir.
// O registro de cada pedido (apto, emitida, autorizada, rejeitada, bloqueado) vem de fat_auto_log.
(()=>{
const st={log:null,estado:null,carregando:false,erro:'',filtro:'',em:0};
const CANAIS=['Mercado Livre','Shopee','Magalu'];
const RES={apto:['Apto (ensaio)','info'],emitida:['Emitida','info'],autorizada:['Autorizada','ok'],rejeitada:['Rejeitada','bad'],bloqueado:['Bloqueado','warn']};
const MKT={enviada:['Enviada ao marketplace','ok'],nao_suportado:['Envio manual','']};
const hojeISO=()=>new Date(Date.now()-3*36e5).toISOString().slice(0,10);
const dono=()=>window.Cloud?.role==='owner';
const cfg=()=>db.gerencial?.fiscal?.fat_auto||{};
const fiscal=()=>db.gerencial?.fiscal||{};
const redesenhar=()=>{if(page==='faturamento')render()};
function salvar(n,msg){const f={...fiscal()};f.fat_auto={...(f.fat_auto||{}),...n};db.gerencial={...(db.gerencial||{}),fiscal:f};audit('Faturamento automático',msg);save()}

async function carregar(forca){if(st.carregando||!window.Cloud?.ws||(!forca&&Date.now()-st.em<60e3))return;st.carregando=true;st.erro='';
 try{const [a,b]=await Promise.all([Cloud.client.from('fat_auto_log').select('*').eq('workspace_id',Cloud.ws).order('updated_at',{ascending:false}).limit(2000),
   Cloud.client.from('integrations').select('settings').eq('workspace_id',Cloud.ws).eq('provider','bling').maybeSingle()]);
  if(a.error)throw a.error;st.log=a.data||[];st.estado=b.data?.settings?.fat_auto||null;st.comNota=new Set(st.log.filter(x=>['autorizada','emitida'].includes(x.resultado)).map(x=>x.pedido))}catch(e){st.erro=e.message||String(e);st.log=st.log||[]}
 st.carregando=false;st.em=Date.now();redesenhar()}

const quando=iso=>iso?new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
function view(){if(!window.Cloud?.ws)return '<div class="empty">Entre na conta para usar o faturamento automático.</div>';
 if(!st.log&&!st.carregando)carregar(true);
 const c=cfg(),f=fiscal(),est=st.estado||{},ult=est.ultima||{},L=st.log||[],pode=dono();
 const prodNfe=f.ambiente==='producao',modo=c.modo==='producao'?'producao':'ensaio',pausado=est.pausado&&!(c.retomar_em&&c.retomar_em>est.pausado.em);
 const hoje=hojeISO(),deHoje=L.filter(x=>String(x.created_at||'').slice(0,10)>=hoje||String(x.updated_at||'').slice(0,10)>=hoje),cont=r=>deHoje.filter(x=>x.resultado===r).length;
 const motivos={};for(const x of L.filter(x=>x.resultado==='bloqueado'))motivos[x.motivo]=(motivos[x.motivo]||0)+1;
 const top=Object.entries(motivos).sort((a,b)=>b[1]-a[1]).slice(0,6);
 const lista=L.filter(x=>!st.filtro||x.resultado===st.filtro).slice(0,300);
 const ck=(on,txt,dica='')=>`<li class="${on?'ok':'pend'}">${on?'✓':'•'} ${txt}${dica?` <span class="caption">${dica}</span>`:''}</li>`;
 return `<div class="notice"><b>Faturamento automático.</b> De 15 em 15 minutos, 24 horas, o Jarvis emite a NF-e dos pedidos pagos e com dados completos, confere se o pedido não foi cancelado e se o Bling ainda não emitiu, leva a nota para o DIFAL, envia ao Mercado Livre e à Shopee e, com "GNRE sozinha", gera e transmite a guia. Para quando 5 notas seguidas são rejeitadas e avisa por e-mail. Nunca cancela nota.</div>
 ${pausado?`<div class="notice fa-pausa"><b>Pausado em ${quando(est.pausado.em)}:</b> ${esc(est.pausado.motivo)}. Confira as rejeições abaixo, corrija e retome.${pode?` <button class="small primary" data-fa="retomar">Retomar</button>`:''}</div>`:''}
 ${est.erro?`<div class="notice">Última rodada com erro: ${esc(est.erro)}</div>`:''}
 <div class="grid two" style="align-items:start">
  <section class="card"><div class="cardhead"><div><h2>Automação</h2><p class="caption">${c.ligado?`Ligada · modo ${modo==='producao'?'<b>produção</b> (notas com valor fiscal)':'<b>ensaio</b> (só confere, não emite)'}`:'Desligada'}${est.em?` · última rodada ${quando(est.em)}`:''}</p></div>
   ${pode?`<button class="${c.ligado?'':'primary'}" data-fa="ligar">${c.ligado?'Desligar':'Ligar'}</button>`:''}</div>
   <div class="fa-cfg">
    <label>Modo<div class="segtabs"><button class="${modo==='ensaio'?'active':''}" data-fa-modo="ensaio" ${pode?'':'disabled'}>Ensaio</button><button class="${modo==='producao'?'active':''}" data-fa-modo="producao" ${pode?'':'disabled'}>Produção</button></div></label>
    <label>Canais<div class="row wrap">${CANAIS.map(k=>`<label class="check-l"><input type="checkbox" class="check" data-fa-canal="${esc(k)}" ${(c.canais?.length?c.canais:['Mercado Livre','Shopee']).includes(k)?'checked':''} ${pode?'':'disabled'}> ${k}</label>`).join('')}</div></label>
    <div class="row wrap"><label>Pedidos a partir de<input type="date" data-fa-campo="desde" value="${esc(c.desde||'')}" ${pode?'':'disabled'}></label>
     <label>Máximo por dia<input type="number" min="1" data-fa-campo="limite_dia" value="${esc(c.limite_dia||400)}" style="width:100px" ${pode?'':'disabled'}></label>
     <label>Por rodada<input type="number" min="1" max="60" data-fa-campo="por_rodada" value="${esc(c.por_rodada||30)}" style="width:90px" ${pode?'':'disabled'}></label>
     <label>Valor máximo do pedido<input type="number" min="1" data-fa-campo="valor_max" value="${esc(c.valor_max||5000)}" style="width:120px" ${pode?'':'disabled'}></label></div>
    <label class="check-l"><input type="checkbox" class="check" data-fa-gnre ${c.gnre?'checked':''} ${pode?'':'disabled'}> GNRE sozinha: gerar e transmitir as guias das notas novas nas UFs sem inscrição (o pagamento continua pelo arquivo do banco)</label>
   </div></section>
  <section class="card"><h2>Antes de ligar em produção</h2><ul class="fa-check">
   ${ck(prodNfe,'NF-e do Jarvis em produção','Fiscal › Regras › Configuração da NF-e')}
   ${ck(L.some(x=>x.modo==='ensaio'&&x.resultado==='apto'),'Ensaio rodado e conferido','pedidos aptos e bloqueios abaixo')}
   ${ck(!!c.bling_parado,'Bling parado de emitir nota para esses canais',pode?`<button class="small quiet" data-fa="bling">${c.bling_parado?'desmarcar':'marcar como feito'}</button>`:'')}
   ${ck(!!(f.emitente?.endereco&&f.emitente?.ibge&&f.emitente?.cep),'Dados do emitente para a GNRE','DIFAL e GNRE › Configuração')}
  </ul><p class="caption">Sem o Bling parado, o mesmo pedido pode sair com duas notas. O Jarvis confere o pedido no Bling antes de cada emissão, mas o Bling não confere o Jarvis.</p></section>
 </div>
 <div class="grid kpis4" style="margin-top:16px">
  <div class="card kpi"><span class="kpil">${modo==='producao'?'Emitidas hoje':'Aptos hoje (ensaio)'}</span><span class="kpiv">${modo==='producao'?cont('emitida')+cont('autorizada')+cont('rejeitada'):cont('apto')}</span><span class="kpis">${ult.emitidas!=null?`última rodada: ${ult.emitidas||0} emitida(s), ${ult.aptos||0} apto(s)`:''}</span></div>
  <div class="card kpi"><span class="kpil">Autorizadas hoje</span><span class="kpiv ok">${cont('autorizada')}</span><span class="kpis">${L.filter(x=>x.resultado==='autorizada'&&x.marketplace==='enviada').length} enviada(s) ao marketplace</span></div>
  <div class="card kpi"><span class="kpil">Rejeitadas</span><span class="kpiv ${cont('rejeitada')?'red':''}">${L.filter(x=>x.resultado==='rejeitada').length}</span><span class="kpis">${cont('rejeitada')} hoje</span></div>
  <div class="card kpi"><span class="kpil">Bloqueados</span><span class="kpiv ${L.some(x=>x.resultado==='bloqueado')?'gold':''}">${L.filter(x=>x.resultado==='bloqueado').length}</span><span class="kpis">esperam correção</span></div>
 </div>
 ${top.length?`<section class="card" style="margin-top:16px"><h2>Por que pedidos ficaram de fora</h2><div class="tablewrap"><table><tbody>${top.map(([m,n])=>`<tr><td>${esc(m)}</td><td class="num">${n}</td></tr>`).join('')}</tbody></table></div></section>`:''}
 <div class="tablebox" style="margin-top:16px"><div class="tabletop"><div><h2>Pedidos avaliados</h2><p class="caption">${st.carregando?'Carregando…':`${L.length} registro(s)`}${st.erro?` · ${esc(st.erro)}`:''}</p></div>
  <div class="row"><div class="segtabs">${[['','Todos'],['autorizada','Autorizadas'],['emitida','Emitidas'],['rejeitada','Rejeitadas'],['bloqueado','Bloqueados'],['apto','Aptos']].map(([k,t])=>`<button class="${st.filtro===k?'active':''}" data-fa-filtro="${k}">${t}</button>`).join('')}</div><button class="small" data-fa="atualizar">${icon('refresh')} Atualizar</button></div></div>
  <div class="tablewrap"><table><thead><tr><th>Pedido</th><th>Canal</th><th>Data</th><th class="num">Valor</th><th>Resultado</th><th>NF-e</th><th>Marketplace</th><th>Motivo</th><th>Atualizado</th></tr></thead><tbody>
  ${lista.map(x=>{const [t,tom]=RES[x.resultado]||[x.resultado,''],[mt,mtom]=MKT[x.marketplace]||[x.marketplace?String(x.marketplace).replace(/^erro: /,'Erro: '):'—',String(x.marketplace||'').startsWith('erro')?'bad':''];
   return `<tr><td class="mono">${esc(x.pedido)}</td><td>${esc(x.canal||'')}</td><td>${x.data_pedido?x.data_pedido.split('-').reverse().join('/'):''}</td><td class="num">${money(Number(x.valor)||0)}</td><td><span class="badge ${tom}">${t}</span></td><td class="mono">${esc(x.numero||'')}</td><td>${x.resultado==='autorizada'?`<span class="badge ${mtom}" title="${esc(x.marketplace||'')}">${esc(mt).slice(0,40)}</span>`:''}</td><td class="fa-motivo">${esc(x.motivo||'')}</td><td>${quando(x.updated_at)}</td></tr>`}).join('')||'<tr><td colspan="9" class="empty">Nenhum pedido avaliado ainda. Ligue a automação (no modo ensaio primeiro).</td></tr>'}
  </tbody></table></div></div>`}

document.addEventListener('click',e=>{const b=e.target.closest('[data-fa],[data-fa-modo],[data-fa-filtro]');if(!b)return;const d=b.dataset;
 if(d.faFiltro!==undefined){st.filtro=d.faFiltro;redesenhar();return}
 if(d.fa==='atualizar'){carregar(true);return}
 if(!dono())return toast('Só o dono muda o faturamento automático.');
 const c=cfg();
 if(d.faModo){if(d.faModo===c.modo||(d.faModo==='ensaio'&&!c.modo))return;
  if(d.faModo==='producao'){if(fiscal().ambiente!=='producao')return toast('Passe a NF-e para produção antes (Fiscal › Regras › Configuração da NF-e).');
   if(!confirm('Modo PRODUÇÃO: o Jarvis vai emitir NF-e com valor fiscal sozinho, sem clique, para os pedidos pagos dos canais marcados. Confirma?'))return}
  salvar({modo:d.faModo},`modo ${d.faModo}`);toast(d.faModo==='producao'?'Modo produção: as notas saem na próxima rodada (até 15 min).':'Modo ensaio: nada é emitido.');redesenhar();return}
 if(d.fa==='ligar'){const liga=!c.ligado;if(liga&&c.modo==='producao'&&!confirm('Ligar a emissão automática em PRODUÇÃO (notas com valor fiscal)?'))return;
  salvar({ligado:liga,desde:c.desde||hojeISO(),canais:c.canais?.length?c.canais:['Mercado Livre','Shopee'],modo:c.modo||'ensaio'},liga?`ligado (${c.modo||'ensaio'})`:'desligado');toast(liga?'Ligado. A primeira rodada sai em até 15 minutos.':'Desligado.');redesenhar();return}
 if(d.fa==='retomar'){salvar({retomar_em:new Date().toISOString()},'retomado depois da pausa');toast('Retomado: volta na próxima rodada.');setTimeout(()=>carregar(true),1500);return}
 if(d.fa==='bling'){salvar({bling_parado:!c.bling_parado?new Date().toISOString():null},c.bling_parado?'Bling: emissão não confirmada como parada':'Bling parado de emitir (confirmado pelo dono)');redesenhar()}});
document.addEventListener('change',e=>{const x=e.target;if(!x.closest?.('.fa-cfg'))return;if(!dono())return;const c=cfg();
 if(x.dataset.faCanal){const s=new Set(c.canais?.length?c.canais:['Mercado Livre','Shopee']);x.checked?s.add(x.dataset.faCanal):s.delete(x.dataset.faCanal);salvar({canais:[...s]},`canais: ${[...s].join(', ')}`);return}
 if(x.hasAttribute('data-fa-gnre')){salvar({gnre:x.checked},`GNRE sozinha ${x.checked?'ligada':'desligada'}`);return}
 if(x.dataset.faCampo){const k=x.dataset.faCampo,v=k==='desde'?x.value||null:Math.max(1,Number(x.value)||0);salvar({[k]:v},`${k}: ${v}`)}});
window.FatAuto={view,carregar,temNota:id=>!!st.comNota?.has(id)};
})();
