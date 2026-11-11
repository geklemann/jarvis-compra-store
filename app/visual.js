// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Ajustes visuais que valem para todas as telas. Rodam depois de cada desenho, como rolagem.js:
// 1) número grande que não cabe na caixa diminui de tamanho em vez de ser cortado com reticências;
// 2) tabela mais larga que a caixa fica compacta (menos espaço entre colunas) antes de precisar rolar;
// 3) no celular, tabelas de até 12 colunas viram cartões: cada linha um cartão, com o nome da coluna ao lado do valor;
// 4) o botão do Jarvis vira só o ícone depois que a página rola (no celular, sempre).
(()=>{
if(typeof MutationObserver==='undefined'||typeof document==='undefined')return;
const GRANDES='.kpiv,.vgv-kpis b,.metric .value,.bankval,.kpis4 strong,.kpi strong,.kpi b,.vg-big strong,.fxk strong,.hj-val,.bl-num b,.pdn';
function caber(){
 for(const el of document.querySelectorAll(GRANDES)){
  if(!el.offsetParent)continue;
  if(el.dataset.cabe){el.style.fontSize='';delete el.dataset.cabe}
  if(el.scrollWidth<=el.clientWidth)continue;
  const base=parseFloat(getComputedStyle(el).fontSize);
  for(let f=.94;f>=.55;f-=.06){el.style.fontSize=(base*f).toFixed(1)+'px';el.dataset.cabe='1';if(el.scrollWidth<=el.clientWidth)break}
  el.title=el.textContent.trim();
 }
}
function tabelas(){
 for(const w of document.querySelectorAll('.tablewrap')){
  w.classList.remove('aperta','aperta2');
  const t=w.querySelector(':scope>table');if(!t)continue;
  if(w.scrollWidth>w.clientWidth+4){w.classList.add('aperta');if(w.scrollWidth>w.clientWidth+4)w.classList.add('aperta2')}
  // Cartões no celular: só tabela com cabeçalho simples (sem colspan) e até 12 colunas.
  if(t.dataset.cartaoFeito===String(t.rows.length))continue;
  const ths=[...(t.tHead?.rows[0]?.cells||[])];
  if(t.closest('[data-sem-cartao]')||!ths.length||ths.length>12||ths.some(c=>c.colSpan>1)){t.classList.remove('cartoes');continue}
  const nomes=ths.map(c=>c.textContent.replace(/[▲▼▴▾↑↓⇅]/g,'').trim());
  for(const tb of t.tBodies)for(const r of tb.rows)[...r.cells].forEach((c,i)=>{if(c.colSpan>1)c.dataset.label='';else c.dataset.label=nomes[i]||''});
  t.classList.add('cartoes');t.dataset.cartaoFeito=String(t.rows.length);
 }
}
let tm=0;const agendar=()=>{clearTimeout(tm);tm=setTimeout(()=>{try{tabelas();caber()}catch{}},140)};
new MutationObserver(agendar).observe(document.documentElement,{childList:true,subtree:true});
addEventListener('resize',agendar);
try{document.fonts.ready.then(agendar)}catch{} // a fonte da marca chega depois e alarga o texto
let rolou=false;
addEventListener('scroll',()=>{const r=(document.scrollingElement?.scrollTop||0)>120||[...document.querySelectorAll('.erp main,.erp .content')].some(x=>x.scrollTop>120);if(r!==rolou){rolou=r;document.body.classList.toggle('rolou',r)}},{capture:true,passive:true});
})();
