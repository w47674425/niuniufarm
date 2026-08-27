// 新手引导修复验证：① 从首页点「开始教程」后教程可见（首页遮罩必须被清）② 完整 6 步可通关 ③ charges=1
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const LOG = 'C:/Work/niuniufarm-new/design/sim/verify_it10.log';
fs.writeFileSync(LOG, 'START ' + new Date().toISOString() + '\n');
function log(s) { try { fs.appendFileSync(LOG, s + '\n'); } catch (e) {} console.log(s); }

const require = createRequire('C:/Users/Administrator/.workbuddy/binaries/node/workspace/package.json');
const WebSocket = require('ws');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const CDP_PORT = 9222;
const APP = 'http://127.0.0.1:4173/';
const PROFILE = 'C:/Work/niuniufarm-new/.cdp_profile';

process.on('uncaughtException', e => { log('UNCAUGHT ' + (e && e.stack || e)); process.exit(2); });
process.on('unhandledRejection', e => { log('UNHANDLED ' + (e && e.stack || e)); process.exit(3); });

const results = [];
const errors = [];
function ok(name, pass, extra = '') {
  results.push({ name, pass });
  log((pass ? 'PASS ' : 'FAIL ') + name + (extra ? '  -> ' + extra : ''));
}

const edge = spawn(EDGE, [
  '--headless=new', '--remote-debugging-port=' + CDP_PORT,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-http-cache',
  '--window-size=1920,1080', '--user-data-dir=' + PROFILE, 'about:blank'
], { stdio: 'ignore' });

setTimeout(() => { log('HARD TIMEOUT 120s'); try { edge.kill('SIGKILL'); } catch (e) {} process.exit(9); }, 120000).unref();

async function getDebuggerUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const data = await new Promise((res, rej) => {
        http.get('http://127.0.0.1:' + CDP_PORT + '/json/list', r => {
          let b = ''; r.on('data', d => b += d); r.on('end', () => res(b));
        }).on('error', rej);
      });
      const arr = JSON.parse(data);
      if (Array.isArray(arr)) {
        const page = arr.find(t => t.type === 'page') || arr.find(t => t.webSocketDebuggerUrl) || arr[0];
        if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      }
    } catch (e) { log('  getUrl retry ' + i + ' ' + e.message); }
    await sleep(300);
  }
  throw new Error('无法获取 CDP debugger url');
}

