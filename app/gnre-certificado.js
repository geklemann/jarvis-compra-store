// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// O quadro "Certificado digital da empresa" (Parâmetros › Certificado digital e Fiscal › DIFAL e GNRE › Configuração).
// Pedido do dono em 19/11/2026: importar o certificado na própria tela e o Jarvis configurar tudo; o e-CNPJ A1 é UM só
// e serve a tudo o que a lei pede o certificado: as guias da GNRE, a emissão das notas pela Focus NFe (e as notas de
// compra da SEFAZ, pela mesma cópia da Focus) e a captura de documentos do Jarvis ERP/Escritório ligado. A lista "Onde
// é usado" mostra a situação de cada um (o servidor manda em usos). Mais o ambiente da GNRE (homologação ou produção).
// O arquivo .pfx/.p12 e a senha vão direto para a função gnre do servidor (ação certificado_instalar), que abre o
// certificado, confere a senha, a validade e o CNPJ do emitente e grava os dois no cofre do banco (Supabase Vault); com a
// marca "Enviar também à Focus NFe", o servidor manda o mesmo certificado à Focus (certificado_focus faz isso depois, do
// cofre). A senha nunca fica no navegador (nem no estado da tela, nem no armazenamento local) e nada do certificado
// volta: a tela recebe só titular, CNPJ mascarado, emissora, validade e quem instalou. Instalar, trocar, remover, enviar
// à Focus, liberar a captura e mudar o ambiente: só quem administra a empresa, com a verificação em duas etapas (o
// servidor confere). Sem certificado, o "XML do lote (enviar pelo site)" continua na aba Guias.
(()=>{
const st={trocar:false,ocupado:false};
const TITULO='Certificado digital da empresa';
const dBR=d=>d?new Date(d).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}):'—';
const dhBR=d=>d?new Date(d).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
const MAX_BYTES=90*1024; // um A1 tem de 2 a 10 KB; com a cadeia inteira, raramente passa de 20 KB
const pode=d=>d?.pode_configurar===true||(d?.pode_configurar==null&&!!window.Acesso?.administra?.());
async function gnre(action,body={}){const r=await Cloud.client.functions.invoke('gnre',{body:{workspace_id:Cloud.ws,action,...body}});if(r.error){let msg=r.error.message;try{msg=(await r.error.context.json()).error||msg}catch{}throw Error(msg)}return r.data}
const AMB={homologacao:'Homologação (teste)',producao:'Produção'};
const SIT={ok:['ok','Em uso'],atencao:['warn','Atenção'],pendente:['info','Pendente']};

function selo(d){const c=d.certificado_empresa;
 if(c?.vencido)return '<span class="badge bad">Vencido</span>';
 if(c?.vence_logo)return `<span class="badge warn">Vence em ${c.dias} dia(s)</span>`;
 if(c)return '<span class="badge ok">Instalado</span>';
 if(d.origem==='servidor')return '<span class="badge info">No servidor (equipe Jarvis)</span>';
 return '<span class="badge warn">Não instalado</span>'}
function dados(c){const campo=(t,v)=>`<div><span class="caption">${t}</span><br><strong>${v}</strong></div>`;
 return `<div class="grid three gc-dados" style="margin-top:12px">${campo('Titular',esc(c.titular||'—'))}${campo('CNPJ',esc(c.cnpj||'—'))}${campo('Emissora',esc(c.emissora||'—'))}${campo('Válido até',`${dBR(c.valido_ate)}${c.dias!=null?` <span class="caption">· ${c.dias<0?`venceu há ${-c.dias} dia(s)`:c.dias===0?'vence hoje':`em ${c.dias} dia(s)`}</span>`:''}`)}${campo('Instalado por',esc(c.instalado_por||'—'))}${campo('Instalado em',dhBR(c.instalado_em))}</div>
 ${c.vencido?'<div class="notice red" style="margin:12px 0 0">O certificado venceu: o Portal GNRE recusa as guias e a SEFAZ recusa as notas. Renove o A1 com a autoridade certificadora e clique em <b>Trocar certificado</b>.</div>':c.vence_logo?`<div class="notice" style="margin:12px 0 0">Faltam ${c.dias} dia(s) para o certificado vencer. Renove o A1 com a autoridade certificadora e clique em <b>Trocar certificado</b> antes do vencimento.</div>`:''}`}
