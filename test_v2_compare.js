/* SI_COMPASS v1.9 vs v2.0 renderResult 비교 시험
   외부 의존성 없이 JS만 추출·주입해서 renderResult 결과 DOM 비교 */
'use strict';
const {JSDOM} = require('jsdom');
const fs = require('fs');

const v19html = fs.readFileSync(__dirname+'/index_v1_9_backup.html','utf8');
const v20html = fs.readFileSync(__dirname+'/index.html','utf8');
const commonJs = fs.readFileSync(
  'C:\\Users\\李明鎬\\Documents\\LEENAI_COMMON\\v1\\leenai-common.js','utf8');

/* HTML body 안의 구조만 추출 (script 제외) */
function extractBody(html){
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if(!m) return '';
  /* script 태그 제거 */
  return m[1].replace(/<script[\s\S]*?<\/script>/gi,'');
}

/* 마지막 <script>...</script> 내용 추출 */
function extractLastJs(html){
  const m = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  return m.length>0 ? m[m.length-1][1] : '';
}

/* 가짜 Dataverse 데이터 */
const FAKE_DATA = {
  ivNo:'NMG2607-07',
  bkg:{
    cr49f_bookingid:'BKG-001',
    cr49f_invoice_no:'NMG2607-07',
    cr49f_main_ship_name:'EVER GIVEN',
    cr49f_etd:'2026-08-15',
    crcf9_bl_etd:'2026-08-20',
    _cr49f_sale_contract_id_value:'SC-001',
    _cr49f_region_japan_id_value:'RJ-001',
  },
  pol:'NAGOYA, JAPAN',
  scNo:'NSG-2607-03',
  tradeTerms:'CIF',
  siData:{
    cr49f_s_iid:'SI-001',
    cr49f_lc_no:'LC-2607-01',
    crcf9_vo_no:'VO NO.12345',
    crcf9_po_vo:'PO-98765',
    crcf9_pod_bl1:'HO CHI MINH',
    crcf9_place_of_delivery_1:'HO CHI MINH',
  },
  siDetails:[
    {crcf9_s_i_detailid:'DET-001',crcf9_productname:'OLD CORRUGATED CARTON',
     crcf9_hs_code:'4707.10',crcf9_price:250,_crcf9_sale_detail_id_value:'SD-001'},
  ],
  saleDetails:[
    {cr49f_sale_detailid:'SD-001',cr49f_price:255,cr49f_quantity:100},
  ],
  containers:[
    {crcf9_container_informationid:'CT-001',crcf9_container_no:'ABCD1234567',
     crcf9_quantity:22,crcf9_n_w:20000,_crcf9_sale_detail_id_value:'SD-001'},
  ],
};

function def(w,k,v){Object.defineProperty(w,k,{value:v,writable:true,configurable:true});}

function makeBase(bodyHtml){
  const dom = new JSDOM(
    '<!DOCTYPE html><html data-theme="dark"><head></head><body>'+bodyHtml+'</body></html>',
    {url:'https://mhlee205.github.io/SI_COMPASS/', runScripts:'outside-only', pretendToBeVisual:true}
  );
  const w = dom.window;
  def(w,'crypto',{subtle:{digest:async()=>new ArrayBuffer(32)},getRandomValues:(a)=>{for(let i=0;i<a.length;i++)a[i]=i%256;return a;}});
  def(w,'sessionStorage',{_d:{},getItem(k){return this._d[k]||null;},setItem(k,v){this._d[k]=v;},removeItem(k){delete this._d[k];}});
  def(w,'localStorage',{_d:{},getItem(k){return this._d[k]||null;},setItem(k,v){this._d[k]=v;},removeItem(k){delete this._d[k];}});
  def(w,'history',{replaceState:()=>{}});
  def(w,'requestAnimationFrame',(cb)=>setTimeout(cb,0));
  def(w,'navigator',{clipboard:{writeText:async()=>{}}});
  def(w,'scrollTo',()=>{});
  w.HTMLElement.prototype.scrollIntoView=function(){};
  return dom;
}

async function runV19(){
  const bodyHtml = extractBody(v19html);
  const toolJs   = extractLastJs(v19html);
  const dom = makeBase(bodyHtml);
  const w = dom.window;
  /* v1.9 JS 주입 */
  w.eval(toolJs);
  await new Promise(r=>setTimeout(r,30));
  /* renderResult 직접 호출 */
  w.renderResult(FAKE_DATA);
  await new Promise(r=>setTimeout(r,30));
  return dom;
}

