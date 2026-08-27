// 迭代8 第二批验收（4 条）：市场旁复活按钮 / 牧民不吃生肉 / 狗训练保留高属性 / endGame 广告召回 1 名
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const LOG = 'C:/Work/niuniufarm-new/design/sim/verify_it9.log';
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

setTimeout(() => { log('HARD TIMEOUT 90s'); try { edge.kill('SIGKILL'); } catch (e) {} process.exit(9); }, 90000).unref();

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

    async function preloadScript(scriptBody) {
      await send('Page.addScriptToEvaluateOnNewDocument', { source: scriptBody });
      try { await send('Network.clearBrowserCache'); } catch (e) {}
      await send('Page.reload');
      await sleep(2600);
    }
    async function injectSave(saveObj) {
      const j = JSON.stringify(saveObj);
      await preloadScript(`try{localStorage.setItem('niuniu_ranch_save_v1', ${JSON.stringify(j)});localStorage.removeItem('niuniu_tutorial_done_v1');}catch(e){}`);
      await evalJS(`document.getElementById('homeMain').click()`);
      await sleep(900);
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

        // ============ 反馈①：市场旁复活按钮（死亡1牧民 → 按钮出现 → 点击看广告复活1名） ============
        await injectSave({ day: 2, timeLeft: 40, phase: 'day', gold: 50, deadHerders: 1, seenCards: {}, cardGets: {}, collection: {}, tasksDone: {}, lastSave: Date.now(), piles: [
          { x: 600, y: 500, cards: [{ type: 'herder', hp: 5, fed: 5, name: '一一' }] }
        ]});
        const btnShown = await evalJS(`JSON.stringify({btn:!!document.getElementById('reviveBtn'), disp:(document.getElementById('reviveBtn')||{}).style.display, herders:document.querySelectorAll('#board .card .cn').length})`);
        const bs = JSON.parse(btnShown.val || '{}');
        ok('反馈① 复活按钮在市场旁显示(死亡1牧民)', !!bs.btn && bs.disp === 'flex' && bs.herders === 1, btnShown.val);
        await evalJS(`document.getElementById('reviveBtn').click()`);
        await sleep(2200); // 广告 1.6s
        const afterRevive = await evalJS(`JSON.stringify({herders:Array.from(document.querySelectorAll('#board .card .cn')).map(e=>e.textContent).join(','), btn:(document.getElementById('reviveBtn')||{}).style.display})`);
        const ar = JSON.parse(afterRevive.val || '{}');
        ok('反馈① 看广告复活 1 名牧民(共2名,按钮消失)', ar.herders.includes('牧民·一一') && ar.herders.includes('牧民·二二') && ar.btn === 'none', afterRevive.val);

        // ============ 反馈②：牧民不能直接吃生肉（拖生肉到牧民 → 不消耗；狗可以吃） ============
        await injectSave({ day: 2, timeLeft: 40, phase: 'day', gold: 50, seenCards: {}, cardGets: {}, collection: {}, tasksDone: {}, lastSave: Date.now(), piles: [
          { x: 400, y: 400, cards: [{ type: 'herder', hp: 5, fed: 4, name: '一一' }] },
          { x: 800, y: 400, cards: [{ type: 'rawmeat' }] }
        ]});
        const feedRaw = await evalJS(`(()=>{const els=document.querySelectorAll('#board .card'); if(els.length<2) return 'NO_CARDS:'+els.length; const from=els[1], to=els[0]; const fr=from.getBoundingClientRect(), tr=to.getBoundingClientRect(); const sx=fr.left+fr.width/2, sy=fr.top+fr.height/2, tx=tr.left+tr.width/2, ty=tr.top+tr.height/2; from.dispatchEvent(new PointerEvent('pointerdown',{clientX:sx,clientY:sy,bubbles:true,cancelable:true,pointerId:5,isPrimary:true})); for(let i=1;i<=10;i++){window.dispatchEvent(new PointerEvent('pointermove',{clientX:sx+(tx-sx)*i/10,clientY:sy+(ty-sy)*i/10,bubbles:true,cancelable:true,pointerId:5,isPrimary:true}));} window.dispatchEvent(new PointerEvent('pointerup',{clientX:tx,clientY:ty,bubbles:true,cancelable:true,pointerId:5,isPrimary:true})); return 'OK';})()`);
        await sleep(1000);
        const afterFeed = await evalJS(`JSON.stringify({raw:Array.from(document.querySelectorAll('#board .card')).filter(e=>e.textContent.includes('生肉')).length, herder:Array.from(document.querySelectorAll('#board .card .cb')).map(e=>e.textContent).join('|')})`);
        const af = JSON.parse(afterFeed.val || '{}');
        ok('反馈② 拖生肉到牧民：生肉不消耗且饱食不变', af.raw === 1 && (af.herder || '').includes('饱食 4/5'), 'feed=' + feedRaw.val + ' ' + afterFeed.val);

        // ============ 反馈③：狗训练保留属性更高的那只 ============
        // dogA 无加成(score10)；dogB atkBonus+2(score12) → 保留 dogB，训练后 atkBonus=2+2=4 → 显示 ⚔️8 ❤️9/9
        await injectSave({ day: 2, timeLeft: 40, phase: 'day', gold: 50, seenCards: {}, cardGets: {}, collection: {}, tasksDone: {}, lastSave: Date.now(), piles: [
          { x: 400, y: 400, cards: [{ type: 'border_collie', hp: 6, fed: 5 }, { type: 'border_collie', hp: 6, fed: 5, atkBonus: 2 }, { type: 'house' }] }
        ]});
        await sleep(13000); // 训练 10s
        const afterBoost = await evalJS(`JSON.stringify({dog:Array.from(document.querySelectorAll('#board .card')).filter(e=>e.textContent.includes('边牧')).map(e=>Array.from(e.querySelectorAll('.cb')).map(x=>x.textContent).join('|')).join('@@'), cnt:document.querySelectorAll('#board .card').length})`);
        const ab = JSON.parse(afterBoost.val || '{}');
        // 保留属性更高者(dogB atkBonus2→4)：⚔️8=4基础+4加成；血量上限 9=6基础+3训练(当前血仍 6)；房屋保留 → 共 2 卡
        ok('反馈③ 狗训练保留属性更高者并累加属性', (ab.dog || '').includes('⚔️8') && (ab.dog || '').includes('❤️6/9') && ab.cnt === 2, afterBoost.val);

        // ============ 反馈④：endGame 看广告只召回 1 名牧民 ============
        await injectSave({ day: 1, timeLeft: 1, phase: 'day', gold: 0, seenCards: {}, cardGets: {}, collection: {}, tasksDone: {}, lastSave: Date.now(), piles: [] });
        await sleep(2600); // timeLeft 归零 → onDayEnd → 全灭弹窗
        const endBox = await evalJS(`JSON.stringify({end:!!document.getElementById('overOverlay'), txt:(document.getElementById('overOverlay')||{}).textContent||''})`);
        const eb = JSON.parse(endBox.val || '{}');
        ok('反馈④ 全灭出现 endGame 弹窗且文案=召回1名', !!eb.end && (eb.txt || '').includes('召回 1 名'), endBox.val);
        await evalJS(`document.getElementById('adBtn').click()`);
        await sleep(2200);
        const afterAd = await evalJS(`JSON.stringify({herders:Array.from(document.querySelectorAll('#board .card .cn')).map(e=>e.textContent).join(','), cards:document.querySelectorAll('#board .card').length, endGone:!document.getElementById('overOverlay')})`);
        const aa = JSON.parse(afterAd.val || '{}');
        const herderN = (aa.herders || '').split(',').filter(s => s.includes('牧民')).length;
        ok('反馈④ 广告召回仅 1 名牧民(且附赠食物)', herderN === 1 && aa.cards === 2 && !!aa.endGone, afterAd.val);

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