function formulario(d){
 return `<div class="gc-form" style="margin-top:12px"><div class="grid two"><div><label for="gcArq">Arquivo do certificado (.pfx ou .p12)</label><input type="file" id="gcArq" accept=".pfx,.p12,application/x-pkcs12" style="width:100%"></div><div><label for="gcSenha">Senha do certificado</label><input type="password" id="gcSenha" name="gcSenhaCertificado" autocomplete="new-password" data-lpignore="true" data-1p-ignore spellcheck="false" style="width:100%" placeholder="A senha que veio com o A1"></div></div>
 <label class="row" style="gap:8px;margin-top:12px;color:var(--text)"><input type="checkbox" class="check" id="gcFocus" checked> Enviar também à Focus NFe, para a emissão das notas e as notas de compra da SEFAZ (substitui o certificado que estiver lá para este CNPJ)</label>
 <div class="row wrap" style="margin-top:12px"><button class="primary small" data-gc-instalar ${st.ocupado?'disabled':''}>${icon('shield')} ${d.certificado_empresa?'Instalar o novo certificado':'Instalar'}</button>${st.trocar?'<button class="small quiet" data-gc-cancelar>Cancelar</button>':''}</div>
 <p class="caption">O Jarvis confere a senha, a validade e se o CNPJ do certificado é o do emitente da empresa, e grava o arquivo e a senha no cofre criptografado do servidor. A senha não fica guardada no navegador e o certificado nunca volta para a tela. Precisa da verificação em duas etapas ativa na sua conta (Segurança e integridade).</p></div>`}
/** "Onde é usado": cada uso com a situação que o servidor mandou (usos) e, para quem administra, a ação de cada um. */
function usos(d){const l=Array.isArray(d.usos)?d.usos:[];if(!l.length)return '';const ok=pode(d)&&!st.ocupado;
 const botao=u=>!ok?'':u.acao==='focus'?`<button class="small" data-gc-focus>${icon('upload')} Enviar à Focus NFe</button>`:u.acao==='captura_ligar'?`<button class="small" data-gc-captura="1">${icon('check')} Liberar para a captura</button>`:u.acao==='captura_desligar'?`<button class="small quiet" data-gc-captura="0">Parar de usar na captura</button>`:'';
 return `<div class="gc-usos" style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line)"><h3>Onde é usado</h3>
 <ul style="list-style:none;padding:0;margin:8px 0 0">${l.map(u=>{const [cls,t]=SIT[u.situacao]||SIT.pendente,b=botao(u);
  return `<li data-gc-uso="${esc(u.id)}" style="padding:10px 0;border-bottom:1px solid var(--line)"><div class="row wrap" style="justify-content:space-between;gap:8px"><strong>${esc(u.nome)}</strong><span class="badge ${cls}">${t}</span></div><p class="caption" style="margin:4px 0 0">${esc(u.texto)}</p>${b?`<div class="row wrap" style="margin-top:8px">${b}</div>`:''}</li>`}).join('')}</ul>
 <p class="caption">Remover o certificado daqui não tira a cópia que a Focus NFe já tem: para trocar lá, instale o novo e envie.</p></div>`}
function ambiente(d){const a=d.ambiente==='producao'?'producao':'homologacao',ok=pode(d);
 return `<div class="gc-amb" style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line)"><h3>Ambiente da GNRE</h3>
 <div class="segtabs" style="margin:10px 0 6px" role="group" aria-label="Ambiente da GNRE">${Object.entries(AMB).map(([k,t])=>`<button class="${a===k?'active':''}" data-gc-amb="${k}" aria-pressed="${a===k}" ${ok&&!st.ocupado?'':'disabled'}>${t}</button>`).join('')}</div>
 <p class="caption">${a==='producao'?'<b>Produção:</b> as guias enviadas têm valor de pagamento e viram título no contas a pagar.':'<b>Homologação:</b> as guias são de teste no Portal GNRE (não se pagam). Teste o envio e depois troque para produção.'}${d.ambiente_origem==='servidor'?' Ambiente definido no servidor até alguém escolher aqui.':''}${ok?'':' Só quem administra a empresa troca o ambiente.'} O ambiente da emissão das notas fica em Regras fiscais.</p></div>`}

