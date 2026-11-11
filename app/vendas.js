// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Vendas · Visão geral no formato ERP: números do mês contra o mesmo período do mês anterior, vendas por dia
// e canal, resultado por canal (bruto, tarifas, líquido, recebido, a receber) e o que pede ação agora.
(()=>{
const CORES={'Mercado Livre':'#f5c518','Shopee':'#ee4d2d','Magalu':'#0086ff','Mercado Pago':'#00b1ea'};
const cor=p=>CORES[p]||platforms?.[p]?.color||'#8a93a9';
const dias=m=>{const [y,mm]=m.split('-').map(Number);return new Date(y,mm,0).getDate()};
const mesAnt=m=>{const d=new Date(m+'-15T12:00:00');d.setMonth(d.getMonth()-1);return d.toISOString().slice(0,7)};
const hoje=()=>new Date().toLocaleDateString('sv-SE');
const pct=(a,b)=>b?((a-b)/Math.abs(b)*100):null;
const delta=(a,b,inv)=>{const p=pct(a,b);if(p==null||!isFinite(p))return '<span class="caption">sem base</span>';const bom=inv?p<0:p>0;return `<span class="${bom?'green':'red'}">${p>0?'▲':'▼'} ${Math.abs(p).toFixed(1).replace('.',',')}%</span> <span class="caption">vs ${mesBR(mesAnt(month)).split(' ')[0]}</span>`};
const mesBR=m=>new Date(m+'-15T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
const nf=v=>Number(v||0).toLocaleString('pt-BR');
function resumo(l){const g=l.reduce((s,o)=>s+o.gross,0),fee=l.reduce((s,o)=>s+o.fee,0),rec=l.reduce((s,o)=>s+Math.min(paid(o),net(o)),0);return {n:l.length,g,fee,liq:g-fee,rec,aberto:Math.max(0,g-fee-rec),ticket:l.length?g/l.length:0}}
// ─────────── Pulso de vendas (faixa viva no topo): hoje, frase da meta, corrida dos canais, vitrine e recorde ───────────
function pulsoVendas(m,doMes,canais,RC,RA,A,proj,meta,porDia,corrente,corte){const h=hoje(),tot=porDia.map(x=>Object.values(x).reduce((s,v)=>s+v,0));
 const hojeL=corrente?doMes.filter(o=>o.date===h):[],hojeV=hojeL.reduce((s,o)=>s+o.gross,0);
 const d7=new Date(h+'T12:00');d7.setDate(d7.getDate()-7);const sem=d7.toLocaleDateString('sv-SE'),semV=db.orders.filter(o=>o.date===sem).reduce((s,o)=>s+o.gross,0);
 const ate=corrente?corte:tot.length,fimR=corrente?Math.max(0,ate-1):ate,ult7=tot.slice(Math.max(0,fimR-7),fimR),ritmo=ult7.length?ult7.reduce((s,v)=>s+v,0)/ult7.length:(corrente&&ate?tot[ate-1]:0); /* ritmo sem o dia de hoje (ainda parcial) */
 const rec=tot.slice(0,ate).reduce((b,v,i)=>v>b.v?{v,i}:b,{v:0,i:-1}),media=ate?tot.slice(0,ate).reduce((s,v)=>s+v,0)/ate:0;
 // Frase inteligente sobre a meta (ou sobre o ritmo, sem meta)
 let frase;if(!corrente)frase=`${mesBR(m)} fechou em ${money(A.g)}${meta?` · ${Math.round(A.g/meta*100)}% da meta`:''}.`;
 else if(meta&&A.g>=meta)frase=`Meta batida! ${money(A.g)} vendidos, ${Math.round((A.g/meta-1)*100)}% acima.`;
 else if(meta){const falta=meta-A.g,dRest=Math.max(1,dias(m)-corte+1),preciso=falta/dRest; /* conta o dia de hoje */const dBate=ritmo>0?Math.ceil(falta/ritmo):null,diaBate=dBate!=null&&corte+dBate<=dias(m)?corte+dBate:null;
  frase=diaBate?`No ritmo dos últimos 7 dias (${money(ritmo)}/dia), a meta é batida por volta do dia ${diaBate}.`:`Faltam ${money(falta)} para a meta: precisa de ${money(preciso)} por dia até o fim do mês (ritmo atual ${money(ritmo)}/dia).`}
 else frase=`Projeção de fechamento: ${money(proj.proj)} no ritmo atual. Defina a meta para o Jarvis acompanhar.`;
 const lider=canais[0],corrida=canais.map((c,i)=>{const x=RC[c],y=RA[c],p=A.g?x.g/A.g*100:0,d=y?.g?(x.g/y.g-1)*100:null;return `<div class="vgv-raia" style="--c:${cor(c)};--w:${Math.max(3,p).toFixed(1)}%;--i:${i}"><span class="vgv-nome">${esc(c)}</span><span class="vgv-pista"><i></i></span><b>${money(x.g)}</b><small>${p.toFixed(1).replace('.',',')}%${d!=null&&isFinite(d)?` · <em class="${d>=0?'up':'down'}">${d>=0?'▲':'▼'} ${Math.abs(d).toFixed(0)}%</em>`:''}</small></div>`}).join('');
 // Vitrine: os 5 mais vendidos do mês com foto grande
 const img=new Map((window.Estoque?.lista?.()||[]).map(p=>[String(p.id).trim(),p.imagem])),mm=new Map();for(const o of doMes)for(const it of o.items||[]){const k=String(it.sku||it.title||'').trim();if(!k)continue;const x=mm.get(k)||{t:it.title||k,sku:k,q:0,v:0};x.q+=Number(it.qty)||0;x.v+=(Number(it.qty)||0)*(Number(it.price)||0);mm.set(k,x)}
 const top=[...mm.values()].sort((a,b)=>b.v-a.v).slice(0,5);
 const vitrine=top.map((x,i)=>{const u=img.get(x.sku);return `<div class="vgv-item" style="--i:${i}"><span class="vgv-rank ${i===0?'ouro':''}">${i+1}º</span><span class="vgv-img${u?'':' vazio'}">${u?`<img src="${esc(u)}" alt="" loading="lazy" onerror="this.parentNode.classList.add('vazio');this.remove()">`:''}${icon('box')}</span><b title="${esc(x.t)}">${esc(x.t)}</b><small>${nf(x.q)} un. · ${money(x.v)}</small></div>`}).join('');
 return `<section class="vgv-hero"><div class="vgv-luz" aria-hidden="true"></div>
 <div class="vgv-top"><div><span class="vgv-eyebrow">${corrente?'Pulso de vendas · agora':'Pulso de vendas'}</span><h2>${esc(frase)}</h2>
  <div class="vgv-kpis">${corrente?`<div><small>Hoje</small><b data-vcount="${Math.round(hojeV)}" data-moeda="1">${money(hojeV)}</b><span>${nf(hojeL.length)} pedidos${semV?` · ${hojeV>=semV?'▲':'▼'} ${Math.abs(pct(hojeV,semV)||0).toFixed(0)}% vs. ${new Date(sem+'T12:00').toLocaleDateString('pt-BR',{weekday:'short'})} passado`:''}</span></div>`:''}
   <div><small>Ritmo (7 dias)</small><b>${money(ritmo)}</b><span>por dia · média do mês ${money(media)}</span></div>
   <div><small>Melhor dia</small><b>${rec.i>=0?money(rec.v):'—'}</b><span>${rec.i>=0?`dia ${rec.i+1} · ${media?`${(rec.v/media).toFixed(1).replace('.',',')}× a média`:''}`:''}</span></div>
   <div><small>Líder do mês</small><b style="color:${lider?cor(lider):'#fff'}">${esc(lider||'—')}</b><span>${lider&&A.g?`${(RC[lider].g/A.g*100).toFixed(0)}% das vendas`:''}</span></div></div></div>
  <div class="vgv-corrida"><span class="vgv-eyebrow">Corrida dos canais</span>${corrida||'<p>Sem vendas no mês.</p>'}</div></div>
 ${top.length?`<div class="vgv-vitrine"><span class="vgv-eyebrow">Vitrine do mês</span><div class="vgv-itens">${vitrine}</div></div>`:''}</section>`}
// Número que sobe ao aparecer (o valor final já está escrito; só enfeite).
function animarVendas(){if(matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)return;$$('[data-vcount]').forEach(el=>{const fim=Number(el.dataset.vcount),t0=performance.now();if(!(fim>0))return;const passo=t=>{const p=Math.min(1,(t-t0)/900),v=fim*(1-Math.pow(1-p,3));el.textContent=el.dataset.moeda?money(Math.round(v)):nf(Math.round(v));if(p<1)requestAnimationFrame(passo)};requestAnimationFrame(passo)})}

function view(){const m=month,ant=mesAnt(m),corrente=m===hoje().slice(0,7),corte=corrente?Number(hoje().slice(8,10)):dias(m);
 const doMes=db.orders.filter(o=>o.date.startsWith(m)),doAnt=db.orders.filter(o=>o.date.startsWith(ant)&&Number(o.date.slice(8,10))<=corte);
 const A=resumo(doMes),B=resumo(doAnt),canais=[...new Set(doMes.map(o=>o.platform))].sort((a,b)=>resumo(doMes.filter(o=>o.platform===b)).g-resumo(doMes.filter(o=>o.platform===a)).g);
 // Atrasados e divergências: a mesma regra e o mesmo recorte (120 dias) de Pendências, para onde o "Pede ação" leva.
 const h=hoje(),pc=window.Pendencias?.conciliacao?.(h)||{atras:[],div:[]},vencidos=pc.atras,valVenc=vencidos.reduce((s,i)=>s+i.v,0);
 const semNf=doMes.filter(o=>!o.nf).length,div=pc.div,valDiv=div.reduce((s,i)=>s+i.v,0);
 // Liberações sem vínculo do mês, de qualquer sinal: a mesma conta da Conciliação.
 const soltas=(db.receipts||[]).filter(r=>!r.linkedOrder&&Number(r.amount)&&(r.date||'').startsWith(m));
 // Vendas por dia empilhadas por canal.
 const D=dias(m),porDia=[...Array(D)].map(()=>({})),recDia=new Array(D).fill(0);for(const o of doMes){const i=Number(o.date.slice(8,10))-1;porDia[i][o.platform]=(porDia[i][o.platform]||0)+o.gross}
 for(const r of db.receipts||[])if((r.date||'').startsWith(m)&&r.amount>0)recDia[Number(r.date.slice(8,10))-1]+=r.amount;
 const max=Math.max(1,...porDia.map(x=>Object.values(x).reduce((s,v)=>s+v,0))),W=900,H=220,bw=W/D;
 const barras=porDia.map((x,i)=>{let y=H;return canais.map(c=>{const v=x[c]||0,hh=v/max*(H-20);y-=hh;return v?`<rect x="${i*bw+bw*.14}" y="${y}" width="${bw*.72}" height="${hh}" fill="${cor(c)}" rx="2"><title>${String(i+1).padStart(2,'0')}/${m.slice(5)} · ${c}: ${money(v)}</title></rect>`:''}).join('')}).join('');
 const kpi=(t,v,s,nav)=>`<button class="card kpi" ${nav?`data-nav="${nav}"`:''}><span class="kpil">${t}</span><span class="kpiv">${v}</span><span class="kpis">${s}</span></button>`;
 const acoes=[semNf&&['warn','receipt',`${nf(semNf)} pedido(s) do mês ainda sem nota fiscal`,'Veja quais e há quanto tempo','faturamento'],vencidos.length&&['bad','alert',`${nf(vencidos.length)} repasse(s) atrasado(s)`,`${money(valVenc)} deveriam ter caído · últimos 120 dias`,'pending'],div.length&&['warn','alert',`${nf(div.length)} pedido(s) com divergência`,`${money(valDiv)} entre previsto e recebido · últimos 120 dias`,'pending'],soltas.length&&['info','link',`${nf(soltas.length)} liberação(ões) sem pedido no mês`,`${money(soltas.reduce((s,r)=>s+r.amount,0))} para vincular`,'reconcile']].filter(Boolean);
 const proj=projecao(m,doMes,corrente,corte),meta=Number(window.Metas?.valor?.(m,'','vendas')??(db.gerencial?.metas?.[m]||db.gerencial?.metas?.padrao||0));
 const RC=Object.fromEntries(canais.map(c=>[c,resumo(doMes.filter(o=>o.platform===c))])),RA=Object.fromEntries(canais.map(c=>[c,resumo(doAnt.filter(o=>o.platform===c))]));
 const Dant=dias(ant),antDia=new Array(Dant).fill(0);for(const o of db.orders)if(o.date.startsWith(ant))antDia[Number(o.date.slice(8,10))-1]+=o.gross;
 const tot=porDia.map(x=>Object.values(x).reduce((s,v)=>s+v,0));vgDados={m,ant,porDia,antDia,canais,tot,proj,corte,corrente};
 // Anel: realizado (sólido) e projeção (translúcido) contra a meta — ou contra a projeção quando não há meta.
 const alvo=meta||proj.proj||1,Rr=60,Cc=2*Math.PI*Rr,fr=Math.min(1,A.g/alvo),fp=Math.min(1,proj.proj/alvo);
 const anel=`<svg viewBox="0 0 150 150" aria-hidden="true"><defs><linearGradient id="vgGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--g2,var(--accent))"/><stop offset="1" style="stop-color:var(--hot,var(--accent))"/></linearGradient></defs><circle class="rtrack" cx="75" cy="75" r="${Rr}" fill="none" stroke-width="12"/>${proj.fechado?'':`<circle class="rproj" cx="75" cy="75" r="${Rr}" fill="none" stroke-width="12" stroke-dasharray="${fp*Cc} ${Cc}" transform="rotate(-90 75 75)"/>`}<circle class="rreal" cx="75" cy="75" r="${Rr}" fill="none" stroke-width="12" stroke-linecap="round" stroke-dasharray="${fr*Cc} ${Cc}" transform="rotate(-90 75 75)"/><text x="75" y="80" text-anchor="middle">${Math.round(A.g/alvo*100)}%</text><text class="s" x="75" y="98" text-anchor="middle">${meta?'da meta':'da projeção'}</text></svg>`;
 let off=0;const Cd=2*Math.PI*48,rosca=`<svg viewBox="0 0 130 130" aria-hidden="true">${canais.map(c=>{const len=(RC[c].g/(A.g||1))*Cd,x=`<circle cx="65" cy="65" r="48" fill="none" stroke="${cor(c)}" stroke-width="18" stroke-dasharray="${Math.max(0,len-2)} ${Cd}" stroke-dashoffset="${-off}" transform="rotate(-90 65 65)"><title>${esc(c)}: ${money(RC[c].g)}</title></circle>`;off+=len;return x}).join('')}<text x="65" y="62" text-anchor="middle" style="fill:var(--muted);font:600 10px 'DM Sans'">canais</text><text x="65" y="80" text-anchor="middle" style="fill:var(--text);font:800 20px Manrope">${canais.length}</text></svg>`;
 const sigla=c=>c==='Mercado Livre'?'ML':c==='Mercado Pago'?'MP':c.slice(0,2).toUpperCase();
 const sparkC=l=>{const mx=Math.max(1,...l),W=200,Hh=34,p=l.map((v,i)=>`${(i/Math.max(1,l.length-1)*W).toFixed(1)},${(Hh-2-v/mx*(Hh-6)).toFixed(1)}`).join(' ');return `<svg class="hj-spark" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none"><polyline points="${p}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`};
 const ate=corrente?corte:D;
 return `<div class="vg">${pulsoVendas(m,doMes,canais,RC,RA,A,proj,meta,porDia,corrente,corte)}<div class="vg-hero">
 <section class="card vg-big"><small>Vendas de ${mesBR(m).split(' ')[0]}</small><strong>${money(A.g)}</strong><p>${nf(A.n)} pedidos · ticket médio ${money(A.ticket)} · ${delta(A.g,B.g)}</p>
  <div class="row"><span class="vg-pill">Tarifas <b>${(A.g?A.fee/A.g*100:0).toFixed(1).replace('.',',')}%</b> ${delta(A.fee/(A.g||1),B.fee/(B.g||1),true).replace(/<span class="caption">.*$/,'')}</span><span class="vg-pill">Líquido <b>${money(A.liq)}</b></span><span class="vg-pill">Recebido <b>${money(A.rec)}</b></span><span class="vg-pill">A receber <b>${money(A.aberto)}</b></span></div>
  ${corrente?`<p class="caption">Comparação com os primeiros ${corte} dias de ${mesBR(ant)}.</p>`:''}</section>
 <section class="card vg-ring">${anel}<dl><div><dt>${proj.fechado?'Total do mês':'Projeção de fechamento'}</dt><dd>${money(proj.proj)}</dd></div><div><dt>Meta do mês</dt><dd><input data-vd-meta value="${meta||''}" placeholder="R$ definir"></dd></div>${meta?`<div><dt>${proj.fechado?'Atingido':'Vai atingir'}</dt><dd class="${proj.proj/meta>=1?'green':proj.proj/meta>=.9?'gold':'red'}">${(proj.proj/meta*100).toFixed(0)}%</dd></div>`:''}</dl></section>
 <section class="card vg-donut">${rosca}<div class="vg-leg">${canais.map(c=>`<span><i style="background:${cor(c)}"></i>${esc(c)}<b>${(A.g?RC[c].g/A.g*100:0).toFixed(1).replace('.',',')}%</b></span>`).join('')}</div></section></div>
 <div class="vg-canais">${canais.map(c=>{const x=RC[c],y=RA[c];return `<button class="vg-canal" data-nav="${esc(c)}" style="--c:${cor(c)}"><header><span class="plogo">${sigla(c)}</span>${esc(c)}<em>${delta(x.g,y.g).replace(/<span class="caption">.*$/,'')}</em></header><strong>${money(x.g)}</strong>
  <span class="vg-kv"><span><small>Pedidos</small><b>${nf(x.n)}</b></span><span><small>Ticket</small><b>${money(x.ticket)}</b></span><span><small>Tarifa</small><b>${(x.g?x.fee/x.g*100:0).toFixed(1).replace('.',',')}%</b></span></span>${sparkC(porDia.slice(0,ate).map(d=>d[c]||0))}</button>`}).join('')}</div>
 <section class="card"><div class="cardhead"><div><h2>Vendas ${vgUI.modo==='acum'?'acumuladas':'por dia'}</h2><p class="caption">${vgUI.modo==='acum'?`Acumulado de ${mesBR(m)} contra ${mesBR(ant)} (tracejado)${proj.fechado?'':' e a projeção até o fim do mês'}`:`Valor bruto por canal · tracejado: ${mesBR(ant)}`}</p></div>
  <div class="row"><div class="legend">${canais.map(c=>`<span><i style="background:${cor(c)}"></i>${esc(c)}</span>`).join('')}</div><div class="segtabs" style="margin:0"><button class="${vgUI.modo==='dia'?'active':''}" data-vg-modo="dia">Por dia</button><button class="${vgUI.modo==='acum'?'active':''}" data-vg-modo="acum">Acumulado</button></div></div></div>
  <div class="vg-chart" id="vgChart">${grafico()}<div class="vg-tip" id="vgTip"></div></div></section>
 <div class="vg-3"><section class="card"><div class="cardhead"><h2>Pede ação</h2><span class="badge ${acoes.length?'warn':'ok'}">${acoes.length||'Tudo em dia'}</span></div>
  ${acoes.map(([tom,ic,t,s2,nav])=>`<button class="hj-task" data-nav="${nav}"><span class="avico ${tom}">${icon(ic)}</span><span><strong>${t}</strong><small>${s2}</small></span>${icon('arrow')}</button>`).join('')||'<p class="caption">Nenhuma pendência de vendas. ✓</p>'}</section>
  ${maisVendidos(doMes)}${mapaUF(doMes)}</div>
 <div class="tablebox"><div class="tabletop"><div><h2>Resultado por canal</h2><p class="caption">${mesBR(m)} · clique no canal para ver os pedidos</p></div></div><div class="tablewrap"><table><thead><tr><th>Canal</th><th class="num">Pedidos</th><th class="num">Bruto</th><th class="num">Participação</th><th class="num">Ticket médio</th><th class="num">Tarifas</th><th class="num">% tarifa</th><th class="num">Líquido</th><th class="num">Recebido</th><th class="num">A receber</th><th class="num">vs mês anterior</th></tr></thead><tbody>
 ${canais.map(c=>{const x=RC[c],y=RA[c];return `<tr class="clickrow" data-nav="${esc(c)}"><td><span class="platdot" style="background:${cor(c)}"></span> <strong>${esc(c)}</strong></td><td class="num">${nf(x.n)}</td><td class="num">${money(x.g)}</td><td class="num">${(A.g?x.g/A.g*100:0).toFixed(1).replace('.',',')}%</td><td class="num">${money(x.ticket)}</td><td class="num">${money(x.fee)}</td><td class="num">${(x.g?x.fee/x.g*100:0).toFixed(1).replace('.',',')}%</td><td class="num">${money(x.liq)}</td><td class="num">${money(x.rec)}</td><td class="num">${money(x.aberto)}</td><td class="num">${delta(x.g,y.g)}</td></tr>`}).join('')}
 <tr class="ctbgrupo"><td>Total</td><td class="num">${nf(A.n)}</td><td class="num">${money(A.g)}</td><td class="num">100%</td><td class="num">${money(A.ticket)}</td><td class="num">${money(A.fee)}</td><td class="num">${(A.g?A.fee/A.g*100:0).toFixed(1).replace('.',',')}%</td><td class="num">${money(A.liq)}</td><td class="num">${money(A.rec)}</td><td class="num">${money(A.aberto)}</td><td class="num">${delta(A.g,B.g)}</td></tr></tbody></table></div></div></div>`}
// ─────────── Gráfico: por dia (barras por canal + mês anterior tracejado) ou acumulado (com projeção) ───────────
const vgUI={modo:'dia'};let vgDados=null;
function grafico(){const {porDia,antDia,canais,tot,proj,corte,corrente}=vgDados,D=porDia.length,W=900,H=240,T=14,bw=W/D;
 const eixo=(mx)=>[0,1,2,3].map(i=>{const y=H-i*(H-T)/3;return `<line class="gl" x1="0" x2="${W}" y1="${y}" y2="${y}"/><text x="${W-2}" y="${y-4}" text-anchor="end">${i?fmtK(mx*i/3):''}</text>`}).join('');
 const dias_=porDia.map((_,i)=>i%5===0||i===D-1?`<text x="${i*bw+bw/2}" y="${H+14}" text-anchor="middle">${String(i+1).padStart(2,'0')}</text>`:'').join('');
 const defs=`<defs><linearGradient id="vgGrad2" x1="0" x2="1"><stop offset="0" style="stop-color:var(--g1,var(--accent))"/><stop offset="1" style="stop-color:var(--hot,var(--accent))"/></linearGradient><linearGradient id="vgArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs>`;
 if(vgUI.modo==='acum'){const cur=[],a=[];let s1=0,s2=0;for(let i=0;i<D;i++){s1+=tot[i];cur.push(s1)}for(let i=0;i<antDia.length;i++){s2+=antDia[i];a.push(s2)}
  const ate=corrente?corte:D,mx=Math.max(1,cur[ate-1]||0,a.at(-1)||0,proj.proj),Y=v=>H-v/mx*(H-T),X=i=>i*bw+bw/2;
  const pc=cur.slice(0,ate).map((v,i)=>`${X(i)},${Y(v)}`).join(' '),pa=a.map((v,i)=>`${X(Math.min(i,D-1))},${Y(v)}`).join(' ');
  const pj=!proj.fechado&&ate<D?`<line x1="${X(ate-1)}" y1="${Y(cur[ate-1])}" x2="${X(D-1)}" y2="${Y(proj.proj)}" stroke="var(--hot,var(--accent))" stroke-width="2.5" stroke-dasharray="3 6" stroke-linecap="round"/><circle cx="${X(D-1)}" cy="${Y(proj.proj)}" r="5" fill="var(--hot,var(--accent))"><title>Projeção: ${money(proj.proj)}</title></circle>`:'';
  return `<svg viewBox="0 -6 ${W} ${H+24}" role="img" aria-label="Vendas acumuladas">${defs}${eixo(mx)}<polygon class="area" points="${X(0)},${H} ${pc} ${X(ate-1)},${H}"/><polyline class="ant" points="${pa}"/><polyline class="cur" points="${pc}"/>${pj}<text class="vlab big" x="${X(ate-1)}" y="${Y(cur[ate-1])-10}" text-anchor="middle">${fmtK(cur[ate-1]||0)}</text><text class="vlab" x="${X(Math.min(a.length,D)-1)}" y="${Y(a.at(-1)||0)+16}" text-anchor="end">${mesBR(vgDados.ant).split(' ')[0]}: ${fmtK(a.at(-1)||0)}</text>${!proj.fechado&&ate<D?`<text class="vlab hot" x="${X(D-1)-8}" y="${Y(proj.proj)-10}" text-anchor="end">projeção ${fmtK(proj.proj)}</text>`:''}${porDia.map((_,i)=>`<g class="d" data-i="${i}"><rect x="${i*bw}" y="0" width="${bw}" height="${H}" fill="transparent"/></g>`).join('')}${dias_}</svg>`}
 const mx=Math.max(1,...tot,...antDia),Y=v=>H-v/mx*(H-T);
 const barras=porDia.map((x,i)=>{let y=H;return `<g class="d" data-i="${i}"><rect x="${i*bw}" y="0" width="${bw}" height="${H}" fill="transparent"/>${canais.map(c=>{const v=x[c]||0,hh=v/mx*(H-T);y-=hh;return v?`<rect class="b" x="${i*bw+bw*.16}" y="${y}" width="${bw*.68}" height="${hh}" fill="${cor(c)}" rx="3"/>`:''}).join('')}</g>`}).join('');
 const pa=antDia.slice(0,D).map((v,i)=>`${i*bw+bw/2},${Y(v)}`).join(' ');
 const rot=tot.map((v,i)=>v?`<text class="vlab" x="${i*bw+bw/2}" y="${Y(v)-5}" text-anchor="middle">${fmtK(v)}</text>`:'').join('');
 return `<svg viewBox="0 -6 ${W} ${H+24}" role="img" aria-label="Vendas por dia">${defs}${eixo(mx)}${barras}<polyline class="ant" points="${pa}" style="pointer-events:none"/>${rot}${dias_}</svg>`}
const fmtK=v=>v>=1e6?(v/1e6).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mi':v>=1e3?Math.round(v/1e3)+' mil':Math.round(v);
function bindGrafico(){const box=$('#vgChart'),tip=$('#vgTip');if(!box||!vgDados)return;const {porDia,antDia,canais,tot,m,ant}=vgDados;
 box.onmousemove=e=>{const g=e.target.closest('g.d');if(!g){tip.classList.remove('on');return}const i=+g.dataset.i,x=porDia[i],r=box.getBoundingClientRect();
  let acum=0,acA=0;for(let k=0;k<=i;k++){acum+=tot[k];acA+=antDia[k]||0}
  tip.innerHTML=`<strong>${String(i+1).padStart(2,'0')}/${m.slice(5)}</strong>${vgUI.modo==='acum'?`<div><span>Acumulado</span><b>${money(acum)}</b></div><div><span>Mesmo dia em ${mesBR(ant).split(' ')[0]}</span><b>${money(acA)}</b></div>`:canais.filter(c=>x[c]).map(c=>`<div><span><i style="background:${cor(c)}"></i>${esc(c)}</span><b>${money(x[c])}</b></div>`).join('')+`<div><span>Total</span><b>${money(tot[i])}</b></div><div class="caption"><span>${mesBR(ant).split(' ')[0]}</span><span>${money(antDia[i]||0)}</span></div>`}`;
  tip.classList.add('on');const px=e.clientX-r.left,py=e.clientY-r.top;tip.style.left=Math.min(r.width-190,px+14)+'px';tip.style.top=Math.max(0,py-20)+'px'};
 box.onmouseleave=()=>tip.classList.remove('on')}
document.addEventListener('click',e=>{const b=e.target.closest('[data-vg-modo]');if(!b)return;vgUI.modo=b.dataset.vgModo;render()});
// Mais vendidos com foto do produto (cadastro do Bling) e mapa de calor dos estados.
function maisVendidos(l){const img=new Map((window.Estoque?.lista?.()||[]).map(p=>[String(p.id).trim(),p.imagem]));const mm=new Map();
 for(const o of l)for(const it of o.items||[]){const k=String(it.sku||it.title||'').trim();const x=mm.get(k)||{t:it.title||k,q:0,v:0};x.q+=Number(it.qty)||0;x.v+=(Number(it.qty)||0)*(Number(it.price)||0);mm.set(k,x)}
 const t=[...mm].sort((a,b)=>b[1].v-a[1].v).slice(0,6),mx=t[0]?.[1].v||1;
 return `<section class="card"><div class="cardhead"><h2>Mais vendidos</h2><button class="small quiet" data-nav="crmprodutos">Ranking</button></div>${t.map(([k,x])=>`<div class="vg-prod">${img.get(k)?`<span class="ph"><img src="${esc(img.get(k))}" alt="" loading="lazy" onerror="this.parentNode.classList.add('semfoto');this.remove()"></span>`:`<span class="ph">${icon('box')}</span>`}<span><strong title="${esc(x.t)}">${esc(x.t)}</strong><span class="bartrack"><i style="width:${x.v/mx*100}%"></i></span></span><b>${money(x.v)}<small>${nf(x.q)} un.</small></b></div>`).join('')||'<p class="caption">Sem itens no período.</p>'}</section>`}
function mapaUF(l){const UFS=['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'],mm=new Map();for(const o of l)if(o.state)mm.set(o.state,(mm.get(o.state)||0)+o.gross);
 const mx=Math.max(1,...mm.values()),tot=l.reduce((s,o)=>s+o.gross,0)||1,top=[...mm].sort((a,b)=>b[1]-a[1]).slice(0,3);
 return `<section class="card"><div class="cardhead"><h2>Estados</h2><button class="small quiet" data-nav="crmgeo">Mapa</button></div><div class="vg-uf">${UFS.map(u=>{const v=mm.get(u)||0,p=v?Math.round(8+v/mx*82):3;return `<span class="${p>55?'hot':''}" style="--p:${p}" title="${u}: ${money(v)} · ${(v/tot*100).toFixed(1).replace('.',',')}%">${u}</span>`}).join('')}</div>
  <p class="caption" style="margin-top:12px">${top.map(([u,v])=>`<b>${u}</b> ${(v/tot*100).toFixed(1).replace('.',',')}%`).join(' · ')||'Sem UF nos pedidos.'}</p></section>`}
// Projeção de fechamento: realizado até hoje + ritmo dos últimos 14 dias (por dia da semana) nos dias que faltam.
function projecao(m,doMes,corrente,corte,h=hoje()){const real=doMes.reduce((x,o)=>x+o.gross,0);if(!corrente)return {real,proj:real,porCanal:{},fechado:true};
 const dia=d=>{const x=new Date(h+'T12:00:00');x.setDate(x.getDate()-d);return x.toLocaleDateString('sv-SE')},ult=db.orders.filter(o=>o.date>=dia(14)&&o.date<h);
 const porDow=new Array(7).fill(0),porCanalDow={};for(const o of ult){const w=new Date(o.date+'T12:00:00').getDay();porDow[w]+=o.gross/2;(porCanalDow[o.platform]=porCanalDow[o.platform]||new Array(7).fill(0))[w]+=o.gross/2}
 let falta=0;const porCanal={};const [y,mm]=m.split('-').map(Number),fim=new Date(y,mm,0).getDate();
 for(let d=corte+1;d<=fim;d++){const w=new Date(y,mm-1,d,12).getDay();falta+=porDow[w];for(const c in porCanalDow)porCanal[c]=(porCanal[c]||0)+porCanalDow[c][w]}
 // Hoje ainda está acontecendo: completa o dia pela média do mesmo dia da semana.
 const hojeReal=doMes.filter(o=>o.date===h).reduce((x,o)=>x+o.gross,0),hojeEsp=porDow[new Date(h+'T12:00:00').getDay()];falta+=Math.max(0,hojeEsp-hojeReal);
 for(const o of doMes){porCanal[o.platform]=(porCanal[o.platform]||0)+o.gross}return {real,proj:real+falta,porCanal,fechado:false}}
function projCard(p,meta,m){const pct=meta?p.proj/meta:null;
 return `<section class="card projcard"><div class="cardhead"><div><h2>${p.fechado?'Fechamento':'Projeção de fechamento'} de ${mesBR(m)}</h2><p class="caption">${p.fechado?'Mês encerrado.':'Realizado até agora + ritmo dos últimos 14 dias para cada dia da semana que falta.'}</p></div><label class="caption">Meta do mês <input data-vd-meta value="${meta||''}" placeholder="R$" style="width:130px"></label></div>
 <div class="projrow"><div><small>Realizado</small><strong>${money(p.real)}</strong></div><div><small>${p.fechado?'Total':'Projeção'}</small><strong class="accent">${money(p.proj)}</strong></div>${meta?`<div><small>Meta</small><strong>${money(meta)}</strong></div><div><small>${p.fechado?'Atingido':'Vai atingir'}</small><strong class="${pct>=1?'green':pct>=.9?'gold':'red'}">${(pct*100).toFixed(0)}%</strong></div>`:''}</div>
 ${meta?`<span class="projbar"><i style="width:${Math.min(100,p.real/meta*100)}%"></i><b style="left:${Math.min(100,p.proj/meta*100)}%"></b></span>`:''}
 ${Object.keys(p.porCanal).length&&!p.fechado?`<p class="caption" style="margin-top:8px">${Object.entries(p.porCanal).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`${esc(c)} ${money(v)}`).join(' · ')}</p>`:''}</section>`}
function topProdutos(l){const m=new Map();for(const o of l)for(const it of o.items||[]){const k=it.title||it.sku;const x=m.get(k)||{q:0,v:0};x.q+=Number(it.qty)||0;x.v+=(Number(it.qty)||0)*(Number(it.price)||0);m.set(k,x)}
 const t=[...m].sort((a,b)=>b[1].v-a[1].v).slice(0,6),max=t[0]?.[1].v||1;
 return `<section class="card"><div class="cardhead"><h2>Mais vendidos</h2><button class="small quiet" data-nav="crmprodutos">Ver ranking</button></div>${t.map(([n,x])=>`<div class="barline"><span class="ellipsis">${esc(n)}</span><span class="bartrack"><i style="width:${x.v/max*100}%"></i></span><strong class="num">${money(x.v)}</strong><small class="caption">${nf(x.q)} un.</small></div>`).join('')||'<p class="caption">Sem itens no período.</p>'}</section>`}
function topEstados(l){const m=new Map();for(const o of l)if(o.state)m.set(o.state,(m.get(o.state)||0)+o.gross);const t=[...m].sort((a,b)=>b[1]-a[1]).slice(0,6),max=t[0]?.[1]||1,tot=l.reduce((s,o)=>s+o.gross,0)||1;
 return `<section class="card"><div class="cardhead"><h2>Principais estados</h2><button class="small quiet" data-nav="crmgeo">Ver mapa</button></div>${t.map(([uf,v])=>`<div class="barline"><span><strong>${esc(uf)}</strong></span><span class="bartrack"><i style="width:${v/max*100}%"></i></span><strong class="num">${money(v)}</strong><small class="caption">${(v/tot*100).toFixed(1).replace('.',',')}%</small></div>`).join('')||'<p class="caption">Sem UF nos pedidos.</p>'}</section>`}
// Substitui a tela antiga: addPage registra a nova e remove a entrada duplicada que ele acrescenta ao menu.
// A meta de vendas do mês é a mesma da tela Metas do mês (empresa toda); db.gerencial.metas fica como cópia/legado.
document.addEventListener('change',async e=>{const i=e.target.closest('[data-vd-meta]');if(!i)return;const v=Number(String(i.value).replace(/[^0-9,]/g,'').replace(',','.'))||0;db.gerencial={...(db.gerencial||{}),metas:{...(db.gerencial?.metas||{}),[month]:v}};save();
 try{await window.Metas?.definir?.(month,'','vendas',v||null)}catch(x){toast('Meta: '+(x.message||x))}audit('Meta de vendas',`${month}: ${money(v)}`);render()});
// Projeção de fechamento (realizado + ritmo dos últimos 14 dias por dia da semana), usada também em Metas do mês.
window.VendasProjecao=(m,h=hoje())=>{const corrente=m===h.slice(0,7),corte=corrente?Number(h.slice(8,10)):dias(m);return projecao(m,db.orders.filter(o=>o.date.startsWith(m)),corrente,corte,h)};
addPage('dashboard','grid','Visão geral',view,'Vendas do mês por canal, comparadas ao mesmo período do mês anterior — e o que pede ação.','',()=>{bindGrafico();animarVendas()});
// ─────────── Faixa viva no topo das demais telas de Vendas (mesmo estilo da Visão geral) ───────────
// Números do mês do cabeçalho e uma frase do assunto de cada tela; tudo dos pedidos e repasses já carregados.
function topoVendas(p){const m=month,ant=mesAnt(m),corrente=m===hoje().slice(0,7),corte=corrente?Number(hoje().slice(8,10)):dias(m);
 const doMes=db.orders.filter(o=>o.date.startsWith(m)),doAnt=db.orders.filter(o=>o.date.startsWith(ant)&&Number(o.date.slice(8,10))<=corte),A=resumo(doMes),B=resumo(doAnt);
 const pp=v=>(Number.isFinite(v)?v:0).toFixed(1).replace('.',',')+'%',var_=(a,b)=>{const x=pct(a,b);return x==null||!isFinite(x)?'':` · ${x>=0?'▲':'▼'} ${Math.abs(x).toFixed(0)}% vs. ${mesBR(ant).split(' ')[0]}`};
 const k=(t,v,s,cls='')=>`<div><small>${t}</small><b class="${cls}">${v}</b><span>${s||''}</span></div>`;
 let titulo='',frase='',ks=[];
 if(p==='metas'){const meta=Number(window.Metas?.valor?.(m,'','vendas')??(db.gerencial?.metas?.[m]||db.gerencial?.metas?.padrao||0)),falta=Math.max(0,meta-A.g),rest=Math.max(1,dias(m)-corte+1);
  titulo='Metas do mês';frase=!meta?'Defina a meta de vendas do mês para o Jarvis acompanhar o ritmo e avisar a tempo.':A.g>=meta?`Meta de vendas batida: ${money(A.g)}, ${pp((A.g/meta-1)*100)} acima.`:corrente?`Faltam ${money(falta)} para a meta: ${money(falta/rest)} por dia nos ${rest} dia(s) que restam.`:`O mês fechou em ${pp(A.g/meta*100)} da meta.`;
  ks=[k('Vendido',money(A.g),`${nf(A.n)} pedidos${var_(A.g,B.g)}`),k('Meta',meta?money(meta):'—','vendas do mês'),k('Atingido',meta?pp(A.g/meta*100):'—',corrente?`dia ${corte} de ${dias(m)}`:'',meta&&A.g>=meta?'ok':''),k('Ritmo por dia',money(corte?A.g/corte:0),'média do mês até hoje')]}
 else if(p==='margem'||p==='raiox'||p==='anuncios'){const mm=window.Margem?.mes?.(m)||{},t0=mm['']||{},tot={v:t0.venda||0,l:t0.lucro||0},mg=tot.v?tot.l/tot.v*100:null;
  titulo={margem:'Radar de margem',raiox:'Raio-X da margem',anuncios:'Anúncios pagos'}[p];
  frase=mg==null?'Cadastre os custos dos produtos para o Jarvis calcular o lucro de cada venda.':p==='anuncios'?`Margem de contribuição de ${pp(mg)} antes dos anúncios: cada real em ads precisa caber nela.`:`Margem de contribuição de ${pp(mg)} em ${mesBR(m).split(' ')[0]}: ${money(tot.l)} de lucro depois de tarifas, frete, custo e impostos.`;
  ks=[k('Vendas',money(A.g),`${nf(A.n)} pedidos${var_(A.g,B.g)}`),k('Tarifas',pp(A.g?A.fee/A.g*100:0),money(A.fee)),k('Margem de contribuição',mg==null?'—':pp(mg),mg==null?'':money(tot.l),mg!=null&&mg<0?'bad':''),k('Ticket médio',money(A.ticket),'por pedido')]}
 else if(p==='faturamento'){const sem=doMes.filter(o=>!o.nf),vs=sem.reduce((x,o)=>x+o.gross,0);titulo='Faturamento';
  frase=sem.length?`${nf(sem.length)} pedido(s) de ${mesBR(m).split(' ')[0]} ainda sem nota fiscal (${money(vs)}).`:'Todos os pedidos do mês já têm nota fiscal.';
  ks=[k('Pedidos',nf(A.n),money(A.g)),k('Com nota',pp(A.n?(A.n-sem.length)/A.n*100:100),`${nf(A.n-sem.length)} pedido(s)`,sem.length?'':'ok'),k('Sem nota',nf(sem.length),money(vs),sem.length?'warn':''),k('Ticket médio',money(A.ticket),'por pedido')]}
 else if(p==='reconcile'||p==='closing'){const st=doMes.map(o=>status(o)),conc=st.filter(s=>s==='Conciliado').length,div=st.filter(s=>s==='Divergência').length;titulo=p==='reconcile'?'Conciliação de repasses':'Fechamento de repasses';
  frase=`${pp(A.n?conc/A.n*100:0)} dos pedidos de ${mesBR(m).split(' ')[0]} já têm o repasse conferido${div?`; ${nf(div)} com divergência para olhar`:''}.`;
  ks=[k('Líquido previsto',money(A.liq),`${nf(A.n)} pedidos`),k('Recebido',money(A.rec),pp(A.liq?A.rec/A.liq*100:0)+' do previsto','ok'),k('A receber',money(A.aberto),'repasses ainda não caíram'),k('Divergências no mês',nf(div),div?'previsto ≠ recebido':'nenhuma',div?'warn':'ok')]}
 else{titulo={concorrencia:'Vigia de preços',produtos:'Produtos',estados:'Estados',clientes:'Clientes'}[p]||'Vendas';
  const canais=[...new Set(doMes.map(o=>o.platform))].map(c=>[c,doMes.filter(o=>o.platform===c).reduce((x,o)=>x+o.gross,0)]).sort((a,b)=>b[1]-a[1]),lid=canais[0];
  frase=`${mesBR(m).split(' ')[0][0].toUpperCase()+mesBR(m).split(' ')[0].slice(1)}: ${money(A.g)} em ${nf(A.n)} pedidos${var_(A.g,B.g)}.`;
  ks=[k('Vendas',money(A.g),`${nf(A.n)} pedidos`),k('Ticket médio',money(A.ticket),'por pedido'),k('Líder',lid?esc(lid[0]):'—',lid&&A.g?pp(lid[1]/A.g*100)+' das vendas':''),k('Tarifas',pp(A.g?A.fee/A.g*100:0),money(A.fee))]}
 return `<section class="vgv-hero vgv-mini"><div class="vgv-luz" aria-hidden="true"></div><div class="vgv-top"><div><span class="vgv-eyebrow">${esc(titulo)} · ${mesBR(m)}</span><h2>${esc(frase)}</h2></div><div class="vgv-kpis vgv-kpis4">${ks.join('')}</div></div></section>`}
// ─────────── Cancelados no marketplace (só consulta) ───────────
// Pedidos que o marketplace devolve como cancelados, mas que seguem com nota/venda no Bling. Já ficam fora das margens;
// continuam no faturamento até a nota ser cancelada ou devolvida. A busca automática no ML marca cada pedido
// (external.ml_status). Nada aqui altera pedidos.
function canceladosView(){const L=db.orders.filter(o=>o.external?.ml_status==='cancelled').sort((a,b)=>b.date.localeCompare(a.date)),tot=L.reduce((s,o)=>s+(Number(o.gross)||0),0),comNf=L.filter(o=>o.nf).length,SIT={9:'Atendido',6:'Em aberto',12:'Cancelado',15:'Em andamento'};
 const porMes={};for(const o of L){const k=o.date.slice(0,7);porMes[k]=(porMes[k]||0)+1}
 const prod=o=>(o.items||[]).map(i=>`${Number(i.qty)||1}× ${i.title||i.sku||''}`).join(' + ');
 return `<div class="notice"><b>Só para consulta.</b> Pedidos que o Mercado Livre informa como <b>cancelados</b>, mas que ainda têm venda ou nota no Bling. Já estão <b>fora das margens</b> (Radar, Formação, Promoção) e continuam no faturamento até a nota ser cancelada ou devolvida. A lista se atualiza sozinha quando a busca automática encontra novos casos.</div>
 <div class="grid kpis4"><div class="card kpi"><span class="kpil">Pedidos cancelados</span><span class="kpiv">${nf(L.length)}</span><span class="kpis">${Object.entries(porMes).sort().map(([m,n])=>`${m.slice(5)}/${m.slice(2,4)}: ${n}`).join(' · ')||'nenhum'}</span></div><div class="card kpi"><span class="kpil">Valor das notas</span><span class="kpiv">${money(tot)}</span><span class="kpis">soma dos pedidos</span></div><div class="card kpi"><span class="kpil">Com nota no Bling</span><span class="kpiv">${nf(comNf)}</span><span class="kpis">precisam de cancelamento ou devolução</span></div><div class="card kpi"><span class="kpil">Canal</span><span class="kpiv">Mercado Livre</span><span class="kpis">conferido pela API do ML</span></div></div>
 <div class="tablebox"><div class="tabletop"><div><h2>Pedidos</h2><p class="caption">Mais recentes primeiro</p></div><button class="small" data-canc-csv>${icon('download')} Exportar</button></div><div class="tablewrap"><table><thead><tr><th>Pedido ML</th><th>Data</th><th>Nota no Bling</th><th>Situação no Bling</th><th>Produtos</th><th class="num">Valor</th></tr></thead><tbody>
 ${L.map(o=>`<tr><td class="mono">${esc(o.id)}</td><td>${new Date(o.date+'T12:00').toLocaleDateString('pt-BR')}</td><td class="mono">${o.nf?esc(o.nf):'<span class="caption">sem nota</span>'}</td><td>${esc(SIT[o.external?.situacao]||o.external?.situacao||'—')}</td><td class="comfoto">${window.Estoque?.foto?.(o.items?.[0]?.sku)||''}${esc(prod(o))}</td><td class="num">${money(o.gross)}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">Nenhum pedido cancelado no marketplace com venda no Bling.</td></tr>'}</tbody></table></div></div>`}
document.addEventListener('click',e=>{if(!e.target.closest('[data-canc-csv]'))return;const L=db.orders.filter(o=>o.external?.ml_status==='cancelled').sort((a,b)=>a.date.localeCompare(b.date)),q=s=>/[;"\n]/.test(String(s))?'"'+String(s).replace(/"/g,'""')+'"':String(s);
 const linhas=[['Pedido ML','Data','Nota no Bling','Situação no Bling','Produtos','Valor'],...L.map(o=>[o.id,o.date.split('-').reverse().join('/'),o.nf||'',o.external?.situacao||'',(o.items||[]).map(i=>`${Number(i.qty)||1}x ${i.title||i.sku||''}`).join(' + '),String(Number(o.gross).toFixed(2)).replace('.',',')])];
 download('pedidos-cancelados-marketplace.csv','﻿'+linhas.map(l=>l.map(q).join(';')).join('\r\n'))});
addPage('cancelados','alert','Cancelados no marketplace',canceladosView,'Pedidos cancelados no Mercado Livre que ainda têm venda ou nota no Bling — só para consulta, fora das margens.','',()=>{});
window.TopoVendas=topoVendas;
// Venda direta e B2B ficam fora: a faixa mostra números dos marketplaces, e essas telas têm os próprios indicadores.
const TOPO_VENDAS=new Set(['metas','margem','raiox','anuncios','concorrencia','faturamento','reconcile','closing','produtos','estados','clientes']);
if(typeof render==='function'){const r0=render;render=function(){const r=r0.apply(this,arguments);try{const v=document.getElementById('view');if(v&&TOPO_VENDAS.has(page)&&!v.querySelector('.vgv-mini')&&window.Cloud?.ws)v.insertAdjacentHTML('afterbegin',topoVendas(page))}catch{}return r}}
if(navItems.filter(n=>n[0]==='dashboard').length>1)navItems.splice(navItems.map(n=>n[0]).lastIndexOf('dashboard'),1);
})();
