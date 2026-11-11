// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Central de ajuda do Jarvis: o cliente fala com a equipe Jarvis (fornecedor do sistema).
// - Busca nas respostas prontas enquanto digita ("resolve antes de abrir"), com botão que leva até a tela certa.
// - Chamado com rastreio como pedido (Recebido → Em análise → Em correção → Testando → Resolvido) e prazo de resposta
//   contando na tela; o contexto técnico (tela, versão, navegador) vai junto sozinho.
// - Saúde da conta: integrações, assinatura, emissão fiscal e falhas, cada uma com a ação certa.
// - Acessível: ditado por voz, letra maior, alto contraste, retorno por WhatsApp ou ligação no horário escolhido.
// - Chamado proativo: falha que se repete abre chamado sozinha (banco: suporte_proativo) — o cliente só acompanha.
// - Equipe Jarvis: fila de todas as empresas com prazo, notas internas, etapas, empresas e liberação do emitente fiscal.
// Os pedidos internos antigos (equipe → dono, tabela chamados) continuam acessíveis em "Pedidos internos".
(()=>{
const st={aba:'inicio',q:'',manualUrl:null,manualErro:'',carregandoManual:false,lista:null,carregando:false,sel:null,msgs:{},
 equipe:null,fila:null,filtroFila:'abertos',empresas:null,eqSel:null,cfg:null,saude:null,internos:null,origem:'',origemId:'',
 form:{tipo:'duvida',urgencia:'normal',canal:'portal',anexar:true},enviando:false};
window.Reiniciar?.registrar(st,['aba','sel','eqSel']);
// Atualização em segundo plano não redesenha a tela enquanto alguém digita (perderia o foco e o cursor).
const digitando=()=>{const el=document.activeElement;return !!(el&&el.closest?.('.ajuda')&&/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))};
const redesenhar=()=>{if(page==='suporte'&&!digitando())render()};
const lsGet=(k,d)=>{try{return localStorage.getItem(k)??d}catch{return d}},lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
const pref={fonte:Number(lsGet('jarvis_ajuda_fonte','1'))||1,contraste:lsGet('jarvis_ajuda_contraste','0')==='1'};
const TIPOS={duvida:'Dúvida de uso',erro:'Algo não funciona',fiscal:'Nota fiscal e impostos',integracao:'Integração com marketplace ou ERP',financeiro:'Financeiro e conciliação',acesso:'Acesso e permissões',sugestao:'Sugestão de melhoria',outro:'Outro assunto'};
const URG={baixa:['Pode esperar','resposta em até 3 dias'],normal:['Normal','resposta em até 24 h'],alta:['Urgente','resposta em até 8 h'],parado:['Parou meu trabalho','resposta em até 2 h']};
const CANAIS={portal:'Aqui no Jarvis',whatsapp:'WhatsApp',ligacao:'Ligação',email:'E-mail'};
const ETAPAS=[['recebido','Recebido'],['analise','Em análise'],['correcao','Em correção'],['testando','Testando'],['resolvido','Resolvido']];
const ETAPA_NOME={recebido:'Recebido',analise:'Em análise',correcao:'Em correção',testando:'Testando',aguardando_cliente:'Aguardando você',resolvido:'Resolvido'};
const eu=()=>window.Cloud?.session?.user||{};
const dono=()=>(window.Cloud?.role||'owner')==='owner';
const dh=t=>t?new Date(t).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const nomeTela=id=>{const n=(window.navItems||[]).find(x=>x[0]===id);return n?n[2]:id};

// ── Respostas prontas (o que mais perguntam), cada uma com a tela que resolve ──
const ARTIGOS=[
 ['Conectar Mercado Livre, Shopee ou Magalu','marketplace conectar integrar loja conta autorizar','Em Integrações, clique em Conectar no marketplace e autorize com a conta da loja. O Jarvis só lê pedidos, tarifas e repasses (e só altera algo quando você pede numa tela). A primeira leitura traz os últimos dias; o histórico pode ser pedido na mesma tela.','integracoes','Abrir Integrações'],
 ['Conectar o ERP de origem (notas e estoque)','erp origem nota estoque conectar bling sincronizar','Em Integrações, conecte o seu ERP de origem: dele vêm as notas fiscais emitidas, produtos, custo e saldo. A sincronização roda sozinha de hora em hora e nunca apaga o que a sua equipe anotou no Jarvis.','integracoes','Abrir Integrações'],
 ['Por que o lucro de um pedido está diferente?','lucro margem pedido diferente errado tarifa frete custo','O Jarvis calcula venda − tarifa real − frete − custo do produto − impostos. Diferenças costumam vir de custo do produto desatualizado, frete cobrado depois ou rebate da campanha. O Raio-X da margem mostra, item a item, de onde veio a variação.','raiox','Abrir Raio-X da margem'],
 ['Como a conciliação dos repasses funciona','conciliacao repasse liberacao divergencia receber','Cada pedido espera o repasse líquido (bruto − tarifa). Repasse que bate ao centavo é vinculado sozinho; o resto fica em Pendências para alguém confirmar. Divergência mostra a diferença exata e o motivo provável.','pending','Abrir Pendências'],
 ['Emitir NF-e pelo Jarvis','nota fiscal nfe emitir emissao producao homologacao certificado','A emissão é liberada pela equipe Jarvis depois de conferir o CNPJ e o certificado A1 da sua empresa (abra um chamado do tipo Nota fiscal). Depois disso, configure as regras em Regras fiscais, emita notas de teste e só então ligue a produção.','nfconfig','Abrir Configuração da NF-e'],
 ['DIFAL e guias GNRE','difal gnre guia icms fcp estado','Em DIFAL e GNRE ficam as notas com diferencial de alíquota, as guias prontas para enviar e o resultado de cada uma. Use os filtros do cabeçalho para escolher só as de hoje, as rejeitadas ou por estado. O envio ao portal é sempre um clique seu.','difal','Abrir DIFAL e GNRE'],
 ['Adicionar alguém da equipe e liberar telas','equipe usuario convidar acesso permissao tela pessoa','A pessoa cria a conta dela no Jarvis com o próprio e-mail. Depois, em Equipe e acessos, o dono adiciona esse e-mail, escolhe o papel (financeiro, estoque, atendimento, contabilidade…) e, se quiser, libera tela por tela.','equipe','Abrir Equipe e acessos'],
 ['Verificação em duas etapas','senha seguranca codigo autenticador duas etapas mfa','Em Segurança e integridade, ative a verificação em duas etapas com um app autenticador. A partir daí, além da senha, o Jarvis pede o código de 6 dígitos — e os dados só abrem depois dele.','integridade','Abrir Segurança'],
 ['Lançar conta a pagar por foto ou e-mail','conta pagar boleto foto email lancar','Em Contas a pagar, use "Ler conta" para mandar foto, PDF ou print: o Jarvis preenche os campos e você confere antes de salvar. Também dá para encaminhar boletos para o e-mail exclusivo da sua empresa.','pagar','Abrir Contas a pagar'],
 ['Conciliar o extrato do banco','banco extrato ofx conciliacao bancaria','Em Conciliação bancária, importe o extrato (OFX ou planilha). O Jarvis sugere o vínculo de cada lançamento com títulos, repasses e transferências; você confirma.','concbanco','Abrir Conciliação bancária'],
 ['Fluxo de caixa e aviso de saldo negativo','caixa fluxo saldo negativo projecao','O Fluxo de caixa projeta o saldo dia a dia com repasses previstos, vendas e contas. Se algum dia ficar negativo, o Jarvis avisa antes (em Alertas e relatórios você escolhe por e-mail ou WhatsApp).','fluxo','Abrir Fluxo de caixa'],
 ['Estoque parado e preço mínimo para liquidar','estoque parado liquidar preco minimo encalhado','Estoque parado mostra o dinheiro preso em produto sem venda há 60 dias ou mais e o preço mínimo que ainda não dá prejuízo, já com tarifa, frete e impostos.','estparado','Abrir Estoque parado'],
 ['Sugestão de compras','compra repor reposicao ruptura fornecedor','A Sugestão de compras calcula quanto repor de cada item pelo ritmo de venda, prazo do fornecedor e cobertura desejada, e avisa o que vai faltar antes da reposição chegar.','estcompras','Abrir Sugestão de compras'],
 ['Montar o orçamento do ano','orcamento anual budget planejamento forecast','Na Visão do orçamento, crie a versão do ano: o Jarvis parte do histórico de cada canal, você ajusta premissas e cenários, os gestores preenchem as despesas deles e o dono aprova. Depois, Orçado × realizado compara mês a mês.','orcvisao','Abrir Orçamento'],
 ['Alertas por e-mail e WhatsApp e resumo do dia','alerta aviso whatsapp email resumo diario relatorio','Em Alertas e relatórios, cadastre quem recebe e marque os avisos (NF-e rejeitada, ruptura, caixa negativo, tarifa que subiu, resumo do dia às 7 h, relatório semanal).','alertasrel','Abrir Alertas e relatórios'],
 ['Filtrar como no Excel e exportar','filtro excel exportar planilha coluna','Clique na setinha do cabeçalho de qualquer coluna para filtrar como no Excel; o total do rodapé acompanha o filtro e você pode salvar filtros. O botão Excel exporta exatamente o que está na tela.',null,''],
 ['Plano, pagamento e teste grátis','plano assinatura pagamento boleto pix cartao teste cobranca','Em Plano e assinatura você vê o plano, os dias de teste e assina por boleto, Pix ou cartão. Dúvida sobre cobrança? Abra um chamado do tipo Financeiro.','plano','Abrir Plano e assinatura'],
 ['App de ponto para os colaboradores','ponto app colaborador jornada bater','Em Ponto e jornada, use "Gerar link do app": o colaborador abre o link (ou o QR) no celular e adiciona à tela inicial. O link vale 72 horas.','ponto','Abrir Ponto e jornada'],
 ['Perguntar ao assistente Jarvis','assistente ia perguntar pergunta jarvis','Na tela Hoje, escreva a pergunta como falaria com alguém ("quanto sobrou da Shopee em setembro?"). O assistente responde com os números da sua empresa e o caminho da tela.','central','Abrir Hoje'],
 ['Atendimento pós-venda numa fila só','atendimento reclamacao pergunta mensagem devolucao fila','Em Atendimento ficam reclamações, perguntas e mensagens dos marketplaces numa fila só, com quem está atendendo cada cliente e modelos de resposta.','atendimento','Abrir Atendimento'],
 ['Vigia de preços da concorrência','concorrencia preco concorrente vigia','O Vigia de preços acompanha os anúncios concorrentes que você escolher e avisa quando alguém baixa o preço, mostrando a sua margem se você acompanhar.','concorrencia','Abrir Vigia de preços'],
];
function buscar(q){const t=norm(q).split(/\s+/).filter(w=>w.length>2);if(!t.length)return [];
 return ARTIGOS.map((a,i)=>{const alvo=norm(a[0]+' '+a[1]),corpo=norm(a[2]);let s=0;for(const w of t){if(norm(a[0]).includes(w))s+=3;else if(alvo.includes(w))s+=2;else if(corpo.includes(w))s+=1}return {a,i,s}}).filter(x=>x.s>0).sort((x,y)=>y.s-x.s).slice(0,5)}
const artigoHtml=(a,i,aberto)=>`<details class="ajart" ${aberto?'open':''}><summary>${icon('help')}<span>${esc(a[0])}</span></summary><p>${esc(a[2])}</p>${a[3]?`<button class="small" data-aj-ir="${a[3]}">${icon('arrow')} ${esc(a[4])}</button>`:''}<span class="ajutil">Isso resolveu? <button class="quiet small" data-aj-util="sim" data-i="${i}">Sim</button><button class="quiet small" data-aj-util="nao" data-i="${i}">Não, quero falar com a equipe</button></span></details>`;

// ── Dados ──
async function carregar(){if(st.carregando||!window.Cloud?.ws)return;st.carregando=true;
 try{const {data,error}=await Cloud.client.from('suporte_chamados').select('*').eq('workspace_id',Cloud.ws).order('created_at',{ascending:false}).limit(300);if(error)throw error;st.lista=data||[]}
 catch(e){st.lista=st.lista||[];console.warn('suporte',e)}finally{st.carregando=false;atualizarContador();redesenhar()}}
async function carregarMsgs(id){try{const {data}=await Cloud.client.from('suporte_mensagens').select('*').eq('chamado_id',id).order('created_at');st.msgs[id]=data||[]}catch{st.msgs[id]=st.msgs[id]||[]}redesenhar()}
async function carregarCfg(){if(st.cfg)return;st.cfg={};try{const {data}=await Cloud.client.from('plataforma_config').select('chave,valor');st.cfg=Object.fromEntries((data||[]).map(x=>[x.chave,x.valor]))}catch{}redesenhar()}
async function verEquipe(){if(st.equipe!==null||!window.Cloud?.client)return;st.equipe=false;try{const {data}=await Cloud.client.rpc('e_equipe_jarvis');st.equipe=data===true}catch{}if(st.equipe){carregarFila();redesenhar()}}
async function carregarFila(){try{const {data}=await Cloud.client.from('suporte_chamados').select('*').order('created_at',{ascending:false}).limit(500);st.fila=data||[]}catch{st.fila=st.fila||[]}atualizarContador();redesenhar()}
async function carregarEmpresas(){try{const {data,error}=await Cloud.client.rpc('equipe_empresas');if(error)throw error;st.empresas=data||[]}catch(e){st.empresas=[];toast(e.message||String(e))}redesenhar()}
async function carregarSaude(){if(st.saude||!window.Cloud?.ws)return;st.saude={carregando:true};const ws=Cloud.ws;
 const [i,a,f,e]=await Promise.all([Cloud.client.from('integrations').select('provider,status,last_sync,account_name').eq('workspace_id',ws),Cloud.client.from('assinaturas').select('status,teste_ate').eq('workspace_id',ws).maybeSingle(),
  Cloud.client.from('fiscal_emitentes').select('cnpj,uf').eq('workspace_id',ws).maybeSingle(),dono()?Cloud.client.from('erros_sistema').select('id',{count:'exact',head:true}).eq('workspace_id',ws).is('resolvido_em',null):Promise.resolve({count:null})].map(p=>p.then(r=>r,()=>({}))));
 st.saude={integ:i.data||[],ass:a.data||null,emit:f.data||null,erros:e.count??null};redesenhar()}
async function carregarInternos(){try{const {data}=await Cloud.client.from('chamados').select('*').eq('workspace_id',Cloud.ws).order('created_at',{ascending:false}).limit(200);st.internos=data||[]}catch{st.internos=[]}redesenhar()}
const naoLidos=()=>(st.lista||[]).filter(c=>!c.lido_cliente&&(c.criado_por===eu().id||dono())).length;
const filaNova=()=>(st.fila||[]).filter(c=>!c.lido_equipe&&c.etapa!=='resolvido').length;
function atualizarContador(){const n=naoLidos()+(st.equipe?filaNova():0);document.querySelectorAll('[data-nav="suporte"] .navcount').forEach(x=>x.remove());if(n)document.querySelectorAll('[data-nav="suporte"]').forEach(b=>b.insertAdjacentHTML('beforeend',`<em class="navcount">${n}</em>`))}

// ── Rastreio e prazo ──
function prazoTxt(c){if(c.etapa==='resolvido')return c.resolvido_em?`Resolvido em ${dh(c.resolvido_em)}`:'Resolvido';
 if(c.primeira_resposta_em)return `Respondido em ${dh(c.primeira_resposta_em)}`;if(!c.prazo)return '';
 const ms=new Date(c.prazo)-Date.now(),h=Math.abs(ms)/36e5,qt=h<1?`${Math.max(1,Math.round(h*60))} min`:`${Math.round(h)} h`;
 return ms>=0?`Primeira resposta até ${dh(c.prazo)} · faltam ${qt}`:`Passou ${qt} do prazo · já está no topo da fila`}
function rastreio(c,grande){const idx=c.etapa==='aguardando_cliente'?1:ETAPAS.findIndex(e=>e[0]===c.etapa);
 return `<ol class="ajtrack ${grande?'grande':''}" aria-label="Andamento do chamado: ${esc(ETAPA_NOME[c.etapa]||c.etapa)}">${ETAPAS.map(([k,t],i)=>`<li class="${i<idx?'feito':i===idx?'agora':''}" ${i===idx?'aria-current="step"':''}><i></i><span>${i===1&&c.etapa==='aguardando_cliente'?'Aguardando você':t}</span></li>`).join('')}</ol>`}

// ── Contexto técnico anexado ao chamado ──
function contexto(){return {tela:st.origem||'',pagina:st.origemId||'',versao:window.Erros?.versao||'',navegador:navigator.userAgent.slice(0,220),tela_px:`${innerWidth}x${innerHeight}`,tema:document.body.classList.contains('light')?'claro':'escuro',papel:window.Cloud?.role||'',enviado_em:new Date().toISOString(),falhas_na_sessao:window.Erros?.pendentes?.()??0}}

// ── Ditado por voz (Chrome/Edge) ──
let reco=null;
function ditar(btn,alvo){const R=window.SpeechRecognition||window.webkitSpeechRecognition;if(!R){toast('Ditado por voz funciona no Chrome e no Edge.');return}
 if(reco){reco.stop();return}reco=new R();reco.lang='pt-BR';reco.continuous=true;reco.interimResults=false;
 reco.onresult=ev=>{const t=[...ev.results].slice(ev.resultIndex).map(r=>r[0].transcript).join(' ');const el=$(alvo);if(el){el.value=(el.value?el.value.trimEnd()+' ':'')+t.trim();el.dispatchEvent(new Event('input'))}};
 reco.onend=()=>{reco=null;btn.classList.remove('gravando');btn.setAttribute('aria-pressed','false');btn.querySelector('span').textContent='Ditar'};
 reco.onerror=()=>{toast('Não consegui ouvir. Confira a permissão do microfone.')};
 reco.start();btn.classList.add('gravando');btn.setAttribute('aria-pressed','true');btn.querySelector('span').textContent='Parar ditado'}

// ── Telas ──
function head(){const n=naoLidos();const abas=[['inicio','Início'],['abrir','Abrir chamado'],['meus',`Meus chamados${n?` <small>${n}</small>`:''}`],['manual','Manual'],
  ...((st.internos||[]).length?[['internos','Pedidos internos']]:[]),...(st.equipe?[['equipe',`Equipe Jarvis${filaNova()?` <small>${filaNova()}</small>`:''}`]]:[])];
 return `<div class="ajbar"><div class="segtabs" role="tablist">${abas.map(([k,t])=>`<button role="tab" aria-selected="${st.aba===k}" class="${st.aba===k?'active':''}" data-aj-aba="${k}">${t}</button>`).join('')}</div>
 <div class="ajacess" role="group" aria-label="Acessibilidade"><button class="quiet small" data-aj-fonte="-1" aria-label="Diminuir a letra">A−</button><button class="quiet small" data-aj-fonte="0" aria-label="Letra normal">A</button><button class="quiet small" data-aj-fonte="1" aria-label="Aumentar a letra">A+</button><button class="quiet small ${pref.contraste?'active':''}" data-aj-contraste="1" aria-pressed="${pref.contraste}">Alto contraste</button></div></div>`}

function inicioView(){if(!st.saude)carregarSaude();const res=st.q?buscar(st.q):[];const c=st.cfg||{};
 const wa=String(c.suporte_whatsapp||'').replace(/\D/g,'');
 return `<section class="ajhero"><div class="eyebrow">Central de ajuda</div><h1>Como podemos ajudar?</h1><p>Busque uma resposta pronta ou fale com a equipe Jarvis. ${c.suporte_horario?`Atendimento: ${esc(c.suporte_horario)}.`:''}</p>
  <label for="ajBusca" class="sr-only">Buscar na ajuda</label><div class="ajbusca">${icon('lupa')}<input id="ajBusca" type="search" autocomplete="off" placeholder="Ex.: conectar Shopee, nota rejeitada, lucro diferente…" value="${esc(st.q)}"></div>
  <div id="ajRes" aria-live="polite">${st.q?(res.length?res.map(x=>artigoHtml(x.a,x.i,true)).join(''):`<p class="caption">Nenhuma resposta pronta para isso. <button class="small" data-aj-aba="abrir">Abrir um chamado</button></p>`):''}</div></section>
 <div class="ajacoes">
  <button class="ajacao" data-aj-aba="abrir">${icon('headset')}<b>Abrir chamado</b><span>Com rastreio e prazo de resposta</span></button>
  ${wa?`<a class="ajacao" href="https://wa.me/${wa}?text=${encodeURIComponent(`Olá! Sou da empresa ${window.Marca?.nome?.()||window.Cloud?.wsName||''} e preciso de ajuda com o Jarvis.`)}" target="_blank" rel="noopener">${icon('smile')}<b>WhatsApp</b><span>Fale com a equipe agora</span></a>`:''}
  <button class="ajacao" data-aj-ligacao="1">${icon('clock')}<b>Peça uma ligação</b><span>Você escolhe o melhor horário</span></button>
  <button class="ajacao" data-aj-aba="manual">${icon('doc')}<b>Manual completo</b><span>Todas as telas, passo a passo</span></button></div>
 <div class="grid two"><section class="card"><div class="cardhead"><div><h2>Saúde da sua conta</h2><p class="caption">O que pode precisar de atenção, com o atalho para resolver.</p></div></div>${saudeHtml()}</section>
 <section class="card"><div class="cardhead"><div><h2>Perguntas frequentes</h2><p class="caption">As dúvidas que mais aparecem.</p></div></div>${ARTIGOS.slice(0,7).map((a,i)=>artigoHtml(a,i,false)).join('')}</section></div>`}

function saudeHtml(){const s=st.saude;if(!s||s.carregando)return '<div class="empty">Verificando…</div>';const linhas=[];
 const nomes={bling:'ERP de origem',mercadolivre:'Mercado Livre',shopee:'Shopee',magalu:'Magalu'};
 if(!s.integ.length)linhas.push(['warn','Nenhuma integração conectada','Conecte marketplaces e o ERP de origem para os números aparecerem.','integracoes','Conectar']);
 for(const i of s.integ){const h=i.last_sync?(Date.now()-new Date(i.last_sync))/36e5:999;const ok=i.status==='conectado'&&h<6;
  linhas.push([ok?'ok':i.status==='desconectado'?'bad':'warn',`${nomes[i.provider]||i.provider}${i.account_name?` · ${i.account_name}`:''}`,ok?`Sincronizado ${dh(i.last_sync)}`:i.status==='desconectado'?'Desconectado — reconecte para voltar a sincronizar.':i.status==='erro'?'A última sincronização falhou. Tente reconectar; se repetir, abra um chamado.':`Sem sincronizar desde ${dh(i.last_sync)||'—'}.`,'integracoes',ok?'':'Ver integração'])}
 const a=s.ass;if(a){const dias=a.teste_ate?Math.ceil((new Date(a.teste_ate+'T23:59:59')-Date.now())/864e5):null;
  if(a.status==='teste')linhas.push([dias>2?'info':'warn','Teste grátis',dias>=0?`Faltam ${dias} dia(s) de teste.`:'O teste acabou: assine para continuar usando as integrações.','plano','Ver planos']);
  else if(a.status==='atrasada'||a.status==='cancelada')linhas.push(['bad','Assinatura','Pagamento pendente: regularize para não interromper as integrações.','plano','Regularizar']);
  else linhas.push(['ok','Assinatura',a.status==='interno'?'Uso interno, sem cobrança.':'Em dia.','plano',''])}
 linhas.push(s.emit?['ok','Emissão de NF-e',`Liberada para o CNPJ ${String(s.emit.cnpj).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5')} (${esc(s.emit.uf||'')}).`,'nfconfig','']:['info','Emissão de NF-e','Ainda não liberada. Se quiser emitir pelo Jarvis, peça a liberação.','__fiscal','Pedir liberação']);
 if(s.erros!=null)linhas.push([s.erros?'warn':'ok','Falhas no sistema',s.erros?`${s.erros} falha(s) registradas. A equipe Jarvis acompanha e abre chamado sozinha quando se repetem.`:'Nenhuma falha em aberto.','erros',s.erros?'Ver falhas':'']);
 return `<ul class="ajsaude">${linhas.map(([t,tit,txt,ir,bt])=>`<li class="${t}"><i aria-hidden="true"></i><div><b>${esc(tit)}</b><span>${esc(txt)}</span></div>${bt?`<button class="small" ${ir==='__fiscal'?'data-aj-fiscal="1"':`data-aj-ir="${ir}"`}>${esc(bt)}</button>`:''}</li>`).join('')}</ul>`}

function abrirView(){const f=st.form,c=st.cfg||{};const sug=f.titulo?buscar(f.titulo+' '+(f.descricao||'')).slice(0,3):[];
 return `<section class="card ajform"><h2>Abrir um chamado</h2><p class="caption">Vai direto para a equipe Jarvis. Você acompanha cada etapa em Meus chamados e recebe aviso a cada resposta.</p>
 <fieldset class="ajchips"><legend>Sobre o quê?</legend>${Object.entries(TIPOS).map(([k,t])=>`<button type="button" class="${f.tipo===k?'active':''}" aria-pressed="${f.tipo===k}" data-aj-f="tipo" data-v="${k}">${t}</button>`).join('')}</fieldset>
 <fieldset class="ajchips"><legend>Urgência</legend>${Object.entries(URG).map(([k,[t,p]])=>`<button type="button" class="${f.urgencia===k?'active':''} ${k==='parado'?'urg':''}" aria-pressed="${f.urgencia===k}" data-aj-f="urgencia" data-v="${k}"><b>${t}</b><small>${p}</small></button>`).join('')}</fieldset>
 <label for="ajTitulo">Assunto</label><input id="ajTitulo" maxlength="140" value="${esc(f.titulo||'')}" placeholder="Ex.: Nota do pedido 2000123 rejeitada" style="width:100%">
 <div id="ajSug" aria-live="polite">${sug.length?`<div class="ajsug"><b>Talvez isso resolva agora:</b>${sug.map(x=>artigoHtml(x.a,x.i,false)).join('')}</div>`:''}</div>
 <div class="row" style="justify-content:space-between;align-items:flex-end"><label for="ajDesc">O que aconteceu ou do que você precisa</label><button type="button" class="quiet small ajmic" data-aj-ditar="#ajDesc" aria-pressed="false">${icon('mic')}<span>Ditar</span></button></div>
 <textarea id="ajDesc" rows="6" placeholder="O que você fez, o que esperava e o que apareceu. Pode falar em vez de digitar: clique em Ditar.">${esc(f.descricao||'')}</textarea>
 <fieldset class="ajchips"><legend>Como prefere o retorno?</legend>${Object.entries(CANAIS).filter(([k])=>k!=='whatsapp'||c.suporte_whatsapp||true).map(([k,t])=>`<button type="button" class="${f.canal===k?'active':''}" aria-pressed="${f.canal===k}" data-aj-f="canal" data-v="${k}">${t}</button>`).join('')}</fieldset>
 ${f.canal==='whatsapp'||f.canal==='ligacao'?`<div class="grid two"><div><label for="ajTel">Telefone com DDD</label><input id="ajTel" inputmode="tel" autocomplete="tel" value="${esc(f.telefone||'')}" style="width:100%"></div><div><label for="ajQuando">Melhor horário</label><input id="ajQuando" value="${esc(f.retorno_quando||'')}" placeholder="Ex.: hoje depois das 14h" style="width:100%"></div></div>`:''}
 <label class="ajcheck"><input type="checkbox" id="ajAnexar" ${f.anexar?'checked':''}> Enviar as informações técnicas desta sessão (tela${st.origem?` "${esc(st.origem)}"`:''}, versão, navegador). Ajuda a resolver mais rápido e não inclui dados de clientes.</label>
 <div id="ajMsg" class="caption" role="alert" style="min-height:20px"></div>
 <div class="row"><button class="primary" data-aj="enviar" ${st.enviando?'disabled':''}>${icon('check')} Enviar chamado</button><span class="caption">${esc(URG[f.urgencia][1])}</span></div></section>`}

function meusView(){if(!st.lista&&!st.carregando)carregar();if(st.sel)return detalheView(st.sel,false);
 const l=(st.lista||[]).filter(c=>dono()||c.criado_por===eu().id||!c.criado_por);
 if(!l.length)return `<div class="empty">${st.carregando||!st.lista?'Carregando…':`Nenhum chamado ainda. Quando precisar, <button class="small" data-aj-aba="abrir">abra um chamado</button>.`}</div>`;
 return `<div class="ajlista">${l.map(c=>`<button class="ajitem ${!c.lido_cliente?'novo':''}" data-aj-abrir="${esc(c.id)}"><div class="ajitemtop"><span class="mono">#${c.numero}</span>${c.origem==='proativo'?'<span class="badge info">Aberto pelo Jarvis</span>':''}${!c.lido_cliente?'<span class="badge bad">novidade</span>':''}<span class="badge ${c.etapa==='resolvido'?'ok':c.etapa==='aguardando_cliente'?'warn':'info'}">${esc(ETAPA_NOME[c.etapa]||c.etapa)}</span></div>
  <b>${esc(c.titulo)}</b>${rastreio(c,false)}<small>${esc(prazoTxt(c))}${dono()&&c.nome&&c.criado_por!==eu().id?` · aberto por ${esc(c.nome)}`:''}</small></button>`).join('')}</div>`}

function detalheView(id,equipe){const c=(equipe?st.fila:st.lista||[])?.find(x=>x.id===id);if(!c)return '<div class="empty">Chamado não encontrado.</div>';
 if(!st.msgs[id]){carregarMsgs(id);const lido=equipe?!c.lido_equipe:!c.lido_cliente;if(lido){Cloud.client.rpc('suporte_marcar_lido',{chamado:id}).then(()=>{if(equipe)c.lido_equipe=true;else c.lido_cliente=true;atualizarContador()},()=>null)}}
 const ms=st.msgs[id]||[];const conversa=[{de:c.origem==='proativo'?'sistema':'cliente',autor_nome:c.origem==='proativo'?'Jarvis':c.nome,texto:c.descricao,created_at:c.created_at},...ms];
 const ctx=c.contexto&&Object.keys(c.contexto).length?c.contexto:null;
 return `<button class="quiet small" data-aj-voltar="${equipe?'equipe':'meus'}">${icon('arrow')} Voltar</button>
 <section class="card ajdet"><div class="ajdethead"><div><span class="mono">#${c.numero}</span>${equipe?` · <b>${esc(c.empresa||'')}</b>`:''}<h2>${esc(c.titulo)}</h2><p class="caption">${esc(TIPOS[c.tipo]||c.tipo)} · ${esc(URG[c.urgencia]?.[0]||c.urgencia)} · aberto ${dh(c.created_at)}${c.nome?` por ${esc(c.nome)}`:''}${c.canal!=='portal'?` · retorno por ${esc(CANAIS[c.canal])}${c.telefone?` (${esc(c.telefone)}${c.retorno_quando?`, ${esc(c.retorno_quando)}`:''})`:''}`:''}</p></div><span class="badge ${c.etapa==='resolvido'?'ok':'info'}">${esc(ETAPA_NOME[c.etapa])}</span></div>
 ${rastreio(c,true)}<p class="caption ajprazo">${esc(prazoTxt(c))}${c.atendente_nome?` · atendente: ${esc(c.atendente_nome)}`:''}</p>
 <div class="atconversa ajconv" aria-live="polite">${conversa.map(m=>`<div class="atbolha ${m.de==='equipe'?'nos':''} ${m.de==='sistema'?'ajsis':''} ${m.interna?'ajinterna':''}"><small>${esc(m.de==='equipe'?(m.autor_nome||'Equipe Jarvis')+' · Equipe Jarvis':m.de==='sistema'?'Jarvis':m.autor_nome||'Você')} · ${dh(m.created_at)}${m.interna?' · nota interna':''}</small>${esc(m.texto||'')}</div>`).join('')}</div>
 ${equipe&&ctx?`<details class="ajctx"><summary>Informações técnicas anexadas</summary><pre>${esc(JSON.stringify(ctx,null,1))}</pre></details>`:''}
 ${c.etapa==='resolvido'&&!equipe?avaliarHtml(c):''}
 <div class="row" style="justify-content:space-between;align-items:flex-end;margin-top:14px"><label for="ajResp">${equipe?'Responder ao cliente':c.etapa==='resolvido'?'Ainda não resolveu? Escreva aqui que reabrimos':'Escrever para a equipe'}</label><button type="button" class="quiet small ajmic" data-aj-ditar="#ajResp" aria-pressed="false">${icon('mic')}<span>Ditar</span></button></div>
 <textarea id="ajResp" rows="4"></textarea>
 <div class="row wrap" style="margin-top:8px">${equipe?`<label class="ajcheck" style="margin:0"><input type="checkbox" id="ajInterna"> Nota interna (o cliente não vê)</label><select id="ajEtapa" aria-label="Etapa"><option value="">Manter etapa</option>${['analise','correcao','testando','aguardando_cliente','resolvido'].map(k=>`<option value="${k}">${ETAPA_NOME[k]}</option>`).join('')}</select>`:''}<button class="primary" data-aj="responder" data-id="${esc(c.id)}" data-eq="${equipe?1:0}">${icon('check')} Enviar</button></div>
 <div id="ajMsg2" class="caption" role="alert" style="min-height:20px;margin-top:8px"></div></section>`}

function avaliarHtml(c){if(c.nota)return `<div class="notice">Obrigado pela avaliação: ${'★'.repeat(c.nota)}${'☆'.repeat(5-c.nota)}${c.nota_comentario?` · "${esc(c.nota_comentario)}"`:''}</div>`;
 return `<div class="notice ajaval"><strong>Como foi o atendimento?</strong><div class="ajestrelas" role="radiogroup" aria-label="Nota de 1 a 5">${[1,2,3,4,5].map(n=>`<button class="quiet" role="radio" aria-checked="false" aria-label="${n} de 5" data-aj-nota="${n}" data-id="${esc(c.id)}">★</button>`).join('')}</div><input id="ajNotaCom" placeholder="Quer comentar? (opcional)" style="width:100%;margin-top:8px"></div>`}

function equipeView(){if(st.eqSel)return detalheView(st.eqSel,true);if(!st.fila)carregarFila();
 const agora=Date.now(),l=(st.fila||[]).filter(c=>st.filtroFila==='abertos'?c.etapa!=='resolvido':st.filtroFila==='vencendo'?c.etapa!=='resolvido'&&!c.primeira_resposta_em&&c.prazo&&new Date(c.prazo)-agora<2*36e5:st.filtroFila==='aguardando'?c.etapa==='aguardando_cliente':st.filtroFila==='resolvidos'?c.etapa==='resolvido':true);
 const sub=[['abertos','Em aberto'],['vencendo','Prazo vencendo'],['aguardando','Aguardando cliente'],['resolvidos','Resolvidos'],['empresas','Empresas'],['contatos','Contatos da Central']];
 const notas=(st.fila||[]).filter(c=>c.nota),media=notas.length?(notas.reduce((s,c)=>s+c.nota,0)/notas.length).toFixed(1):'—';
 const resp=(st.fila||[]).filter(c=>c.primeira_resposta_em).map(c=>(new Date(c.primeira_resposta_em)-new Date(c.created_at))/36e5).sort((a,b)=>a-b),med=resp.length?resp[Math.floor(resp.length/2)]:null;
 const top=`<div class="grid three ajkpi"><div class="card"><span class="caption">Em aberto</span><b>${(st.fila||[]).filter(c=>c.etapa!=='resolvido').length}</b></div><div class="card"><span class="caption">Primeira resposta (mediana)</span><b>${med==null?'—':med<1?Math.round(med*60)+' min':med.toFixed(1)+' h'}</b></div><div class="card"><span class="caption">Satisfação</span><b>${media}${notas.length?' / 5':''}</b></div></div>
 <div class="segtabs">${sub.map(([k,t])=>`<button class="${st.filtroFila===k?'active':''}" data-aj-fila="${k}">${t}</button>`).join('')}</div>`;
 if(st.filtroFila==='empresas'){if(!st.empresas)carregarEmpresas();return top+empresasHtml()}
 if(st.filtroFila==='contatos'){if(!st.cfg)carregarCfg();const c=st.cfg||{};return top+`<section class="card ajform"><h2>Contatos da Central</h2><p class="caption">Aparecem para todos os clientes na Central de ajuda e no site.</p>${[['suporte_whatsapp','WhatsApp do suporte (com DDD)'],['suporte_email','E-mail do suporte'],['suporte_horario','Horário de atendimento'],['fornecedor_razao','Razão social do fornecedor do Jarvis'],['fornecedor_cnpj','CNPJ do fornecedor']].map(([k,t])=>`<label for="cfg_${k}">${t}</label><input id="cfg_${k}" data-aj-cfg="${k}" value="${esc(c[k]||'')}" style="width:100%">`).join('')}<div class="row" style="margin-top:12px"><button class="primary" data-aj="salvarcfg">${icon('check')} Salvar contatos</button></div></section>`}
 return top+(l.length?`<div class="tablebox"><div class="tablewrap"><table><thead><tr><th>Nº</th><th>Empresa</th><th>Assunto</th><th>Urgência</th><th>Etapa</th><th>Prazo</th><th>Nota</th></tr></thead><tbody>${l.map(c=>{const venc=c.etapa!=='resolvido'&&!c.primeira_resposta_em&&c.prazo&&new Date(c.prazo)<agora;
  return `<tr class="clickrow" data-aj-eqabrir="${esc(c.id)}"><td class="mono">${c.numero}</td><td>${esc(c.empresa||'')}</td><td style="white-space:normal;min-width:280px">${!c.lido_equipe?'<span class="badge bad">novo</span> ':''}${c.origem==='proativo'?'<span class="badge info">proativo</span> ':''}<strong>${esc(c.titulo)}</strong><br><small class="caption">${esc(TIPOS[c.tipo]||c.tipo)}${c.canal!=='portal'?' · retorno por '+esc(CANAIS[c.canal]):''}</small></td><td><span class="badge ${c.urgencia==='parado'?'bad':c.urgencia==='alta'?'warn':''}">${esc(URG[c.urgencia]?.[0]||'')}</span></td><td>${esc(ETAPA_NOME[c.etapa])}</td><td class="${venc?'red':''}">${c.etapa==='resolvido'?'—':esc(prazoTxt(c))}</td><td>${c.nota?'★'.repeat(c.nota):''}</td></tr>`}).join('')}</tbody></table></div></div>`:'<div class="empty">Nada por aqui.</div>')}

function empresasHtml(){const l=st.empresas;if(!l)return '<div class="empty">Carregando…</div>';
 return `<section class="card ajform"><h2>Liberar emitente fiscal</h2><p class="caption">Depois de conferir o CNPJ, o contrato e o certificado A1 da empresa (e de cadastrar o CNPJ na conta Focus NFe do Jarvis). Sem isso, a empresa não emite NF-e, GNRE nem lê as notas da SEFAZ.</p>
 <div class="grid three"><div><label for="emWs">Empresa</label><select id="emWs" style="width:100%">${l.map(e=>`<option value="${esc(e.id)}">${esc(e.nome)}</option>`).join('')}</select></div><div><label for="emCnpj">CNPJ</label><input id="emCnpj" inputmode="numeric" style="width:100%"></div><div><label for="emUf">UF</label><input id="emUf" maxlength="2" style="width:100%;text-transform:uppercase"></div></div>
 <div class="row" style="margin-top:12px"><button class="primary" data-aj="liberar">${icon('shield')} Liberar emissão</button></div></section>
 <div class="tablebox"><div class="tablewrap"><table><thead><tr><th>Empresa</th><th>Desde</th><th>Assinatura</th><th>Emitente</th><th class="num">Pessoas</th><th class="num">Chamados</th><th class="num">Falhas</th></tr></thead><tbody>${l.map(e=>`<tr><td><strong>${esc(e.nome)}</strong></td><td>${esc(String(e.criada||'').split('-').reverse().join('/'))}</td><td><span class="badge ${['ativa','interno'].includes(e.assinatura)?'ok':e.assinatura==='teste'?'info':'warn'}">${esc(e.assinatura||'—')}${e.assinatura==='teste'&&e.teste_ate?' até '+esc(String(e.teste_ate).split('-').reverse().join('/')):''}</span></td><td>${e.emitente?esc(e.emitente)+' · '+esc(e.uf||''):'<span class="caption">não liberado</span>'}</td><td class="num">${e.membros}</td><td class="num">${e.chamados_abertos}</td><td class="num">${e.erros_abertos}</td></tr>`).join('')}</tbody></table></div></div>`}

async function carregarManual(){if(st.carregandoManual||st.manualUrl)return;st.carregandoManual=true;st.manualErro='';
 // O manual geral (loja de demonstração) vale para todas as empresas; uma empresa pode ter um manual próprio com o mesmo id.
 try{const {data,error}=await Cloud.client.from('documentos').select('parte,conteudo,workspace_id').eq('id','manual').order('parte');if(error)throw error;
  const proprio=(data||[]).filter(x=>x.workspace_id===Cloud.ws),partes=proprio.length?proprio:(data||[]).filter(x=>!x.workspace_id);
  if(!partes.length){st.manualErro='vazio';return}
  st.manualUrl=URL.createObjectURL(new Blob([partes.map(x=>x.conteudo).join('')],{type:'text/html'}))}catch(e){st.manualErro=e.message||String(e)}finally{st.carregandoManual=false;redesenhar()}}
// O manual completo é a Academia do site (um capítulo por área, com passo a passo e exercícios na demonstração).
const ACADEMIA=[['primeiros-passos','Primeiros passos: conhecer o Jarvis e preparar a empresa'],['integracoes','Integrações, importação de relatórios e confiança nos dados'],['conciliacao','Conciliação de vendas, faturamento e fechamento'],['vendas','Vendas: acompanhar o mês, vender direto e conhecer clientes'],['margem-e-precos','Margem, lucro real e preços'],['financeiro','Financeiro: contas a pagar, bancos e fluxo de caixa'],['estoque-e-compras','Estoque, compras e importações'],['fiscal','Fiscal: NF-e, devoluções, DIFAL e notas da SEFAZ'],['atendimento-e-crm','Atendimento, experiência do cliente e CRM'],['orcamento-e-resultado','Orçamento, DRE e contabilidade'],['folha-e-ponto','Folha de pagamento e ponto'],['relatorios-ia-auditoria','Relatórios, alertas, assistente de IA, auditoria e ajuda']];
function manualView(){if(!st.manualUrl&&!st.manualErro)carregarManual();
 const academia=`<section class="card"><h2>Manual completo na Academia Jarvis</h2><p class="caption">Cada capítulo explica as telas de uma área, passo a passo, com exercícios para praticar na demonstração. Abre numa nova aba.</p><div style="display:grid;gap:2px;margin-top:10px">${ACADEMIA.map(([slug,t],i)=>`<a class="listline" href="/academia/ecommerce/${slug}/" target="_blank" rel="noopener"><span><b>${i+1}.</b> ${esc(t)}</span>${icon('arrow')}</a>`).join('')}</div><p class="caption" style="margin-top:10px"><a href="/academia/ecommerce/" target="_blank" rel="noopener">Ver todos os capítulos e materiais</a> · Dica: cada tela tem o botão ? no título, e o Mapa do ERP lista todas as telas.</p></section>`;
 return academia+(st.manualUrl?`<h3 style="margin:18px 0 8px">Manual da sua empresa</h3><div class="spmanual"><iframe src="${st.manualUrl}" title="Manual do Jarvis"></iframe></div>`:st.manualErro&&st.manualErro!=='vazio'?`<p class="caption" style="margin-top:10px">${esc(st.manualErro)}</p>`:'')}

function internosView(){const l=st.internos||[];const SIT={aberto:'Aberto',andamento:'Em andamento',aguardando:'Aguardando',resolvido:'Resolvido'};
 return `<div class="notice">Pedidos que a sua equipe fez ao responsável pelo sistema antes da Central de ajuda. Novos assuntos: use <button class="small" data-aj-aba="abrir">Abrir chamado</button> — vai direto para a equipe Jarvis.</div>
 <div class="tablebox"><div class="tablewrap"><table><thead><tr><th>Nº</th><th>Assunto</th><th>Quem abriu</th><th>Situação</th><th>Atualizado</th></tr></thead><tbody>${l.map(c=>`<tr><td class="mono">${c.numero}</td><td style="white-space:normal"><strong>${esc(c.titulo)}</strong><br><small class="caption">${esc(String(c.descricao||'').slice(0,160))}</small></td><td>${esc(c.nome||c.email||'')}</td><td>${esc(SIT[c.status]||c.status)}</td><td>${dh(c.updated_at)}</td></tr>`).join('')}</tbody></table></div></div>`}

function view(){if(!window.Cloud?.ws)return '<div class="empty">Entre no Jarvis para usar a Central de ajuda.</div>';
 if(!st.cfg)carregarCfg();if(st.equipe===null)verEquipe();if(st.internos===null){st.internos=[];carregarInternos()}if(!st.lista&&!st.carregando)carregar();
 if(st.aba==='equipe'&&!st.equipe)st.aba='inicio';
 const corpo=st.aba==='abrir'?abrirView():st.aba==='meus'?meusView():st.aba==='manual'?manualView():st.aba==='internos'?internosView():st.aba==='equipe'?equipeView():inicioView();
 return `<div class="ajuda ${pref.contraste?'ajcontraste':''}" style="--ajfonte:${pref.fonte}">${head()}${corpo}</div>`}

// ── Ações ──
function lerForm(){const f=st.form;if($('#ajTitulo'))f.titulo=$('#ajTitulo').value;if($('#ajDesc'))f.descricao=$('#ajDesc').value;if($('#ajTel'))f.telefone=$('#ajTel').value;if($('#ajQuando'))f.retorno_quando=$('#ajQuando').value;if($('#ajAnexar'))f.anexar=$('#ajAnexar').checked}
function novoChamado(pre){st.form={tipo:'duvida',urgencia:'normal',canal:'portal',anexar:true,...pre};st.aba='abrir';st.sel=null;render();setTimeout(()=>$('#ajTitulo')?.focus(),50)}
document.addEventListener('input',e=>{
 if(e.target.id==='ajBusca'){st.q=e.target.value;const r=$('#ajRes');if(r){const res=buscar(st.q);r.innerHTML=st.q?(res.length?res.map(x=>artigoHtml(x.a,x.i,true)).join(''):`<p class="caption">Nenhuma resposta pronta para isso. <button class="small" data-aj-aba="abrir">Abrir um chamado</button></p>`):''}return}
 if(e.target.id==='ajTitulo'||e.target.id==='ajDesc'){lerForm();const box=$('#ajSug');if(box){const sug=st.form.titulo?buscar(st.form.titulo+' '+(st.form.descricao||'')).slice(0,3):[];box.innerHTML=sug.length?`<div class="ajsug"><b>Talvez isso resolva agora:</b>${sug.map(x=>artigoHtml(x.a,x.i,false)).join('')}</div>`:''}}});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-aj],[data-aj-aba],[data-aj-ir],[data-aj-f],[data-aj-abrir],[data-aj-eqabrir],[data-aj-voltar],[data-aj-fila],[data-aj-fonte],[data-aj-contraste],[data-aj-ditar],[data-aj-nota],[data-aj-util],[data-aj-ligacao],[data-aj-fiscal]');if(!b||!b.closest('.ajuda'))return;const d=b.dataset;
 if(d.ajAba){lerForm();st.aba=d.ajAba;st.sel=null;st.eqSel=null;if(st.aba==='meus')carregar();render();return}
 if(d.ajIr){navigate(d.ajIr);return}
 if(d.ajF){lerForm();st.form[d.ajF]=d.v;render();return}
 if(d.ajAbrir){st.sel=d.ajAbrir;delete st.msgs[d.ajAbrir];render();return}
 if(d.ajEqabrir){st.eqSel=d.ajEqabrir;delete st.msgs[d.ajEqabrir];render();return}
 if(d.ajVoltar){st.sel=null;st.eqSel=null;st.aba=d.ajVoltar;render();return}
 if(d.ajFila){st.filtroFila=d.ajFila;if(d.ajFila==='empresas')st.empresas=null;render();return}
 if(d.ajFonte!=null){const v=Number(d.ajFonte);pref.fonte=v===0?1:Math.min(1.4,Math.max(.9,+(pref.fonte+v*.1).toFixed(2)));lsSet('jarvis_ajuda_fonte',String(pref.fonte));render();return}
 if(d.ajContraste){pref.contraste=!pref.contraste;lsSet('jarvis_ajuda_contraste',pref.contraste?'1':'0');render();return}
 if(d.ajDitar){ditar(b,d.ajDitar);return}
 if(d.ajLigacao){novoChamado({canal:'ligacao',titulo:'Quero que me liguem'});return}
 if(d.ajFiscal){novoChamado({tipo:'fiscal',titulo:'Liberar a emissão de NF-e pelo Jarvis',descricao:'Quero emitir NF-e pelo Jarvis. CNPJ da empresa: \nUF: \nJá tenho certificado A1? (sim/não): '});return}
 if(d.ajUtil){if(d.ajUtil==='sim'){toast('Que bom! Qualquer coisa, estamos aqui.');audit('Ajuda: resposta pronta resolveu',ARTIGOS[+d.i]?.[0]||'');return}novoChamado({titulo:ARTIGOS[+d.i]?.[0]||''});return}
 if(d.ajNota){const n=+d.ajNota,com=$('#ajNotaCom')?.value||'';const {error}=await Cloud.client.rpc('suporte_avaliar',{chamado:d.id,p_nota:n,comentario:com});if(error){toast(error.message);return}const c=(st.lista||[]).find(x=>x.id===d.id);if(c){c.nota=n;c.nota_comentario=com}toast('Obrigado pela avaliação!');render();return}
 if(d.aj==='enviar'){lerForm();const f=st.form,m=$('#ajMsg');if(!(f.titulo||'').trim()||(f.descricao||'').trim().length<5){m.innerHTML='<span class="red">Conte o assunto e o que aconteceu.</span>';return}
  if((f.canal==='whatsapp'||f.canal==='ligacao')&&String(f.telefone||'').replace(/\D/g,'').length<10){m.innerHTML='<span class="red">Informe o telefone com DDD para o retorno.</span>';return}
  st.enviando=true;b.disabled=true;m.textContent='Enviando…';
  const {data,error}=await Cloud.client.rpc('suporte_abrir',{p:{workspace_id:Cloud.ws,tipo:f.tipo,urgencia:f.urgencia,titulo:f.titulo.trim(),descricao:f.descricao.trim(),tela:st.origem||null,canal:f.canal,telefone:f.telefone||null,retorno_quando:f.retorno_quando||null,contexto:f.anexar?contexto():{}}});
  st.enviando=false;if(error){m.innerHTML=`<span class="red">${esc(error.message)}</span>`;b.disabled=false;return}
  audit('Chamado aberto na Central de ajuda',`#${data?.numero} · ${f.titulo}`);toast(`Chamado #${data?.numero} enviado. Acompanhe em Meus chamados.`);st.form={tipo:'duvida',urgencia:'normal',canal:'portal',anexar:true};st.lista=null;st.aba='meus';st.sel=data?.id||null;await carregar();if(st.equipe)carregarFila();render();return}
 if(d.aj==='responder'){const texto=($('#ajResp')?.value||'').trim(),eq=d.eq==='1',etapa=eq?($('#ajEtapa')?.value||null):null,interna=eq&&!!$('#ajInterna')?.checked;
  if(!texto&&!etapa){$('#ajMsg2').innerHTML='<span class="red">Escreva a mensagem.</span>';return}b.disabled=true;
  const {error}=await Cloud.client.rpc('suporte_responder',{chamado:d.id,texto,interna,nova_etapa:etapa});b.disabled=false;if(error){$('#ajMsg2').innerHTML=`<span class="red">${esc(error.message)}</span>`;return}
  toast(eq?'Resposta enviada ao cliente.':'Mensagem enviada à equipe Jarvis.');delete st.msgs[d.id];if(eq)await carregarFila();await carregar();render();return}
 if(d.aj==='liberar'){const ws=$('#emWs').value,cnpj=$('#emCnpj').value,uf=$('#emUf').value;const {data,error}=await Cloud.client.rpc('equipe_liberar_emitente',{ws,p_cnpj:cnpj,p_uf:uf});if(error){toast(error.message);return}toast(data||'Emitente liberado.');st.empresas=null;render();return}
 if(d.aj==='salvarcfg'){for(const el of document.querySelectorAll('[data-aj-cfg]')){const {error}=await Cloud.client.rpc('equipe_config',{p_chave:el.dataset.ajCfg,p_valor:el.value.trim()});if(error){toast(error.message);return}}st.cfg=null;toast('Contatos da Central salvos.');render();return}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='ajBusca'){e.preventDefault();const p=document.querySelector('#ajRes details');if(p){p.open=true;p.querySelector('summary')?.focus()}}});

