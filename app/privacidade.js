// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Privacidade (LGPD): atender o titular (cliente, fornecedor pessoa física, membro da equipe) — localizar onde os
// dados dele aparecem, exportar tudo num arquivo (acesso e portabilidade, art. 18), anonimizar o que não tem guarda
// obrigatória e registrar o atendimento. Na nuvem a busca e a anonimização rodam NO BANCO (lgpd_ws_buscar e
// lgpd_ws_anonimizar, migração 20261105130000_lgpd_titular.sql): todos os pedidos, contas, notas, atendimentos,
// mensagens da régua, anotações de CRM e a equipe do ponto, não só o que o navegador carregou. Só o Administrador.
// Na demonstração (ou sem conexão), procura no que está carregado. Inclui o registro das operações de tratamento.
// Testado em testes/lgpd_ecommerce.test.mjs.
(()=>{
const st={q:'',res:null,ultimo:null,erro:'',carregando:false,pedido:{recebido_em:'',canal:'e-mail'}};
window.Reiniciar?.registrar(st,['q','res','ultimo','erro']); // estado de tela: volta ao original ao clicar no menu
const so=v=>String(v||'').replace(/\D/g,'');
const mask=d=>{d=so(d);return d.length===11?`${d.slice(0,3)}.***.***-${d.slice(9)}`:d.length===14?`${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`:d};
const ACOES={anonimizar:['Anonimiza','bad'],anonimizar_parcial:['Anonimiza em parte','warn'],preservar:['Fica (obrigação legal)','info'],informar:['Só informa','']};
const hoje=()=>new Date().toLocaleDateString('sv-SE');
const nuvem=()=>!window.JARVIS_DEMO&&!!(window.Cloud?.client?.rpc&&Cloud.ws);
const podeAtender=()=>!nuvem()||Cloud.role==='owner';
/** Mesma regra do banco (lgpd__termo): CPF/CNPJ, e-mail ou nome completo. */
function termo(q){const t=String(q||'').trim(),d=so(t);if(t.includes('@'))return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t)?{tipo:'email',valor:t.toLowerCase()}:{erro:'E-mail inválido.'};
 if(!/\p{L}/u.test(t))return [11,14].includes(d.length)?{tipo:'doc',valor:d}:{erro:'Informe o CPF (11 dígitos), o CNPJ (14 dígitos), o e-mail ou o nome completo.'};
 const n=normalized(t).replace(/\s+/g,' ').trim();return n.length<5||!n.includes(' ')?{erro:'Para buscar pelo nome, use o nome completo (nome e sobrenome).'}:{tipo:'nome',valor:n}}
const rpc=async(nome,args)=>{const {data,error}=await Cloud.client.rpc(nome,args);if(error)throw new Error(error.message||String(error));return data};

// Busca local (demonstração ou sem nuvem): o que o navegador carregou, no mesmo formato do banco.
function buscarLocal(q){const t=termo(q);if(t.erro)throw new Error(t.erro);const n=t.tipo==='nome'?t.valor:'',d=t.tipo==='doc'?t.valor:'',bate=(nome,doc,email)=>(d&&so(doc)===d)||(t.tipo==='email'&&String(email||'').trim().toLowerCase()===t.valor)||(n&&normalized(nome||'').includes(n));
 const itens=[];const add=(chave,fonte,acao,explicacao,linhas)=>{if(linhas.length)itens.push({chave,fonte,acao,explicacao,situacao:`${linhas.length} registro(s)`,registros:linhas.length,relacionados:{[chave]:{rotulo:fonte,quantidade:linhas.length,linhas}}})};
 const fica='Fica guardado por obrigação legal (documentos fiscais e contábeis, 5 anos; fundamento a conferir).';
 add('orders','Pedidos de venda','preservar',fica,db.orders.filter(o=>bate(o.customer?.name,o.customer?.doc,o.customer?.email)).map(o=>({data:o.date,ref:o.id,canal:o.platform,nome:o.customer?.name,doc:o.customer?.doc,cidade:o.customer?.city,uf:o.state||o.customer?.state,valor:o.gross,itens:(o.items||[]).map(i=>`${i.qty}× ${i.title||i.sku}`).join('; ')})));
 add('vendas_diretas','Vendas diretas','preservar',fica,(window.VendaDireta?.vendas?.()||[]).filter(v=>bate(v.cliente?.nome,v.cliente?.doc,v.cliente?.email)).map(v=>({data:v.emissao||v.created_at,ref:v.numero,nome:v.cliente?.nome,doc:v.cliente?.doc,email:v.cliente?.email,telefone:v.cliente?.telefone,endereco:v.cliente?.endereco,valor:v.total,situacao:v.status})));
 add('recebiveis','Contas a receber','preservar',fica,(window.VendaDireta?.titulos?.()||[]).filter(x=>bate(x.cliente,x.cliente_doc)).map(x=>({vencimento:x.vencimento,ref:x.documento||x.id,nome:x.cliente,doc:x.cliente_doc,valor:x.valor,situacao:x.status})));
 add('purchase_invoices','Notas de entrada e devoluções','preservar',fica,(db.purchases||[]).filter(p=>bate(p.fornecedor,p.fornecedorDoc||p.fornecedor_doc)).map(p=>({data:p.emissao,ref:`NF ${p.numero||''}`,nome:p.fornecedor,doc:p.fornecedorDoc||p.fornecedor_doc,tipo:p.tipo,valor:p.valor})));
 if(n)add('atendimentos','Atendimento (marketplaces)','preservar','Fica enquanto houver o caso e por 5 anos para a defesa em reclamações (fundamento a conferir).',(window.Atendimento?.lista?.()||[]).filter(a=>normalized((a.comprador||'')+' '+JSON.stringify(a.mensagens||[])).includes(n)).map(a=>({data:a.aberto_em,ref:a.pedido||a.id,tipo:a.tipo,comprador:a.comprador,motivo:a.motivo})));
 const crm=Object.entries(db.crm||{}).filter(([k])=>(d&&k==='DOC-'+d)||(n&&normalized(k).replace(/-/g,' ').includes(n)));
 add('crm_contacts','Anotações de CRM','anonimizar','Sem obrigação de guarda: fase, etiquetas, anotações e o histórico de contatos são apagados.',crm.map(([k,v])=>({id:k,...v})));
 return {termo:{tipo:t.tipo,mascarado:t.tipo==='doc'?(d.length===11?'CPF ':'CNPJ ')+mask(d):t.tipo==='email'?t.valor.replace(/^(.).*@/,'$1***@'):q},itens}}

async function buscar(q){st.q=String(q||'').trim();st.erro='';st.ultimo=null;const t=termo(st.q);if(t.erro){st.res=null;st.erro=t.erro;return null}
 st.res=nuvem()?await rpc('lgpd_ws_buscar',{p_workspace:Cloud.ws,p_termo:st.q}):buscarLocal(st.q);return st.res}
const controlador=()=>{const M=window.Marca,n=M?.nome?.()||'',r=M?.razao?.()||'',c=M?.cnpjFmt?.()||'';return [r&&r!==n?`${n} (${r})`:(r||n),c?'CNPJ '+c:''].filter(Boolean).join(' · ')||'Preencha os dados da empresa'};
/** O arquivo do titular (mesmo formato de motor/lgpd.js › montarArquivo). */
function arquivo(protocolo){const r=st.res||{itens:[]};const sem=o=>o&&typeof o==='object'&&!Array.isArray(o)?Object.fromEntries(Object.entries(o).filter(([k,v])=>!['token_hash','pin_hash','token','xml','pdf_base64','chaves','payload','resposta','raw'].includes(k)&&v!==null&&v!=='')):o;
 return {titulo:'Dados pessoais do titular (LGPD, art. 18, II e V)',gerado_em:new Date().toISOString(),controlador:controlador(),sistema:'Jarvis E-Commerce',protocolo:protocolo||null,titular:r.termo?.mascarado||'',
  pedido:{recebido_em:st.pedido.recebido_em||hoje(),canal:st.pedido.canal||null},
  explicacao:'Este arquivo traz os dados pessoais que a empresa guarda sobre você no sistema Jarvis, por fonte. "o_que_acontece" diz o que é feito com o dado; quando ele fica guardado por obrigação legal, "guarda" traz o motivo e o fundamento.',
  fontes:(r.itens||[]).map(i=>({fonte:i.fonte,situacao:i.situacao||null,o_que_acontece:`${ACOES[i.acao]?.[0]||i.acao}: ${i.explicacao||''}`,guarda:i.guarda?.fundamento?{ate:i.guarda.ate||null,fundamento:i.guarda.fundamento}:null,cadastro:sem(i.cadastro)||null,
   registros:Object.values(i.relacionados||{}).map(x=>({o_que:x.rotulo,quantidade:x.quantidade,linhas:(x.linhas||[]).map(sem)}))}))}}
async function exportar(){if(!st.res)return null;let prot=null;
 if(nuvem())prot=await rpc('lgpd_registrar_atendimento',{p_empresa:null,p_workspace:Cloud.ws,p_termo:st.q,p_tipo:st.res.itens.length?'acesso':'consulta',p_pedido:{...st.pedido,recebido_em:st.pedido.recebido_em||hoje(),direitos:['acesso','portabilidade']}});
 else audit('LGPD: dados do titular exportados',st.res.termo?.mascarado||'');
 const doc=arquivo(prot);const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}));a.download=`lgpd-titular-${so(st.q)?so(st.q).slice(0,3)+'xxx'+so(st.q).slice(-2):'busca'}-${hoje()}.json`;a.click();return doc}
