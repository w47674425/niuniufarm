// 迭代7 UI 验收：纯 DOM 验证（不注入存档，开局即新档）
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const LOG = 'C:/Work/niuniufarm-new/design/sim/verify_it7.log';
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
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1920,1080', '--user-data-dir=' + PROFILE, 'about:blank'
], { stdio: 'ignore' });

setTimeout(() => { log('HARD TIMEOUT 60s'); try { edge.kill('SIGKILL'); } catch (e) {} process.exit(9); }, 60000).unref();

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
          } else if (msg.method === 'Log.entryAdded' && p.entry && p.entry.level === 'error') {
            errors.push('LOG.ERROR: ' + (p.entry.text || '') + (p.entry.url ? (' @ ' + p.entry.url) : ''));
          }
        }
      } catch (e) { log('MSG HANDLER ERR ' + e.message); }
    });
    ws.on('open', async () => {
      try {
        await send('Page.enable');
        await send('Runtime.enable');
        await send('Log.enable');
        await send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.clear()}catch(e){}' });
        await send('Network.enable');
        ws.on('message', m2 => { try { const mm = JSON.parse(m2); if (mm.method === 'Network.responseReceived' && mm.params.response && mm.params.response.status >= 400) log('HTTP ' + mm.params.response.status + ' ' + mm.params.response.url); } catch (e) {} });
        await send('Page.navigate', { url: APP });
        log('navigated');
        await sleep(4000);

        const diag = await send('Runtime.evaluate', { expression: `JSON.stringify({title:document.title, appKids:document.getElementById('app')?document.getElementById('app').children.length:-1, hasHome:!!document.getElementById('homeMain'), homeText:(document.getElementById('homeMain')||{}).textContent, bodyLen:document.body.innerHTML.length, codexBtn:!!document.getElementById('codexBtn'), hasBoard:!!document.getElementById('board'), boardKids:document.getElementById('board')?document.getElementById('board').children.length:-1})`, returnByValue: true });
        log('DIAG ' + (diag.result && diag.result.value));

        const homeText = await send('Runtime.evaluate', { expression: `(document.getElementById('homeMain')||{}).textContent||'NONE'`, returnByValue: true });
        const ht = homeText.result && homeText.result.value;
        ok('首页主CTA存在且为「开始经营」', ht && ht.includes('开始经营'), JSON.stringify(ht));

        await send('Runtime.evaluate', { expression: `document.getElementById('homeMain').click()`, returnByValue: true });
        await sleep(1200);
        // 新手礼包出现 → 点开才会散布 8 张开局卡
        const packOk = await send('Runtime.evaluate', { expression: `(()=>{const p=document.querySelector('.packobj'); if(p){p.click(); return true;} return false;})()`, returnByValue: true });
        ok('开局后出现新手礼包(.packobj)', !!(packOk.result && packOk.result.value));
        await sleep(900);
        const cardCount = await send('Runtime.evaluate', { expression: `document.querySelectorAll('#board .card').length`, returnByValue: true });
        const cc = (cardCount.result && cardCount.result.value) || 0;
        ok('点开礼包后棋盘渲染卡牌(≥8)', cc >= 8, 'cards=' + cc);

        await send('Runtime.evaluate', { expression: `(()=>{const c=document.querySelector('#board .card'); if(c) c.dispatchEvent(new MouseEvent('mouseenter',{bubbles:false}));})()`, returnByValue: true });
        await sleep(400);
        const tip = await send('Runtime.evaluate', { expression: `!!document.querySelector('.cardtip')`, returnByValue: true });
        ok('卡牌悬停出现介绍浮层 .cardtip', !!(tip.result && tip.result.value));

        await send('Runtime.evaluate', { expression: `(()=>{const t=document.querySelector('.cardtip'); if(t) t.remove();})()`, returnByValue: true });
        await send('Runtime.evaluate', { expression: `document.getElementById('codexBtn').click()`, returnByValue: true });
        await sleep(900);
        const codexInfo = await send('Runtime.evaluate', {
          expression: `JSON.stringify({cells:document.querySelectorAll('.codex-cell').length, sale:document.querySelectorAll('.cc-sale').length})`,
          returnByValue: true
        });
        let cells = 0, sale = 0;
        try { const o = JSON.parse(codexInfo.result.value); cells = o.cells; sale = o.sale; } catch (e) {}
        ok('图鉴打开且有售价列 .cc-sale(>0)', sale > 0, 'cells=' + cells + ' sale=' + sale);

        await send('Runtime.evaluate', { expression: `(()=>{const b=document.querySelector('.modal .close'); if(b) b.click();})()`, returnByValue: true });
        await sleep(300);
        await send('Runtime.evaluate', { expression: `document.getElementById('travelBtn').click()`, returnByValue: true });
        await sleep(700);
        const pp = await send('Runtime.evaluate', { expression: `document.querySelectorAll('.passport-grid .pp-card').length`, returnByValue: true });
        const ppc = (pp.result && pp.result.value) || 0;
        ok('护照入口可开且含 6 站打卡网格', ppc === 6, 'pp-card=' + ppc);

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