/** O quadro do certificado, onde é usado e o ambiente da GNRE. d = o diagnóstico da função gnre. */
function html(d){
 if(!d)return `<section class="card" id="gnreCert"><h3>${TITULO}</h3><p class="caption">Conferindo o certificado…</p></section>`;
 if(d.erro)return `<section class="card" id="gnreCert"><h3>${TITULO}</h3><p class="caption">Não consegui ler a situação do certificado agora. Recarregue a página para tentar de novo.</p></section>`;
 const c=d.certificado_empresa,ok=pode(d),form=ok&&(!c||st.trocar);
 return `<section class="card" id="gnreCert"><div class="row wrap" style="justify-content:space-between"><h3>${TITULO}</h3>${selo(d)}</div>
 <p class="caption">O e-CNPJ A1 da empresa, um só para tudo o que a lei pede o certificado: o envio das guias da GNRE, a emissão das notas (pela Focus NFe) e a captura das notas recebidas.</p>
 ${c?dados(c):d.origem==='servidor'?'<p class="caption" style="margin-top:10px">As guias saem com o certificado gravado no servidor pela equipe Jarvis. Para usar o certificado da própria empresa, instale aqui: ele passa a valer só para esta empresa.</p>':'<p class="caption" style="margin-top:10px">Nenhum certificado instalado. Sem ele, use <b>XML do lote (enviar pelo site)</b> na aba Guias e envie o arquivo pelo site do Portal GNRE.</p>'}
 ${c&&ok&&!st.trocar?`<div class="row wrap" style="margin-top:12px"><button class="small" data-gc-trocar>${icon('upload')} Trocar certificado</button><button class="small quiet" data-gc-remover ${st.ocupado?'disabled':''}>${icon('close')} Remover</button></div>`:''}
 ${form?formulario(d):ok?'':'<p class="caption" style="margin-top:10px">Só quem administra a empresa (Equipe e acessos › “Pode administrar a equipe e as configurações”) instala, troca ou remove o certificado.</p>'}
 ${usos(d)}${ambiente(d)}</section>`}

/** O arquivo escolhido em base64 (sem o prefixo data:). */
async function base64(f){const b=new Uint8Array(await f.arrayBuffer());let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));return btoa(s)}
const depois=(r,msg)=>{window.Difal?.definirDiag?.(r);st.trocar=false;toast(msg);render()};
/** O que o servidor disse do envio à Focus NFe (vai junto com a mensagem da instalação). */
const textoFocus=f=>f?`${f.ok?'':'Focus NFe: '}${f.mensagem||''}`:'';

async function instalar(b){const arq=$('#gcArq')?.files?.[0],campo=$('#gcSenha'),senha=campo?.value||'',focus=!!$('#gcFocus')?.checked;
 if(!arq)return toast('Escolha o arquivo do certificado A1 (.pfx ou .p12).');
 if(!/\.(pfx|p12)$/i.test(arq.name||''))return toast('O certificado A1 é um arquivo .pfx ou .p12.');
 if(!(arq.size>0)||arq.size>MAX_BYTES)return toast('Este arquivo não parece um certificado A1 (.pfx ou .p12): confira se escolheu o arquivo certo.');
 if(!senha)return toast('Digite a senha do certificado.');
 st.ocupado=true;b.disabled=true;b.textContent='Conferindo e instalando…';
 try{const pfx=await base64(arq);if(campo)campo.value='';
  const r=await gnre('certificado_instalar',{pfx,senha,focus});const c=r.certificado_empresa||{};
  st.ocupado=false;depois(r,[`Certificado instalado: ${c.titular||'empresa'} · válido até ${dBR(c.valido_ate)}.`,textoFocus(r.focus)].filter(Boolean).join(' '))}
 catch(e){st.ocupado=false;if(campo)campo.value='';b.disabled=false;b.innerHTML=`${icon('shield')} Instalar`;toast(e.message)}}

