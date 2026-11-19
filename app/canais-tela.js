// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Cadastros › Canais de venda: o cadastro único dos canais (window.Canais, web/parametros-base.js). Cada canal tem o nome,
// a sigla e a cor das telas, as regras de preço dos tipos de anúncio (a regra em si fica em Preços e margem › Regras de
// venda), o prazo de repasse e a margem do "repasse atrasado", as contas contábeis próprias, o intermediador da NF-e, as
// lojas do Bling ligadas a ele (Integrações) e as palavras que o reconhecem. Os canais padrão (Mercado Livre, Shopee,
// Magalu, TikTok Shop e Site próprio) só se desligam e voltam ao padrão; a empresa inclui os dela (ex.: Amazon).
(()=>{
const C=()=>window.Canais;
const ui={edit:null,novo:false,confRestaurar:false};
window.Reiniciar?.registrar(ui,['edit','novo','confRestaurar']);
const pad=id=>C().PADRAO.some(c=>c.id===id);
const lojasBling=id=>Object.entries(window.Integrations?.state?.rows?.bling?.settings?.lojas||{}).filter(([,p])=>p===id).map(([l])=>l);
const medido=id=>{try{return window.Fluxo?.prazos?.()?.[id]??null}catch{return null}};
const cnpjFiscal=id=>db.gerencial?.fiscal?.intermediadores?.[id]?.cnpj||'';
const fmtCnpj=s=>{const d=String(s||'').replace(/\D/g,'');return d.length===14?d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'):d};
const rot=k=>window.Preco?.rotulo?.(k)||k;
const lista=l=>(l||[]).map(esc).join(', ')||'—';

function view(){const L=C().lista(),R=window.Preco?.regras?.().canais||{},P=window.Parametros;
 const linha=c=>{const m=medido(c.id),lj=lojasBling(c.id);return `<tr class="clickrow" data-cn-edit="${esc(c.id)}"><td><span class="row" style="gap:8px"><input type="checkbox" class="check" data-cn-ativo="${esc(c.id)}" ${c.ativo?'checked':''} aria-label="Canal ${esc(c.nome)} ativo"><span class="plogo" style="background:${esc(c.cor)}16;color:${esc(c.cor)}">${esc(c.sigla||'?')}</span><b>${esc(c.nome)}</b></span>${pad(c.id)?'':'<span class="badge info">da empresa</span>'}${c.conta?`<br><span class="caption">conta de liquidação: ${esc(c.conta)}</span>`:''}</td>
  <td>${c.regras.length?c.regras.map(r=>`<span class="badge ${R[r.id]?.ativo?'ok':''}">${esc(rot(r.id))}${R[r.id]?'':' · sem regra'}</span>`).join(' '):'<span class="caption">sem regra de preço</span>'}</td>
  <td class="num">${c.prazo!=null&&c.prazo!==''?`<b>${c.prazo} dias</b>`:`${P.get('canais.prazo_padrao')} dias <span class="caption">(padrão)</span>`}${m!=null?`<br><span class="caption">real: ${m} dias (mediana de ${P.get('fluxo.prazo_janela')} dias)</span>`:''}<br><span class="caption">atrasado depois de +${C().atraso(c.id)} dias</span></td>
  <td class="mono caption">${esc(c.contas.receber)}<br>${esc(c.contas.receita)}</td>
  <td class="caption">${fmtCnpj(cnpjFiscal(c.id)||c.intermediador.cnpj)||'—'}</td>
  <td class="caption">${lj.length?`lojas ${lista(lj)}`:'—'}</td></tr>`};
 return `<div class="notice"><strong>Um cadastro só para o app inteiro.</strong> Os canais daqui aparecem nos filtros, na conciliação, no fluxo de caixa, na contabilidade, nas notas (intermediador) e nos preços. A comissão, a taxa fixa e o frete de cada tipo de anúncio ficam em <button class="fplink" data-nav="regrasvenda">Preços e margem › Regras de venda</button>; a loja do Bling se liga ao canal em <button class="fplink" data-nav="integracoes">Integrações</button>.</div>
 <section class="tablebox"><div class="tabletop"><div><h2>Canais de venda</h2><p class="caption">Clique num canal para editar. Desligar tira o canal das listas e dos filtros (os pedidos dele continuam); os canais da empresa também se removem.</p></div>
  <div class="row"><button class="small ${ui.confRestaurar?'danger':''}" data-cn="restaurar">${ui.confRestaurar?'Confirmar: voltar todos ao padrão':'Voltar ao padrão'}</button><button class="small primary" data-cn="novo">${icon('plus')} Novo canal</button></div></div>
 <div class="tablewrap"><table><thead><tr><th>Canal</th><th>Regras de preço (tipos de anúncio)</th><th class="num">Repasse</th><th>Contas contábeis</th><th>Intermediador (NF-e)</th><th>Bling</th></tr></thead><tbody>${L.map(linha).join('')}</tbody></table></div></section>
 <p class="caption">Prazo de repasse: a previsão do repasse do pedido sem data informada pela plataforma é a data do pedido mais o prazo (com histórico de liberações, o fluxo de caixa usa a mediana real). O valor dos canais novos e dos pedidos de canal sem cadastro está em Configurações › Parâmetros › Canais de venda.</p>`}

const campo=(k,t,v,extra='')=>`<div class="field"><label>${t}</label><input data-cn-f="${k}" value="${esc(v??'')}" ${extra}></div>`;
function janela(id){const c=C().porId(id);if(!c)return;const P=window.Parametros,R=window.Preco?.regras?.().canais||{},m=medido(id);
 modal(`Canal · ${c.nome}`,`<div class="grid three">${campo('nome','Nome nas telas',c.nome)}${campo('sigla','Sigla',c.sigla,'maxlength="3"')}<div class="field"><label>Cor</label><input type="color" data-cn-f="cor" value="${esc(/^#[0-9a-f]{6}$/i.test(c.cor)?c.cor:'#8b93a7')}"></div>
  ${campo('prazo','Prazo de repasse (dias)',c.prazo??'',`placeholder="${P.get('canais.prazo_padrao')} (padrão)${m!=null?' · real '+m:''}" inputmode="numeric"`)}${campo('atraso','Repasse atrasado depois de + (dias)',c.atraso??'',`placeholder="${P.get('canais.atraso_padrao')} (padrão)" inputmode="numeric"`)}${campo('conta','Conta de liquidação',c.conta,'placeholder="ex.: Mercado Pago"')}
  ${campo('receber','Conta contábil a receber',c.contas.receber,'class="mono"')}${campo('receita','Conta contábil da receita',c.contas.receita,'class="mono"')}${campo('cnpj','CNPJ do intermediador (NF-e)',fmtCnpj(cnpjFiscal(id)||c.intermediador.cnpj),'placeholder="sem intermediador"')}</div>
  ${campo('extrato','Palavras do extrato bancário (separadas por vírgula)',c.extrato.join(', '),'placeholder="ex.: amazon, amzn"')}
  ${c.regras.map((r,i)=>campo('regra'+i,`Palavras da regra "${esc(rot(r.id))}" (loja do Bling, plataforma)`,r.padroes.join(', '))).join('')}
  <p class="caption">Regras de preço: ${c.regras.length?c.regras.map(r=>`${esc(rot(r.id))} (${R[r.id]?`comissão ${String(R[r.id].comissao).replace('.',',')}%`:'sem regra'})`).join(' · '):'nenhuma'}. Lojas do Bling ligadas: ${lista(lojasBling(id))}. As palavras são expressões: <span class="mono">\\bml\\b</span> é "ml" como palavra inteira.</p>
  <div class="modalfoot">${pad(id)?`<button data-cn-padrao="${esc(id)}">Voltar ao padrão</button>`:`<button data-cn-remover="${esc(id)}" class="quiet">Remover canal</button>`}${c.regras.length?'':`<button data-cn-regra="${esc(id)}">Criar regra de venda</button>`}<button data-action="close">Cancelar</button><button class="primary" data-cn-salvar="${esc(id)}">${icon('check')} Salvar</button></div>`)}
function novo(){modal('Novo canal de venda',`<p class="caption" style="margin-top:-8px">Ex.: Amazon, Mercado Shops, uma loja física. O canal nasce com a regra de preço própria (comissão e taxa fixa), ajustável em Regras de venda.</p>
 <div class="grid three"><div class="field"><label>Nome</label><input data-cn-n="nome" maxlength="40" placeholder="Amazon"></div><div class="field"><label>Sigla</label><input data-cn-n="sigla" maxlength="3" placeholder="AMZ"></div><div class="field"><label>Cor</label><input type="color" data-cn-n="cor" value="#8b93a7"></div>
 <div class="field"><label>Comissão (%)</label><input data-cn-n="comissao" inputmode="decimal" placeholder="0"></div><div class="field"><label>Taxa fixa por item (R$)</label><input data-cn-n="fixa" inputmode="decimal" placeholder="0"></div><div class="field"><label>Prazo de repasse (dias)</label><input data-cn-n="prazo" inputmode="numeric" placeholder="${window.Parametros.get('canais.prazo_padrao')} (padrão)"></div></div>
 <div class="field"><label>Palavras que reconhecem o canal (separadas por vírgula; vazio = o nome)</label><input data-cn-n="palavras" placeholder="amazon"></div>
 <div class="modalfoot"><button data-action="close">Cancelar</button><button class="primary" data-cn="incluir">${icon('check')} Incluir</button></div>`)}
const palavras=s=>String(s||'').split(',').map(x=>x.trim()).filter(Boolean);
function salvar(id){const c=C().porId(id),v=k=>document.querySelector(`[data-cn-f="${k}"]`)?.value??'';const P=window.Parametros;
 const pz=String(v('prazo')).trim(),at=String(v('atraso')).trim(),cnpj=String(v('cnpj')).replace(/\D/g,'');
 const campos={nome:String(v('nome')).trim()||c.nome,sigla:String(v('sigla')).trim().toUpperCase()||c.sigla,cor:v('cor')||c.cor,prazo:pz===''?null:P.num(pz),atraso:at===''?null:P.num(at),conta:String(v('conta')).trim(),
  contas:{receber:String(v('receber')).trim()||c.contas.receber,receita:String(v('receita')).trim()||c.contas.receita},intermediador:{...c.intermediador,cnpj},extrato:palavras(v('extrato')),
  regras:c.regras.map((r,i)=>({...r,padroes:palavras(v('regra'+i)).length?palavras(v('regra'+i)):r.padroes}))};
 if(!/^\d+(\.\d+)+$/.test(campos.contas.receber)||!/^\d+(\.\d+)+$/.test(campos.contas.receita))return toast('Conta contábil no formato 1.1.03.04.');
 const erro=C().atualizar(id,campos);if(erro)return toast(erro);
 // O CNPJ do intermediador também vai para Regras fiscais › Intermediadores, que o emissor da NF-e lê.
 if(cnpj!==String(cnpjFiscal(id)||c.intermediador.cnpj||'').replace(/\D/g,'')){const F=db.gerencial.fiscal=db.gerencial.fiscal||{};F.intermediadores={...(F.intermediadores||{}),[id]:{...(F.intermediadores?.[id]||{}),cnpj}};save()}
 closeModal();toast('Canal salvo.');render()}
document.addEventListener('click',e=>{const b=e.target.closest('[data-cn],[data-cn-edit],[data-cn-salvar],[data-cn-padrao],[data-cn-remover],[data-cn-regra]');if(!b||e.target.closest('[data-cn-ativo]'))return;const d=b.dataset;
 if(d.cnEdit){janela(d.cnEdit);return}
 if(d.cnSalvar){salvar(d.cnSalvar);return}
 if(d.cnPadrao){C().restaurar(d.cnPadrao);closeModal();toast('Canal de volta ao padrão.');render();return}
 if(d.cnRemover){if(!confirm(`Remover o canal ${d.cnRemover} e a regra de preço dele? Os pedidos continuam.`))return;const er=C().remover(d.cnRemover);if(er)return toast(er);closeModal();render();return}
 if(d.cnRegra){const er=C().criarRegra(d.cnRegra);if(er)return toast(er);closeModal();toast('Regra de venda criada: ajuste a comissão em Regras de venda.');render();return}
 if(d.cn==='novo'){novo();return}
 if(d.cn==='restaurar'){if(!ui.confRestaurar){ui.confRestaurar=true;render();return}ui.confRestaurar=false;C().restaurar();toast('Canais padrão de volta aos valores de fábrica.');render();return}
 if(d.cn==='incluir'){const v=k=>document.querySelector(`[data-cn-n="${k}"]`)?.value??'';const er=C().adicionar({nome:v('nome'),sigla:v('sigla'),cor:v('cor'),comissao:v('comissao'),fixa:v('fixa'),prazo:String(v('prazo')).trim()===''?null:window.Parametros.num(v('prazo')),palavras:palavras(v('palavras'))});if(er)return toast(er);closeModal();toast('Canal incluído.');render()}});
document.addEventListener('change',e=>{const x=e.target.closest('[data-cn-ativo]');if(!x)return;const er=C().atualizar(x.dataset.cnAtivo,{ativo:x.checked});if(er)toast(er);render()});
addPage('canais','link','Canais de venda',view,'O cadastro dos canais onde a empresa vende: nome e cor nas telas, prazo de repasse, contas contábeis, intermediador da NF-e, lojas do Bling e as palavras que reconhecem cada um.','',()=>{});
})();
