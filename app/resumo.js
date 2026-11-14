// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Tela inicial do E-Commerce: o "Resumo da semana" virou um painel de impacto, com tudo que a diretoria precisa ver
// ao abrir o Jarvis, sem perder o que a tela já fazia (texto pronto para WhatsApp e e-mail).
// Blocos, de cima para baixo:
//  1. Abertura com o veredito da semana numa frase e 4 indicadores grandes (vendas, margem, caixa, pendências) com a
//     tendência das últimas 8 semanas e números que sobem ao abrir.
//  2. Vendas por dia nas últimas 8 semanas: área com o período anterior tracejado, a faixa da meta diária e os marcos
//     (promoções, campanhas).
//  3. Cascata da margem dos últimos 30 dias: venda → tarifas → tributos → custo → lucro.
//  4. Canais em bolhas: faturamento × margem, tamanho = pedidos (clique abre o Radar de margem).
//  5. Mapa do Brasil por estado: faturamento, ticket, frete e vendas interestaduais a consumidor final (DIFAL).
//  6. Caixa: realizado dos últimos 14 dias e projeção de 30 dias, com o dia de menor saldo em destaque.
//  7. Metas do mês em anéis (vendas, margem, recebido).
//  8. Fila de ações ordenada pelo valor em jogo, cada uma com o botão para resolver.
//  9. Vitrine dos mais vendidos: tendência, margem por produto e alerta de ruptura (quando há estoque).
// 10. Pedidos de hoje ao vivo, modo TV (tela cheia, painéis girando) e o resumo em imagem para mandar no WhatsApp.
// Envio automático toda segunda precisa do provedor de e-mail / WhatsApp Business (ver Integrações).
(()=>{
Object.assign(paths,{doc2:'M6 3h9l3 3v15H6z M9 9h6 M9 13h6 M9 17h4',tv:'M3 5h18v12H3z M8 21h8 M12 17v4',imagem:'M3 4h18v16H3z M3 16l5-5 4 4 3-3 6 6 M15.5 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3',raio:'M13 2 4 14h7l-1 8 9-12h-7z',caixa3:'M21 8 12 3 3 8v8l9 5 9-5z M3 8l9 5 9-5 M12 13v8',sair:'M15 3h6v18h-6 M10 17l-5-5 5-5 M5 12h12'});
const iso=d=>d.toLocaleDateString('sv-SE');
const hojeIso=()=>iso(new Date());
const dia=(h,n)=>{const d=new Date(h+'T12:00:00');d.setDate(d.getDate()+n);return iso(d)};
function semanas(){const h=new Date();h.setHours(12);const seg=new Date(h);seg.setDate(h.getDate()-((h.getDay()+6)%7)-7);const dom=new Date(seg);dom.setDate(seg.getDate()+6);const s2=new Date(seg);s2.setDate(seg.getDate()-7);const d2=new Date(dom);d2.setDate(dom.getDate()-7);return {ini:iso(seg),fim:iso(dom),ini2:iso(s2),fim2:iso(d2)}}
const dBR=d=>new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
const pct=(a,b)=>b?((a/b-1)*100):null;const fp=v=>v==null?'—':`${v>=0?'+':''}${v.toFixed(1).replace('.',',')}%`;
const p1=v=>v==null||!isFinite(v)?'—':(v*100).toFixed(1).replace('.',',')+'%';
const curto=v=>{const a=Math.abs(v),s=v<0?'−':'';return a>=1e6?`${s}R$ ${(a/1e6).toFixed(2).replace('.',',')} mi`:a>=1e4?`${s}R$ ${(a/1e3).toFixed(1).replace('.',',')} mil`:s+money(a)};
const CORES={'Mercado Livre':'#f5c518','Shopee':'#ee4d2d','Magalu':'#0086ff','Mercado Pago':'#00b1ea','Bling':'#2fbf71'};
const eixo=v=>{const a=Math.abs(v);return (v<0?'−':'')+(a>=1e6?(a/1e6).toFixed(1).replace('.',',').replace(',0','')+' mi':a>=1e3?(a/1e3).toFixed(a>=1e4?0:1).replace('.',',').replace(',0','')+' mil':String(Math.round(a)))};
const cor=c=>CORES[c]||platforms[c]?.color||'#8b93a7';
const calmo=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch{return false}};
const valido=o=>o.gross>0&&o.fee<o.gross*.95; // cancelado/reembolsado fica fora das vendas

// ─────────── Dados do texto (o mesmo resumo de antes) ───────────
function dados(){const w=semanas(),em=(o,a,b)=>o.date>=a&&o.date<=b,s1=db.orders.filter(o=>em(o,w.ini,w.fim)),s0=db.orders.filter(o=>em(o,w.ini2,w.fim2)),soma=l=>l.reduce((a,o)=>a+(o.gross||0),0);
 const canais=[...new Set(s1.map(o=>o.platform))].map(c=>({c,v:soma(s1.filter(o=>o.platform===c)),n:s1.filter(o=>o.platform===c).length,v0:soma(s0.filter(o=>o.platform===c))})).sort((a,b)=>b.v-a.v);
 const itens=new Map();for(const o of s1)for(const i of o.items||[]){const k=i.title||i.sku;const x=itens.get(k)||{k,q:0,v:0};x.q+=Number(i.qty)||0;x.v+=(Number(i.qty)||0)*(Number(i.price)||0);itens.set(k,x)}
 const mg=window.Margem?.resumo?.(),cx=(()=>{try{return window.Fluxo?.resumoCaixa?.(30)}catch{return null}})();
 const hoje=hojeIso(),ab=(db.payables||[]).filter(t=>!['pago','cancelado'].includes(t.status)),venc=ab.filter(t=>t.vencimento<hoje),saldoT=t=>Math.max(0,t.valor+(t.juros||0)-(t.desconto||0)-(t.valorPago||0));
 const pend=[];const add=(t,s)=>pend.push([t,s]);
 if(venc.length)add(`${venc.length} conta(s) vencida(s)`,money(venc.reduce((a,t)=>a+saldoT(t),0)));
 for(const g of [window.Metas,window.Pagamentos,window.Faturamento,window.Estoque,window.Atendimento,window.Orcamento,window.Margem,window.NfRecebidas])for(const a of g?.avisos?.()||[])add(a[2],a[3]||'');
 const metas=(()=>{try{return window.Metas?.resumo?.()||[]}catch{return []}})();
 return {metas,w,v1:soma(s1),v0:soma(s0),n1:s1.length,n0:s0.length,canais,top:[...itens.values()].sort((a,b)=>b.v-a.v).slice(0,5),mg,cx,pend,venc,saldoT}}
function texto(d){const L=[`*Resumo da semana · ${dBR(d.w.ini)} a ${dBR(d.w.fim)}*`,'',`*Vendas:* ${money(d.v1)} em ${d.n1} pedidos (${fp(pct(d.v1,d.v0))} vs. semana anterior)`,`Ticket médio: ${money(d.n1?d.v1/d.n1:0)}`];
 for(const c of d.canais)L.push(`• ${c.c}: ${money(c.v)} · ${c.n} ped. (${fp(pct(c.v,c.v0))})`);
 if(d.top.length){L.push('','*Mais vendidos:*');d.top.forEach((t,i)=>L.push(`${i+1}. ${t.k} — ${t.q} un. · ${money(t.v)}`))}
 if(d.mg&&d.mg.venda)L.push('',`*Margem de contribuição (30 dias):* ${(d.mg.lucro/d.mg.venda*100).toFixed(1).replace('.',',')}% · ${money(d.mg.lucro)}`,`Pedidos com prejuízo: ${d.mg.prejuizo} (${money(d.mg.perda)})`);
 if(d.cx)L.push('',`*Caixa:* ${money(d.cx.hoje)} hoje${d.cx.aplic?` + ${money(d.cx.aplic)} aplicado`:''}`,`Menor saldo em 30 dias: ${money(d.cx.min)} em ${dBR(d.cx.dataMin)}${d.cx.negativos?` ⚠️ ${d.cx.negativos} dia(s) negativo(s)`:''}`);
 if(d.metas?.length){const NM={vendas:'Vendas',margem:'Margem',recebido:'Recebido'},ST={ok:'no ritmo ✅',atencao:'atenção ⚠️',abaixo:'abaixo do ritmo 🔻',cedo:'começo do mês',futuro:'',semdados:'sem dados'};L.push('','*Metas do mês:*');for(const a of d.metas)L.push(a.ind==='margem'?`• ${NM[a.ind]}: ${a.real==null?'—':a.real.toFixed(1).replace('.',',')+'%'} (meta ${Number(a.meta).toFixed(1).replace('.',',')}%) · ${ST[a.status]}`:`• ${NM[a.ind]}: ${money(a.real)} de ${money(a.meta)} (${Math.round((a.pct||0)*100)}%) · ${ST[a.status]}${a.proj!=null&&!['futuro','cedo'].includes(a.status)?` · projeção ${money(a.proj)}`:''}`)}
 L.push('',`*Pendências:*`);if(d.pend.length)d.pend.slice(0,10).forEach(p=>L.push(`• ${p[0]}${p[1]?' — '+p[1]:''}`));else L.push('• Nada pendente ✓');
 L.push('','_Gerado pelo Jarvis_');return L.join('\n')}

// ─────────── Dados do painel ───────────
let memo=null;
function painel(){const h=hojeIso(),chave=[h,db.orders.length,db.receipts.length,(db.payables||[]).length,(db.bankTx||[]).length,window.Metas?.resumo?.()?.length||0,(window.Estoque?.lista?.()||[]).length].join('|');if(memo?.chave===chave)return memo.v;
 const d=dados(),w=d.w;
 // Vendas por dia (112 dias: 56 do gráfico e 56 do período anterior) e por semana fechada (8 semanas).
 const porDia=new Map();for(const o of db.orders){if(!valido(o)||o.date<dia(h,-111))continue;const x=porDia.get(o.date)||{v:0,n:0};x.v+=o.gross;x.n++;porDia.set(o.date,x)}
 const serie=[...Array(56)].map((_,i)=>{const dd=dia(h,i-55),x=porDia.get(dd)||{v:0,n:0},a=porDia.get(dia(dd,-56))||{v:0};return {d:dd,v:x.v,n:x.n,ant:a.v}});
 const semIni=k=>dia(w.ini,-7*k),somaSem=(f,k)=>{const a=semIni(k),b=dia(a,6);let s=0;for(let dd=a;dd<=b;dd=dia(dd,1))s+=f(dd);return s};
 const vendasSem=[...Array(8)].map((_,i)=>somaSem(dd=>porDia.get(dd)?.v||0,7-i));
 // Margem (pedidos com tarifa real e custo cadastrado).
 const mpeds=(()=>{try{return window.Margem?.pedidos?.(semIni(7))||[]}catch{return []}})();
 const margemSem=[...Array(8)].map((_,i)=>{const a=semIni(7-i),b=dia(a,6),l=mpeds.filter(x=>x.o.date>=a&&x.o.date<=b),v=l.reduce((s,x)=>s+x.o.gross,0);return v?l.reduce((s,x)=>s+x.lucro,0)/v:null});
 const ini30=dia(h,-29),m30=mpeds.filter(x=>x.o.date>=ini30),somaM=f=>m30.reduce((s,x)=>s+f(x),0);
 const cascata=m30.length?{venda:somaM(x=>x.o.gross),tarifa:somaM(x=>x.o.fee),frete:somaM(x=>x.frete||0),trib:somaM(x=>x.trib),cmv:somaM(x=>x.cmv),lucro:somaM(x=>x.lucro),n:m30.length}:null;
 // Canais (30 dias).
 const o30=db.orders.filter(o=>o.date>=ini30&&valido(o)),canais=[...new Set(o30.map(o=>o.platform))].map(c=>{const l=o30.filter(o=>o.platform===c),ml=m30.filter(x=>x.o.platform===c),vm=ml.reduce((s,x)=>s+x.o.gross,0);return {c,v:l.reduce((s,o)=>s+o.gross,0),n:l.length,tarifa:l.reduce((s,o)=>s+o.fee,0),m:vm?ml.reduce((s,x)=>s+x.lucro,0)/vm:null}}).sort((a,b)=>b.v-a.v);
 // Estados (30 dias).
 const origem=(window.Marca?.uf?.()||'').toUpperCase(),ufs=new Map();
 for(const o of o30){const uf=(o.state||o.customer?.state||'').toUpperCase();if(!/^[A-Z]{2}$/.test(uf))continue;const x=ufs.get(uf)||{uf,v:0,n:0,frete:0,nf:0,cf:0};x.v+=o.gross;x.n++;if(o.shipping>0){x.frete+=o.shipping;x.nf++}if(String(o.customer?.doc||'').replace(/\D/g,'').length===11)x.cf++;ufs.set(uf,x)}
 const listaUf=[...ufs.values()].sort((a,b)=>b.v-a.v),totUf=listaUf.reduce((s,x)=>s+x.v,0),inter=origem?listaUf.filter(x=>x.uf!==origem):[],interCF=inter.reduce((s,x)=>s+x.cf,0);
 // Caixa: saldo ao fim de cada semana (8) e o diário (14 realizados + 30 projetados).
 const contas=(db.bankAccounts||[]).filter(a=>a.tipo!=='aplicacao'&&a.ativo!==false),txs=(db.bankTx||[]).filter(t=>contas.some(a=>a.id===t.contaId)&&t.status!=='ignorado'&&t.origem!=='espelho');
 const saldoAte=dd=>contas.reduce((s,a)=>s+Number(a.saldoInicial||0)+txs.filter(t=>t.contaId===a.id&&t.data>(a.dataSaldoInicial||'0000')&&t.data<=dd).reduce((x,t)=>x+t.valor,0),0);
 const caixaSem=contas.length?[...Array(8)].map((_,i)=>saldoAte(dia(semIni(7-i),6))):[];
 const diario=(()=>{try{return contas.length?window.Fluxo?.diario?.(30,14):null}catch{return null}})();
 // Metas, ações e vitrine.
 const metas=d.metas;
 const acoes=filaAcoes(d,h);
 const prod=new Map();for(const o of db.orders){if(!valido(o)||o.date<semIni(7))continue;for(const it of o.items||[]){const k=String(it.sku||it.title||'');if(!k)continue;const x=prod.get(k)||{sku:it.sku,t:it.title||it.sku,v:0,q:0,sem:Array(8).fill(0),lucro:0,vm:0};const q=Number(it.qty)||0,v=q*(Number(it.price)||0);
  if(o.date>=ini30){x.v+=v;x.q+=q}const s=Math.floor((Math.round((new Date(o.date+'T12:00:00')-new Date(semIni(7)+'T12:00:00'))/864e5))/7);if(s>=0&&s<8)x.sem[s]+=q;prod.set(k,x)}}
 for(const x of m30){const its=x.o.items||[],tot=its.reduce((s,i)=>s+(Number(i.qty)||0)*(Number(i.price)||0),0)||1;for(const it of its){const p=prod.get(String(it.sku||it.title||''));if(!p)continue;const part=(Number(it.qty)||0)*(Number(it.price)||0)/tot;p.lucro+=x.lucro*part;p.vm+=x.o.gross*part}}
 const est=new Map((window.Estoque?.lista?.()||[]).map(p=>[String(p.id),p]));
 const vitrine=[...prod.values()].filter(p=>p.v>0).sort((a,b)=>b.v-a.v).slice(0,6).map(p=>{const e=est.get(String(p.sku)),saldo=e&&Number.isFinite(Number(e.saldo))?Number(e.saldo):null,cob=saldo!=null&&p.q?saldo/(p.q/30):null;return {...p,m:p.vm?p.lucro/p.vm:null,foto:e?.imagem||'',cat:(db.products||[]).find(x=>String(x.id)===String(p.sku))?.categoria||'',saldo,cob}});
 const deHoje=db.orders.filter(o=>o.date===h&&valido(o));
 const v={d,serie,vendasSem,margemSem,cascata,canais,listaUf,totUf,origem,inter,interCF,caixaSem,diario,metas,acoes,vitrine,deHoje,metaDia:metaDiaria(metas,h),marcos:(db.gerencial?.marcos||[]).filter(m=>m.data>=serie[0].d&&m.data<=h)};
 memo={chave,v};return v}
function metaDiaria(metas,h){const a=(metas||[]).find(x=>x.ind==='vendas');if(!a?.meta)return null;const [y,m]=h.split('-').map(Number);return a.meta/new Date(y,m,0).getDate()}
// Fila de ações: cada item com o valor em jogo, ordenados do maior para o menor.
function filaAcoes(d,h){const A=[],sNum=s=>{const m=String(s||'').match(/R\$\s?-?[\d.]+,\d{2}/);return m?Math.abs(Number(m[0].replace(/[^\d,-]/g,'').replace(/\./g,'').replace(',','.'))):0};
 if(d.venc.length)A.push({ic:'alert',tom:'bad',t:`${d.venc.length} conta(s) vencida(s) sem pagamento`,s:'Juros e multa começam a contar',v:d.venc.reduce((a,t)=>a+d.saldoT(t),0),nav:'pagar',b:'Pagar'});
 // Atrasados, liberações sem pedido, divergências e sem nota: as mesmas regras e recortes da tela Pendências.
 const P=window.Pendencias?.conciliacao?.(h)||{atras:[],div:[],soltas:[],semNf:[]},soma=l=>l.reduce((s,i)=>s+Math.abs(i.v||0),0);
 if(P.atras.length)A.push({ic:'clock',tom:'warn',t:`${P.atras.length} repasse(s) atrasado(s)`,s:'Já deveriam ter caído na conta · últimos 120 dias',v:soma(P.atras),nav:'pending',b:'Cobrar'});
 if(P.soltas.length)A.push({ic:'link',tom:'info',t:`${P.soltas.length} liberação(ões) sem pedido`,s:'Vincule para fechar a conciliação · últimos 120 dias',v:soma(P.soltas),nav:'pending',b:'Conciliar'});
 if(P.div.length)A.push({ic:'alert',tom:'bad',t:`${P.div.length} repasse(s) com valor diferente`,s:'Previsto ≠ recebido · últimos 120 dias',v:soma(P.div),nav:'pending',b:'Contestar'});
 if(d.mg?.prejuizo)A.push({ic:'chart',tom:'bad',t:`${d.mg.prejuizo} pedido(s) com prejuízo em 30 dias`,s:'Veja o preço mínimo por canal',v:Math.abs(d.mg.perda||0),nav:'margem',b:'Ver margem'});
 if(P.semNf.length)A.push({ic:'file',tom:'warn',t:`${P.semNf.length} pedido(s) sem nota fiscal há 2 dias ou mais`,s:'Emita antes do prazo de envio',v:soma(P.semNf),nav:'pending',b:'Emitir'});
 const vistos=new Set(['contas','vencid','prejuízo','prejuizo']);
 for(const g of [window.Pagamentos,window.Faturamento,window.Estoque,window.Atendimento,window.Orcamento,window.NfRecebidas])for(const a of g?.avisos?.()||[]){if([...vistos].some(x=>String(a[2]).toLowerCase().includes(x)))continue;A.push({ic:a[1]||'alert',tom:a[0]==='bad'?'bad':a[0]==='warn'?'warn':'info',t:a[2],s:a[3]||'',v:sNum(a[2]),nav:a[4]||'',b:'Abrir'})}
 return A.sort((a,b)=>b.v-a.v)}

// ─────────── Desenho ───────────
const W=(n,dec=0)=>Number(n).toFixed(dec);
function spark(l,cls=''){const ok=l.filter(x=>x!=null);if(ok.length<2)return '';const mn=Math.min(...ok),mx=Math.max(...ok),r=mx-mn||1,pts=l.map((v,i)=>v==null?null:[i*100/(l.length-1),28-((v-mn)/r)*24]).filter(Boolean);
 const ln=pts.map((p,i)=>`${i?'L':'M'}${W(p[0],1)},${W(p[1],1)}`).join(' ');
 return `<svg class="rzspark ${cls}" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><path class="a" d="${ln} L100,32 L0,32 Z"/><path class="l" d="${ln}"/><circle cx="${W(pts.at(-1)[0],1)}" cy="${W(pts.at(-1)[1],1)}" r="2.2"/></svg>`}
const num=(v,fmt)=>`<span class="rznum" data-rz-num="${Number(v)||0}" data-rz-fmt="${fmt}">${fmt==='pct'?p1(v):fmt==='int'?Math.round(v):money(v)}</span>`;
function veredito(P){const d=P.d,v=pct(d.v1,d.v0),lider=[...d.canais].filter(c=>c.v0).sort((a,b)=>pct(b.v,b.v0)-pct(a.v,a.v0))[0],mg=d.mg?.venda?d.mg.lucro/d.mg.venda:null,metaM=d.metas?.find(a=>a.ind==='margem')?.meta,partes=[];
 const tom=v==null?'':v>=5?'Semana forte':v>=0?'Semana estável':v>-10?'Semana mais fraca':'Semana de queda';
 partes.push(v==null?`Vendas de ${curto(d.v1)} na semana.`:`${tom}: vendas ${v>=0?'subiram':'caíram'} ${Math.abs(v).toFixed(1).replace('.',',')}% (${curto(d.v1)})${lider&&pct(lider.v,lider.v0)>0?`, puxadas pelo ${lider.c} (${fp(pct(lider.v,lider.v0))})`:''}.`);
 if(mg!=null)partes.push(`Margem de ${p1(mg)}${metaM?mg*100>=metaM?`, acima da meta de ${String(metaM).replace('.',',')}%`:`, abaixo da meta de ${String(metaM).replace('.',',')}%`:''}.`);
 if(d.cx)partes.push(d.cx.negativos?`Atenção ao caixa: ${d.cx.negativos} dia(s) negativo(s) à frente.`:d.cx.min<d.cx.hoje*.4?`Caixa aperta em ${dBR(d.cx.dataMin)} (${curto(d.cx.min)}).`:'Caixa folgado nos próximos 30 dias.');
 partes.push(P.acoes.length?`${P.acoes.length} ${P.acoes.length>1?'pontos pedem':'ponto pede'} sua atenção.`:'Nada pendente.');
 return {txt:partes.join(' '),tom:v==null?'':v>=0?'bom':'ruim'}}
function saudacao(){const h=new Date().getHours();return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'}

function blocoAbertura(P){const d=P.d,ve=veredito(P),v=pct(d.v1,d.v0),mg=d.mg?.venda?d.mg.lucro/d.mg.venda:null,mgAnt=P.margemSem.at(-2),hojeV=P.deHoje.reduce((s,o)=>s+o.gross,0);
 const tile=(rot,valor,sub,sp,tom='',nav='')=>`<button type="button" class="rztile ${tom}" ${nav?`data-nav="${nav}"`:''}><span class="rzrot">${rot}</span><span class="rzval">${valor}</span><span class="rzsub">${sub}</span>${sp}</button>`;
 return `<section class="rzhero ${ve.tom}" aria-label="Resumo da semana">
  <div class="rzhero-top"><div><p class="rzola">${saudacao()} · ${esc(window.Marca?.nome?.()||'')} · semana de ${dBR(d.w.ini)} a ${dBR(d.w.fim)}</p><h2 class="rzverd">${esc(ve.txt)}</h2></div>
   <div class="rzvivo" title="Vendas de hoje até agora"><span class="rzpulso" aria-hidden="true"></span><span>Hoje</span><strong>${num(hojeV,'brl')}</strong><small>${P.deHoje.length} pedido(s)</small></div></div>
  <div class="rzacoes"><button class="primary small" data-rs="copiar">${icon('doc2')} Copiar resumo</button><a class="btnlink small" data-rs-link="wa" href="#" target="_blank" rel="noopener">Enviar no WhatsApp</a><a class="btnlink small" data-rs-link="mail" href="#">Enviar por e-mail</a><button class="small" data-rs="imagem">${icon('imagem')} Imagem do resumo</button><button class="small" data-rs="tv">${icon('tv')} Modo TV</button></div>
  <div class="rztiles">
   ${tile('Vendas da semana',num(d.v1,'brl'),`<b class="${v!=null&&v<0?'red':'green'}">${fp(v)}</b> vs. anterior · ${d.n1} pedidos`,spark(P.vendasSem),'','dashboard')}
   ${tile('Margem de contribuição · 30 d',mg==null?'—':num(mg,'pct'),d.mg?`${curto(d.mg.lucro)} de lucro${mgAnt!=null&&mg!=null?` · <b class="${mg>=mgAnt?'green':'red'}">${(mg-mgAnt>=0?'+':'')+((mg-mgAnt)*100).toFixed(1).replace('.',',')} p.p.</b> na semana`:''}`:'cadastre o custo dos produtos',spark(P.margemSem,'roxo'),'','margem')}
   ${tile('Caixa hoje',d.cx?num(d.cx.hoje,'brl'):'—',d.cx?`menor em 30 d: ${curto(d.cx.min)} (${dBR(d.cx.dataMin)})`:'importe o extrato do banco',spark(P.caixaSem,'azul'),d.cx?.negativos?'alerta':'','fluxo')}
   ${tile('Pendências',num(P.acoes.length,'int'),P.acoes.length?`${curto(P.acoes.reduce((s,a)=>s+a.v,0))} em jogo`:'tudo em dia ✓',`<span class="rzchips">${P.acoes.slice(0,3).map(a=>`<i class="${a.tom}"></i>`).join('')}</span>`,P.acoes.length?'ouro':'','pending')}
  </div></section>`}

function blocoVendas(P){const s=P.serie,X0=40,X1=788,Y0=22,Y1=262,mx=Math.max(1,...s.map(x=>Math.max(x.v,x.ant)),P.metaDia?P.metaDia*1.15:0),nice=(()=>{const p=10**Math.floor(Math.log10(mx)),f=mx/p;return (f<=2?2:f<=5?5:10)*p})();
 const x=i=>X0+(X1-X0)*i/(s.length-1),y=v=>Y1-(Y1-Y0)*v/nice,ln=k=>s.map((p,i)=>`${i?'L':'M'}${W(x(i),1)},${W(y(p[k]),1)}`).join(' ');
 const grade=[0,.5,1].map(f=>`<line class="g" x1="${X0}" x2="${X1}" y1="${W(y(nice*f),1)}" y2="${W(y(nice*f),1)}"/><text class="ax" x="${X0-8}" y="${W(y(nice*f)+4,1)}" text-anchor="end">${f?eixo(nice*f):'0'}</text>`).join('');
 const meta=P.metaDia?`<rect class="meta" x="${X0}" width="${X1-X0}" y="${W(y(P.metaDia*1.1),1)}" height="${W(y(P.metaDia*.9)-y(P.metaDia*1.1),1)}"/><text class="metat" x="${X1}" y="${W(y(P.metaDia*1.1)-5,1)}" text-anchor="end">meta diária ${curto(P.metaDia)}</text>`:'';
 const segs=s.map((p,i)=>i&&new Date(p.d+'T12:00:00').getDay()===1?`<text class="ax" x="${W(x(i),1)}" y="${Y1+18}" text-anchor="middle">${dBR(p.d)}</text>`:'').join('');
 const marcos=P.marcos.map(m=>{const i=s.findIndex(p=>p.d===m.data);if(i<0)return '';return `<line class="mk" x1="${W(x(i),1)}" x2="${W(x(i),1)}" y1="${Y0}" y2="${Y1}"/><g class="mkf" transform="translate(${W(x(i),1)},${Y0})"><circle r="4"/></g><text class="mkt" x="${W(x(i)+7,1)}" y="${Y0+4}">${esc(m.texto)}</text>`}).join('');
 const alvo=s.map((p,i)=>`<rect class="hit" x="${W(x(i)-(X1-X0)/(s.length-1)/2,1)}" y="${Y0}" width="${W((X1-X0)/(s.length-1),1)}" height="${Y1-Y0}" data-tip="${esc(`<b>${new Date(p.d+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'})}</b><br>${money(p.v)} · ${p.n} pedidos<br><span>8 semanas antes: ${money(p.ant)}</span>`)}" data-i="${i}"/>`).join('');
 const tot=s.reduce((a,p)=>a+p.v,0),ant=s.reduce((a,p)=>a+p.ant,0),ult=s.at(-1);
 return `<section class="card rzcard rzvendas"><div class="rzhead"><div><h3>Vendas por dia</h3><p class="caption">Últimas 8 semanas · ${curto(tot)} <b class="${tot>=ant?'green':'red'}">${fp(pct(tot,ant))}</b> vs. as 8 anteriores</p></div>
  <div class="rzleg"><span><i class="lv"></i>Vendas</span><span><i class="la"></i>8 semanas antes</span>${P.metaDia?'<span><i class="lm"></i>Meta</span>':''}</div></div>
  <svg class="rzarea" viewBox="0 0 800 288" role="img" aria-label="Vendas por dia nas últimas 8 semanas"><defs><linearGradient id="rzgA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb(var(--ar))" stop-opacity=".38"/><stop offset="1" stop-color="rgb(var(--ar))" stop-opacity="0"/></linearGradient></defs>
   ${grade}${meta}${marcos}<path class="ant" d="${ln('ant')}"/><path class="ar" d="${ln('v')} L${X1},${Y1} L${X0},${Y1} Z"/><path class="ln" d="${ln('v')}"/><circle class="pt" cx="${W(x(s.length-1),1)}" cy="${W(y(ult.v),1)}" r="4.5"/>${segs}<line class="cross" x1="0" x2="0" y1="${Y0}" y2="${Y1}"/>${alvo}</svg></section>`}

function blocoMetas(P){const NM={vendas:'Vendas',margem:'Margem',recebido:'Recebido'},T={ok:['No ritmo','ok'],atencao:['Atenção','warn'],abaixo:['Abaixo do ritmo','bad'],cedo:['Começo do mês','info'],futuro:['—',''],semdados:['Sem dados','']};
 const ms=P.metas||[];if(!ms.length)return `<section class="card rzcard rzmetas"><div class="rzhead"><h3>Metas do mês</h3></div><div class="rzvazio"><p>Defina metas de vendas, margem e recebido e acompanhe o ritmo aqui.</p><button class="small primary" data-nav="metas">Definir metas</button></div></section>`;
 const anel=a=>{const f=a.ind==='margem'?(a.real!=null&&a.meta?Math.min(1.2,a.real/a.meta):0):Math.min(1.2,a.pct||0),c=2*Math.PI*42,t=T[a.status]||['',''];
  return `<div class="rzanel ${t[1]}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="tr" cx="50" cy="50" r="42"/><circle class="vl" cx="50" cy="50" r="42" stroke-dasharray="${W(c*Math.min(1,f),1)} ${W(c,1)}" data-rz-anel="${W(c*Math.min(1,f),1)}"/></svg>
   <div class="rzanel-c"><strong>${a.ind==='margem'?(a.real==null?'—':a.real.toFixed(1).replace('.',',')+'%'):Math.round((a.pct||0)*100)+'%'}</strong><small>${a.ind==='margem'?'meta '+String(a.meta).replace('.',',')+'%':'da meta'}</small></div>
   <span class="rzanel-n">${NM[a.ind]||a.ind}</span><span class="badge ${t[1]}">${t[0]}</span>${a.ind!=='margem'&&a.proj!=null&&!['futuro','cedo'].includes(a.status)?`<small class="caption" title="Projeção de fechamento do mês">vai a ${curto(a.proj).replace('R$ ','')} de ${curto(a.meta).replace('R$ ','')}</small>`:''}</div>`};
 return `<section class="card rzcard rzmetas"><div class="rzhead"><h3>Metas do mês</h3><button class="quiet small" data-nav="metas">Ajustar</button></div><div class="rzaneis">${ms.map(anel).join('')}</div></section>`}

function blocoCascata(P){const c=P.cascata;if(!c)return `<section class="card rzcard"><div class="rzhead"><h3>Para onde vai o dinheiro de cada venda</h3></div><div class="rzvazio"><p>Cadastre o custo dos produtos para ver a cascata da margem.</p><button class="small primary" data-nav="cadprodutos">Cadastrar custos</button></div></section>`;
 const passos=[['Venda',c.venda,'tot'],['Tarifas e frete',-c.tarifa,'neg'],['Tributos',-c.trib,'neg'],['Custo dos produtos',-c.cmv,'neg'],['Lucro',c.lucro,c.lucro>=0?'pos':'negt']];
 const X0=12,X1=528,bw=(X1-X0)/passos.length,Y0=26,Y1=200,y=v=>Y1-(Y1-Y0)*v/c.venda;let acum=0;
 const barras=passos.map(([n,v,k],i)=>{let a,b;if(k==='tot'){a=0;b=v;acum=v}else if(k==='neg'){a=acum+v;b=acum;acum+=v}else{a=Math.min(0,v);b=Math.max(0,v)}const x=X0+i*bw+10,h=Math.max(2,y(a)-y(b));
  return `<rect class="cb ${k}" x="${W(x,1)}" y="${W(y(b),1)}" width="${W(bw-20,1)}" height="${W(h,1)}" rx="4" data-tip="${esc(`<b>${n}</b><br>${money(Math.abs(v))} · ${p1(Math.abs(v)/c.venda)} da venda`)}"/>${i<passos.length-1?`<line class="cl" x1="${W(x+bw-20,1)}" x2="${W(x+bw,1)}" y1="${W(y(acum),1)}" y2="${W(y(acum),1)}"/>`:''}
   <text class="cv" x="${W(x+(bw-20)/2,1)}" y="${W(y(b)-7,1)}" text-anchor="middle">${k==='tot'?curto(v):(v<0?'−':'')+p1(Math.abs(v)/c.venda)}</text><text class="cn" x="${W(x+(bw-20)/2,1)}" y="${Y1+18}" text-anchor="middle">${n}</text>`}).join('');
 return `<section class="card rzcard"><div class="rzhead"><div><h3>Para onde vai o dinheiro de cada venda</h3><p class="caption">Últimos 30 dias · ${c.n} pedidos com custo e tarifa conferidos · de cada R$ 100 vendidos, sobram <b class="${c.lucro>=0?'green':'red'}">${money(c.lucro/c.venda*100)}</b></p></div><button class="quiet small" data-nav="margem">Radar de margem</button></div>
  <svg class="rzcasc" viewBox="0 0 540 228" role="img" aria-label="Cascata da margem">${barras}</svg></section>`}

function blocoCanais(P){const l=P.canais.filter(c=>c.v>0);if(!l.length)return '';const comM=l.filter(c=>c.m!=null),mlo=comM.length?Math.min(...comM.map(c=>c.m)):0,mhi=comM.length?Math.max(...comM.map(c=>c.m)):.1,mmin=Math.floor((mlo-.06)*20)/20,mmax=Math.ceil((mhi+.06)*20)/20,vmax=Math.max(...l.map(c=>c.v)),nmax=Math.max(...l.map(c=>c.n));
 const X0=44,X1=512,Y0=24,Y1=196,x=v=>X0+(X1-X0)*v/(vmax*1.12),y=m=>Y1-(Y1-Y0)*(m-mmin)/((mmax-mmin)||1);
 const bol=l.map(c=>{const r=10+26*Math.sqrt(c.n/nmax),cy=c.m==null?Y1-8:y(c.m);return `<g class="bol" data-nav="margem" role="button" tabindex="0" aria-label="${esc(c.c)}" data-tip="${esc(`<b>${c.c}</b><br>${money(c.v)} · ${c.n} pedidos<br>margem ${p1(c.m)} · tarifa ${p1(c.tarifa/c.v)}`)}"><circle cx="${W(x(c.v),1)}" cy="${W(cy,1)}" r="${W(r,1)}" style="--c:${cor(c.c)}"/><text x="${W(x(c.v),1)}" y="${W(cy-r-6,1)}" text-anchor="middle">${esc(c.c)}</text></g>`}).join('');
 const zero=mmin<0&&mmax>0?`<line class="z" x1="${X0}" x2="${X1}" y1="${W(y(0),1)}" y2="${W(y(0),1)}"/>`:'';
 const tic=[mmin,(mmin+mmax)/2,mmax].map(m=>`<text class="ax" x="${X0-6}" y="${W(y(m)+4,1)}" text-anchor="end">${Math.round(m*100)}%</text>`).join('');
 return `<section class="card rzcard"><div class="rzhead"><div><h3>Canais: faturamento × margem</h3><p class="caption">30 dias · tamanho da bolha = pedidos · clique para abrir o Radar de margem</p></div></div>
  <svg class="rzbol" viewBox="0 0 540 228" role="img" aria-label="Canais por faturamento e margem"><line class="g" x1="${X0}" x2="${X1}" y1="${Y1}" y2="${Y1}"/>${zero}${tic}<text class="ax" x="${X1}" y="${Y1+20}" text-anchor="end">faturamento →</text><text class="ax" x="${X0}" y="${Y0-8}">margem ↑</text>${bol}</svg>
  <div class="rzleg rzleg-b">${l.map(c=>`<span><i style="background:${cor(c.c)}"></i>${esc(c.c)} · ${p1(c.v/l.reduce((s,x)=>s+x.v,0))}</span>`).join('')}</div></section>`}

let geoCache=null;
function geo(){if(geoCache)return geoCache;const G=window.MapaBRGeo;if(!G)return null;const k=10.4,cl=Math.cos(15*Math.PI/180),px=lon=>(lon+74.2)*k*cl,py=lat=>(5.4-lat)*k;
 geoCache=Object.fromEntries(Object.entries(G).map(([uf,polys])=>[uf,polys.map(p=>{let s='';for(let i=0;i<p.length;i+=2)s+=(i?'L':'M')+W(px(p[i]),1)+','+W(py(p[i+1]),1);return s+'Z'}).join(' ')]));return geoCache}
function blocoMapa(P){const g=geo(),l=P.listaUf;if(!g||!l.length)return '';const mx=Math.max(...l.map(x=>x.v)),by=new Map(l.map(x=>[x.uf,x]));
 const nivel=v=>!v?0:Math.min(5,1+Math.floor(4*Math.sqrt(v/mx)));
 const formas=Object.entries(g).map(([uf,d])=>{const x=by.get(uf);return `<path class="uf n${nivel(x?.v)}${uf===P.origem?' orig':''}" d="${d}" data-tip="${esc(x?`<b>${uf}</b><br>${money(x.v)} · ${x.n} pedidos (${p1(x.v/P.totUf)})<br>ticket ${money(x.v/x.n)}${x.nf?` · frete médio ${money(x.frete/x.nf)}`:''}`:`<b>${uf}</b><br>sem vendas em 30 dias`)}"/>`}).join('');
 const tk=[...l].filter(x=>x.n>=5).sort((a,b)=>b.v/b.n-a.v/a.n)[0],fr=[...l].filter(x=>x.nf>=3).sort((a,b)=>b.frete/b.nf-a.frete/a.nf)[0],nInter=P.inter.reduce((s,x)=>s+x.n,0),nTot=l.reduce((s,x)=>s+x.n,0);
 return `<section class="card rzcard rzmapa"><div class="rzhead"><div><h3>Para onde a loja vende</h3><p class="caption">30 dias · faturamento por estado</p></div><button class="quiet small" data-nav="crmgeo">Mapa completo</button></div>
  <div class="rzmapa-g"><svg class="rzbr" viewBox="0 0 440 400" role="img" aria-label="Mapa do Brasil por faturamento">${formas}</svg>
  <div class="rzmapa-l">${l.slice(0,5).map((x,i)=>`<div class="rzuf"><span>${i+1}. ${x.uf}</span><i><b style="width:${W(x.v/mx*100)}%"></b></i><em>${p1(x.v/P.totUf)}</em></div>`).join('')}
   <div class="rzfatos">${tk?`<p><b>Maior ticket:</b> ${tk.uf}, ${money(tk.v/tk.n)}</p>`:''}${fr?`<p><b>Frete mais caro:</b> ${fr.uf}, ${money(fr.frete/fr.nf)} por pedido</p>`:''}${P.origem&&nTot?`<p><b>Fora de ${P.origem}:</b> ${p1(nInter/nTot)} dos pedidos${P.interCF?`, ${P.interCF} para consumidor final (geram DIFAL)`:''}</p>`:''}</div>
   <div class="rzescala" aria-hidden="true"><span>menos</span>${[1,2,3,4,5].map(n=>`<i class="n${n}"></i>`).join('')}<span>mais</span></div></div></div></section>`}

function blocoCaixa(P){const D=P.diario;if(!D?.L?.length)return `<section class="card rzcard"><div class="rzhead"><h3>Caixa dos próximos 30 dias</h3></div><div class="rzvazio"><p>Cadastre a conta do banco e importe o extrato para ver a projeção do caixa.</p><button class="small primary" data-nav="cadcontas">Cadastrar conta</button></div></section>`;
 const L=D.L,vals=L.map(l=>l.saldo),mn=Math.min(0,...vals),mx=Math.max(...vals)*1.08||1,X0=50,X1=520,Y0=20,Y1=176,x=i=>X0+(X1-X0)*i/(L.length-1),y=v=>Y1-(Y1-Y0)*(v-mn)/(mx-mn||1);
 const iHoje=L.findIndex(l=>!l.real),fut=L.slice(Math.max(0,iHoje-1)),minF=fut.reduce((m,l)=>l.saldo<m.saldo?l:m,fut[0]),iMin=L.indexOf(minF);
 const ln=(a,b)=>L.slice(a,b).map((l,j)=>`${j?'L':'M'}${W(x(a+j),1)},${W(y(l.saldo),1)}`).join(' ');
 const area=`${ln(Math.max(0,iHoje-1),L.length)} L${X1},${Y1} L${W(x(Math.max(0,iHoje-1)),1)},${Y1} Z`;
 const alvo=L.map((l,i)=>`<rect class="hit" x="${W(x(i)-(X1-X0)/(L.length-1)/2,1)}" y="${Y0}" width="${W((X1-X0)/(L.length-1),1)}" height="${Y1-Y0}" data-i="${i}" data-tip="${esc(`<b>${new Date(l.d+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'})}</b> · ${l.real?'realizado':'previsto'}<br>saldo ${money(l.saldo)}<br><span>entra ${money(l.e)} · sai ${money(l.x)}</span>`)}"/>`).join('');
 const neg=minF.saldo<0,tom=neg?'red':minF.saldo<D.hojeSaldo*.4?'gold':'green';
 return `<section class="card rzcard"><div class="rzhead"><div><h3>Caixa: 14 dias atrás e 30 à frente</h3><p class="caption">Hoje ${money(D.hojeSaldo)}${D.aplic?` + ${curto(D.aplic)} aplicado`:''} · menor saldo previsto <b class="${tom}">${money(minF.saldo)}</b> em ${dBR(minF.d)}</p></div></div>
  <svg class="rzcx" viewBox="0 0 540 200" role="img" aria-label="Saldo de caixa realizado e previsto"><defs><linearGradient id="rzgC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--rz-azul)" stop-opacity=".32"/><stop offset="1" stop-color="var(--rz-azul)" stop-opacity="0"/></linearGradient></defs>
   ${mn<0?`<line class="z" x1="${X0}" x2="${X1}" y1="${W(y(0),1)}" y2="${W(y(0),1)}"/>`:''}<line class="g" x1="${X0}" x2="${X1}" y1="${Y1}" y2="${Y1}"/>
   <text class="ax" x="${X0-6}" y="${W(y(mx/1.08)+4,1)}" text-anchor="end">${eixo(mx/1.08)}</text><text class="ax" x="${X0-6}" y="${W(y(Math.max(mn,0))+4,1)}" text-anchor="end">${mn<0?eixo(mn):'0'}</text>
   <path class="real" d="${ln(0,Math.max(1,iHoje))}"/><path class="ar" d="${area}"/><path class="prev" d="${ln(Math.max(0,iHoje-1),L.length)}"/>
   <line class="hoje" x1="${W(x(iHoje),1)}" x2="${W(x(iHoje),1)}" y1="${Y0}" y2="${Y1}"/><text class="ax" x="${W(x(iHoje),1)}" y="${Y1+16}" text-anchor="middle">hoje</text>
   <circle class="min ${tom}" cx="${W(x(iMin),1)}" cy="${W(y(minF.saldo),1)}" r="6"/><text class="mint" x="${W(Math.min(X1-60,Math.max(X0+60,x(iMin))),1)}" y="${W(Math.min(Y1-6,y(minF.saldo)+22),1)}" text-anchor="middle">menor: ${curto(minF.saldo)}</text>
   <text class="ax" x="${X1}" y="${Y1+16}" text-anchor="end">${dBR(L.at(-1).d)}</text><line class="cross" x1="0" x2="0" y1="${Y0}" y2="${Y1}"/>${alvo}</svg>
  <div class="rzbts"><button class="small" data-nav="fluxo">Ver fluxo de caixa</button><button class="small" data-nav="pagar">Contas a pagar</button><button class="small" data-nav="reconcile">Repasses a receber</button></div></section>`}

function blocoFila(P){const A=P.acoes;return `<section class="card rzcard rzfila"><div class="rzhead"><div><h3>O que fazer primeiro</h3><p class="caption">Ordenado pelo valor em jogo</p></div><span class="badge ${A.length?'warn':'ok'}">${A.length||'✓'}</span></div>
  ${A.length?`<div class="rzfila-l">${A.slice(0,6).map(a=>`<div class="rzacao ${a.tom}"><span class="rzacao-i">${icon(a.ic)}</span><div><strong>${esc(a.t)}</strong><small>${esc(a.s)}</small></div><em>${a.v?curto(a.v):''}</em>${a.nav?`<button class="small" data-nav="${esc(a.nav)}">${esc(a.b)}</button>`:''}</div>`).join('')}</div>`:'<div class="rzvazio"><p>Nada pendente. Tudo conciliado, pago e com nota. ✓</p></div>'}</section>`}

const ICONE_CAT={'Áudio':'M4 14v-2a8 8 0 0 1 16 0v2 M4 14h3v6H4z M17 14h3v6h-3z','Energia':'M13 2 4 14h7l-1 8 9-12h-7z','Vestíveis':'M8 3h8l1 4v10l-1 4H8l-1-4V7z M9 9h6v6H9z','Informática':'M3 5h18v11H3z M1 19h22','Casa':'M3 11 12 4l9 7 M5 10v10h14V10','Foto e vídeo':'M3 7h4l2-3h6l2 3h4v13H3z M12 17a4 4 0 1 1 0-8 4 4 0 0 1 0 8','Acessórios de celular':'M7 2h10v20H7z M11 18h2'};
function fotoProd(p){if(p.foto)return `<img src="${esc(p.foto)}" alt="" loading="lazy">`;const h=[...String(p.sku||p.t)].reduce((s,c)=>s+c.charCodeAt(0),0)%360;
 return `<svg viewBox="0 0 24 24" aria-hidden="true" style="--h:${h}"><path d="${ICONE_CAT[p.cat]||paths.caixa3}"/></svg>`}
function blocoVitrine(P){const l=P.vitrine;if(!l.length)return '';const mx=Math.max(...l.map(p=>p.v));
 return `<section class="card rzcard rzvit"><div class="rzhead"><div><h3>Vitrine dos mais vendidos</h3><p class="caption">30 dias · tendência de unidades em 8 semanas</p></div><button class="quiet small" data-nav="crmprodutos">Todos os produtos</button></div>
  <div class="rzvit-g">${l.map((p,i)=>`<article class="rzprod"><div class="rzfoto">${fotoProd(p)}<span class="rzpos">${i+1}º</span>${p.cob!=null&&p.cob<15?`<span class="rzrupt" title="Estoque para ${Math.max(0,Math.round(p.cob))} dia(s)">${icon('alert')} ${p.saldo<=0?'Sem estoque':`${Math.max(0,Math.round(p.cob))} dias`}</span>`:''}</div>
   <strong title="${esc(p.t)}">${esc(p.t)}</strong><div class="rzprod-n"><span>${curto(p.v)}</span><small>${p.q} un.</small></div>
   <div class="rzprod-b"><i style="width:${W(p.v/mx*100)}%"></i></div><div class="rzprod-r">${spark(p.sem,'fino')}${p.m!=null?`<span class="rzmg ${p.m<.05?'bad':p.m<.15?'warn':'ok'}" title="Margem de contribuição">${p1(p.m)}</span>`:''}</div></article>`).join('')}</div></section>`}

function blocoFeed(P){const l=[...P.deHoje].reverse().slice(0,8),tot=P.deHoje.reduce((s,o)=>s+o.gross,0);
 return `<section class="card rzcard rzfeed"><div class="rzhead"><div><h3><span class="rzpulso" aria-hidden="true"></span> Pedidos de hoje</h3><p class="caption">${P.deHoje.length} pedido(s) · ${money(tot)}</p></div><button class="quiet small" data-nav="dashboard">Visão geral</button></div>
  ${l.length?`<ul class="rzfeed-l">${l.map((o,i)=>`<li style="--i:${i}">${logo(o.platform)}<div><strong>${esc(o.items?.[0]?.title||'Pedido '+o.id)}${(o.items?.length||0)>1?` <small>+${o.items.length-1}</small>`:''}</strong><small>${esc(o.platform)} · ${esc(o.state||o.customer?.state||'')}</small></div><em>${money(o.gross)}</em></li>`).join('')}</ul>`:'<div class="rzvazio"><p>Nenhum pedido hoje ainda.</p></div>'}</section>`}

function view(){const P=painel(),t=texto(P.d);
 return `<div class="rz">${blocoAbertura(P)}
  <div class="rzgrid g21">${blocoVendas(P)}${blocoMetas(P)}</div>
  <div class="rzgrid g11">${blocoCascata(P)}${blocoCanais(P)}</div>
  <div class="rzgrid g11">${blocoMapa(P)}${blocoCaixa(P)}</div>
  <div class="rzgrid g11">${blocoFila(P)}${blocoFeed(P)}</div>
  ${blocoVitrine(P)}
  <details class="card rzcard rztexto"><summary><h3>Texto pronto para WhatsApp e e-mail</h3><span class="caption">Semana de ${dBR(P.d.w.ini)} a ${dBR(P.d.w.fim)}</span></summary><pre class="rstexto">${esc(t)}</pre></details>
  <div id="rzTip" class="rztip" role="tooltip" hidden></div></div>`}

// ─────────── Interação ───────────
function animar(){if(calmo())return;const ini=performance.now(),els=$$('[data-rz-num]');
 for(const a of $$('[data-rz-anel]')){a.style.strokeDasharray=`0 999`;requestAnimationFrame(()=>requestAnimationFrame(()=>{a.style.strokeDasharray=`${a.dataset.rzAnel} 999`}))}
 const fmt=(f,v)=>f==='pct'?p1(v):f==='int'?String(Math.round(v)):money(v);
 const passo=t=>{const k=Math.min(1,(t-ini)/900),e=1-Math.pow(1-k,3);for(const el of els){if(!el.isConnected)continue;el.textContent=fmt(el.dataset.rzFmt,Number(el.dataset.rzNum)*e)}if(k<1)requestAnimationFrame(passo)};requestAnimationFrame(passo)}
function ligarDica(raiz){const tip=$('#rzTip');if(!tip)return;
 const mostra=(el,ev)=>{tip.innerHTML=el.dataset.tip;tip.hidden=false;const r=tip.getBoundingClientRect(),x=Math.min(innerWidth-r.width-12,ev.clientX+14),y=ev.clientY-r.height-12<8?ev.clientY+16:ev.clientY-r.height-12;tip.style.transform=`translate(${Math.max(8,x)}px,${y}px)`;
  const svg=el.closest('svg'),cr=svg?.querySelector('.cross');if(cr&&el.classList.contains('hit')){const xx=Number(el.getAttribute('x'))+Number(el.getAttribute('width'))/2;cr.setAttribute('x1',xx);cr.setAttribute('x2',xx);cr.style.opacity=1}};
 raiz.addEventListener('pointermove',e=>{const el=e.target.closest('[data-tip]');if(!el){tip.hidden=true;$$('.rz .cross').forEach(c=>c.style.opacity=0);return}mostra(el,e)});
 raiz.addEventListener('pointerleave',()=>{tip.hidden=true});
 raiz.addEventListener('keydown',e=>{const g=e.target.closest('g[data-nav]');if(g&&(e.key==='Enter'||e.key===' ')){e.preventDefault();navigate(g.dataset.nav)}});
 raiz.addEventListener('click',e=>{const g=e.target.closest('g[data-nav]');if(g)navigate(g.dataset.nav)})}
function links(t,d){const wa=$('[data-rs-link="wa"]'),ml=$('[data-rs-link="mail"]');if(wa)wa.href=`https://wa.me/?text=${encodeURIComponent(t)}`;if(ml)ml.href=`mailto:?subject=${encodeURIComponent('Resumo da semana · '+dBR(d.w.ini)+' a '+dBR(d.w.fim))}&body=${encodeURIComponent(t.replace(/\*/g,'').replace(/_/g,''))}`}
function bind(){const raiz=$('.rz');if(!raiz)return;const P=painel();links(texto(P.d),P.d);ligarDica(raiz);animar()}

// Imagem do resumo (1080 × 1350, formato de post) para mandar no WhatsApp ou guardar.
function imagem(){const P=painel(),d=P.d,c=document.createElement('canvas');c.width=1080;c.height=1350;const g=c.getContext('2d');
 const grad=g.createLinearGradient(0,0,1080,1350);grad.addColorStop(0,'#141a2e');grad.addColorStop(1,'#090c13');g.fillStyle=grad;g.fillRect(0,0,1080,1350);
 const glow=g.createRadialGradient(900,120,10,900,120,520);glow.addColorStop(0,'rgba(168,138,255,.35)');glow.addColorStop(1,'rgba(168,138,255,0)');g.fillStyle=glow;g.fillRect(0,0,1080,700);
 const T=(s,x,y,f,c='#eff1fa',al='left')=>{g.font=f;g.fillStyle=c;g.textAlign=al;g.fillText(s,x,y)};
 T((window.Marca?.nome?.()||'Resumo').toUpperCase(),80,120,'700 30px Manrope, sans-serif','#a88aff');T(`Resumo da semana · ${dBR(d.w.ini)} a ${dBR(d.w.fim)}`,80,170,'500 32px "DM Sans", sans-serif','#929bb2');
 T('Vendas da semana',80,280,'500 34px "DM Sans", sans-serif','#929bb2');T(money(d.v1),80,380,'800 104px Manrope, sans-serif');
 const v=pct(d.v1,d.v0);T(`${fp(v)} vs. semana anterior · ${d.n1} pedidos`,80,440,'600 34px "DM Sans", sans-serif',v!=null&&v<0?'#ff8d9f':'#66dfb5');
 const mg=d.mg?.venda?d.mg.lucro/d.mg.venda:null,box=(x,y,rot,val,sub)=>{g.fillStyle='rgba(255,255,255,.05)';g.strokeStyle='rgba(255,255,255,.1)';g.lineWidth=2;g.beginPath();g.roundRect(x,y,440,170,24);g.fill();g.stroke();T(rot,x+32,y+52,'500 28px "DM Sans", sans-serif','#929bb2');T(val,x+32,y+112,'800 50px Manrope, sans-serif');if(sub)T(sub,x+32,y+150,'500 24px "DM Sans", sans-serif','#929bb2')};
 box(80,500,'Margem · 30 dias',mg==null?'—':p1(mg),d.mg?curto(d.mg.lucro)+' de lucro':'');box(560,500,'Caixa hoje',d.cx?curto(d.cx.hoje):'—',d.cx?`menor em 30 d: ${curto(d.cx.min)}`:'');
 T('Canais',80,760,'700 34px Manrope, sans-serif');const mx=Math.max(1,...d.canais.map(x=>x.v));d.canais.slice(0,4).forEach((x,i)=>{const y=800+i*78;T(x.c,80,y+30,'600 30px "DM Sans", sans-serif');T(money(x.v),1000,y+30,'700 30px "DM Sans", sans-serif','#eff1fa','right');g.fillStyle='rgba(255,255,255,.08)';g.beginPath();g.roundRect(80,y+46,920,12,6);g.fill();g.fillStyle=cor(x.c);g.beginPath();g.roundRect(80,y+46,Math.max(12,920*x.v/mx),12,6);g.fill()});
 T('Mais vendidos',80,1130,'700 34px Manrope, sans-serif');d.top.slice(0,3).forEach((x,i)=>T(`${i+1}. ${x.k} · ${x.q} un.`,80,1180+i*46,'500 30px "DM Sans", sans-serif','#cfd4e4'));
 T('Gerado pelo Jarvis',1000,1300,'600 24px "DM Sans", sans-serif','#6e7891','right');
 c.toBlob(async b=>{if(!b)return toast('Não consegui gerar a imagem.');const nome=`Resumo da semana ${d.w.ini}.png`,f=new File([b],nome,{type:'image/png'});
  try{if(navigator.canShare?.({files:[f]})){await navigator.share({files:[f],title:'Resumo da semana'});return}}catch{}
  const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=nome;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);toast('Imagem do resumo baixada. Mande no WhatsApp ou no e-mail.')},'image/png')}

// Modo TV: tela cheia com os painéis girando a cada 12 s (setas trocam, Esc sai).
let tv=null;
function modoTV(){const P=painel(),slides=[blocoAbertura(P),`<div class="rzgrid g11">${blocoVendas(P)}${blocoMetas(P)}</div>`,`<div class="rzgrid g11">${blocoMapa(P)}${blocoCanais(P)}</div>`,blocoCascata(P),`<div class="rzgrid g11">${blocoFila(P)}${blocoFeed(P)}</div>`,blocoCaixa(P),blocoVitrine(P)].filter((s)=>s&&!/^\s*<div[^>]*class="rzgrid[^"]*"[^>]*>\s*<\/div>\s*$/.test(s));
 const el=document.createElement('div');el.className='rztv rz';el.setAttribute('role','dialog');el.setAttribute('aria-label','Modo TV');
 el.innerHTML=`<div class="rztv-top"><strong>${esc(window.Marca?.nome?.()||'Jarvis')}</strong><span class="rztv-rel"></span><div class="rztv-dots">${slides.map((_,i)=>`<i data-i="${i}"></i>`).join('')}</div><button class="small" data-rztv="sair">${icon('sair')} Sair</button></div><div class="rztv-s"></div><div id="rzTip" class="rztip" hidden></div>`;
 document.body.appendChild(el);let i=0;const ir=n=>{i=(n+slides.length)%slides.length;el.querySelector('.rztv-s').innerHTML=`<div class="rztv-in">${slides[i]}</div>`;el.querySelectorAll('.rztv-dots i').forEach((d,k)=>d.classList.toggle('on',k===i));animar()};
 const rel=()=>{const r=el.querySelector('.rztv-rel');if(r)r.textContent=new Date().toLocaleString('pt-BR',{weekday:'long',hour:'2-digit',minute:'2-digit'})};rel();
 const timer=setInterval(()=>ir(i+1),12000),relogio=setInterval(rel,30000);
 const sair=()=>{clearInterval(timer);clearInterval(relogio);removeEventListener('keydown',tecla,true);el.remove();tv=null;try{if(document.fullscreenElement)document.exitFullscreen()}catch{}};
 const tecla=e=>{if(e.key==='Escape'){e.preventDefault();sair()}else if(e.key==='ArrowRight')ir(i+1);else if(e.key==='ArrowLeft')ir(i-1)};addEventListener('keydown',tecla,true);
 el.addEventListener('click',e=>{if(e.target.closest('[data-rztv="sair"]'))sair();else if(e.target.closest('.rztv-dots i'))ir(Number(e.target.dataset.i));else if(e.target.closest('[data-nav]')){sair()}});
 document.addEventListener('fullscreenchange',function f(){if(!document.fullscreenElement&&tv){document.removeEventListener('fullscreenchange',f);sair()}});
 tv={sair};ir(0);try{el.requestFullscreen?.().catch(()=>{})}catch{}}

document.addEventListener('click',e=>{const b=e.target.closest('[data-rs]');if(!b)return;const k=b.dataset.rs;
 if(k==='copiar'){const t=texto(dados());navigator.clipboard?.writeText(t).then(()=>toast('Resumo copiado. Cole no WhatsApp ou no e-mail.'),()=>toast('Não consegui copiar.'))}
 else if(k==='imagem')imagem();else if(k==='tv'&&!tv)modoTV()});
addPage('resumo','doc2','Resumo da semana',view,'Vendas, margem, caixa e o que pede ação, num painel só. Pronto para mandar à diretoria.','',bind);
window.Resumo={avisos:()=>new Date().getDay()===1?[['info','doc2','Resumo da semana pronto','Mande para a diretoria em um clique','resumo']]:[],painel,texto:()=>texto(dados())};
})();
