// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Marca da empresa cliente: o Jarvis é vendido a várias empresas, então nada de nome, logo, razão social ou
// escritório contábil fixo no código. Tudo vem de db.gerencial.empresa (tela "Dados da empresa") e de
// db.gerencial.fiscal (Regras fiscais), que o cloud.js sincroniza em workspace_settings.
// Carregado logo depois de app.js: as telas chamam Marca.nome(), Marca.logo() etc. na hora de desenhar.
(()=>{
const LOGO_PADRAO='brand/jarvis-192.png';
const G=()=>(typeof db!=='undefined'&&db&&db.gerencial)||{};
const emp=()=>G().empresa||{};
const fis=()=>G().fiscal||{};
const txt=v=>String(v??'').trim();
const nome=()=>txt(emp().nome_exibicao)||txt(window.Cloud?.wsName)||'Minha empresa';
const Marca={
 nome,
 logo:()=>txt(emp().logo)||LOGO_PADRAO,
 temLogo:()=>!!txt(emp().logo),
 assinatura:()=>txt(emp().assinatura)||('Equipe '+nome()),
 escritorio:()=>txt(emp().escritorio)||'a contabilidade',
 segmento:()=>txt(emp().segmento),
 razao:()=>txt(fis().razao),
 cnpj:()=>String(fis().cnpj||'').replace(/\D/g,''),
 uf:()=>txt(fis().uf).toUpperCase(),
 municipio:()=>txt(fis().municipio),
 regime:()=>txt(fis().regime),
 /** CNPJ formatado (00.000.000/0000-00) ou vazio. */
 cnpjFmt:()=>{const d=Marca.cnpj();return d.length===14?d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'):d},
 /** "Cidade/UF" da configuração fiscal, ou vazio. */
 cidadeUF:()=>[Marca.municipio(),Marca.uf()].filter(Boolean).join('/'),
 /** Segmento infantil/brinquedos: liga telas de nicho (ex.: "Próximo brinquedo"). */
 nichoInfantil:()=>{const s=typeof normalized==='function'?normalized(Marca.segmento()):Marca.segmento().toLowerCase();return /brinquedo|infantil/.test(s)},
 /** Troca {loja} pela assinatura das mensagens ao cliente. */
 assinar:t=>String(t??'').replace(/\{loja\}/g,Marca.assinatura()),
 podeEditar:()=>!window.Cloud?.ws||window.Cloud?.role==='owner',
};
window.Marca=Marca;

// ─────────── Tela "Dados da empresa" (registrada por empresa.js, depois que addPage existe) ───────────
const LIMITE_LOGO=60*1024;
const ui={logo:undefined,processando:false};
const bytesDataUrl=u=>Math.floor((u.length-u.indexOf(',')-1)*3/4);
function lerArquivo(f){return new Promise((ok,erro)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>erro(Error('Não consegui ler o arquivo.'));r.readAsDataURL(f)})}
function carregarImagem(src){return new Promise((ok,erro)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>erro(Error('Arquivo não é uma imagem válida.'));i.src=src})}
// Redimensiona no navegador para no máximo 256 px e tenta WebP/PNG até ficar abaixo de 60 KB.
async function reduzirLogo(f){if(!/^image\//.test(f.type||''))throw Error('Escolha um arquivo de imagem (PNG, JPG, WebP ou SVG).');
 const img=await carregarImagem(await lerArquivo(f));
 for(const lado of [256,192,160,128,96]){const k=Math.min(1,lado/Math.max(img.naturalWidth||img.width||lado,img.naturalHeight||img.height||lado));
  const w=Math.max(1,Math.round((img.naturalWidth||img.width||lado)*k)),h=Math.max(1,Math.round((img.naturalHeight||img.height||lado)*k));
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;const cx=cv.getContext('2d');cx.clearRect(0,0,w,h);cx.drawImage(img,0,0,w,h);
  for(const q of [0.92,0.8,0.65,0.5]){const u=cv.toDataURL('image/webp',q);if(/^data:image\/webp/.test(u)&&bytesDataUrl(u)<LIMITE_LOGO)return u}
  const png=cv.toDataURL('image/png');if(bytesDataUrl(png)<LIMITE_LOGO)return png}
 throw Error('A imagem continua grande demais mesmo reduzida. Tente um logo mais simples.')}

function view(){const e=emp(),pode=Marca.podeEditar(),dis=pode?'':'disabled',logo=ui.logo===undefined?txt(e.logo):ui.logo;
 const campo=(k,t,ph,dica)=>`<div class="field"><label for="de_${k}">${t}</label><input id="de_${k}" data-de="${k}" value="${esc(e[k]||'')}" placeholder="${esc(ph)}" ${dis} maxlength="120">${dica?`<small class="caption">${dica}</small>`:''}</div>`;
 const f=fis(),fiscalTxt=[f.razao,Marca.cnpjFmt(),Marca.cidadeUF(),f.regime].filter(Boolean).map(esc).join(' · ');
 return `${pode?'':'<div class="notice">Só o administrador da empresa altera estes dados.</div>'}
 <section class="card"><div class="cardhead"><div><h2>Como a empresa aparece</h2><p class="caption">Nome e logo na barra lateral, no painel da TV e nos documentos; assinatura nas mensagens aos clientes.</p></div>${pode?`<button class="small primary" data-de-salvar="1">${icon('check')} Salvar</button>`:''}</div>
  <div class="grid two">${campo('nome_exibicao','Nome de exibição',window.Cloud?.wsName||'Ex.: Loja Exemplo','Aparece no menu, no painel e nos relatórios.')}
   ${campo('assinatura','Assinatura das mensagens ao cliente','Equipe '+nome(),'Vai no fim dos modelos de atendimento e das mensagens de CRM.')}
   ${campo('escritorio','Escritório contábil','Ex.: Contabilidade Silva','Citado nas telas de fechamento, obrigações e emissão de notas.')}
   ${campo('segmento','Segmento','Ex.: brinquedos, moda, casa e decoração','Liga recursos próprios do ramo (ex.: brinquedos → "Próximo brinquedo" no CRM).')}</div>
  <div class="field" style="margin-top:14px"><label>Logo</label><div class="row wrap" style="gap:14px;align-items:center">
   <img src="${esc(logo||LOGO_PADRAO)}" alt="Logo atual" style="width:72px;height:72px;object-fit:contain;border-radius:12px;background:var(--panel2);border:1px solid var(--line);padding:6px">
   ${pode?`<label class="small upbtn" style="cursor:pointer"><input type="file" accept="image/*" data-de-logo="1" hidden> ${ui.processando?'Reduzindo…':'Escolher imagem'}</label>${logo?'<button class="small quiet" data-de-semlogo="1">Remover logo</button>':''}`:''}
   <small class="caption">PNG, JPG, WebP ou SVG. O Jarvis reduz para até 256 px e menos de 60 KB.${logo?'':' Sem logo, aparece o símbolo do Jarvis.'}</small></div></div>
 </section>
 <section class="card"><div class="cardhead"><div><h2>Dados fiscais</h2><p class="caption">Razão social, CNPJ, cidade/UF e regime ficam em Regras fiscais (usados na nota, nas propostas, no CNAB e nas obrigações).</p></div><button class="small" data-nav="parametros">Abrir Regras fiscais</button></div>
  <p>${fiscalTxt||'<span class="gold">Preencha os dados da empresa em Regras fiscais.</span>'}</p></section>`}

function salvar(){if(!Marca.podeEditar()){toast('Só o administrador altera os dados da empresa.');return}
 const novo={...emp()};document.querySelectorAll('[data-de]').forEach(i=>{novo[i.dataset.de]=i.value.trim()});
 if(ui.logo!==undefined)novo.logo=ui.logo||'';
 db.gerencial={...(db.gerencial||{}),empresa:novo};ui.logo=undefined;save();
 try{audit('Dados da empresa','nome, logo e assinatura atualizados')}catch{}
 toast('Dados da empresa salvos.');render()}

document.addEventListener('click',e=>{const b=e.target.closest('[data-de-salvar],[data-de-semlogo]');if(!b)return;
 if(b.dataset.deSalvar){salvar();return}
 if(b.dataset.deSemlogo){ui.logo='';render()}});
document.addEventListener('change',async e=>{const i=e.target.closest('[data-de-logo]');if(!i||!i.files?.[0])return;
 if(!Marca.podeEditar())return;
 /* guarda o que já foi digitado antes de redesenhar */
 const rascunho={};document.querySelectorAll('[data-de]').forEach(x=>rascunho[x.dataset.de]=x.value);
 ui.processando=true;render();
 try{ui.logo=await reduzirLogo(i.files[0]);toast('Logo pronto. Clique em Salvar.')}catch(x){toast(x.message||String(x))}finally{ui.processando=false}
 render();document.querySelectorAll('[data-de]').forEach(x=>{if(rascunho[x.dataset.de]!=null)x.value=rascunho[x.dataset.de]})});

Marca.tela={id:'dadosempresa',icone:'folder',titulo:'Dados da empresa',view,sub:'Nome, logo, assinatura das mensagens, escritório contábil e segmento da empresa.',reduzirLogo};
})();