async function anonimizar(chaves){const alvos=(st.res?.itens||[]).filter(i=>chaves.includes(i.chave)&&(i.acao==='anonimizar'||i.acao==='anonimizar_parcial'));if(!alvos.length)throw new Error('Marque os itens a anonimizar (os que ficam por obrigação legal não se anonimizam).');
 let r;
 if(nuvem()){r=await rpc('lgpd_ws_anonimizar',{p_workspace:Cloud.ws,p_termo:st.q,p_alvos:alvos.map(i=>i.chave),p_pedido:{...st.pedido,recebido_em:st.pedido.recebido_em||hoje(),direitos:['eliminacao']},p_confirmacao:'ANONIMIZAR'})}
 else{r={protocolo:null,anonimizados:alvos.map(i=>({fonte:i.fonte,acao:i.acao})),preservados:[]};audit('LGPD: anotações de CRM apagadas',`${alvos.reduce((s,i)=>s+i.registros,0)} registro(s) · ${st.res.termo?.mascarado||''}`)}
 // o navegador esquece as anotações apagadas (sem isso a próxima gravação as mandaria de volta)
 const crm=alvos.find(i=>i.chave==='crm_contacts');for(const l of crm?.relacionados?.crm_contacts?.linhas||[])delete db.crm[l.id];if(crm&&!nuvem())save();
 st.ultimo=r;await buscar(st.q);st.ultimo=r;return r}