async function trocarAmbiente(amb){st.ocupado=true;
 try{const r=await gnre('ambiente',{ambiente:amb,confirmo:amb==='producao'});st.ocupado=false;closeModal();depois(r,amb==='producao'?'GNRE em PRODUÇÃO: as próximas guias enviadas têm valor de pagamento.':'GNRE em homologação: as próximas guias são de teste.')}
 catch(e){st.ocupado=false;toast(e.message);render()}}
function confirmarProducao(){modal('Trocar a GNRE para produção',`<div class="notice red" style="margin:0 0 14px"><strong>As guias enviadas passam a ter valor de pagamento.</strong> Cada guia emitida em produção vira título no contas a pagar e é cobrada pela SEFAZ do estado.</div>
 <p>Troque só depois de testar o envio em homologação e de liberar o acesso ao webservice no Portal GNRE (Área do contribuinte › Solicitar acesso ao webservice) em produção, com o mesmo certificado.</p>
 <label class="row" style="gap:8px;margin-top:14px;color:var(--text)"><input type="checkbox" class="check" id="gcEntendi"> Entendi: as guias enviadas a partir de agora são reais e devem ser pagas.</label>
 <div class="modalfoot"><button class="quiet" data-action="close">Cancelar</button><button class="primary" data-gc-producao disabled>Trocar para produção</button></div>`)}
/** Uma ação do "Onde é usado" com o segundo clique de confirmação. */
async function acaoUso(b,action,body,msg){st.ocupado=true;b.disabled=true;
 try{const r=await gnre(action,body);st.ocupado=false;depois(r,msg(r))}catch(x){st.ocupado=false;b.disabled=false;toast(x.message)}}

document.addEventListener('change',e=>{if(e.target?.id==='gcEntendi'){const b=document.querySelector('[data-gc-producao]');if(b)b.disabled=!e.target.checked}});
document.addEventListener('click',async e=>{const b=e.target.closest?.('[data-gc-instalar],[data-gc-trocar],[data-gc-cancelar],[data-gc-remover],[data-gc-amb],[data-gc-producao],[data-gc-focus],[data-gc-captura]');if(!b)return;const d=b.dataset;
 if(d.gcTrocar!=null){st.trocar=true;render();return}
 if(d.gcCancelar!=null){st.trocar=false;render();return}
 if(d.gcInstalar!=null)return instalar(b);
 if(d.gcRemover!=null){if(d.conf!=='1'){d.conf='1';b.textContent='Confirmar: remover o certificado (as guias não saem sem ele)';b.classList.add('danger');return}
  st.ocupado=true;b.disabled=true;try{const r=await gnre('certificado_remover');st.ocupado=false;depois(r,'Certificado removido do cofre do servidor.')}catch(x){st.ocupado=false;b.disabled=false;toast(x.message)}return}
 if(d.gcFocus!=null){if(d.conf!=='1'){d.conf='1';b.textContent='Confirmar: enviar à Focus NFe (substitui o certificado de lá)';return}
  return acaoUso(b,'certificado_focus',{confirmo:true},r=>textoFocus(r.focus)||'Pedido enviado.')}
 if(d.gcCaptura!=null){const ligar=d.gcCaptura==='1';
  if(ligar&&d.conf!=='1'){d.conf='1';b.textContent='Confirmar: a captura assina a manifestação do destinatário com este certificado';return}
  return acaoUso(b,'certificado_uso',{uso:'captura',ligado:ligar,...(ligar?{confirmo:true}:{})},()=>ligar?'A captura da empresa ligada passa a usar este certificado.':'A captura volta a usar o certificado do cofre dela, se houver.')}
 if(d.gcProducao!=null){if(!document.querySelector('#gcEntendi')?.checked)return;b.disabled=true;return trocarAmbiente('producao')}
 if(d.gcAmb){if(b.getAttribute('aria-pressed')==='true')return; // já é o ambiente atual
  if(d.gcAmb==='producao')return confirmarProducao();
  if(d.conf!=='1'){d.conf='1';b.textContent='Confirmar: voltar para homologação (guias de teste)';return}
  return trocarAmbiente('homologacao')}});

window.GnreCertificado={html,base64};
})();