// Chegada de respostas (cliente) e de chamados novos (equipe): contador no menu, aviso e notificação do navegador.
let vistos=null;setInterval(async()=>{if(!window.Cloud?.ws||!Cloud.client)return;await carregar();if(st.equipe)await carregarFila();
 const ids=new Set([...(st.lista||[]).filter(c=>!c.lido_cliente).map(c=>'c'+c.id+c.updated_at),...(st.equipe?(st.fila||[]).filter(c=>!c.lido_equipe&&c.etapa!=='resolvido').map(c=>'e'+c.id+c.updated_at):[])]);
 if(vistos){const novos=[...ids].filter(x=>!vistos.has(x));if(novos.length){const eq=novos.some(x=>x[0]==='e'),txt=eq?'Chamado novo ou respondido na fila da equipe Jarvis':'A equipe Jarvis respondeu o seu chamado';toast(txt);try{if(Notification?.permission==='granted')new Notification('Jarvis · Central de ajuda',{body:txt})}catch{}}}vistos=ids},60000);
setTimeout(()=>{if(window.Cloud?.ws){carregar();verEquipe()}},4000);
// Guarda a tela de onde a pessoa veio (vai no contexto do chamado).
const nav0=navigate;navigate=function(p){if(p==='suporte'&&page!=='suporte'){st.origemId=page;st.origem=nomeTela(page)}return nav0.apply(this,arguments)};
window.Suporte={avisos:()=>{const n=naoLidos(),q=st.equipe?filaNova():0;const a=[];if(n)a.push(['info','help',`${n} chamado(s) com novidade da equipe Jarvis`,'Central de ajuda','suporte']);if(q)a.push(['warn','headset',`${q} chamado(s) na fila da equipe Jarvis`,'Central de ajuda','suporte']);return a},
 abrir:aba=>{st.aba=aba||'inicio';navigate('suporte')},novo:pre=>{navigate('suporte');novoChamado(pre||{})}};