function itemHtml(x){const [rot,cor]=ACOES[x.acao]||[x.acao,''],pode=x.acao==='anonimizar'||x.acao==='anonimizar_parcial';
 return `<label class="lgpdfonte">${pode?`<input type="checkbox" data-lgpd-alvo="${esc(x.chave)}" checked>`:'<span></span>'}<div><strong>${esc(x.fonte)}</strong><small>${esc([x.nome,x.documento,x.email,x.situacao].filter(Boolean).join(' · '))}</small><small class="caption">${esc(x.explicacao||'')}</small>${x.guarda?.fundamento?`<small class="caption">Fundamento (a conferir): ${esc(x.guarda.fundamento)}</small>`:''}</div><span class="badge ${cor}">${esc(rot)}</span><span class="badge">${x.registros||0} registro(s)</span></label>`}
function view(){const r=st.res,u=st.ultimo;
 if(!podeAtender())return `<section class="card"><h2>${icon('shield')} Atender um titular</h2><p class="caption">Só o Administrador da empresa atende pedidos de titulares, porque a busca mostra e exporta todos os dados pessoais.</p></section>`;
 return `<div class="grid two"><section class="card"><div class="cardhead"><div><h2>${icon('search')} Atender um titular</h2><p class="caption">Quando alguém pede para saber, corrigir, levar ou apagar os seus dados (LGPD, art. 18). ${nuvem()?'A busca roda no banco, em todos os dados da empresa.':'Demonstração: a busca usa os dados carregados.'}</p></div></div>
  <div class="searchin">${icon('search')}<input type="search" id="lgpdQ" placeholder="CPF, CNPJ, e-mail ou nome completo" value="${esc(st.q)}"></div>
  <div class="row wrap" style="margin-top:8px;gap:8px"><label class="caption">Pedido recebido em <input type="date" id="lgpdData" value="${esc(st.pedido.recebido_em||hoje())}" max="${hoje()}"></label><label class="caption">Canal <select id="lgpdCanal">${['e-mail','telefone','WhatsApp','marketplace','presencial','outro'].map(c=>`<option${c===st.pedido.canal?' selected':''}>${c}</option>`).join('')}</select></label></div>
  <p class="caption" style="margin-top:8px">Com CPF/CNPJ ou e-mail a busca é exata. Por nome, use o nome completo para não misturar pessoas diferentes.</p>
  ${st.erro?`<p class="notice warnbox" style="margin-top:8px">${esc(st.erro)}</p>`:''}
  ${r?(r.itens.length?`<p class="caption" style="margin-top:12px">Titular ${esc(r.termo?.mascarado||'')}</p><div class="lgpdres">${r.itens.map(itemHtml).join('')}</div>
   <div class="row wrap" style="margin-top:12px"><button class="primary small" data-lgpd="exportar">${icon('download')} Exportar tudo (arquivo para o titular)</button>${r.itens.some(x=>x.acao==='anonimizar'||x.acao==='anonimizar_parcial')?`<button class="small" data-lgpd="apagar">Anonimizar os marcados</button>`:''}</div>
   <div id="lgpdConf"></div>`:`<p class="caption" style="margin-top:12px">Nenhum dado encontrado com essa busca.</p><button class="small" data-lgpd="exportar">Registrar a resposta "nada encontrado"</button>`):''}
  ${u?`<div class="notice okbox" style="margin-top:12px">Anonimização registrada${u.protocolo?` (${esc(u.protocolo)})`:''}: ${esc((u.anonimizados||[]).map(i=>i.fonte).join(', '))}.${(u.preservados||[]).length?` Ficaram por obrigação legal: ${esc(u.preservados.map(i=>i.fonte).join(', '))}.`:''}</div>`:''}</section>
 <section class="card"><h2>Como responder</h2><ol class="lgpdpassos"><li><strong>Confirme a identidade</strong> de quem pede (documento com foto ou a própria conta do marketplace).</li><li><strong>Busque</strong> pelo CPF/CNPJ aqui e <strong>exporte</strong> o arquivo: é a resposta para "quais dados vocês têm" e para a portabilidade.</li><li><strong>Correção:</strong> ajuste no Bling ou no marketplace (a origem do cadastro); a próxima sincronização corrige aqui.</li><li><strong>Exclusão:</strong> anonimize o que não tem guarda obrigatória (anotações de CRM, mensagens da régua, contatos de quem saiu da equipe). Pedidos, notas e contas têm guarda obrigatória de 5 anos (legislação fiscal, a conferir) e ficam, com acesso restrito: a tela mostra o motivo para você explicar ao titular.</li><li><strong>Prazo:</strong> responda em até 15 dias (LGPD, art. 19, II). Cada exportação e anonimização fica registrada, com protocolo, na auditoria.</li></ol></section></div>
 <div class="tablebox" style="margin-top:18px"><div class="tabletop"><div><h2>Registro das operações de tratamento</h2><p class="caption">O que o Jarvis guarda, por quê, com qual base legal e por quanto tempo.</p></div></div><div class="tablewrap"><table><thead><tr><th>Dados</th><th>De quem</th><th>Para quê</th><th>Base legal (LGPD, art. 7º)</th><th>Guarda</th><th>Compartilhado com</th></tr></thead><tbody>
 ${[['Nome, CPF/CNPJ, cidade/UF, itens e valores dos pedidos','Clientes dos marketplaces','Faturar, entregar, conciliar recebimentos, contabilizar','Execução de contrato (V) e obrigação legal (II)','5 anos após o exercício','Bling, marketplaces, Focus NFe, escritório contábil'],
  ['Nome, documento, IE, e-mail, telefone, endereço','Clientes de venda direta (B2B)','Emitir nota, cobrar parcelas','Execução de contrato (V) e obrigação legal (II)','5 anos','Focus NFe, escritório contábil'],
  ['Apelido e mensagens de atendimento','Compradores com reclamação ou pergunta','Resolver o caso e proteger a reputação','Execução de contrato (V) e exercício regular de direitos (VI)','Durante o caso + 5 anos','Mercado Livre (origem)'],
  ['Histórico de compras e anotações de CRM','Clientes','Recompra, relacionamento, análise de vendas','Legítimo interesse (IX), com opção de exclusão','Até o pedido de exclusão','Não é compartilhado'],
  ['Nome, CNPJ/CPF e notas','Fornecedores','Pagar, escriturar compras','Execução de contrato (V) e obrigação legal (II)','5 anos','Escritório contábil'],
  ['Nome, CPF, PIS, contrato, ponto e folha','Equipe (colaboradores)','Contrato de trabalho, ponto (Portaria 671/2021), folha e eSocial','Execução de contrato (V) e obrigação legal (II)','Contrato + 5 anos (a conferir)','Escritório contábil, eSocial'],
  ['E-mail, nome, papel e ações no sistema','Equipe da '+esc(window.Marca?.nome?.()||'empresa'),'Controle de acesso e auditoria','Legítimo interesse (IX) e obrigação legal (II)','Enquanto tiver acesso + 5 anos da auditoria','Não é compartilhado']].map(l=>`<tr>${l.map(c=>`<td style="white-space:normal">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`}
const rodar=p=>{st.carregando=true;Promise.resolve(p).catch(e=>{st.erro=String(e?.message||e)}).finally(()=>{st.carregando=false;render()})};
function bind(){const i=$('#lgpdQ');if(!i)return;const ler=()=>{st.pedido.recebido_em=$('#lgpdData')?.value||'';st.pedido.canal=$('#lgpdCanal')?.value||st.pedido.canal};
 i.onkeydown=e=>{if(e.key==='Enter'){ler();rodar(buscar(i.value))}};i.onchange=()=>{ler();if(i.value.trim().length>=4)rodar(buscar(i.value))}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-lgpd]');if(!b)return;const k=b.dataset.lgpd;
 if(k==='exportar'){rodar(exportar().then(()=>toast('Arquivo exportado e atendimento registrado.')));return}
 if(k==='apagar'){const n=[...document.querySelectorAll('[data-lgpd-alvo]')].filter(c=>c.checked).length;$('#lgpdConf').innerHTML=`<div class="notice warnbox" style="margin-top:12px">Anonimizar ${n} item(ns) marcado(s)? Não dá para desfazer. Pedidos, notas e contas continuam (guarda fiscal). <div class="row" style="margin-top:8px"><button class="small" data-lgpd="cancelar">Cancelar</button><button class="small primary" data-lgpd="confirmar">Anonimizar</button></div></div>`;return}
 if(k==='cancelar'){$('#lgpdConf').innerHTML='';return}
 if(k==='confirmar'){const chaves=[...document.querySelectorAll('[data-lgpd-alvo]')].filter(c=>c.checked).map(c=>c.dataset.lgpdAlvo);rodar(anonimizar(chaves).then(()=>toast('Anonimização registrada.')))}});
window.Privacidade={buscar,exportar,anonimizar,termo,estado:st,arquivo,podeAtender,view};
addPage('privacidade','shield','Privacidade (LGPD)',view,'Atender pedidos de titulares (acesso, portabilidade, correção, anonimização) e o registro do que o sistema guarda, por quê e por quanto tempo.','',bind);
})();
