import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--autoplay-policy=no-user-gesture-required']});
const pg=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
const errs=[], p404=new Set();
pg.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });
pg.on('response',r=>{ if(r.status()===404) p404.add(r.url().split('/').pop()); });
const wait=ms=>pg.waitForTimeout(ms);
await pg.goto('http://localhost:8099/index.html?v=35&debug=1',{waitUntil:'networkidle'}); await wait(300);
await pg.click('#btn-start-stream'); await wait(200);
const ids=await pg.evaluate(()=>window.PUZZLES.map(p=>p.id));
// --- PASS A: layout/board integrity for ALL 50 (open+check+back) ---
let layout=[];
for(const id of ids){
  await pg.evaluate(id=>{const c=[...document.querySelectorAll('.ss-card')].find(x=>x.dataset.puzzleId===id);c.scrollIntoView();c.click();}, id);
  await wait(90);
  const chk=await pg.evaluate(id=>{const p=window.PUZZLES.find(x=>x.id===id);const R=p.solution.length,C=p.solution[0].length;return {cells:document.querySelectorAll('.cell').length,expect:R*C,ov:document.documentElement.scrollWidth-document.documentElement.clientWidth};}, id);
  if(chk.cells!==chk.expect) layout.push(`${id}:cells ${chk.cells}!=${chk.expect}`);
  if(chk.ov>0) layout.push(`${id}:overflow ${chk.ov}`);
  await pg.evaluate(()=>document.getElementById('back-btn').click()); await wait(60);
}
console.log('PASS A (layout all 50):', layout.length?layout:'all OK');
// --- PASS B: full clear flow on a representative subset ---
const subset=['heart','face','cat','mush','ship','key','castle','giraffe','fish','snowman'];
let flow=[];
for(const id of subset){
  await pg.evaluate(id=>{const c=[...document.querySelectorAll('.ss-card')].find(x=>x.dataset.puzzleId===id);c.scrollIntoView();c.click();}, id);
  await wait(150);
  await pg.evaluate(id=>{const s=window.PUZZLES.find(x=>x.id===id).solution;for(let r=0;r<s.length;r++)for(let c=0;c<s[0].length;c++)if(s[r][c]){const cell=document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);const rc=cell.getBoundingClientRect();const x=rc.x+rc.width/2,y=rc.y+rc.height/2;cell.dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,button:0,clientX:x,clientY:y,bubbles:true,pointerType:'mouse'}));cell.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,clientX:x,clientY:y,bubbles:true}));}}, id);
  let shown=false; for(let i=0;i<45;i++){ if(await pg.evaluate(()=>!document.getElementById('clear-overlay').classList.contains('hidden'))){shown=true;break;} await wait(100); }
  if(!shown){ flow.push(`${id}:no-clear`); continue; }
  const cc=await pg.evaluate(()=>({t:(document.querySelector('.js-trivia-text').textContent||'').length,a:document.querySelectorAll('.js-clear-art > span.on').length}));
  if(cc.t===0) flow.push(`${id}:empty-trivia`); if(cc.a===0) flow.push(`${id}:no-art`);
  await pg.click('#clear-next-btn'); await wait(150);
  for(let i=0;i<12;i++){ if(!(await pg.evaluate(()=>!document.getElementById('talk-event').classList.contains('hidden')))) break; await pg.click('#talk-event'); await wait(110); }
  await wait(60);
}
console.log('PASS B (clear flow x'+subset.length+'):', flow.length?flow:'all OK');
// --- PASS C: UI controls (fresh nav so no leftover overlay from PASS B) ---
let ui=[];
await pg.evaluate(()=>{document.getElementById('talk-event').classList.add('hidden');document.getElementById('clear-overlay').classList.add('hidden');document.getElementById('menu-overlay').classList.add('hidden');}); await wait(60);
// PASS B ends on the select screen; pick a puzzle NOT in the clear subset so board opens fresh
await pg.evaluate(()=>{const c=[...document.querySelectorAll('.ss-card')].find(x=>x.dataset.puzzleId==='apple');c.scrollIntoView();c.click();}); await wait(200);
await pg.click('#mode-mark'); await wait(40);
await pg.evaluate(()=>{const cell=document.querySelector('.cell[data-r="0"][data-c="0"]');const rc=cell.getBoundingClientRect();cell.dispatchEvent(new PointerEvent('pointerdown',{pointerId:2,button:0,clientX:rc.x+5,clientY:rc.y+5,bubbles:true,pointerType:'mouse'}));cell.dispatchEvent(new PointerEvent('pointerup',{pointerId:2,clientX:rc.x+5,clientY:rc.y+5,bubbles:true}));}); await wait(50);
if(!(await pg.evaluate(()=>document.querySelector('.cell[data-r="0"][data-c="0"]').classList.contains('marked')))) ui.push('mark failed');
if(await pg.evaluate(()=>document.getElementById('btn-undo').disabled)) ui.push('undo not enabled after mark');
await pg.evaluate(()=>document.getElementById('btn-undo').click()); await wait(60);
if(await pg.evaluate(()=>document.querySelector('.cell[data-r="0"][data-c="0"]').classList.contains('marked'))) ui.push('undo failed');
await pg.click('#btn-pause'); await wait(50);
if(!(await pg.evaluate(()=>document.getElementById('board').classList.contains('paused')))) ui.push('pause failed');
await pg.click('#btn-pause'); await wait(50);
await pg.click('#gh-menu-btn'); await wait(80);
if(!(await pg.evaluate(()=>!document.getElementById('menu-overlay').classList.contains('hidden')))) ui.push('menu failed');
await pg.click('#menu-title-btn'); await wait(120);
if(!(await pg.evaluate(()=>!document.getElementById('title-screen').classList.contains('hidden')))) ui.push('title nav failed');
console.log('PASS C (UI controls):', ui.length?ui:'all OK');
console.log('404s:', p404.size?[...p404]:'none');
console.log('JS errors:', errs.length?[...new Set(errs)].slice(0,10):'none');
await b.close();