Object.assign(paths,{help:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3 M12 17h.01'});
// Visual da Central (junto do módulo; usa as variáveis do tema, claro e escuro).
if(!document.getElementById('ajudaCss')){const s=document.createElement('style');s.id='ajudaCss';s.textContent=`
.ajuda{font-size:calc(14px*var(--ajfonte,1))}.ajuda .caption,.ajuda small{font-size:calc(11.5px*var(--ajfonte,1))}
.ajbar{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}.ajbar .segtabs{margin-bottom:16px}.ajacess{display:flex;gap:4px;flex-wrap:wrap}.ajacess .active{color:var(--accent);border-color:var(--accent)}
.ajhero{border:1px solid rgb(var(--ar) / 22%);border-radius:18px;padding:30px 28px;margin-bottom:18px;background:radial-gradient(ellipse at 85% -30%,rgb(var(--ar2) / 30%),transparent 60%),linear-gradient(115deg,var(--panel),var(--panel2))}
.ajhero h1{font-size:calc(30px*var(--ajfonte,1));margin:4px 0 6px}.ajbusca{display:flex;align-items:center;gap:10px;margin:18px 0 6px;padding:4px 6px 4px 16px;border:1px solid rgb(var(--ar) / 35%);border-radius:14px;background:var(--panel);max-width:760px}
.ajbusca input{border:0;background:transparent;flex:1;font-size:calc(16px*var(--ajfonte,1));padding:12px 4px;min-width:0}.ajbusca input:focus{outline:none}.ajbusca:focus-within{box-shadow:0 0 0 3px rgb(var(--ar) / 25%)}
#ajRes{max-width:760px}.ajart{border:1px solid var(--line);border-radius:12px;padding:0 14px;margin:8px 0;background:var(--panel)}.ajart summary{display:flex;gap:10px;align-items:center;cursor:pointer;padding:12px 0;font-weight:600;list-style:none}.ajart summary::-webkit-details-marker{display:none}
.ajart summary .icon{color:var(--accent)}.ajart p{margin:0 0 10px;line-height:1.65}.ajart>button{margin-bottom:10px}.ajutil{display:flex;flex-wrap:wrap;align-items:center;gap:4px;color:var(--muted);font-size:12px;padding:8px 0 12px;border-top:1px dashed var(--line)}
.ajacoes{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:18px}.ajacao{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:18px;border-radius:14px;text-align:left;background:var(--panel);text-decoration:none;color:var(--text);border:1px solid var(--line);transition:.18s}
.ajacao:hover{border-color:var(--accent);transform:translateY(-2px)}.ajacao .icon{width:24px;height:24px;color:var(--accent);margin-bottom:6px}.ajacao span{color:var(--muted);font-size:12px}
.ajsaude{list-style:none;margin:0;padding:0}.ajsaude li{display:flex;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}.ajsaude li:last-child{border:0}.ajsaude li>div{flex:1;display:flex;flex-direction:column}.ajsaude li span{color:var(--muted);font-size:12px}
.ajsaude i{width:10px;height:10px;border-radius:50%;flex:none;background:var(--muted)}.ajsaude .ok i{background:var(--green)}.ajsaude .warn i{background:var(--gold)}.ajsaude .bad i{background:var(--red)}.ajsaude .info i{background:var(--accent)}
.ajform{max-width:880px}.ajchips{border:0;padding:0;margin:14px 0 0;display:flex;flex-wrap:wrap;gap:8px}.ajchips legend{color:var(--muted);font-size:12px;margin-bottom:8px;padding:0}.ajchips button{border-radius:999px;padding:8px 14px;flex-direction:column;align-items:flex-start;gap:0}
.ajchips button.active{background:rgb(var(--ar) / 14%);border-color:var(--accent);color:var(--text)}.ajchips button small{color:var(--muted);font-size:10.5px}.ajchips button.urg.active{background:color-mix(in srgb,var(--red) 16%,transparent);border-color:var(--red)}
.ajsug{margin:10px 0;padding:12px 14px;border-radius:12px;background:rgb(var(--ar) / 5%);border:1px dashed rgb(var(--ar) / 35%)}.ajsug>b{font-size:12px}.ajcheck{display:flex;gap:8px;align-items:flex-start;line-height:1.5}.ajcheck input{margin-top:3px}
.ajmic.gravando{color:var(--red);border-color:var(--red);animation:ajpulso 1.2s infinite}@keyframes ajpulso{50%{box-shadow:0 0 0 6px color-mix(in srgb,var(--red) 18%,transparent)}}
.ajlista{display:grid;gap:10px}.ajitem{display:flex;flex-direction:column;align-items:stretch;gap:6px;text-align:left;padding:16px 18px;border-radius:14px;background:var(--panel)}.ajitem.novo{border-color:rgb(var(--ar) / 50%)}.ajitemtop{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ajitem small{color:var(--muted)}
.ajtrack{display:flex;list-style:none;margin:6px 0 2px;padding:0;gap:0}.ajtrack li{flex:1;position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:10.5px;color:var(--muted);text-align:center}
.ajtrack li i{width:12px;height:12px;border-radius:50%;background:var(--line);border:2px solid var(--panel);position:relative;z-index:1}.ajtrack li:before{content:'';position:absolute;top:6px;left:-50%;width:100%;height:2px;background:var(--line)}.ajtrack li:first-child:before{display:none}
.ajtrack li.feito i,.ajtrack li.feito:before,.ajtrack li.agora:before{background:var(--accent)}.ajtrack li.agora i{background:var(--accent);box-shadow:0 0 0 5px rgb(var(--ar) / 22%)}.ajtrack li.agora{color:var(--text);font-weight:650}
.ajtrack.grande li{font-size:12px}.ajtrack.grande li i{width:16px;height:16px}.ajtrack.grande li:before{top:8px}.ajprazo{text-align:center;margin:8px 0 14px}
.ajdet{margin-top:10px}.ajdethead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}.ajdethead h2{margin:4px 0}.ajconv{max-height:420px}.ajsis{align-self:center;background:transparent;border-style:dashed;font-size:12px}.ajinterna{border-color:var(--gold);background:color-mix(in srgb,var(--gold) 8%,transparent)}
.ajctx pre{white-space:pre-wrap;font-size:11px;background:var(--panel2);padding:10px;border-radius:8px}.ajestrelas{display:flex;gap:4px;margin-top:6px}.ajestrelas button{font-size:24px;padding:2px 8px;color:var(--gold)}
.ajkpi{margin-bottom:14px}.ajkpi .card{padding:14px 16px}.ajkpi b{display:block;font-size:22px;margin-top:4px}
.ajcontraste{--muted:var(--text);--line:currentColor}.ajcontraste .card,.ajcontraste .ajart,.ajcontraste .ajacao,.ajcontraste .ajitem{border-width:2px}.ajcontraste a,.ajcontraste .ajart summary{text-decoration:underline}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.ajuda :focus-visible{outline:3px solid var(--accent);outline-offset:3px}
@media(max-width:620px){.ajhero{padding:22px 18px}.ajtrack li span{font-size:9px}.ajdethead{flex-direction:column}}`;document.head.appendChild(s)}
addPage('suporte','help','Central de ajuda',view,'Respostas prontas, chamados com rastreio e prazo, saúde da conta e o manual — falando direto com a equipe Jarvis.','',()=>{});
})();