async function runV20(){
  const bodyHtml = extractBody(v20html);
  const toolJs   = extractLastJs(v20html);
  const dom = makeBase(bodyHtml);
  const w = dom.window;
  /* LEENAI 공통 파일 주입 */
  w.eval(commonJs);
  await new Promise(r=>setTimeout(r,20));
  /* v2.0 JS 주입 (LEENAI.init 포함 — init は splash を作るが #app を隠すだけ) */
  /* location に code がないので init は showSplash() で終わる */
  w.eval(toolJs);
  await new Promise(r=>setTimeout(r,30));
  /* stepSearch と app を表示して renderResult */
  w.document.getElementById('app').style.display='';
  w.document.getElementById('stepSearch').style.display='block';
  w.renderResult(FAKE_DATA);
  await new Promise(r=>setTimeout(r,30));
  return dom;
}

function getText(dom, sel){
  const el = dom.window.document.querySelector(sel);
  return el ? el.textContent.trim() : '(missing)';
}
function getAllText(dom, sel){
  return [...dom.window.document.querySelectorAll(sel)].map(e=>e.textContent.trim()).join('\n');
}

let passed=0, failed=0;
function ok(label, a, b){
  if(a===b){console.log('  ✔ '+label); passed++;}
  else{
    console.error('  ✖ FAIL: '+label);
    console.error('    v1.9: '+String(a).slice(0,200));
    console.error('    v2.0: '+String(b).slice(0,200));
    failed++;
  }
}

(async()=>{
  console.log('\n[比較テスト] v1.9 vs v2.0 renderResult 完全一致確認');

  let d19, d20;
  try{d19=await runV19();}catch(e){console.error('v1.9 エラー:',e.message);process.exit(1);}
  try{d20=await runV20();}catch(e){console.error('v2.0 エラー:',e.message);process.exit(1);}

  /* 概要バー */
  ok('resInvoice',  getText(d19,'#resInvoice'),  getText(d20,'#resInvoice'));
  ok('resContract', getText(d19,'#resContract'), getText(d20,'#resContract'));
  ok('resLcNo',     getText(d19,'#resLcNo'),     getText(d20,'#resLcNo'));

  /* 画面① grid 全テキスト */
  const s1sel = '#screen1Grid .rg-label-fixed,#screen1Grid .rg-val-fixed,#screen1Grid .rg-text';
  ok('画面① grid全テキスト', getAllText(d19,s1sel), getAllText(d20,s1sel));

  /* 画面② grid 全テキスト */
  const s2sel = '#screen2Grid .rg-label-fixed,#screen2Grid .rg-val-fixed,#screen2Grid .rg-text';
  ok('画面② grid全テキスト', getAllText(d19,s2sel), getAllText(d20,s2sel));

  /* Goods テキスト */
  ok('Goods テキスト', getText(d19,'#goodsText0'), getText(d20,'#goodsText0'));

  /* CIF自動計算 */
  ok('CIF自動計算値',
    d19.window.document.getElementById('cifInput').value,
    d20.window.document.getElementById('cifInput').value);

  /* 日付 (ETD) — 年月日フォーマット */
  const etdSel = (dom)=>[...dom.window.document.querySelectorAll('#screen2Grid .rg-val-fixed')]
    .find(e=>e.textContent.includes('年'))?.textContent||'(missing)';
  ok('ETD 日付フォーマット', etdSel(d19), etdSel(d20));

  /* 詳細表示 */
  const g19=getText(d19,'#goodsText0'), g20=getText(d20,'#goodsText0');
  console.log('\n  [Goods テキスト (1行目)]');
  console.log('  v1.9:', g19.split('\n')[0]);
  console.log('  v2.0:', g20.split('\n')[0]);
  console.log('  CIF  v1.9:', d19.window.document.getElementById('cifInput').value,
              '/ v2.0:', d20.window.document.getElementById('cifInput').value);

  console.log('\n─────────────────────────');
  console.log('結果: PASS '+passed+' / FAIL '+failed);
  process.exit(failed>0?1:0);
})();