function run() {
  return new Promise(async (resolve) => {
    let wsUrl;
    try { wsUrl = await getDebuggerUrl(); } catch (e) { ok('获取CDP地址', false, e.message); resolve(false); return; }
    log('WS ' + wsUrl);
    const ws = new WebSocket(wsUrl);
    let idc = 0;
    const pending = new Map();
    function send(method, params = {}) {
      return new Promise((res, rej) => {
        const id = ++idc;
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }
    async function evalJS(expression) {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) return { err: r.exceptionDetails.exception ? (r.exceptionDetails.exception.description || r.exceptionDetails.exception.value) : r.exceptionDetails.text };
      return { val: r.result && r.result.value };
    }
    ws.on('message', m => {
      try {
        const msg = JSON.parse(m);
        if (msg.id && pending.has(msg.id)) {
          const { res, rej } = pending.get(msg.id);
          pending.delete(msg.id);
          if (msg.error) rej(new Error(JSON.stringify(msg.error))); else res(msg.result);
        } else if (msg.method) {
          const p = msg.params || {};
          if (msg.method === 'Runtime.exceptionThrown') {
            const ed = p.exceptionDetails || {};
            errors.push('EXCEPTION: ' + (ed.exception ? (ed.exception.description || ed.exception.value) : ed.text));
          } else if (msg.method === 'Runtime.consoleAPICalled' && p.type === 'error') {
            errors.push('CONSOLE.ERROR: ' + (p.args || []).map(a => a.value !== undefined ? a.value : (a.description || a.type)).join(' '));
          }
        }
      } catch (e) { log('MSG HANDLER ERR ' + e.message); }
    });

    // 页面内工具：按文本找卡 + 拖拽 A 到 B
    const TOOL_JS = `
    window.__card = function(t){ return Array.from(document.querySelectorAll('#board .card')).find(e=>e.textContent.includes(t)) || null; };
    window.__dragTo = function(fromEl, toEl){
      if(!fromEl || !toEl) return 'NO_EL';
      const fr=fromEl.getBoundingClientRect(), tr=toEl.getBoundingClientRect();
      const sx=fr.left+fr.width/2, sy=fr.top+fr.height/2, tx=tr.left+tr.width/2, ty=tr.top+tr.height/2;
      fromEl.dispatchEvent(new PointerEvent('pointerdown',{clientX:sx,clientY:sy,bubbles:true,cancelable:true,pointerId:9,isPrimary:true}));
      for(let i=1;i<=10;i++){window.dispatchEvent(new PointerEvent('pointermove',{clientX:sx+(tx-sx)*i/10,clientY:sy+(ty-sy)*i/10,bubbles:true,cancelable:true,pointerId:9,isPrimary:true}));}
      window.dispatchEvent(new PointerEvent('pointerup',{clientX:tx,clientY:ty,bubbles:true,cancelable:true,pointerId:9,isPrimary:true}));
      return 'OK';
    };`;

    async function preloadScript(scriptBody) {
      await send('Page.addScriptToEvaluateOnNewDocument', { source: scriptBody });
      try { await send('Network.clearBrowserCache'); } catch (e) {}
      await send('Page.reload');
      await sleep(2600);
      await evalJS(TOOL_JS); // reload 后工具函数丢失，需重新注入
    }

    ws.on('open', async () => {
      try {
        await send('Page.enable');
        await send('Runtime.enable');
        await send('Log.enable');
        await send('Network.enable');
        try { await send('Network.clearBrowserCache'); } catch (e) {}
        await send('Page.navigate', { url: APP });
        log('navigated');
        await sleep(3800);
        await evalJS(TOOL_JS);

        // 清档：无存档 + 未看过教程
        await preloadScript(`try{localStorage.removeItem('niuniu_ranch_save_v1');localStorage.removeItem('niuniu_tutorial_done_v1');}catch(e){}`);

        // ============ 核心修复：从首页点「开始教程」→ 教程必须可见（首页遮罩被清） ============
        const intro = await evalJS(`JSON.stringify({tutStart:!!document.getElementById('tutStart'), home:!!document.querySelector('.home-overlay')})`);
        const intO = JSON.parse(intro.val || '{}');
        ok('首次启动出现教程入口', !!intO.tutStart, intro.val);
        await evalJS(`document.getElementById('tutStart').click()`);
        await sleep(900);
        const vis = await evalJS(`JSON.stringify({homeGone:!document.querySelector('.home-overlay'), tut:!!document.querySelector('.tut'), pack:!!document.querySelector('.packobj'), title:(document.getElementById('tutTitle')||{}).textContent||'NO'})`);
        const v = JSON.parse(vis.val || '{}');
        ok('修复 教程启动后首页遮罩被清除(教程可见)', !!v.homeGone && !!v.tut && !!v.pack, vis.val);
        ok('修复 教程第 1 步=打开新手礼包', (v.title || '').includes('打开新手礼包'), v.title);

        // 第 0 步：点礼包
        await evalJS(`(()=>{const p=document.querySelector('.packobj'); if(p) p.click(); return !!p;})()`);
        await sleep(1500);
        const step1 = await evalJS(`(document.getElementById('tutTitle')||{}).textContent||'NO'`);
        ok('第0步→第1步(拖牧民到树木)', (step1.val || '').includes('拖牧民到树木'), step1.val);

        // 第 1 步：牧民·一一 拖到 树木
        await evalJS(`window.__dragTo(window.__card('牧民·一一'), window.__card('树木'))`);
        await sleep(2500); // gather_wood 8s？太快没采完——等 9s
        await sleep(8000);
        const step2 = await evalJS(`(document.getElementById('tutTitle')||{}).textContent||'NO'`);
        ok('第1步→第2步(拖牧民到蓝莓丛)', (step2.val || '').includes('蓝莓丛'), step2.val);

        // 第 2 步：牧民·二二 拖到 蓝莓丛
        await evalJS(`window.__dragTo(window.__card('牧民·二二'), window.__card('蓝莓丛'))`);
        await sleep(7000); // gather_blueberry 5s
        const step3 = await evalJS(`(document.getElementById('tutTitle')||{}).textContent||'NO'`);
        ok('第2步→第3步(把蓝莓喂给牧民)', (step3.val || '').includes('喂给牧民'), step3.val);

        // 第 3 步：蓝莓 拖到 牧民·二二（二二 fed=2，喂食有真实反馈）
        await evalJS(`window.__dragTo(window.__card('蓝莓'), window.__card('牧民·二二'))`);
        await sleep(1200);
        const step4 = await evalJS(`(document.getElementById('tutTitle')||{}).textContent||'NO'`);
        ok('第3步→第4步(打造木剑)', (step4.val || '').includes('打造木剑'), step4.val);

        // 第 4 步：制造厂 拖到 木头堆，再牧民拖上去 → 木剑
        await evalJS(`window.__dragTo(window.__card('制造厂'), window.__card('木头'))`);
        await sleep(600);
        await evalJS(`window.__dragTo(window.__card('牧民·一一'), window.__card('制造厂'))`);
        await sleep(8000); // craft 5s
        const step5 = await evalJS(`(document.getElementById('tutTitle')||{}).textContent||'NO'`);
        ok('第4步→第5步(给狗装备木剑)', (step5.val || '').includes('装备木剑'), step5.val);

        // 第 5 步：木剑 拖到 边牧
        await evalJS(`window.__dragTo(window.__card('木剑'), window.__card('边牧'))`);
        await sleep(3000); // equip 1s
        const step6 = await evalJS(`(document.getElementById('tutTitle')||{}).textContent||'NO'`);
        ok('第5步→第6步(买动物店卡包)', (step6.val || '').includes('动物店'), step6.val);

        // 第 6 步：点卡包 → 买动物店
        await evalJS(`document.getElementById('packBtn').click()`);
        await sleep(700);
        const buy = await evalJS(`(()=>{const b=Array.from(document.querySelectorAll('.si-buy')).find(x=>x.getAttribute('data-pack')==='animal'); if(b){b.click(); return 'OK';} return 'NO_BTN';})()`);
        await sleep(1500);
        const done = await evalJS(`JSON.stringify({tutGone:!document.querySelector('.tut'), toast:(document.getElementById('toast')||{}).textContent||''})`);
        const d = JSON.parse(done.val || '{}');
        ok('修复 第6步买动物店后教程完成(教程UI消失)', !!d.tutGone, 'buy=' + buy.val + ' ' + done.val);
        ok('修复 教程结束语=开始经营牧场吧', (d.toast || '').includes('开始经营牧场吧'), d.toast);

        // ============ charges=1 验证：树采 1 次即消失（timeLeft=80 避免验证中途入夜刷小偷干扰） ============
        await preloadScript(`try{localStorage.setItem('niuniu_ranch_save_v1', JSON.stringify({day:2,timeLeft:80,phase:'day',gold:50,seenCards:{},cardGets:{},collection:{},tasksDone:{},lastSave:Date.now(),piles:[{x:400,y:400,cards:[{type:'herder',hp:5,fed:5,name:'一一'}]},{x:800,y:400,cards:[{type:'tree'}]}]}));localStorage.removeItem('niuniu_tutorial_done_v1');}catch(e){}`);
        await evalJS(`document.getElementById('homeMain').click()`);
        await sleep(900);
        await evalJS(`window.__dragTo(window.__card('牧民·一一'), window.__card('树木'))`);
        await sleep(10000); // gather_wood 8s
        const treeState = await evalJS(`JSON.stringify({tree:!!window.__card('树木'), wood:!!window.__card('木头'), left:(()=>{const t=window.__card('树木'); return t?Array.from(t.querySelectorAll('.cb')).map(e=>e.textContent).join('|'):'GONE';})()})`);
        const ts = JSON.parse(treeState.val || '{}');
        ok('charges=1 树采 1 次后消失(木头产出)', !ts.tree && !!ts.wood, treeState.val);

        // ============ tick 30Hz 但计时按秒：timeLeft=10 → 等 2.5s → 剩余 ≈7-8s ============
        await preloadScript(`try{localStorage.setItem('niuniu_ranch_save_v1', JSON.stringify({day:2,timeLeft:10,phase:'day',gold:50,seenCards:{},cardGets:{},collection:{},tasksDone:{},lastSave:Date.now(),piles:[{x:400,y:400,cards:[{type:'herder',hp:5,fed:5,name:'一一'}]}]}));localStorage.removeItem('niuniu_tutorial_done_v1');}catch(e){}`);
        await evalJS(`document.getElementById('homeMain').click()`);
        await sleep(900);
        const t0 = await evalJS(`(document.getElementById('timer')||{}).textContent||''`);
        await sleep(2500);
        const t1 = await evalJS(`(document.getElementById('timer')||{}).textContent||''`);
        const parseT = (s) => { const p = (s||'').split(':'); return p.length===2 ? parseInt(p[0],10)*60+parseInt(p[1],10) : NaN; };
        const v0 = parseT(t0.val), v1 = parseT(t1.val);
        ok('tick30Hz 计时按秒(2.5s 后剩余≈7-8s)', !isNaN(v0) && v1 >= 6 && v1 <= 9, 't0=' + t0.val + ' t1=' + t1.val);

        const realErrors = errors.filter(e => !/favicon/i.test(e));
        ok('运行期无 JS 报错(已忽略 favicon 404)', realErrors.length === 0, realErrors.slice(0, 5).join(' | '));
      } catch (e) {
        ok('脚本执行异常', false, String(e && e.stack || e));
      } finally {
        try { ws.close(); } catch (e) {}
        const failed = results.filter(r => !r.pass);
        log('\n==== 汇总 ====');
        log('通过 ' + (results.length - failed.length) + '/' + results.length);
        if (errors.length) { log('捕获到的报错:'); errors.forEach(e => log('  - ' + e)); }
        try { edge.kill('SIGKILL'); } catch (e) {}
        resolve(failed.length === 0);
      }
    });
    ws.on('error', e => { ok('WebSocket 连接失败', false, String(e)); try { edge.kill('SIGKILL'); } catch (_) {} resolve(false); });
  });
}

run().then(success => { log('EXIT ' + (success ? 0 : 1)); process.exit(success ? 0 : 1); });
