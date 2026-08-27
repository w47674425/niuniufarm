// 美术资产替换验证（2026-08-27 新世界观资源接入）
// 1) 静态：art.js 全部 CARD_ART/UI_ART 映射 → dist/img 文件存在；背景尺寸 1920x1080
// 2) 动态：CDP 真机打开页面，验证 首页护照/成就图标、棋盘新卡渲染、图鉴全图、护照面板、背景层
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import * as art from '../../src/art.js';

const LOG = 'C:/Work/niuniufarm-new/design/sim/verify_assets.log';
fs.writeFileSync(LOG, 'START ' + new Date().toISOString() + '\n');
function log(s) { try { fs.appendFileSync(LOG, s + '\n'); } catch (e) {} console.log(s); }

const require = createRequire('C:/Users/Administrator/.workbuddy/binaries/node/workspace/package.json');
const WebSocket = require('ws');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const CDP_PORT = 9223;
const APP = 'http://127.0.0.1:4173/';
const PROFILE = 'C:/Work/niuniufarm-new/.cdp_profile_assets';
const DIST_IMG = 'C:/Work/niuniufarm-new/dist/img';

process.on('uncaughtException', e => { log('UNCAUGHT ' + (e && e.stack || e)); process.exit(2); });
process.on('unhandledRejection', e => { log('UNHANDLED ' + (e && e.stack || e)); process.exit(3); });

const results = [];
const errors = [];
function ok(name, pass, extra = '') {
  results.push({ name, pass });
  log((pass ? 'PASS ' : 'FAIL ') + name + (extra ? '  -> ' + extra : ''));
}

// ============ 静态核对 ============
const allMaps = { ...art.CARD_ART, ...art.UI_ART };
const missing = Object.entries(allMaps).filter(([k, v]) => !fs.existsSync(path.join(DIST_IMG, path.basename(v))));
ok('静态 CARD_ART+UI_ART 映射(' + Object.keys(allMaps).length + ')文件全存在', missing.length === 0, missing.map(m => m[0]).join(','));

