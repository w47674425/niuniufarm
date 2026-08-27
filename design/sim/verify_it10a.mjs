// 场景 A：从已开过礼包的存档进教程 → 第 0 步「打开新手礼包」不得自动跳过（修复验证）
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const LOG = 'C:/Work/niuniufarm-new/design/sim/verify_it10a.log';
fs.writeFileSync(LOG, 'START\n');
function log(s) { try { fs.appendFileSync(LOG, s + '\n'); } catch (e) {} console.log(s); }
const require = createRequire('C:/Users/Administrator/.workbuddy/binaries/node/workspace/package.json');
const WebSocket = require('ws');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const CDP_PORT = 9222;
const APP = 'http://127.0.0.1:4173/';
const PROFILE = 'C:/Work/niuniufarm-new/.cdp_profile';
const edge = spawn(EDGE, ['--headless=new','--remote-debugging-port='+CDP_PORT,'--no-first-run','--no-default-browser-check','--disable-gpu','--disable-http-cache','--window-size=1920,1080','--user-data-dir='+PROFILE,'about:blank'], { stdio: 'ignore' });
setTimeout(() => { try { edge.kill('SIGKILL'); } catch (e) {} process.exit(9); }, 60000).unref();
const results = []; const errors = [];
function ok(name, pass, extra = '') { results.push({ name, pass }); log((pass?'PASS ':'FAIL ')+name+(extra?'  -> '+extra:'')); }
async function getUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const data = await new Promise((res, rej) => {
        http.get('http://127.0.0.1:'+CDP_PORT+'/json/list', r => { let b=''; r.on('data',d=>b+=d); r.on('end',()=>res(b)); }).on('error', rej);
      });
      const arr = JSON.parse(data);
      const page = arr.find(t => t.type==='page') || arr.find(t => t.webSocketDebuggerUrl) || arr[0];
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch (e) {}
    await sleep(300);
  }
  throw new Error('no url');
}
(async () => {
  const ws = new WebSocket(await getUrl());
  let idc = 0; const pending = new Map();
  const send = (method, params={}) => new Promise((res, rej) => { const id=++idc; pending.set(id,{res,rej}); ws.send(JSON.stringify({id,method,params})); });
  ws.on('message', m => { const msg=JSON.parse(m); if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.rej(new Error(JSON.stringify(msg.error))):p.res(msg.result);} else if(msg.method==='Runtime.exceptionThrown'){const ed=msg.params.exceptionDetails||{};errors.push('EX: '+(ed.exception?(ed.exception.description||ed.exception.value):ed.text));} });
  await new Promise(r => ws.on('open', r));
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  try { await send('Network.clearBrowserCache'); } catch(e){}
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result && r.result.value; };
  // 注入：已开礼包存档（无 isPack pile → packOpened 语义 true）
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.removeItem('niuniu_ranch_save_v1');localStorage.removeItem('niuniu_tutorial_done_v1');}catch(e){}` });
  await send('Page.navigate', { url: APP });
  await sleep(3800);

  // ============ 首页「新手教程」按钮（新需求）：无存档首页 → 点击 → 进入教程 ============
  const homeBtn = await ev(`JSON.stringify({tutBtn:!!document.getElementById('homeTut'), home:!!document.querySelector('.home-overlay')})`);
  const hb = JSON.parse(homeBtn);
  ok('首页存在「新手教程」按钮', !!hb.tutBtn && !!hb.home, homeBtn);
  await ev(`document.getElementById('homeTut').click()`);
  await sleep(1000);
  const tutFromHome = JSON.parse(await ev(`JSON.stringify({homeGone:!document.querySelector('.home-overlay'), tut:!!document.querySelector('.tut'), title:(document.getElementById('tutTitle')||{}).textContent||'NO'})`));
  ok('首页点新手教程：进入教程且首页遮罩被清', !!tutFromHome.homeGone && !!tutFromHome.tut && (tutFromHome.title||'').includes('打开新手礼包'), JSON.stringify(tutFromHome));
  await ev(`(()=>{const b=document.getElementById('tutSkip'); if(b) b.click();})()`); // 跳过，避免污染后续
  await sleep(800);

  // ============ 原场景：从已开礼包存档的「设置」进教程 → 第 0 步不得自动完成 ============
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('niuniu_ranch_save_v1', JSON.stringify({day:2,timeLeft:40,phase:'day',gold:50,seenCards:{},cardGets:{},collection:{},tasksDone:{},lastSave:Date.now(),piles:[{x:500,y:500,cards:[{type:'herder',hp:5,fed:5,name:'一一'}]}]}));localStorage.removeItem('niuniu_tutorial_done_v1');}catch(e){}` });
  await send('Page.navigate', { url: APP });
  await sleep(3800);
  await ev(`document.getElementById('homeMain').click()`);  // 继续经营
  await sleep(900);
  await ev(`document.getElementById('setBtn').click()`);    // 主界面设置
  await sleep(600);
  await ev(`document.getElementById('tutBtn').click()`);    // 设置 → 新手教程
  await sleep(1000);
  const s0 = JSON.parse(await ev(`JSON.stringify({title:(document.getElementById('tutTitle')||{}).textContent||'NO', nextDisabled:(document.getElementById('tutNext')||{}).disabled, pack:!!document.querySelector('.packobj'), step:(document.getElementById('tutStep')||{}).textContent||''})`));
  ok('修复 已开礼包存档进教程：第0步未自动完成', (s0.title||'').includes('打开新手礼包') && s0.nextDisabled===true && !!s0.pack && (s0.step||'').includes('1 / 7'), JSON.stringify(s0));
  await ev(`(()=>{const p=document.querySelector('.packobj'); if(p) p.click();})()`);
  await sleep(1600);
  const s1 = await ev(`(document.getElementById('tutTitle')||{}).textContent||'NO'`);
  ok('修复 点开教程礼包后才进入第 1 步', (s1||'').includes('拖牧民到树木'), s1);
  const realErrors = errors.filter(e=>!/favicon/i.test(e));
  ok('运行期无 JS 报错', realErrors.length===0, realErrors.slice(0,3).join('|'));
  const failed = results.filter(r=>!r.pass);
  log('通过 '+(results.length-failed.length)+'/'+results.length);
  try { edge.kill('SIGKILL'); } catch(e){}
  ws.close(); process.exit(failed.length===0?0:1);
})().catch(e => { log('ERR '+e); try{edge.kill('SIGKILL');}catch(_){} process.exit(1); });
