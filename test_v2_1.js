/* SI_COMPASS v2.1 — autoFetchLcJson 8케이스 jsdom 시험 */
'use strict';
const {JSDOM} = require('jsdom');
const fs = require('fs');

const v21html    = fs.readFileSync(__dirname+'/index.html','utf8');
const v20html    = fs.readFileSync(__dirname+'/index_v1_9_backup.html','utf8'); // for result comparison
const commonJs   = fs.readFileSync('C:\\Users\\李明鎬\\Documents\\LEENAI_COMMON\\v1\\leenai-common.js','utf8');

function extractLastJs(html){
  const m=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  return m.length?m[m.length-1][1]:'';
}
function extractBody(html){
  const m=html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return m?m[1].replace(/<script[\s\S]*?<\/script>/gi,''):'';
}

function def(w,k,v){Object.defineProperty(w,k,{value:v,writable:true,configurable:true});}

function makeBase(bodyHtml, url){
  url=url||'https://mhlee205.github.io/SI_COMPASS/';
  const dom=new JSDOM('<!DOCTYPE html><html data-theme="dark"><head></head><body>'+bodyHtml+'</body></html>',
    {url, runScripts:'outside-only', pretendToBeVisual:true});
  const w=dom.window;
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

/* 공통 setup: LEENAI 주입 + 툴 JS 주입, LEENAI.sp mock 세팅 */
function setupV21(dom, spMock){
  const w=dom.window;
  w.eval(commonJs);
  /* LEENAI.auth.status mock (Graph ok) */
  Object.defineProperty(w.LEENAI.auth,'status',{
    get:()=>({dataverse:'ok',graph:'ok',graphError:''}),configurable:true
  });
  w.eval(extractLastJs(v21html));
  /* sp mock 주입 */
  w.LEENAI.sp=spMock;
  return w;
}

const FAKE_LC = {lcNo:'ILC9162600175', lcDate:'06/08/2026', insuranceCondition:'FOR 110% ICC A CLAIM PAYABLE IN DESTINATION THE LC', country:'INDONESIA'};

let passed=0,failed=0;
function ok(label,cond){if(cond){console.log('  ✔ '+label);passed++;}else{console.error('  ✖ FAIL: '+label);failed++;}}

/* TEST 1: 정확한 이름으로 폴더① 발견 */
async function test1(){
  console.log('\n[TEST 1] 정확한 이름으로 폴더① 발견');
  const dom=makeBase(extractBody(v21html));
  const w=setupV21(dom,{
    getJson:async(path)=>{
      if(path.includes('D-01-LC_FD_CHECKER/LRS-2608A1_ILC9162600175.json')) return FAKE_LC;
      return null;
    },
    list:async()=>[]
  });
  w.document.getElementById('stepSearch').style.display='block';
  w.document.getElementById('app').style.display='';
  await w.autoFetchLcJson('LRS-2608A1','ILC9162600175');
  await new Promise(r=>setTimeout(r,30));
  const msg=w.document.getElementById('lcJsonMsg').textContent;
  ok('成功メッセージ (SharePoint:)', msg.includes('SharePoint:'));
  ok('dropZone に SharePoint ラベル', w.document.getElementById('lcDropZone').textContent.includes('SharePoint:'));
  ok('detectIcc ICC(A) → iccSelect=A', w.document.getElementById('iccSelect').value==='A');
}

/* TEST 2: 폴더① 없음 → 폴더② 발견 */
async function test2(){
  console.log('\n[TEST 2] 폴더① 없음 → 폴더② 발견');
  const dom=makeBase(extractBody(v21html));
  const w=setupV21(dom,{
    getJson:async(path)=>{
      if(path.includes('LC_LEENAI_JSON/LRS-2608A1_ILC9162600175.json')) return FAKE_LC;
      return null;
    },
    list:async()=>[]
  });
  w.document.getElementById('stepSearch').style.display='block';
  w.document.getElementById('app').style.display='';
  await w.autoFetchLcJson('LRS-2608A1','ILC9162600175');
  await new Promise(r=>setTimeout(r,30));
  ok('フォルダ② メッセージ', w.document.getElementById('lcJsonMsg').textContent.includes('フォルダ2'));
  ok('dropZone loaded', w.document.getElementById('lcDropZone').classList.contains('loaded'));
}

/* TEST 3: 목록에서 1개 발견 */
async function test3(){
  console.log('\n[TEST 3] 정확한 이름 없음 → 목록에서 1개 발견');
  const dom=makeBase(extractBody(v21html));
  const w=setupV21(dom,{
    getJson:async(path)=>{
      if(path.includes('LRS-2608A1_ILC9162600175_20260608.json')) return FAKE_LC;
      return null;
    },
    list:async(folder)=>{
      if(folder.includes('D-01')) return [{name:'LRS-2608A1_ILC9162600175_20260608.json',lastModified:'2026-08-01',size:1000}];
      return [];
    }
  });
  w.document.getElementById('app').style.display='';
  await w.autoFetchLcJson('LRS-2608A1','ILC9162600175');
  await new Promise(r=>setTimeout(r,30));
  ok('目録1件 取得成功', w.document.getElementById('lcJsonMsg').textContent.includes('SharePoint:'));
  ok('dropZone loaded', w.document.getElementById('lcDropZone').classList.contains('loaded'));
}

/* TEST 4: 여러 개 → lcFirst 필터로 1개로 줄임 */
async function test4(){
  console.log('\n[TEST 4] 복수 → lcFirst 필터로 1개로 줄임');
  const dom=makeBase(extractBody(v21html));
  const w=setupV21(dom,{
    getJson:async(path)=>{
      if(path.includes('LRS-2608A1_ILC9162600175_v1.json')) return FAKE_LC;
      return null;
    },
    list:async(folder)=>{
      if(folder.includes('D-01')) return [
        {name:'LRS-2608A1_ILC9162600175_v1.json'},
        {name:'LRS-2608A1_ILC0000000000_v1.json'},
      ];
      return [];
    }
  });
  w.document.getElementById('app').style.display='';
  await w.autoFetchLcJson('LRS-2608A1','ILC9162600175');
  await new Promise(r=>setTimeout(r,30));
  ok('lcFirst フィルタで1件に絞り込み', w.document.getElementById('lcJsonMsg').textContent.includes('SharePoint:'));
}

/* TEST 5: 여러 개 + lcFirst 필터도 여러 개 → 선택 목록 표시 */
async function test5(){
  console.log('\n[TEST 5] 복수 → lcFirst 필터도 복수 → 선택 목록 표시');
  const dom=makeBase(extractBody(v21html));
  const w=setupV21(dom,{
    getJson:async()=>null,
    list:async(folder)=>{
      if(folder.includes('D-01')) return [
        {name:'LRS-2608A1_ILC9162600175_v1.json'},
        {name:'LRS-2608A1_ILC9162600175_v2.json'},
      ];
      return [];
    }
  });
  w.document.getElementById('app').style.display='';
  await w.autoFetchLcJson('LRS-2608A1','ILC9162600175');
  await new Promise(r=>setTimeout(r,30));
  ok('_lcChoiceMatches 設定', Array.isArray(w._lcChoiceMatches) && w._lcChoiceMatches.length===2);
  ok('選択ボタン表示 (innerHTML に button)', w.document.getElementById('lcJsonMsg').innerHTML.includes('<button'));
}

/* TEST 6: 아무것도 없음 → 안내 메시지 */
async function test6(){
  console.log('\n[TEST 6] 없음 → 案内メッセージ');
  const dom=makeBase(extractBody(v21html));
  const w=setupV21(dom,{getJson:async()=>null,list:async()=>[]});
  w.document.getElementById('app').style.display='';
  await w.autoFetchLcJson('LRS-2608A1','ILC9162600175');
  await new Promise(r=>setTimeout(r,30));
  ok('見つかりません メッセージ', w.document.getElementById('lcJsonMsg').textContent.includes('見つかりません'));
}

/* TEST 7: _TT_BASE.json 제외 */
async function test7(){
  console.log('\n[TEST 7] _TT_BASE.json 제외');
  const dom=makeBase(extractBody(v21html));
  let listCallCount=0;
  const w=setupV21(dom,{
    getJson:async()=>null,
    list:async()=>{
      listCallCount++;
      return [{name:'LRS-2608A1_TT_BASE.json'},{name:'LRS-2608A1_SOMETHING_TT_BASE.json'}];
    }
  });
  w.document.getElementById('app').style.display='';
  await w.autoFetchLcJson('LRS-2608A1','');
  await new Promise(r=>setTimeout(r,30));
  ok('_TT_BASE が選択されず 見つかりません', w.document.getElementById('lcJsonMsg').textContent.includes('見つかりません'));
  ok('list 呼ばれた', listCallCount>0);
}

/* TEST 8: Graph 미접속 → 스킵 */
async function test8(){
  console.log('\n[TEST 8] Graph 未接続 → スキップ');
  const dom=makeBase(extractBody(v21html));
  const w=setupV21(dom,{getJson:async()=>({lcNo:'X'}),list:async()=>[]});
  /* graph=error に上書き */
  Object.defineProperty(w.LEENAI.auth,'status',{
    get:()=>({dataverse:'ok',graph:'error',graphError:''}),configurable:true
  });
  w.document.getElementById('app').style.display='';
  await w.autoFetchLcJson('LRS-2608A1','ILC1234');
  await new Promise(r=>setTimeout(r,30));
  ok('スキップ → 手動取込メッセージ', w.document.getElementById('lcJsonMsg').textContent.includes('手動'));
  ok('lcJsonData は null のまま', !w.lcJsonData);
}

(async()=>{
  try{await test1();}catch(e){console.error('TEST1:',e.message);failed++;}
  try{await test2();}catch(e){console.error('TEST2:',e.message);failed++;}
  try{await test3();}catch(e){console.error('TEST3:',e.message);failed++;}
  try{await test4();}catch(e){console.error('TEST4:',e.message);failed++;}
  try{await test5();}catch(e){console.error('TEST5:',e.message);failed++;}
  try{await test6();}catch(e){console.error('TEST6:',e.message);failed++;}
  try{await test7();}catch(e){console.error('TEST7:',e.message);failed++;}
  try{await test8();}catch(e){console.error('TEST8:',e.message);failed++;}
  console.log('\n─────────────────────────');
  console.log('結果: PASS '+passed+' / FAIL '+failed);
  process.exit(failed>0?1:0);
})();
