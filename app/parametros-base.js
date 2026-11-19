// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Parâmetros do Jarvis E-Commerce (decisão do dono em 19/11/2026: nada que mexe nos números da empresa fica fixo no
// código). Aqui ficam, num lugar só:
//   • o CATÁLOGO de cada parâmetro (rótulo, unidade, ajuda, padrão, faixa válida), agrupado por área — o padrão é o
//     número que o código usava até 19/11/2026, então nada muda até a empresa mexer;
//   • Parametros.get('grupo.chave'): o valor que vale (o da empresa ou o padrão). Os valores da empresa ficam em
//     workspace_settings.data.gerencial.parametros.v (sincronizados como o resto das configurações); alguns parâmetros já
//     tinham casa e continuam nela (a meta Alvo em pricing.metas, a presunção do IRPJ/CSLL em gerencial.fiscal, a
//     provisão dos tributos em gerencial.contabil);
//   • as regras que várias telas repetiam: o pedido cancelado, a curva ABC, o cliente VIP, as tabelas do ICMS por UF, a
//     alíquota interestadual, a base do PIS/COFINS, o IRPJ/CSLL do lucro presumido e a tabela do Simples Nacional;
//   • window.Canais: o cadastro dos canais de venda (gerencial.canais), com a regra de preço de cada tipo de anúncio na
//     casa de sempre (pricing.canais, Regras de venda), o prazo de repasse, as contas contábeis, o intermediador da NF-e e
//     as palavras que reconhecem o canal.
// A tela (Configurações › Parâmetros e Cadastros › Canais de venda) está em web/parametros-tela.js. Cada mudança vai para
// o Histórico e auditoria (audit_log), com quem, quando e o valor antigo → novo.
(()=>{
const D=()=>{try{return db}catch{return null}};
const ger=()=>{const d=D();return d?(d.gerencial||(d.gerencial={})):{}};
const num=v=>{if(typeof v==='number')return v;const s=String(v??'').trim().replace(/\s/g,'').replace(/^R\$/,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.');return s===''?NaN:Number(s)};
/** Taxa digitada: vazio/nulo → o padrão; 0 → 0 (antes, `Number(x)||padrão` trocava o 0 digitado pelo padrão). */
const taxa=(v,padrao)=>{if(v==null||String(v).trim()==='')return padrao;const x=num(v);return Number.isFinite(x)?x:padrao};
const copia=o=>JSON.parse(JSON.stringify(o));

// ─────────── Casas antigas (parâmetros que já tinham onde morar) ───────────
const lerLocal=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{try{return localStorage.getItem(k)}catch{return null}}};
const tirarLocal=k=>{try{localStorage.removeItem(k)}catch{}};
const CASAS={
 // A meta Alvo mora nas Regras de venda (pricing.metas), já convertidas do formato antigo por window.Preco.regras().
 'precos.alvo':{ler:()=>D()?.pricing?.metas?.alvo,gravar:v=>{const d=D();if(!d)return;const p=window.Preco?.regras?.()||(d.pricing=d.pricing||{});p.metas={...(p.metas||{}),alvo:v}}},
 'fiscal.presuncao_irpj':{ler:()=>{const g=ger();return g.fiscal?.presuncao_irpj??g.contabil?.presuncao_irpj},gravar:v=>{const g=ger();g.fiscal={...(g.fiscal||{}),presuncao_irpj:v}}},
 'fiscal.presuncao_csll':{ler:()=>{const g=ger();return g.fiscal?.presuncao_csll??g.contabil?.presuncao_csll},gravar:v=>{const g=ger();g.fiscal={...(g.fiscal||{}),presuncao_csll:v}}},
 'contabil.provisao':{ler:()=>ger().contabil?.provisao,gravar:v=>{const g=ger();g.contabil={...(g.contabil||{}),provisao:v}},
  // eb_contab (só no navegador, até 19/11/2026): a chave "Tributos por competência" da Contabilidade automática.
  local:()=>{const x=lerLocal('eb_contab');return x&&typeof x==='object'&&typeof x.provisao==='boolean'?x.provisao:null},localChave:'eb_contab'},
};
// eb_estoque_param (só no navegador, até 19/11/2026): cobertura alvo, segurança e prazo de reposição padrão.
const ESTOQUE_LOCAL={'estoque.alvo':'alvo','estoque.seguranca':'seguranca','estoque.prazo':'prazoPadrao'};
for(const [k,campo] of Object.entries(ESTOQUE_LOCAL))CASAS[k]={local:()=>{const x=lerLocal('eb_estoque_param');return x&&typeof x==='object'&&x[campo]!=null&&Number.isFinite(Number(x[campo]))?Number(x[campo]):null},localChave:'eb_estoque_param'};
// eb_gnre_pag (só no navegador): data de pagamento das guias GNRE — 'auto' (a do vencimento) ou 'fixa'.
CASAS['fiscal.gnre_pagamento']={local:()=>{const x=lerLocal('eb_gnre_pag');return x==='fixa'||x==='auto'?x:null},localChave:'eb_gnre_pag'};

// ─────────── Catálogo ───────────
// [chave, rótulo, unidade, padrão, mín, máx, ajuda, extras]; extras: {tipo:'bool'|'sel'|'lista'|'datas'|'texto', ops, int}
const SAZONAL_PADRAO=[{id:'criancas',nome:'Dia das Crianças',dia:12,mes:10,pico:21,fator:2.5,dica:'Pico nas 3 semanas antes; os produtos de maior valor costumam concentrar a receita.'},
 {id:'blackfriday',nome:'Black Friday',regra:'blackfriday',pico:10,fator:2.2,dica:'Semana da Black Friday; preço e frete decidem — confira margem no Radar antes de dar desconto.'},
 {id:'natal',nome:'Natal',dia:25,mes:12,pico:30,fator:2.8,dica:'Dezembro inteiro; o prazo de entrega dos marketplaces fecha por volta de 18/12.'}];
const GRUPOS=[
 {id:'precos',t:'Preços e margem',ic:'tag',d:'As metas e as janelas da conta única de preço (Formação de preço, Margem real, Promoções, Estoque parado, Vigia de preços).',itens:[
  ['precos.minimo','Meta Mínima (margem líquida)','%',0,-50,80,'Abaixo dela a venda dá prejuízo. Com 0%, o Mínimo é o preço de lucro líquido zero.'],
  ['precos.alvo','Meta Alvo (margem líquida do preço sugerido)','%',10,-50,80,'A margem líquida do preço sugerido; vale em todas as telas de preço. Também em Preços e margem › Regras de venda.'],
  ['precos.tolerancia_alvo','Tolerância do "no alvo"','p.p.',0.05,0,5,'Margem até esta distância abaixo do Alvo ainda conta como "no alvo" (arredondamento).'],
  ['precos.fixas_meses','Despesas fixas: meses da DRE na média','meses',3,1,12,'Quantos meses de balancete entram na média das despesas fixas rateadas no preço.',{int:true}],
  ['precos.trib_meses','Tributos: meses fechados na média','meses',3,1,6,'Quantos meses já fechados (com receita) entram na alíquota de tributos sobre a venda.',{int:true}],
  ['precos.trib_janela','Tributos: meses olhados para trás','meses',6,1,12,'Até quantos meses antes do atual o Jarvis procura os meses fechados com receita.',{int:true}],
  ['precos.canal_reserva','Canal principal sem vendas','',"Mercado Livre",null,null,'O canal usado na conta do produto que ainda não vendeu nos últimos dias (Estoque parado, Promoções).',{tipo:'sel',ops:'regras'}],
  ['precos.canal_dias','Canal principal: janela de vendas','dias',180,7,730,'O canal principal de um produto é o que mais vendeu as unidades dele nesta janela.',{int:true}],
  ['precos.custo_mudou_pct','Custo: aviso de nota de entrada nova','%',2,0,100,'Avisa quando a última nota de entrada muda o custo mais do que isso.'],
  ['precos.custo_mudou_dias','Custo: nota nova até','dias',30,1,365,'Só avisa a mudança de custo de notas emitidas nestes dias.',{int:true}],
  ['precos.custo_velho_dias','Custo: sem nota de entrada há','dias',180,30,1095,'Custo pela nota mais velha que isso fica marcado como "pode estar velho".',{int:true}],
  ['precos.custo_bling_pct','Custo: diferença para o Bling','%',2,0,100,'Diferença entre o custo do Jarvis e o do Bling que vale atualizar o Bling.'],
  ['precos.real_min_pedidos','Regra × real: vendas mínimas','vendas',5,1,1000,'Só compara a tarifa da regra com a real do canal com pelo menos estas vendas nos últimos 30 dias.',{int:true}],
  ['precos.real_tarifa_pp','Regra × real: tarifa longe do real','p.p.',1.5,0,50,'Diferença entre a tarifa da regra e a real que pede revisão (e "bate com o real" até ela).'],
  ['precos.real_ruim_pp','Regra × real: diferença grave','p.p.',4,0,50,'Acima desta diferença o selo do canal fica vermelho.'],
  ['precos.real_fixas_pp','Regra × real: despesas fixas','p.p.',2,0,50,'Despesas fixas digitadas longe da DRE por mais que isso pedem revisão.'],
  ['precos.real_ads_pp','Regra × real: anúncios','p.p.',1.5,0,50,'Percentual de anúncios da regra longe do real por mais que isso pede revisão.']]},
 {id:'promocoes',t:'Promoções',ic:'spark',d:'Quando o Jarvis sugere queimar estoque, promover com folga, promover leve ou segurar.',itens:[
  ['promo.ritmo_dias','Ritmo de venda (janela)','dias',90,7,365,'O ritmo de cada produto é a venda destes dias; cobertura = saldo ÷ ritmo.',{int:true}],
  ['promo.cobertura_min','Pouco estoque: cobertura abaixo de','dias',15,0,365,'Produto com menos dias de estoque do que isso não deve entrar em promoção.',{int:true}],
  ['promo.cobertura_queimar','Queimar estoque: cobertura acima de','dias',120,1,1095,'Produto com mais dias de estoque do que isso (e espaço para desconto) pede promoção forte.',{int:true}],
  ['promo.desc_queimar','Queimar estoque: desconto possível a partir de','%',5,0,90,'Espaço de desconto até o Mínimo a partir do qual a promoção forte compensa.'],
  ['promo.desc_folga','Promoção com folga: desconto possível a partir de','%',8,0,90,'Com a margem no Alvo e esse espaço até o Mínimo, dá para baixar o preço e ganhar volume.'],
  ['promo.desc_leve','Promoção leve: desconto possível a partir de','%',3,0,90,'Espaço pequeno: cupom, frete ou destaque.']]},
 {id:'margem',t:'Margem real e tarifas',ic:'chart',d:'Os alertas da Margem real (tarifa fora do padrão, o que mudou) e o alerta semanal de tarifa.',itens:[
  ['margem.tarifa_fora_x','Tarifa fora do padrão: vezes a mediana','×',1.5,1,10,'Tarifa do pedido acima da mediana do anúncio vezes este número (e acima do valor abaixo) é marcada.'],
  ['margem.tarifa_fora_rs','Tarifa fora do padrão: excesso mínimo','R$',5,0,10000,'Só marca quando o excesso sobre a mediana passa deste valor.'],
  ['margem.min_unidades','Unidades mínimas para julgar um anúncio','un.',3,1,1000,'Anúncio com menos unidades vendidas não entra no aviso de prejuízo.',{int:true}],
  ['margem.mudou_preco_pct','O que mudou: queda do preço médio','%',3,0,100,'Preço médio que caiu mais que isso entre os dois períodos aparece como causa.'],
  ['margem.mudou_custo_pct','O que mudou: alta do custo','%',3,0,100,'Custo que subiu mais que isso aparece como causa.'],
  ['margem.mudou_tarifa_pp','O que mudou: alta da tarifa','p.p.',1,0,100,'Tarifa (em % da venda) que subiu mais que isso aparece como causa.'],
  ['margem.mudou_frete_pct','O que mudou: alta do frete','%',10,0,1000,'Frete por unidade que subiu mais que isso (e mais que o valor abaixo) aparece como causa.'],
  ['margem.mudou_frete_rs','O que mudou: alta mínima do frete','R$',0.5,0,1000,'Alta do frete por unidade abaixo deste valor não aparece.'],
  ['tarifa.semana_dias','Alerta de tarifa: semana recente','dias',7,1,60,'A tarifa média destes últimos dias fechados é comparada com a dos dias anteriores (vale também para o alerta diário do servidor).',{int:true}],
  ['tarifa.base_dias','Alerta de tarifa: período de comparação','dias',28,7,180,'Quantos dias antes da semana recente formam a tarifa de referência.',{int:true}],
  ['tarifa.limiar_pp','Alerta de tarifa: mudança mínima','p.p.',1.5,0,50,'Mudança da tarifa média que dispara o alerta.'],
  ['tarifa.min_venda','Alerta de tarifa: venda mínima na semana','R$',1000,0,1e7,'Canal com venda menor na semana recente não dispara o alerta.'],
  ['tarifa.min_pedidos','Alerta de tarifa: pedidos mínimos na semana','pedidos',20,1,10000,'Canal com menos pedidos na semana recente não dispara o alerta.',{int:true}],
  ['tarifa.min_pedidos_tela','Tarifa da semana: pedidos para mostrar','pedidos',5,1,10000,'Canal com menos pedidos na semana não aparece no quadro da tarifa semanal.',{int:true}]]},
 {id:'cancelamento',t:'Pedido cancelado',ic:'close',d:'Uma regra só para todas as telas (Margem real, Rentabilidade, Resumo, Saldos a receber, Pendências).',itens:[
  ['cancel.taxa_pct','Taxa a partir de (% do bruto)','%',95,1,1000,'Pedido cuja taxa chega a este percentual do bruto é cancelado ou reembolsado.'],
  ['cancel.itens_pct','Bruto abaixo de (% dos itens)','%',50,0,100,'Pedido cujo bruto ficou abaixo deste percentual do valor dos itens foi cancelado em parte (o marketplace zerou a venda). 0 desliga.']]},
 {id:'conciliacao',t:'Conciliação e bancos',ic:'link',d:'Como o Jarvis pontua as sugestões de vínculo (Conciliação de vendas e Bancos). A regra de "Conciliado" (± R$ 0,01) é fixa: é a mesma do banco de dados.',itens:[
  ['conc.tolerancia','Sugestão: valor igual até','R$',0.01,0.01,100,'Diferença de valor até a qual a liberação é sugerida como valor exato.'],
  ['conc.pontos_pedido','Pontos: pedido idêntico','pontos',60,0,100,'Pontos quando a liberação informa o mesmo pedido.',{int:true}],
  ['conc.pontos_valor','Pontos: valor exato','pontos',30,0,100,'Pontos quando o valor bate com o saldo do pedido.',{int:true}],
  ['conc.valor_perto','Valor próximo: até','R$',30,0,100000,'Diferença de valor considerada próxima.'],
  ['conc.pontos_valor_perto','Pontos: valor próximo','pontos',10,0,100,'',{int:true}],
  ['conc.dias_perto','Data próxima: até','dias',7,0,365,'Distância entre a liberação e o pedido considerada próxima (e o limite para sugerir sem o número do pedido).',{int:true}],
  ['conc.pontos_dias_perto','Pontos: data próxima','pontos',10,0,100,'',{int:true}],
  ['conc.dias_mes','Data no mesmo mês: até','dias',31,0,365,'',{int:true}],
  ['conc.pontos_dias_mes','Pontos: data no mesmo mês','pontos',5,0,100,'',{int:true}],
  ['banco.receb_dias','Bancos: recebimento exato até','dias',5,0,365,'Recebimento de venda direta sem o nome do cliente na descrição é "exato" se cair até estes dias do vencimento.',{int:true}],
  ['banco.dias_sem_nome','Bancos: pagamento sem o nome até','dias',20,0,365,'Pagamento sem o nome do fornecedor na descrição só é sugerido até estes dias do vencimento.',{int:true}],
  ['banco.pontos_nome','Bancos: pontos pelo nome','pontos',40,0,100,'',{int:true}],
  ['banco.dias_curto','Bancos: vencimento muito perto','dias',2,0,365,'',{int:true}],
  ['banco.pontos_curto','Bancos: pontos do vencimento muito perto','pontos',30,0,100,'',{int:true}],
  ['banco.dias_medio','Bancos: vencimento perto','dias',7,0,365,'',{int:true}],
  ['banco.pontos_medio','Bancos: pontos do vencimento perto','pontos',15,0,100,'',{int:true}],
  ['banco.exata_nome_dias','Bancos: exata com o nome até','dias',10,0,365,'Com o nome do fornecedor, a sugestão é "exata" até estes dias do vencimento.',{int:true}],
  ['banco.exata_dias','Bancos: exata sem o nome até','dias',3,0,365,'',{int:true}],
  ['darf.tolerancia_pct','DARF × provisão: diferença até','%',0.5,0,100,'DARF pago que bate com a provisão do mês anterior até esta diferença (ou o valor abaixo) baixa a provisão.'],
  ['darf.tolerancia_rs','DARF × provisão: diferença mínima aceita','R$',1,0,10000,''],
  ['darf.fracao_irpj','DARF do presumido sem provisão: parte do IRPJ','%',63.4,0,100,'Sem provisão de referência, o DARF de IRPJ/CSLL é rateado com esta parte para o IRPJ.']]},
 {id:'fluxo',t:'Fluxo de caixa e pendências',ic:'clock',d:'As janelas do fluxo de caixa projetado, das pendências e dos avisos de nota fiscal.',itens:[
  ['fluxo.prazo_janela','Prazo real de repasse: janela','dias',90,7,365,'O prazo de repasse de cada canal é a mediana das liberações destes dias (sem histórico, o prazo do cadastro do canal).',{int:true}],
  ['fluxo.ritmo_dias','Vendas futuras: ritmo dos últimos','dias',28,7,365,'O líquido médio diário destes dias projeta as vendas futuras.',{int:true}],
  ['fluxo.atrasado_dias','Recebíveis atrasados: até','dias',60,0,730,'Pedido a receber com previsão mais velha do que isso sai da projeção.',{int:true}],
  ['pend.janela','Pendências: janela','dias',120,7,730,'Pedidos e liberações dos últimos dias que entram nas pendências da conciliação.',{int:true}],
  ['pend.semnf_dias','Sem nota: pedido pago há','dias',2,0,60,'Pedido pago há pelo menos estes dias e ainda sem NF vira pendência.',{int:true}],
  ['pend.semnf_janela','Sem nota: pedidos dos últimos','dias',30,1,365,'',{int:true}],
  ['pend.idade_atencao','Idade da pendência: atenção a partir de','dias',7,0,365,'',{int:true}],
  ['pend.idade_alerta','Idade da pendência: alerta a partir de','dias',30,0,730,'',{int:true}],
  ['fat.alerta_h','Sem nota: atenção a partir de','horas',24,1,720,'Pedido sem NF há mais horas que isso fica amarelo no Faturamento.',{int:true}],
  ['fat.urgente_h','Sem nota: urgente a partir de','horas',36,1,720,'Pedido sem NF há mais horas que isso fica vermelho e vira aviso.',{int:true}],
  ['fat.janela','Sem nota: avisos dos pedidos dos últimos','dias',14,1,365,'',{int:true}],
  ['receber.faixas','Saldos a receber: faixas de atraso','dias',[7,15,30,60],1,3650,'Limites das faixas de vencido (ex.: 7, 15, 30, 60 → 1–7, 8–15, 16–30, 31–60 e mais de 60 dias).',{tipo:'lista'}]]},
 {id:'estoque',t:'Estoque',ic:'box',d:'Reposição, curva ABC, parado e excesso. Os três primeiros valem para os produtos sem valor próprio na ficha.',itens:[
  ['estoque.alvo','Cobertura alvo','dias',45,7,365,'Quantos dias de venda a compra deve cobrir.',{int:true}],
  ['estoque.seguranca','Estoque de segurança','dias de venda',7,0,365,'Estoque mínimo em dias de venda, para o produto sem mínimo próprio.',{int:true}],
  ['estoque.prazo','Prazo de reposição padrão','dias',20,0,365,'Para o produto sem prazo próprio (Posição de estoque e Sazonalidade).',{int:true}],
  ['estoque.abc_a','Curva ABC: classe A até','% da receita',80,1,99,'Os produtos que somam até este percentual da receita de 90 dias são a classe A.'],
  ['estoque.abc_b','Curva ABC: classe B até','% da receita',95,1,100,'Daí até este percentual, classe B; o resto, C.'],
  ['estoque.pareto','Concentração: produtos do topo','% dos produtos',20,1,100,'Em Vendas › Produtos, a concentração é a receita desta fatia dos produtos mais vendidos.'],
  ['estoque.parado_dias','Parado: sem venda há','dias',60,7,730,'Produto com saldo e sem venda nestes dias é estoque parado (e a primeira faixa do Estoque parado).',{int:true}],
  ['estoque.excesso_x','Excesso: cobertura acima de','× o alvo',3,1,50,'Cobertura maior que a cobertura alvo vezes este número é excesso.'],
  ['estoque.faixa2_dias','Parado: segunda faixa a partir de','dias',90,8,1095,'',{int:true}],
  ['estoque.faixa3_dias','Parado: terceira faixa a partir de','dias',180,9,1460,'',{int:true}],
  ['estoque.desc1','Parado: desconto sugerido na primeira faixa','%',10,0,90,''],
  ['estoque.desc2','Parado: desconto sugerido na segunda faixa','%',20,0,90,''],
  ['estoque.desc3','Parado: desconto sugerido na terceira faixa','%',35,0,90,'Na terceira faixa a sugestão pode ir até o Piso (contribuição zero).'],
  ['estoque.reserva_tarifa','Parado sem a conta de preço: tarifa de reserva','%',25,0,90,'Sem a conta de preço da Margem real, o custo do canal estimado.'],
  ['estoque.reserva_aliq','Parado sem a conta de preço: tributos de reserva','%',10,0,90,'']]},
 {id:'sazonal',t:'Datas sazonais',ic:'calendar',d:'As datas da Sazonalidade (planejamento de compra para o pico). Inclua as datas do seu nicho.',itens:[
  ['sazonal.datas','Datas','',SAZONAL_PADRAO,null,null,'Nome, dia e mês, dias de pico antes da data e o fator de venda no pico (2 = o dobro do ritmo normal).',{tipo:'datas'}]]},
 {id:'metas',t:'Metas e indicadores',ic:'target',d:'Como as metas e os indicadores julgam o resultado (as mesmas regras do alerta diário e do relatório semanal).',itens:[
  ['metas.margem_atencao','Meta de margem: atenção até','p.p. abaixo',2,0,50,'Margem até estes pontos abaixo da meta fica em atenção; mais que isso, abaixo.'],
  ['metas.ritmo_atencao','Meta no ritmo: atenção a partir de','% do esperado',90,0,100,'Realizado (ou projeção) acima deste percentual do esperado fica em atenção; abaixo, fora do ritmo.'],
  ['metas.dias_cedo','Meta: dias sem julgamento','dias',3,0,31,'Nos primeiros dias do mês a meta ainda não é julgada.',{int:true}],
  ['metas.sugestao_cresc','Meta sugerida: crescimento sobre a média','%',10,-50,500,'A meta sugerida de vendas e recebido é a média dos meses anteriores mais este percentual.'],
  ['metas.projecao_semanas','Projeção do mês: semanas de ritmo','semanas',2,1,8,'A projeção de fechamento usa a média do mesmo dia da semana nestas últimas semanas (Visão geral, Metas, alerta diário).',{int:true}],
  ['diag.margem_ruim','Diagnóstico: margem de contribuição baixa abaixo de','%',5,-100,100,''],
  ['resumo.semana_forte','Resumo: semana forte a partir de','% sobre a anterior',5,-100,1000,''],
  ['resumo.semana_fraca','Resumo: semana de queda abaixo de','% sobre a anterior',-10,-100,0,''],
  ['resumo.ruptura_dias','Resumo e Promoções: ruptura com menos de','dias de estoque',15,0,365,'',{int:true}],
  ['dev.taxa_atencao','Devoluções: taxa de atenção acima de','%',3,0,100,''],
  ['dev.taxa_alerta','Devoluções: taxa grave acima de','%',5,0,100,''],
  ['cx.promotor','NPS: promotor a partir da nota','nota',9,0,10,'',{int:true}],
  ['cx.detrator','NPS: detrator até a nota','nota',6,0,10,'',{int:true}],
  ['cx.nps_bom','NPS bom a partir de','pontos',50,-100,100,'',{int:true}]]},
 {id:'crm',t:'Clientes (CRM)',ic:'heart',d:'Uma definição de cliente VIP, em risco e inativo para o CRM e para Vendas › Clientes.',itens:[
  ['crm.inativo_dias','Inativo: sem comprar há mais de','dias',180,30,1825,'',{int:true}],
  ['crm.risco_dias','Em risco: sem comprar há mais de','dias',90,7,1825,'',{int:true}],
  ['crm.recorrente_min','Recorrente: compras a partir de','compras',2,2,100,'',{int:true}],
  ['crm.vip_pct','VIP: os que mais gastam','% dos clientes',20,1,100,'Recorrentes entre os que mais gastaram (este percentual do topo) são VIP.'],
  ['crm.regua_posentrega','Régua "Chegou tudo certo?"','dias depois da entrega',3,1,60,'Também é o início da janela de envio automático pelo Mercado Livre.',{int:true}],
  ['crm.regua_dicas','Régua "Dicas de uso e opinião"','dias depois da compra',10,1,90,'',{int:true}],
  ['crm.regua_reativacao','Régua de reativação','dias sem comprar',180,30,1825,'',{int:true}]]},
 {id:'b2b',t:'Venda direta e B2B',ic:'briefcase',d:'Condições de pagamento e a proposta comercial.',itens:[
  ['b2b.condicoes','Condições de pagamento','',['0','30','30/60','30/60/90','28/56/84'],null,null,'Prazos em dias separados por "/" (0 = à vista), um por linha.',{tipo:'texto'}],
  ['b2b.dia_vencimento','Contrato recorrente: dia do vencimento','dia',10,1,28,'Dia do mês do vencimento quando o contrato não diz.',{int:true}],
  ['b2b.validade','Proposta: validade','dias',7,1,365,'Quando a configuração do B2B não diz.',{int:true}]]},
 {id:'fiscal',t:'Tributos e contabilidade',ic:'receipt',d:'As regras da apuração gerencial (Contabilidade automática e o tributo dos preços). Os dados da NF-e ficam em Fiscal › Regras fiscais.',itens:[
  ['fiscal.regime_padrao','Regime quando não informado','','Lucro Presumido',null,null,'Enquanto a empresa não informa o regime em Regras fiscais, a apuração segue este.',{tipo:'sel',ops:[['Lucro Presumido','Lucro Presumido'],['Lucro Real','Lucro Real'],['Simples Nacional','Simples Nacional']]}],
  ['contabil.provisao','Tributos sobre vendas por competência','',true,null,null,'Ligado: provisiona os tributos no mês da venda; desligado: só quando a guia é paga (caixa).',{tipo:'bool'}],
  ['fiscal.presuncao_irpj','Presunção do IRPJ (lucro presumido)','% da receita',8,0,100,'Comércio: 8%. A mesma da Contabilidade automática e do tributo dos preços.'],
  ['fiscal.presuncao_csll','Presunção da CSLL (lucro presumido)','% da receita',12,0,100,'Comércio: 12%.'],
  ['fiscal.irpj_aliq','IRPJ: alíquota','%',15,0,100,''],
  ['fiscal.irpj_adicional','IRPJ: adicional','%',10,0,100,'Sobre a base presumida que passa do limite mensal abaixo.'],
  ['fiscal.irpj_limite','IRPJ: limite mensal do adicional','R$',20000,0,1e9,''],
  ['fiscal.csll_aliq','CSLL: alíquota','%',9,0,100,''],
  ['fiscal.simples_anexo','Simples Nacional: anexo','','I',null,null,'Tabela da alíquota efetiva do DAS (LC 123/2006 com a LC 155/2016).',{tipo:'sel',ops:[['I','Anexo I · comércio'],['II','Anexo II · indústria']]}],
  ['fiscal.icms_sem_uf','ICMS interno sem a UF do emitente','%',18,0,40,'Enquanto a UF do emitente não é informada.'],
  ['fiscal.inter_7','ICMS interestadual para N, NE, CO e ES','%',7,0,40,'Venda do Sul e Sudeste (menos o ES) para o Norte, Nordeste, Centro-Oeste e Espírito Santo.'],
  ['fiscal.inter_12','ICMS interestadual para os demais estados','%',12,0,40,''],
  ['fiscal.inter_importado','ICMS interestadual de importados (Res. SF 13/2012)','%',4,0,40,'Produtos de origem 1, 2, 3 e 8.'],
  ['fiscal.efetiva_max','Alíquota efetiva do balancete: máximo aceito','%',60,1,100,'Alíquota (tributos ÷ receita) acima disso é descartada como erro de leitura.'],
  ['fiscal.calib_min','Calibração pelo balancete: fator mínimo','×',0.75,0.1,1,'Nos meses sem balancete, o fator do último balancete fica entre este mínimo e o máximo abaixo.'],
  ['fiscal.calib_max','Calibração pelo balancete: fator máximo','×',1.35,1,10,''],
  ['fiscal.credito_icms','Crédito de ICMS nas compras sem balancete','%',12,0,40,'Usado enquanto não há balancete para aprender (e sem valor em Regras fiscais).'],
  ['fiscal.credito_min','Crédito aprendido do balancete: mínimo','%',3,0,40,''],
  ['fiscal.credito_max','Crédito aprendido do balancete: máximo','%',20,0,100,''],
  ['fiscal.gnre_pagamento','Data de pagamento das guias GNRE','','auto',null,null,'Na preparação das guias de DIFAL.',{tipo:'sel',ops:[['auto','A do vencimento'],['fixa','Uma data fixa']]}]]},
 {id:'canais',t:'Canais de venda',ic:'link',d:'Os valores dos canais novos e dos pedidos de canal sem cadastro. Cada canal tem os seus em Cadastros › Canais de venda.',itens:[
  ['canais.prazo_padrao','Prazo de repasse padrão','dias',15,0,180,'Sem histórico de liberações, a previsão do repasse é a data do pedido mais este prazo.',{int:true}],
  ['canais.atraso_padrao','Repasse atrasado: margem','dias',5,0,90,'O repasse só conta como atrasado depois do prazo mais estes dias.',{int:true}]]}];
const IDX=new Map();for(const g of GRUPOS)g.itens=g.itens.map(([k,t,un,padrao,min,max,ajuda,x])=>{const it={k,t,un,padrao,min,max,ajuda:ajuda||'',grupo:g.id,tipo:'num',...(x||{})};IDX.set(k,it);return it});

// ─────────── Leitura e gravação ───────────
const loja=()=>{const g=ger();return g.parametros||(g.parametros={v:{}})};
const vazio=v=>v==null||(typeof v==='string'&&v.trim()==='');
let migrando=false;const semLocal=new Set();
// Leva o valor que estava só no navegador para a empresa (uma vez, todas as chaves daquele armazenamento juntas); depois
// de gravado, apaga o do navegador e só a empresa vale. Enquanto a nuvem carrega, só lê (os dados ainda vão ser trocados).
function migrar(k,c){if(migrando||!c?.local||semLocal.has(c.localChave))return null;const v=c.local();if(v==null){semLocal.add(c.localChave);return null}
 if(window.Cloud?.state==='loading'||!D())return v;
 migrando=true;try{for(const [kk,cc] of Object.entries(CASAS)){if(cc.localChave!==c.localChave)continue;const vv=cc.local();if(vv==null)continue;if(!vazio(cc.ler?cc.ler():D().gerencial?.parametros?.v?.[kk]))continue;if(cc.gravar)cc.gravar(vv);else loja().v[kk]=vv}
  let ok=false;try{ok=typeof save==='function'&&save()!==false}catch{}if(ok){tirarLocal(c.localChave);semLocal.add(c.localChave)}}finally{migrando=false}return v}
/** O valor que vale para a chave: o da empresa (ou da casa antiga) e, sem ele, o padrão do catálogo. */
function get(k){const it=IDX.get(k);if(!it)throw Error('Parâmetro desconhecido: '+k);const c=CASAS[k];
 let v=c?.ler?c.ler():D()?.gerencial?.parametros?.v?.[k];if(vazio(v)){const m=migrar(k,c);v=m??it.padrao}
 if(it.tipo==='num'){const x=taxa(v,it.padrao);return Number.isFinite(x)?x:it.padrao}
 if(it.tipo==='bool')return typeof v==='boolean'?v:it.padrao;
 if(it.tipo==='lista')return Array.isArray(v)&&v.length?v.map(Number).filter(Number.isFinite):copia(it.padrao);
 if(it.tipo==='datas'||it.tipo==='texto')return Array.isArray(v)?copia(v):copia(it.padrao);
 return v}
const guardadoK=k=>{const c=CASAS[k];const v=c?.ler?c.ler():D()?.gerencial?.parametros?.v?.[k];return !vazio(v)};
/** A empresa mudou o parâmetro (há valor dela e é diferente do padrão). */
const proprio=k=>guardadoK(k)&&JSON.stringify(get(k))!==JSON.stringify(IDX.get(k).padrao);
const fmt=(it,v)=>{if(v==null)return '—';if(it.tipo==='bool')return v?'ligado':'desligado';if(it.tipo==='lista')return v.join(', ');if(it.tipo==='datas')return v.map(x=>x.nome).join(', ');if(it.tipo==='texto')return v.join(' · ');
 if(it.tipo==='sel')return (Array.isArray(it.ops)?it.ops.find(o=>o[0]===v)?.[1]:null)||String(v);return String(v).replace('.',',')+(it.un?' '+it.un:'')};
/** Confere um valor novo: devolve {v} já convertido ou {erro}. */
function validar(k,bruto){const it=IDX.get(k);if(!it)return {erro:'Parâmetro desconhecido.'};
 if(it.tipo==='bool')return {v:bruto===true||bruto==='1'||bruto==='true'||bruto==='on'};
 if(it.tipo==='sel'){const v=String(bruto??'');return v?{v}:{erro:'Escolha uma opção.'}}
 if(it.tipo==='lista'){const l=(Array.isArray(bruto)?bruto:String(bruto).split(/[;,\s]+/)).filter(x=>String(x).trim()!=='').map(num);if(!l.length||l.some(x=>!Number.isFinite(x)))return {erro:'Informe números separados por vírgula.'};
  const s=[...l].sort((a,b)=>a-b);if(s.some((x,i)=>i&&x===s[i-1]))return {erro:'Os limites não podem repetir.'};if(s[0]<it.min||s.at(-1)>it.max)return {erro:`Entre ${it.min} e ${it.max}.`};return {v:s}}
 if(it.tipo==='texto'){const l=(Array.isArray(bruto)?bruto:String(bruto).split(/\n+/)).map(x=>String(x).trim()).filter(Boolean);if(!l.length)return {erro:'Informe pelo menos uma.'};if(l.some(x=>!/^\d{1,3}(\/\d{1,3})*$/.test(x)))return {erro:'Use prazos em dias separados por "/" (ex.: 30/60/90).'};return {v:[...new Set(l)]}}
 if(it.tipo==='datas'){const l=Array.isArray(bruto)?bruto:[];for(const x of l){if(!String(x.nome||'').trim())return {erro:'Toda data precisa de nome.'};if(x.regra!=='blackfriday'){const d=Number(x.dia),m=Number(x.mes);if(!(d>=1&&d<=31&&m>=1&&m<=12))return {erro:`${x.nome}: dia e mês inválidos.`}}
   if(!(Number(x.pico)>=1&&Number(x.pico)<=120))return {erro:`${x.nome}: o pico vai de 1 a 120 dias.`};if(!(Number(x.fator)>=1&&Number(x.fator)<=20))return {erro:`${x.nome}: o fator vai de 1 a 20.`}}
  return {v:l.map(x=>({...x,nome:String(x.nome).trim(),pico:Number(x.pico),fator:Number(x.fator),...(x.regra?{}:{dia:Number(x.dia),mes:Number(x.mes)})}))}}
 const x=num(bruto);if(!Number.isFinite(x))return {erro:'Informe um número.'};if(it.int&&!Number.isInteger(x))return {erro:'Informe um número inteiro.'};
 if(it.min!=null&&x<it.min||it.max!=null&&x>it.max)return {erro:`Entre ${String(it.min).replace('.',',')} e ${String(it.max).replace('.',',')}${it.un?' '+it.un:''}.`};
 if(k==='estoque.abc_b'&&x<=get('estoque.abc_a'))return {erro:'A classe B precisa terminar depois da A.'};if(k==='estoque.abc_a'&&x>=get('estoque.abc_b'))return {erro:'A classe A precisa terminar antes da B.'};
 if(k==='estoque.faixa3_dias'&&x<=get('estoque.faixa2_dias'))return {erro:'A terceira faixa começa depois da segunda.'};if(k==='estoque.faixa2_dias'&&(x<=get('estoque.parado_dias')||x>=get('estoque.faixa3_dias')))return {erro:'A segunda faixa fica entre o "parado" e a terceira.'};
 if(k==='estoque.parado_dias'&&x>=get('estoque.faixa2_dias'))return {erro:'O "parado" começa antes da segunda faixa.'};if(k==='cx.detrator'&&x>=get('cx.promotor'))return {erro:'O detrator fica abaixo do promotor.'};if(k==='cx.promotor'&&x<=get('cx.detrator'))return {erro:'O promotor fica acima do detrator.'};
 if(k==='crm.risco_dias'&&x>=get('crm.inativo_dias'))return {erro:'"Em risco" vem antes de "inativo".'};if(k==='crm.inativo_dias'&&x<=get('crm.risco_dias'))return {erro:'"Inativo" vem depois de "em risco".'};
 if(k==='fat.urgente_h'&&x<get('fat.alerta_h'))return {erro:'O urgente vem depois da atenção.'};if(k==='fat.alerta_h'&&x>get('fat.urgente_h'))return {erro:'A atenção vem antes do urgente.'};
 if(k==='fiscal.calib_max'&&x<get('fiscal.calib_min'))return {erro:'O máximo fica acima do mínimo.'};if(k==='fiscal.credito_max'&&x<=get('fiscal.credito_min'))return {erro:'O máximo fica acima do mínimo.'};
 return {v:x}}
let ver=0;const mexeu=()=>{ver++};
const registrar=(acao,det)=>{try{if(typeof audit==='function')audit(acao,det);else if(typeof save==='function')save()}catch{}};
/** Grava o valor da empresa (com a conferência e o registro na auditoria). Devolve '' ou a mensagem de erro. */
function set(k,bruto){const it=IDX.get(k),r=validar(k,bruto);if(r.erro)return r.erro;const antes=get(k),c=CASAS[k];
 if(JSON.stringify(antes)===JSON.stringify(r.v)&&guardadoK(k))return '';
 if(c?.gravar)c.gravar(r.v);else loja().v[k]=r.v;mexeu();
 registrar('Parâmetro alterado',`${GRUPOS.find(g=>g.id===it.grupo).t} › ${it.t}: ${fmt(it,antes)} → ${fmt(it,r.v)}`);return ''}
/** Volta a chave ao padrão (apaga o valor da empresa). */
function reset(k){const it=IDX.get(k);if(!it||!guardadoK(k))return false;const antes=get(k),c=CASAS[k];
 if(c?.gravar)c.gravar(null);else delete loja().v[k];mexeu();registrar('Parâmetro voltou ao padrão',`${GRUPOS.find(g=>g.id===it.grupo).t} › ${it.t}: ${fmt(it,antes)} → ${fmt(it,it.padrao)} (padrão)`);return true}
function resetGrupo(gid){let n=0;for(const it of GRUPOS.find(g=>g.id===gid)?.itens||[])if(proprio(it.k)&&reset(it.k))n++;return n}
/** Impressão digital dos parâmetros da empresa (chave dos caches das telas). */
const versao=()=>{const d=D();return ver+'|'+JSON.stringify(d?.gerencial?.parametros?.v||{})+'|'+JSON.stringify(d?.gerencial?.canais||null)+'|'+(d?.pricing?.metas?.alvo??'')+'|'+JSON.stringify([d?.gerencial?.fiscal?.presuncao_irpj,d?.gerencial?.fiscal?.presuncao_csll,d?.gerencial?.contabil?.provisao])};

// ─────────── Regras comuns ───────────
/** Pedido cancelado ou reembolsado: bruto zerado, taxa ≥ 95% do bruto ou bruto abaixo de 50% dos itens (cancelamento
 * parcial: o marketplace zera a venda e o Bling mantém os itens). Uma regra só para todas as telas. */
function cancelado(o){const g=Number(o?.gross),fee=Number(o?.fee)||0;if(!(g>0))return true;if(fee>=g*get('cancel.taxa_pct')/100)return true;
 const lim=get('cancel.itens_pct');if(!(lim>0))return false;const it=(o.items||[]).reduce((s,i)=>s+(Number(i.qty)||0)*(Number(i.price)||0),0);return it>0&&g<it*lim/100}
/** Curva ABC: classifica pela participação acumulada (do maior para o menor). itens: [{valor}] → define .abc em cada um. */
function curvaABC(itens,valor=x=>x.valor){const tot=itens.reduce((s,x)=>s+(Number(valor(x))||0),0),a=get('estoque.abc_a')/100,b=get('estoque.abc_b')/100;let acc=0;
 for(const x of [...itens].sort((p,q)=>(Number(valor(q))||0)-(Number(valor(p))||0))){const v=Number(valor(x))||0;acc+=v;x.abc=!v?'C':acc<=tot*a?'A':acc<=tot*b?'B':'C'}return itens}
/** Segmento do cliente (CRM e Vendas › Clientes): recência em dias, número de compras e o total gasto; totais = todos
 * os totais em ordem crescente. VIP = recorrente entre os que mais gastaram (o topo de crm.vip_pct). */
function segmento({recencia,n,total},totais){if(recencia>get('crm.inativo_dias'))return 'Inativo';if(recencia>get('crm.risco_dias'))return 'Em risco';const rec=get('crm.recorrente_min');if(n<rec)return 'Novo';
 const i=totais.findIndex(x=>x>=total),p=(i<0?totais.length:i)/Math.max(1,totais.length);return p>=1-get('crm.vip_pct')/100-1e-12?'VIP':'Recorrente'}

// ─────────── Fiscal: uma tabela por UF e as mesmas fórmulas em todas as telas ───────────
const UFS=['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
const ALIQ_INTERNA=Object.freeze({AC:19,AL:19,AM:20,AP:18,BA:20.5,CE:20,DF:20,ES:17,GO:19,MA:23,MG:18,MS:17,MT:17,PA:19,PB:20,PE:20.5,PI:22.5,PR:19.5,RJ:20,RN:20,RO:19.5,RR:20,RS:17,SC:17,SE:19,SP:18,TO:20});
const FCP=Object.freeze({AL:1,RJ:2});
const INTER_7=new Set(['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MS','MT','PA','PB','PE','PI','RN','RO','RR','SE','TO']);
const IMPORTADO=new Set([1,2,3,8]);
// Valores das alíquotas federais da NF-e quando a empresa não informa (os mesmos do emissor).
const FISCAL_PADRAO=Object.freeze({aliq_pis:0.65,aliq_cofins:3,pis_exclui_icms:true,difal:true,origem_padrao:5});
const fiscalCfg=()=>({...FISCAL_PADRAO,...(D()?.gerencial?.fiscal||{})});
const ufEmit=F=>String((F||fiscalCfg()).uf||'').trim().toUpperCase();
/** ICMS interno da UF do emitente: o salvo; senão a tabela da UF; sem UF, o parâmetro (18%). */
const icmsInterno=(F=fiscalCfg())=>taxa(F.aliq_icms_interna,ALIQ_INTERNA[ufEmit(F)]??get('fiscal.icms_sem_uf'));
/** Alíquota interna do destino: a salva por UF > a lida das notas do ERP (opcional) > a tabela. */
const internaDestino=(uf,F=fiscalCfg(),lida=null)=>{const s=F.por_uf?.[uf]||{};return taxa(s.interna,taxa((F.aliquotas||{})[uf],taxa(lida,ALIQ_INTERNA[uf]??get('fiscal.icms_sem_uf'))))};
const fcpDestino=(uf,F=fiscalCfg(),lida=null)=>taxa(F.por_uf?.[uf]?.fcp,taxa(lida,FCP[uf]??0));
/** ICMS interestadual: importados (origem 1, 2, 3 e 8) 4%; senão o salvo para a UF; senão 7% (N/NE/CO/ES) ou 12%. */
const interestadual=(uf,origem,F=fiscalCfg())=>{if(IMPORTADO.has(Number(origem)))return get('fiscal.inter_importado');const s=F.por_uf?.[uf]?.inter;return Number(s)>0?Number(s):INTER_7.has(uf)?get('fiscal.inter_7'):get('fiscal.inter_12')};
/** Base do PIS/COFINS: com "excluir o ICMS" (padrão, como o emissor), a receita menos ICMS, DIFAL e FCP. */
const basePisCofins=({base,icms=0,difal=0,fcp=0},F=fiscalCfg())=>F.pis_exclui_icms===false?base:base-icms-difal-fcp;
const aliqPis=(F=fiscalCfg())=>taxa(F.aliq_pis,FISCAL_PADRAO.aliq_pis),aliqCofins=(F=fiscalCfg())=>taxa(F.aliq_cofins,FISCAL_PADRAO.aliq_cofins);
/** Regime da empresa (Regras fiscais) ou o parâmetro de quando não foi informado. */
const regime=()=>String(D()?.gerencial?.fiscal?.regime||'')||get('fiscal.regime_padrao');
/** IRPJ e CSLL do lucro presumido sobre a receita do mês (bruta − devoluções): presunção × alíquota, mais o adicional do
 * IRPJ sobre a base que passa do limite mensal. A mesma conta na Contabilidade automática e nos preços. */
function irpjCsll(receita){const b=Math.max(0,Number(receita)||0),pi=get('fiscal.presuncao_irpj')/100,pc=get('fiscal.presuncao_csll')/100,bi=b*pi;
 const irpj=bi*get('fiscal.irpj_aliq')/100+Math.max(0,bi-get('fiscal.irpj_limite'))*get('fiscal.irpj_adicional')/100,csll=b*pc*get('fiscal.csll_aliq')/100;return {irpj,csll,pi,pc}}
// Simples Nacional (LC 123/2006 com a LC 155/2016): [receita bruta de 12 meses até, alíquota nominal %, parcela a deduzir].
const ANEXOS=Object.freeze({I:[[180000,4,0],[360000,7.3,5940],[720000,9.5,13860],[1800000,10.7,22500],[3600000,14.3,87300],[4800000,19,378000]],
 II:[[180000,4.5,0],[360000,7.8,5940],[720000,10,13860],[1800000,11.2,22500],[3600000,14.7,85500],[4800000,30,720000]]});
function aliqSimples(rbt12){const T=ANEXOS[get('fiscal.simples_anexo')]||ANEXOS.I;if(!(rbt12>0))return T[0][1]/100;const f=T.find(x=>rbt12<=x[0])||T[5];return Math.max(0,(rbt12*f[1]/100-f[2])/rbt12)}
const Fiscal={UFS,ALIQ_INTERNA,FCP,INTER_7,IMPORTADO,PADRAO:FISCAL_PADRAO,ANEXOS,taxa,cfg:fiscalCfg,ufEmit,icmsInterno,internaDestino,fcpDestino,interestadual,basePisCofins,aliqPis,aliqCofins,regime,irpjCsll,aliqSimples};

window.Parametros=Object.assign(window.Parametros||{},{GRUPOS,item:k=>IDX.get(k)||null,get,set,reset,resetGrupo,validar,proprio,padrao:k=>{const it=IDX.get(k);return it?copia(it.padrao):undefined},fmt:(k,v)=>fmt(IDX.get(k),v===undefined?get(k):v),
 versao,taxa,num,cancelado,curvaABC,segmento,fiscal:Fiscal,SAZONAL_PADRAO});

// ═════════════ Canais de venda (cadastro único) ═════════════
// Cada canal é um lugar onde a empresa vende (o "platform" dos pedidos). Os tipos de anúncio com regra de preço própria
// (Mercado Livre Premium e Clássico) são as "regras" do canal; a regra de preço de cada um continua em pricing.canais
// (Regras de venda), pela mesma chave de sempre, para que preços por produto, exceções e fretes por canal sigam valendo.
// padroes: palavras (expressões) que reconhecem o canal num texto (loja do Bling, plataforma do pedido); ordem: quem é
// testado primeiro (o Clássico antes do Premium, como sempre foi). Os valores padrão são os que o código usava até 19/11/2026.
const CANAIS_PADRAO=Object.freeze([
 {id:'Mercado Livre',nome:'Mercado Livre',sigla:'ML',cor:'#f4d66d',ativo:true,integracao:'mercadolivre',conta:'Mercado Pago',contaSigla:'MP',contaCor:'#69d4ed',
  regras:[{id:'Mercado Livre Clássico',padroes:['classic'],ordem:30},{id:'Mercado Livre',padroes:['mercado','\\bml\\b','meli'],ordem:40}],extrato:['mercado ?pago','mercado livre'],
  prazo:null,atraso:null,contas:{receber:'1.1.03.01',receita:'4.1.01'},intermediador:{cnpj:'03007331000141',nome:'Mercado Livre'},destaque:2},
 {id:'Shopee',nome:'Shopee',sigla:'S',cor:'#ff9274',ativo:true,integracao:'shopee',regras:[{id:'Shopee',padroes:['shopee'],ordem:10}],extrato:['shopee'],
  prazo:null,atraso:null,contas:{receber:'1.1.03.02',receita:'4.1.02'},intermediador:{cnpj:'35635824000112',nome:'Shopee'},destaque:1},
 {id:'Magalu',nome:'Magalu',sigla:'M',cor:'#6bb5ff',ativo:true,integracao:'magalu',regras:[{id:'Magalu',padroes:['magalu','magazine'],ordem:20}],extrato:['magalu','magazine luiza'],
  prazo:null,atraso:null,contas:{receber:'1.1.03.03',receita:'4.1.03'},intermediador:{cnpj:'47960950000121',nome:'Magalu'},destaque:3},
 {id:'TikTok Shop',nome:'TikTok Shop',sigla:'TT',cor:'#fe2c55',ativo:true,integracao:'',regras:[],extrato:[],
  prazo:null,atraso:null,contas:{receber:'1.1.03.09',receita:'4.1.09'},intermediador:{cnpj:'',nome:'TikTok Shop'},destaque:4},
 {id:'Site próprio',nome:'Site próprio',sigla:'SP',cor:'#a78bfa',ativo:false,integracao:'',regras:[{id:'Site próprio',padroes:['site','loja propria','nuvem','tray','shopify'],ordem:50}],extrato:[],
  prazo:null,atraso:null,contas:{receber:'1.1.03.09',receita:'4.1.09'},intermediador:{cnpj:'',nome:''}}]);
const CAMPOS={nome:'',sigla:'',cor:'#8b93a7',ativo:true,integracao:'',conta:'',contaSigla:'',contaCor:'',regras:[],extrato:[],prazo:null,atraso:null,contas:{receber:'1.1.03.09',receita:'4.1.09'},intermediador:{cnpj:'',nome:''},lojas:[]};
const completo=c=>({...copia(CAMPOS),...copia(c),contas:{...CAMPOS.contas,...(c.contas||{})},intermediador:{...CAMPOS.intermediador,...(c.intermediador||{})}});
const guardado=()=>{const g=D()?.gerencial?.canais;return g&&Array.isArray(g.lista)?g.lista:null};
let cacheLista={k:null,v:null};
/** Os canais da empresa (os padrões enquanto ela não mexe), completos. */
function lista(){const g=guardado(),k=g?JSON.stringify(g):'padrao';if(cacheLista.k===k)return cacheLista.v;const v=(g||CANAIS_PADRAO).map(completo);cacheLista={k,v};return v}
const porId=id=>lista().find(c=>c.id===id)||null;
const ativos=()=>lista().filter(c=>c.ativo);
/** Canal de um nome de plataforma (o do pedido ou da liberação): o próprio ou o canal de quem ele é a conta (Mercado Pago). */
const daPlataforma=p=>porId(p)||lista().find(c=>c.conta&&c.conta===p)||null;
const prazo=p=>{const c=daPlataforma(p);return Number.isFinite(Number(c?.prazo))&&c?.prazo!==null&&c?.prazo!==''?Number(c.prazo):get('canais.prazo_padrao')};
const atraso=p=>{const c=daPlataforma(p);return Number.isFinite(Number(c?.atraso))&&c?.atraso!==null&&c?.atraso!==''?Number(c.atraso):get('canais.atraso_padrao')};
const contas=p=>porId(p)?.contas||copia(CAMPOS.contas);
/** Todas as regras de preço (tipos de anúncio), na ordem em que reconhecem um texto. */
const regras=()=>lista().flatMap(c=>c.regras.map((r,i)=>({id:r.id,canal:c.id,padroes:r.padroes||[],ordem:r.ordem??(100+i)}))).sort((a,b)=>a.ordem-b.ordem);
const canalDaRegra=rid=>regras().find(r=>r.id===rid)?.canal||null;
const norm=s=>typeof normalized==='function'?normalized(s):String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[_\-./]+/g,' ').replace(/\s+/g,' ').trim();
const casa=(s,pads)=>pads.some(p=>{try{return new RegExp(p).test(s)}catch{return s.includes(norm(p))}});
/** A regra de preço de um texto (loja do Bling, plataforma do pedido): pelas palavras de cada regra; null se nenhuma. */
function regraDe(t){const s=norm(t);if(!s)return null;for(const r of regras())if(casa(s,r.padroes))return r.id;return null}
/** O canal de um texto (extrato bancário, transferência): pelas palavras do extrato de cada canal. */
function canalDoExtrato(t){const s=norm(t);for(const c of lista())if(c.extrato?.length&&casa(s,c.extrato))return c;return null}
/** Intermediadores da NF-e (canais com CNPJ): [[canal, cnpj]]. */
const intermediadores=()=>lista().filter(c=>c.intermediador?.cnpj).map(c=>[c.id,c.intermediador.cnpj]);
// Objeto de plataformas do app (app.js): o ERP de origem, os canais ativos e as contas de liquidação.
let cachePlat={k:null,v:null};
function plataformas(){const l=lista();if(cachePlat.k===l)return cachePlat.v;const o={'Bling':{color:'#77d6a0',short:'B',role:'Origem fiscal · ERP'}};
 for(const c of l)if(c.ativo)o[c.id]={color:c.cor||'#8b93a7',short:c.sigla||c.id.slice(0,2).toUpperCase(),role:'Marketplace'};
 for(const c of l)if(c.ativo&&c.conta&&!o[c.conta])o[c.conta]={color:c.contaCor||c.cor||'#8b93a7',short:c.contaSigla||c.conta.slice(0,2).toUpperCase(),role:'Conta de liquidação'};
 cachePlat={k:l,v:o};return o}
const gravarLista=(l,acao,det)=>{const g=ger();g.canais={lista:l.map(completo)};cacheLista={k:null,v:null};mexeu();registrar(acao,det)};
/** Grava os campos de um canal (sem mexer nos outros). Devolve '' ou o erro. */
function atualizar(id,campos){const l=lista().map(copia),i=l.findIndex(c=>c.id===id);if(i<0)return 'Canal não encontrado.';const c={...l[i],...campos};
 if(campos.prazo!=null&&campos.prazo!==''&&!(Number(campos.prazo)>=0&&Number(campos.prazo)<=180))return 'Prazo de repasse entre 0 e 180 dias.';
 if(campos.atraso!=null&&campos.atraso!==''&&!(Number(campos.atraso)>=0&&Number(campos.atraso)<=90))return 'Margem do atraso entre 0 e 90 dias.';
 if(campos.intermediador?.cnpj&&String(campos.intermediador.cnpj).replace(/\D/g,'').length!==14)return 'CNPJ do intermediador com 14 dígitos.';
 if(campos.contas&&[campos.contas.receber,campos.contas.receita].some(x=>!/^\d+(\.\d+)+$/.test(String(x||''))))return 'Conta contábil no formato 1.1.03.04.';
 if(campos.cor!=null&&!/^#[0-9a-f]{6}$/i.test(String(campos.cor)))return 'Cor no formato #rrggbb.';
 l[i]=c;gravarLista(l,'Canal de venda alterado',`${id}: ${Object.keys(campos).join(', ')}`);return ''}
/** Canal novo (ex.: Amazon), com a regra de preço própria em Regras de venda. */
function adicionar({nome,sigla,cor,comissao=0,fixa=0,prazo:pz=null,palavras=[]}){const id=String(nome||'').trim();if(!id)return 'Informe o nome do canal.';if(id.length>40)return 'Nome com até 40 letras.';
 if(lista().some(c=>c.id.toLowerCase()===id.toLowerCase())||regras().some(r=>r.id.toLowerCase()===id.toLowerCase())||id==='Bling')return 'Já existe um canal com esse nome.';
 const pads=(palavras.length?palavras:[norm(id)]).map(p=>String(p).trim()).filter(Boolean);
 const l=[...lista().map(copia),completo({id,nome:id,sigla:String(sigla||id.slice(0,2)).toUpperCase().slice(0,3),cor:/^#[0-9a-f]{6}$/i.test(cor||'')?cor:'#8b93a7',ativo:true,regras:[{id,padroes:pads,ordem:100+lista().length}],extrato:pads,prazo:pz===''?null:pz})];
 const d=D();if(d){d.pricing=d.pricing||{};d.pricing.canais=d.pricing.canais||{};d.pricing.canais[id]={rotulo:id,comissao:taxa(comissao,0),fixa:taxa(fixa,0),faixas:[],freteAcima:0,freteFixo:0,ativo:true}}
 gravarLista(l,'Canal de venda incluído',id);return ''}
/** Regra de preço para um canal que ainda não tem (ex.: TikTok Shop). */
function criarRegra(id){const l=lista().map(copia),c=l.find(x=>x.id===id);if(!c)return 'Canal não encontrado.';if(c.regras.length)return '';c.regras=[{id,padroes:[norm(id)],ordem:100+l.indexOf(c)}];
 const d=D();if(d){d.pricing=d.pricing||{};d.pricing.canais=d.pricing.canais||{};if(!d.pricing.canais[id])d.pricing.canais[id]={rotulo:id,comissao:0,fixa:0,faixas:[],freteAcima:0,freteFixo:0,ativo:true}}
 gravarLista(l,'Regra de venda criada para o canal',id);return ''}
/** Tira um canal criado pela empresa (os padrões só se desligam). */
function remover(id){const pad=CANAIS_PADRAO.some(c=>c.id===id);if(pad)return 'Os canais padrão não se apagam: desligue-os.';const l=lista().map(copia),c=l.find(x=>x.id===id);if(!c)return 'Canal não encontrado.';
 const d=D();for(const r of c.regras)if(d?.pricing?.canais?.[r.id])delete d.pricing.canais[r.id];gravarLista(l.filter(x=>x.id!==id),'Canal de venda removido',id);return ''}
/** Volta um canal padrão (ou todos) aos valores de fábrica, inclusive a regra de preço; os canais criados ficam. */
function restaurar(id=null){const l=lista().map(copia),M=window.PrecoMotor,d=D();
 for(const p of CANAIS_PADRAO){if(id&&p.id!==id)continue;const i=l.findIndex(c=>c.id===p.id),novo=completo(p);if(i<0)l.push(novo);else l[i]={...novo,lojas:l[i].lojas||[]};
  if(d&&M)for(const r of p.regras){d.pricing=d.pricing||{};d.pricing.canais=d.pricing.canais||{};if(M.CANAIS_PADRAO[r.id])d.pricing.canais[r.id]=copia(M.CANAIS_PADRAO[r.id])}}
 gravarLista(l,'Canais de venda voltaram ao padrão',id||'todos');return ''}
window.Canais={PADRAO:CANAIS_PADRAO,lista,porId,ativos,daPlataforma,prazo,atraso,contas,regras,canalDaRegra,regraDe,canalDoExtrato,intermediadores,plataformas,atualizar,adicionar,criarRegra,remover,restaurar,
 /** Ids dos canais ativos (os marketplaces dos filtros e das listas de plataforma). */ids:()=>ativos().map(c=>c.id),
 /** Canais em destaque nas listas por canal, na ordem (Shopee, Mercado Livre, Magalu, TikTok Shop); os outros vêm depois. */destaques:()=>lista().filter(c=>c.destaque).sort((a,b)=>a.destaque-b.destaque).map(c=>c.id)};
})();
