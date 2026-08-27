// 迭代8 验收反馈修复验证（12 条 + xlsx 还原关键项）
// 状态管理：用 Page.addScriptToEvaluateOnNewDocument 在每次导航前写入目标存档，
// 避免 beforeunload 的 saveGame 写回污染注入的存档。
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const LOG = 'C:/Work/niuniufarm-new/design/sim/verify_it8.log';
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

    // 预注入脚本（文档加载前执行）：写入指定存档（或清空）；reload 前清浏览器缓存防旧 bundle
    async function preloadScript(scriptBody) {
      await send('Page.addScriptToEvaluateOnNewDocument', { source: scriptBody });
      try { await send('Network.clearBrowserCache'); } catch (e) {}
      await send('Page.reload');
      await sleep(2600);
    }
    // 无存档启动（流程 A / B / G）
    async function cleanStart() {
      await preloadScript(`try{localStorage.removeItem('niuniu_ranch_save_v1');localStorage.removeItem('niuniu_tutorial_done_v1');}catch(e){}`);
    }
    // 注入存档并进入游戏（点「继续经营牧场」）
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
        await cleanStart();

        // ============ 流程 A：首页（背景图 / 子面板保持 / 时间冻结） ============
        const homeBg = await evalJS(`(()=>{const o=document.querySelector('.home-overlay'); if(!o) return 'NO_OV'; return getComputedStyle(o).backgroundImage||'';})()`);
        ok('反馈⑫ 首页有背景图', !!(homeBg.val || '').includes('bg_day'), homeBg.val);
        const cta = await evalJS(`(document.getElementById('homeMain')||{}).textContent||'NONE'`);
        ok('反馈⑫ 首页主CTA=开始经营', cta.val === '🚀 开始经营', cta.val);

        // 打开护照 → 首页应保留（叠加）
        await evalJS(`document.getElementById('homePass').click()`);
        await sleep(600);
        const pp = await evalJS(`JSON.stringify({pp:!!document.querySelector('.passport-overlay .modal'), homeStill:!!document.querySelector('.home-overlay'), ppCards:document.querySelectorAll('.passport-grid .pp-card').length})`);
        const ppO = JSON.parse(pp.val || '{}');
        ok('反馈⑬ 首页点护照：护照面板+首页并存', !!ppO.pp && !!ppO.homeStill, pp.val);
        ok('反馈⑬ 护照含 6 站', ppO.ppCards === 6, 'pp=' + ppO.ppCards);
        // 关闭护照 → 仍停留首页（无主界面卡）
        await evalJS(`(()=>{const c=document.querySelector('.passport-overlay .close'); if(c) c.click();})()`);
        await sleep(500);
        const afterClose = await evalJS(`JSON.stringify({home:!!document.querySelector('.home-overlay'), cards:document.querySelectorAll('#board .card').length, timer:(document.getElementById('timer')||{}).textContent})`);
        const acO = JSON.parse(afterClose.val || '{}');
        ok('反馈⑬ 关闭护照后仍回首页且棋盘无卡', !!acO.home && acO.cards === 0, afterClose.val);
        // 设置：打开 → 关闭 → 首页保持
        await evalJS(`document.getElementById('homeSet').click()`);
        await sleep(600);
        const setO = await evalJS(`JSON.stringify({set:!!document.querySelector('.set-overlay .modal'), home:!!document.querySelector('.home-overlay')})`);
        const so = JSON.parse(setO.val || '{}');
        ok('反馈⑬ 首页点设置：设置面板+首页并存', !!so.set && !!so.home, setO.val);
        await evalJS(`(()=>{const c=document.querySelector('.set-overlay .close'); if(c) c.click();})()`);
        await sleep(500);
        const setClose = await evalJS(`JSON.stringify({home:!!document.querySelector('.home-overlay'), cards:document.querySelectorAll('#board .card').length})`);
        const sc = JSON.parse(setClose.val || '{}');
        ok('反馈⑬ 关闭设置后仍回首页', !!sc.home && sc.cards === 0, setClose.val);

        // ============ 流程 B：开始经营 → 礼包 → 命名 / 无攻击 / 图鉴合成 / 任务 / 帮助 ============
        await evalJS(`document.getElementById('homeMain').click()`);
        await sleep(1000);
        await evalJS(`(()=>{const p=document.querySelector('.packobj'); if(p) p.click();})()`);
        await sleep(900);
        const names = await evalJS(`Array.from(document.querySelectorAll('#board .card .cn')).map(e=>e.textContent).join(',')`);
        ok('反馈① 牧民命名 一一/二二', (names.val || '').includes('牧民·一一') && (names.val || '').includes('牧民·二二'), names.val);
        const herderAttr = await evalJS(`(()=>{const c=Array.from(document.querySelectorAll('#board .card')).find(e=>e.textContent.includes('牧民·一一')); if(!c) return 'NO_HERDER'; return Array.from(c.querySelectorAll('.cb')).map(e=>e.textContent).join('|');})()`);
        ok('反馈⑩ 牧民无攻击属性(卡面无⚔️)', !!herderAttr.val && !herderAttr.val.includes('⚔️'), herderAttr.val);
        // 图鉴 → 合成 tab
        await evalJS(`document.getElementById('codexBtn').click()`);
        await sleep(800);
        await evalJS(`(()=>{const t=Array.from(document.querySelectorAll('.book-tab')).find(b=>b.textContent.includes('合成')); if(t) t.click();})()`);
        await sleep(700);
        const recipes = await evalJS(`document.querySelectorAll('.recipe-item').length`);
        ok('反馈③ 图鉴-合成标签有配方内容', (recipes.val || 0) > 10, 'recipe-item=' + recipes.val);
        const hasBoost = await evalJS(`Array.from(document.querySelectorAll('.recipe-item')).some(e=>e.textContent.includes('训练'))`);
        ok('还原 同种狗训练配方在图鉴合成可见', !!hasBoost.val);
        await evalJS(`(()=>{const c=document.querySelector('.modal .close'); if(c) c.click();})()`);
        await sleep(400);
        // 任务列表（新世界观 10 条）
        await evalJS(`document.getElementById('taskBtn').click()`);
        await sleep(600);
        const tasks = await evalJS(`JSON.stringify({n:document.querySelectorAll('.task-item').length, txt:(document.querySelector('.modal')||{}).textContent||''})`);
        const tO = JSON.parse(tasks.val || '{}');
        ok('反馈⑤ 任务列表替换为策划 10 条', tO.n === 10, 'n=' + tO.n);
        ok('反馈⑤ 任务含新任务文案', (tO.txt || '').includes('打开新手礼包') && (tO.txt || '').includes('建造飞机') && (tO.txt || '').includes('首次旅行') && (tO.txt || '').includes('驱逐一个小偷'), '');
        await evalJS(`(()=>{const c=document.querySelector('.modal .close'); if(c) c.click();})()`);
        await sleep(400);
        // 设置 → 玩法帮助（新文案）
        await evalJS(`document.getElementById('setBtn').click()`);
        await sleep(600);
        await evalJS(`(()=>{const b=document.getElementById('helpBtn'); if(b) b.click();})()`);
        await sleep(600);
        const help = await evalJS(`(document.querySelector('.modal')||{}).textContent || ''`);
        const hText = help.val || '';
        ok('反馈⑦ 玩法介绍替换为新世界观文案', hText.includes('飞机链') && hText.includes('小偷') && hText.includes('牧羊犬自动迎击'), hText.slice(0, 50));
        ok('反馈⑦ 玩法介绍无繁殖/城墙残留', !hText.includes('繁殖') && !hText.includes('城墙'), '');
        await evalJS(`(()=>{const c=document.querySelector('.modal .close'); if(c) c.click();})()`);
        await sleep(400);
        await evalJS(`(()=>{const c=document.querySelector('.set-overlay .close'); if(c) c.click();})()`);
        await sleep(400);

        // ============ 流程 C：饱食满拖食物不消失（反馈②） ============
        await injectSave({ day: 2, timeLeft: 40, phase: 'day', gold: 50, seenCards: {}, cardGets: {}, collection: {}, tasksDone: {}, lastSave: Date.now(), piles: [
          { x: 500, y: 500, cards: [{ type: 'herder', hp: 5, fed: 5 }] },
          { x: 900, y: 500, cards: [{ type: 'blueberry' }] }
        ]});
        const feed = await evalJS(`(()=>{const els=document.querySelectorAll('#board .card'); if(els.length<2) return 'NO_CARDS:'+els.length; const from=els[1], to=els[0]; const fr=from.getBoundingClientRect(), tr=to.getBoundingClientRect(); const sx=fr.left+fr.width/2, sy=fr.top+fr.height/2, tx=tr.left+tr.width/2, ty=tr.top+tr.height/2; from.dispatchEvent(new PointerEvent('pointerdown',{clientX:sx,clientY:sy,bubbles:true,cancelable:true,pointerId:3,isPrimary:true})); for(let i=1;i<=10;i++){window.dispatchEvent(new PointerEvent('pointermove',{clientX:sx+(tx-sx)*i/10,clientY:sy+(ty-sy)*i/10,bubbles:true,cancelable:true,pointerId:3,isPrimary:true}));} window.dispatchEvent(new PointerEvent('pointerup',{clientX:tx,clientY:ty,bubbles:true,cancelable:true,pointerId:3,isPrimary:true})); return 'OK';})()`);
        await sleep(1400);
        const blueberryCount = await evalJS(`Array.from(document.querySelectorAll('#board .card')).filter(e=>e.textContent.includes('蓝莓')).length`);
        ok('反馈② 饱食满牧民叠加食物不消耗', (blueberryCount.val || 0) === 1, 'feed=' + feed.val + ' blueberry=' + blueberryCount.val);

        // ============ 流程 D：两狗叠加可拆分（反馈⑨） ============
        await injectSave({ day: 2, timeLeft: 40, phase: 'day', gold: 50, seenCards: {}, cardGets: {}, collection: {}, tasksDone: {}, lastSave: Date.now(), piles: [
          { x: 400, y: 400, cards: [{ type: 'border_collie', hp: 6, fed: 5 }, { type: 'golden', hp: 4, fed: 5 }] }
        ]});
        const splitPos = await evalJS(`(()=>{const els=Array.from(document.querySelectorAll('#board .card')); if(els.length<2) return 'LEN:'+els.length; const top=els[els.length-1]; const r=top.getBoundingClientRect(); const sx=r.left+r.width/2, sy=r.top+r.height/2; top.dispatchEvent(new PointerEvent('pointerdown',{clientX:sx,clientY:sy,bubbles:true,cancelable:true,pointerId:4,isPrimary:true})); for(let i=1;i<=10;i++){window.dispatchEvent(new PointerEvent('pointermove',{clientX:sx+280*i/10,clientY:sy+280*i/10,bubbles:true,cancelable:true,pointerId:4,isPrimary:true}));} window.dispatchEvent(new PointerEvent('pointerup',{clientX:sx+280,clientY:sy+280,bubbles:true,cancelable:true,pointerId:4,isPrimary:true})); const els2=Array.from(document.querySelectorAll('#board .card')); if(els2.length<2) return 'AFTER_LEN:'+els2.length; const a=els2[0].getBoundingClientRect(), b=els2[els2.length-1].getBoundingClientRect(); return (Math.abs(a.left-b.left)>50||Math.abs(a.top-b.top)>50)?'SPLIT':'STUCK';})()`);
        ok('反馈⑨ 两狗叠加可拆分(顶狗拖出成独立堆)', (splitPos.val || '').includes('SPLIT'), splitPos.val);

        // ============ 流程 E：狗血量清空消失（反馈⑪） ============
        await injectSave({ day: 2, timeLeft: 40, phase: 'day', gold: 50, seenCards: {}, cardGets: {}, collection: {}, tasksDone: {}, lastSave: Date.now(), piles: [
          { x: 400, y: 400, cards: [{ type: 'border_collie', hp: 1, fed: 5 }, { type: 'thief', hp: 1 }] }
        ]});
        await sleep(2600);
        const dead = await evalJS(`JSON.stringify({cards:document.querySelectorAll('#board .card').length, neg:Array.from(document.querySelectorAll('#board .card .cb')).some(e=>e.textContent.includes('❤️-'))})`);
        const deadO = JSON.parse(dead.val || '{}');
        ok('反馈⑪ 狗血条清空后卡牌消失(无负血)', deadO.cards === 0 && !deadO.neg, dead.val);

        // ============ 流程 F：小偷节奏对齐策划（第2晚=1小偷 / 第6晚=2小偷） ============
        await injectSave({ day: 2, timeLeft: 8, phase: 'day', gold: 50, seenCards: {}, cardGets: {}, collection: {}, tasksDone: {}, lastSave: Date.now(), piles: [
          { x: 600, y: 600, cards: [{ type: 'herder', hp: 5, fed: 5 }] }
        ]});
        await sleep(3200);
        const mons1 = await evalJS(`document.querySelectorAll('#board .card.cat-mon').length`);
        ok('反馈⑥ 第2晚夜晚刷 1 小偷(对齐策划)', (mons1.val || 0) === 1, 'mon=' + mons1.val);
        await injectSave({ day: 6, timeLeft: 8, phase: 'day', gold: 50, seenCards: {}, cardGets: {}, collection: {}, tasksDone: {}, lastSave: Date.now(), piles: [
          { x: 600, y: 600, cards: [{ type: 'herder', hp: 5, fed: 5 }] }
        ]});
        await sleep(3200);
        const mons2 = await evalJS(`document.querySelectorAll('#board .card.cat-mon').length`);
        ok('反馈⑥ 第6晚夜晚刷 2 小偷(对齐策划)', (mons2.val || 0) === 2, 'mon=' + mons2.val);

        // ============ 流程 G：新手引导 6 步（含打开礼包） ============
        await cleanStart();
        const intro = await evalJS(`JSON.stringify({home:!!document.querySelector('.home-overlay'), tutStart:!!document.getElementById('tutStart')})`);
        const intO = JSON.parse(intro.val || '{}');
        ok('反馈⑧ 首次启动出现教程引导弹窗', !!intO.tutStart, intro.val);
        await evalJS(`document.getElementById('tutStart').click()`);
        await sleep(800);
        const step0 = await evalJS(`(document.getElementById('tutTitle')||{}).textContent||'NO'`);
        ok('反馈⑧ 教程第 1 步=打开新手礼包', (step0.val || '').includes('打开新手礼包'), step0.val);
        const stepInfo = await evalJS(`(document.getElementById('tutStep')||{}).textContent||''`);
        ok('反馈⑧ 教程共 6 步', (stepInfo.val || '').includes('6 步'), stepInfo.val);
        await evalJS(`(()=>{const p=document.querySelector('.packobj'); if(p) p.click();})()`);
        await sleep(1800);
        const step1 = await evalJS(`(document.getElementById('tutTitle')||{}).textContent||'NO'`);
        ok('反馈⑧ 打开礼包后进入第 2 步(拖牧民到树木)', (step1.val || '').includes('拖牧民到树木'), step1.val);

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