// PNG 尺寸（读 IHDR，bytes 16-23）
function pngSize(p) {
  const b = fs.readFileSync(p);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
const bgDay = pngSize(path.join(DIST_IMG, 'bg_day.png'));
const bgNight = pngSize(path.join(DIST_IMG, 'bg_night.png'));
ok('静态 背景横屏 1920x1080', bgDay.w === 1920 && bgDay.h === 1080 && bgNight.w === 1920 && bgNight.h === 1080, JSON.stringify({ bgDay, bgNight }));
// 新增关键卡图存在
const must = ['border_collie', 'golden', 'husky', 'german_shepherd', 'corgi', 'wool', 'felt', 'flint', 'jam', 'caesar', 'plane',
  'thief', 'bandit', 'capitalist', 'spy', 'factory', 'sheep', 'ui_passport', 'ui_achievement',
  'ticket_xinjiang', 'ticket_maldives', 'ticket_kenya', 'ticket_nz', 'ticket_italy', 'ticket_iceland',
  'photo_xinjiang', 'photo_maldives', 'photo_kenya', 'photo_nz', 'photo_italy', 'photo_iceland'];
const mustMiss = must.filter(n => !fs.existsSync(path.join(DIST_IMG, n + '.png')));
ok('静态 30 张新卡/新UI图存在', mustMiss.length === 0, mustMiss.join(','));

// ============ 动态 CDP ============
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

    async function preloadScript(scriptBody) {
      await send('Page.addScriptToEvaluateOnNewDocument', { source: scriptBody });
      try { await send('Network.clearBrowserCache'); } catch (e) {}
      await send('Page.reload');
      await sleep(2600);
    }
    async function cleanStart() {
      await preloadScript(`try{localStorage.removeItem('niuniu_ranch_save_v1');localStorage.removeItem('niuniu_tutorial_done_v1');}catch(e){}`);
    }
    async function imgOk(sel) {
      const r = await evalJS(`(()=>{const i=document.querySelector(${JSON.stringify(sel)}); return i?JSON.stringify({w:i.naturalWidth, broken:!i.complete||i.naturalWidth===0, src:i.getAttribute('src')}):'NO_EL';})()`);
      return r.val;
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

        // ============ 首页：护照/成就图标 ============
        const homePass = await imgOk('#homePass img');
        const homeAch = await imgOk('#homeAch img');
        const travel = await imgOk('#travelBtn img');
        ok('动态 首页护照按钮图标加载', !!homePass && !JSON.parse(homePass).broken, homePass);
        ok('动态 首页成就按钮图标加载', !!homeAch && !JSON.parse(homeAch).broken, homeAch);
        ok('动态 顶栏护照按钮图标加载', !!travel && !JSON.parse(travel).broken, travel);

        // 背景层
        const bg = await evalJS(`(()=>{const b=document.getElementById('bg-layer'); return b?b.style.backgroundImage||'': 'NO_BG';})()`);
        ok('动态 背景层挂载 bg_day', !!bg.val && bg.val.includes('bg_day.png'), bg.val);
        const bgLoaded = await evalJS(`new Promise(res=>{const im=new Image();im.onload=()=>res(true);im.onerror=()=>res(false);im.src='img/bg_day.png';})`);
        ok('动态 背景图 1920x1080 可加载', bgLoaded.val === true, 'loaded=' + bgLoaded.val);

        // ============ 护照面板（首页阶段） ============
        await evalJS(`document.getElementById('homePass').click()`);
        await sleep(600);
        const pp = await evalJS(`JSON.stringify({cards:document.querySelectorAll('.pp-card').length, imgs:document.querySelectorAll('.pp-card .pp-emoji img').length, locks:document.querySelectorAll('.pp-emoji').length})`);
        const ppO = JSON.parse(pp.val || '{}');
        ok('动态 护照面板 6 站（未打卡🔒）', ppO.cards === 6 && ppO.imgs === 0 && ppO.locks === 6, pp.val);
        await evalJS(`(()=>{const c=document.querySelector('.passport-overlay .close'); if(c) c.click();})()`);
        await sleep(500);

        // ============ 开始经营 → 礼包 → 棋盘正式图 ============
        await evalJS(`document.getElementById('homeMain').click()`);
        await sleep(1000);
        await evalJS(`(()=>{const p=document.querySelector('.packobj'); if(p) p.click();})()`);
        await sleep(1000);
        const cimgs = await evalJS(`Array.from(document.querySelectorAll('#board .card .cimg')).map(i=>i.getAttribute('src')).join(',')`);
        log('  棋盘 .cimg: ' + cimgs.val);
        ok('动态 开局棋盘使用正式图(非emoji)', !!cimgs.val && cimgs.val.length > 0, cimgs.val);
        const hasBorderCollie = (cimgs.val || '').includes('border_collie.png');
        ok('动态 新手礼包边牧渲染 border_collie.png', hasBorderCollie, cimgs.val);
        // 页面所有 img 无 broken
        const broken = await evalJS(`Array.from(document.querySelectorAll('img')).filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.getAttribute('src')).join(',')`);
        ok('动态 页面无破损图片', !broken.val, 'broken=' + broken.val);

        // ============ 图鉴：卡片 tab 已解锁卡全为正式图 ============
        await evalJS(`document.getElementById('codexBtn').click()`);
        await sleep(900);
        const bookImgs = await evalJS(`JSON.stringify({cells:document.querySelectorAll('.codex-cell').length, unlockedImgs:document.querySelectorAll('.codex-cell:not(.locked) .cc-img').length, unlocked:document.querySelectorAll('.codex-cell:not(.locked)').length, broken:Array.from(document.querySelectorAll('.codex-cell .cc-img')).filter(i=>!i.complete||i.naturalWidth===0).length})`);
        const bi = JSON.parse(bookImgs.val || '{}');
        ok('动态 图鉴卡片格 >40 且已解锁全为正式图', bi.cells > 40 && bi.unlockedImgs === bi.unlocked && bi.broken === 0, bookImgs.val);
        await evalJS(`(()=>{const c=document.querySelector('.modal .close'); if(c) c.click();})()`);
        await sleep(500);

        log('\n=== 运行时错误 ===');
        (errors.length ? errors : ['（无）']).forEach(e => log('  ' + e));
        const passed = results.filter(r => r.pass).length;
        log('\n===== ' + passed + '/' + results.length + ' PASS =====');
        try { edge.kill('SIGKILL'); } catch (e) {}
        resolve(passed === results.length && errors.length === 0);
      } catch (e) {
        log('RUN ERR ' + (e && e.stack || e));
        try { edge.kill('SIGKILL'); } catch (e2) {}
        resolve(false);
      }
    });
  });
}

run().then(okAll => {
  const passed = results.filter(r => r.pass).length;
  console.log((okAll ? '✓ ' : '✗ ') + passed + '/' + results.length + ' PASS' + (errors.length ? '（' + errors.length + ' 个运行时错误）' : ''));
  process.exit(okAll ? 0 : 1);
});
