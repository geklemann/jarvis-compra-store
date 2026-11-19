// © 2026 GK Soluções Empresariais LTDA (CNPJ 60.180.675/0001-91) · Todos os direitos reservados. Veja LICENSE e AUTORIA.md.
'use strict';
// Web Worker da importação do razão (web/razao.js): lê a planilha ou o texto (SheetJS) e transforma e confere o razão
// (web/razao-motor.js) fora da página, para o navegador não travar com dezenas de milhares de linhas. Guarda as linhas
// lidas na memória do worker: trocar o formato, as colunas ou a competência na tela de ajuste refaz só a transformação.
// Mensagens (cada uma com `id`, respondida com o mesmo `id`):
//   { tipo:'ler', buf, ext, aba, v }         → { abas, aba, total, amostra, layout }
//   { tipo:'linhas', rows, linhas }          → o mesmo, para as linhas já extraídas na página (PDF)
//   { tipo:'processar', opts }               → { R, V } (opts: layout, header, map, colunas, competencia, balancete, regras)
(()=>{
let carregado=false,rows=null,linhas=null;
function carregar(v){if(carregado)return;const q=v?'?v='+encodeURIComponent(v):'';importScripts('vendor/xlsx.full.min.js'+q,'razao-motor.js'+q);carregado=true}
function resposta(){const M=self.RazaoMotor;return {total:rows.length,amostra:rows.slice(0,80),layout:M.detectar(rows),cabecalho:M.cabecalhoColunas(rows)}}
self.onmessage=e=>{const m=e.data||{},id=m.id;
 try{carregar(m.v);const M=self.RazaoMotor;
  if(m.tipo==='ler'){const a=M.lerArquivo(m.buf,m.ext,self.XLSX,m.aba);rows=a.rows;linhas=a.linhas;self.postMessage({id,ok:true,abas:a.abas,aba:a.aba,...resposta()});return}
  if(m.tipo==='linhas'){rows=m.rows||[];linhas=m.linhas||null;self.postMessage({id,ok:true,abas:[],aba:'',...resposta()});return}
  if(m.tipo==='processar'){if(!rows)throw Error('Selecione o arquivo de novo.');const o=m.opts||{};
   const R=M.ler(rows,{layout:o.layout,header:o.header,map:o.map,colunas:o.colunas,linhas});if(o.regras?.length)M.aplicarCentros(R,o.regras);
   const V=M.validar(R,{competencia:o.competencia,balancete:o.balancete||[]});self.postMessage({id,ok:true,R,V});return}
  throw Error('mensagem desconhecida')}
 catch(x){self.postMessage({id,ok:false,erro:String(x&&x.message||x)})}};
})();
