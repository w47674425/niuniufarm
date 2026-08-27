// 新手教程：3 分钟内引导玩家完成 4 个基础操作。
// 设计纪律（对齐 GDD §4.1 / P1 操作极简）：
//   1) 教程在「受控沙盘」运行，拦截 saveGame，绝不污染玩家真实存档。
//   2) 结束教程时优先 loadGame 还原玩家进度，无档才开新局 → 随时重看不丢档。
//   3) 每步用「高亮目标卡 + 自动检测完成」驱动，玩家跟着拖一遍即毕业。

import { mk, makePile, pileOf } from './state.js';
import { render, updateHUD, toast } from './render.js';
import { foodCapOf } from './config.js';
import { loadGame } from './systems.js';
import * as audio from './audio.js';

const DONE_KEY = 'niuniu_tutorial_done_v1';

export function hasSeenTutorial() {
  try { return localStorage.getItem(DONE_KEY) === '1'; } catch (e) { return false; }
}
function markTutorialSeen() {
  try { localStorage.setItem(DONE_KEY, '1'); } catch (e) { }
}

// ===================== 教程步骤定义 =====================
// check(game) 返回 true 即视为该步完成，自动进入下一步。
// targets: 需要高亮的卡 id（'herder' 等）或 DOM 选择器（'market' / 'packBtn'）。
const STEPS = [
  {
    title: '① 拖拽堆叠 · 万物皆可叠',
    text: '按住【牧民】，拖到下面的【蓝莓丛】上松手。这就是游戏的根本：任意两张卡叠在一起都会发生点什么（这里会采出蓝莓）。',
    targets: ['herder', 'bush'],
    check: (g) => {
      const t = g.tutorial;
      const ph = pileOf(g, t.herder), pb = pileOf(g, t.bush);
      return ph && pb && ph === pb;
    }
  },
  {
    title: '② 喂食牧民',
    text: '把【面包】拖到【牧民】身上喂饱他。每天结算会消耗饱食度，没食物就会饿死——这是生存底线。',
    targets: ['bread', 'herder'],
    check: (g) => g.tutorial.flags.feed > 0
  },
  {
    title: '③ 卖牛换金币',
    text: '把【牛】拖到右下角的【市场】里，卖出换金币。金币是打工的报酬，而牛是金币的主来源。',
    targets: ['cow', 'market'],
    check: (g) => g.tutorial.flags.sell > 0
  },
  {
    title: '④ 买卡包扩充',
    text: '点底部【卡包】打开商店，用金币买一个卡包。新卡是扩张的燃料。完成这步就毕业啦！',
    targets: ['packBtn'],
    check: (g) => g.tutorial.flags.buy > 0
  }
];

// ===================== 教程 UI（覆盖层） =====================
const TutorialUI = {
  el: null, ring: null, panel: null, titleEl: null, textEl: null,
  stepEl: null, nextBtn: null, mount(game) {
    this.destroy();
    const app = game.app;
    const el = document.createElement('div');
    el.className = 'tut';
    el.innerHTML =
      '<div class="tut-ring"></div>' +
      '<div class="tut-panel">' +
      '  <div class="tut-step" id="tutStep"></div>' +
      '  <div class="tut-title" id="tutTitle"></div>' +
      '  <div class="tut-text" id="tutText"></div>' +
      '  <div class="tut-actions">' +
      '    <button class="tut-skip" id="tutSkip">跳过教程</button>' +
      '    <button class="tut-next" id="tutNext" disabled>下一步 ✓</button>' +
      '  </div>' +
      '</div>';
    app.appendChild(el);
    this.el = el;
    this.ring = el.querySelector('.tut-ring');
    this.panel = el.querySelector('.tut-panel');
    this.stepEl = el.querySelector('#tutStep');
    this.titleEl = el.querySelector('#tutTitle');
    this.textEl = el.querySelector('#tutText');
    this.nextBtn = el.querySelector('#tutNext');
    const self = this;
    this.nextBtn.onclick = function () { advance(game); };
    el.querySelector('#tutSkip').onclick = function () { finishTutorial(game); };
    // 窗口尺寸变化时重算高亮位置与面板避让
    this._onResize = () => { self.positionRing(game); self.positionPanel(game); };
    window.addEventListener('resize', this._onResize);
    this.positionPanel(game);
  },
  showStep(game, idx) {
    const s = STEPS[idx];
    this.stepEl.textContent = '新手教程 · 第 ' + (idx + 1) + ' / ' + STEPS.length + ' 步';
    this.titleEl.textContent = s.title;
    this.textEl.innerHTML = s.text;
    this.positionRing(game);
    this.positionPanel(game);
  },
  // 面板避让右下角市场：按真实市场矩形计算右缩进，保证市场可见且可拖入
  positionPanel(game) {
    const panel = this.panel;
    if (!panel) return;
    const app = game.app;
    const a = app.getBoundingClientRect();
    const GAP = 14;
    let rightOff = 114; // 兜底：市场 82 + 边距 10 + 间隙
    const mkt = game.marketEl;
    if (mkt) {
      const m = mkt.getBoundingClientRect();
      const mLeftFromAppRight = a.right - m.left; // 市场左缘距 app 右缘
      rightOff = mLeftFromAppRight + GAP;
    }
    rightOff = Math.max(rightOff, 12);                       // 面板至少保留极小宽度
    rightOff = Math.min(rightOff, Math.max(120, a.width - 200)); // 面板也不宜过窄
    panel.style.left = '12px';
    panel.style.right = rightOff + 'px';
    panel.style.bottom = '74px';
    panel.style.top = 'auto';
  },
  setNextEnabled(on) { this.nextBtn.disabled = !on; },
  positionRing(game) {
    const t = game.tutorial;
    if (!t) return;
    const s = STEPS[t.step];
    if (!s.targets || s.targets.length === 0) { this.ring.style.display = 'none'; return; }
    const app = game.app.getBoundingClientRect();
    let minL = 1e9, minT = 1e9, maxR = -1e9, maxB = -1e9, any = false;
    s.targets.forEach(sel => {
      const r = rectOf(game, sel);
      if (!r) return;
      any = true;
      minL = Math.min(minL, r.left); minT = Math.min(minT, r.top);
      maxR = Math.max(maxR, r.left + r.width); maxB = Math.max(maxB, r.top + r.height);
    });
    if (!any) { this.ring.style.display = 'none'; return; }
    const pad = 8;
    this.ring.style.display = 'block';
    this.ring.style.left = (minL - pad) + 'px';
    this.ring.style.top = (minT - pad) + 'px';
    this.ring.style.width = (maxR - minL + pad * 2) + 'px';
    this.ring.style.height = (maxB - minT + pad * 2) + 'px';
  },
  destroy() {
    if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    this.el = this.ring = this.panel = this.titleEl = this.textEl = this.nextBtn = null;
  }
};

function rectOf(game, sel) {
  let el = null;
  if (sel === 'market') el = game.marketEl;
  else if (sel === 'packBtn') el = game.refs.packBtn;
  else el = game.board.querySelector('[data-id="' + sel + '"]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const a = game.app.getBoundingClientRect();
  return { left: r.left - a.left, top: r.top - a.top, width: r.width, height: r.height };
}

// ===================== 教程核心流程 =====================
export function startTutorial(game) {
  const st = game.state;
  st.tutorialActive = true;
  st.paused = false;
  st.gameOver = false;
  st.speed = 1;
  st.gold = 30;            // 教程启动金：足够买基础卡包(💰10)
  // 清空当前棋盘（含新手卡包 / 弹窗），搭沙盘
  game.board.querySelectorAll('.card,.pileprog,.packobj,.overlay').forEach(el => el.remove());
  st.piles = [];
  st.day = 1; st.timeLeft = 9999; st.phase = 'day';
  game.app.classList.remove('night');
  game._openModal = null; game._openOv = null;

  const s = game.boardSize();
  const topY = Math.max(8, s.h * 0.20);
  const colL = Math.max(8, s.w * 0.28);
  const colR = Math.max(8, s.w * 0.60);
  const herder = mk(game, 'herder'); herder.fed = foodCapOf('herder');
  const bush = mk(game, 'bush');
  const bread = mk(game, 'bread');
  const cow = mk(game, 'cow');
  const hPile = makePile(game, colL, topY, [herder]);
  const bPile = makePile(game, colL, topY + 118, [bush]);
  const brPile = makePile(game, colR, topY, [bread]);
  const cPile = makePile(game, colR, topY + 118, [cow]);

  const tut = {
    step: 0, herder, bush, bread, cow,
    hPile, bPile, brPile, cPile,
    flags: {}, _advanced: false, _poll: null,
    notify(type) { this.flags[type] = (this.flags[type] || 0) + 1; checkStep(game); }
  };
  game.tutorial = tut;

  render(game); game.updateHUD();
  TutorialUI.mount(game);
  TutorialUI.showStep(game, 0);
  checkStep(game);
  tut._poll = setInterval(() => checkStep(game), 250);
}

function checkStep(game) {
  const t = game.tutorial;
  if (!t) return;
  const step = STEPS[t.step];
  const done = step.check(game);
  TutorialUI.setNextEnabled(done);
  if (done && !t._advanced) {
    t._advanced = true;
    audio.play('ui.click');
    setTimeout(() => advance(game), 850);
  }
}

function advance(game) {
  const t = game.tutorial;
  if (!t) return;
  t.step++;
  t._advanced = false;
  if (t.step >= STEPS.length) { finishTutorial(game); return; }
  TutorialUI.showStep(game, t.step);
  checkStep(game);
}

function finishTutorial(game) {
  const t = game.tutorial;
  if (t && t._poll) clearInterval(t._poll);
  TutorialUI.destroy();
  game.state.tutorialActive = false;
  game.tutorial = null;
  markTutorialSeen();
  // 还原玩家进度：优先读档（保留真实进度），无档才开新局
  if (!loadGame(game)) {
    game.newGame();
    const pk = game.state.piles.find(p => p.isPack);
    if (pk && pk._open) pk._open();
  }
  // 清掉可能残留的弹窗（如教程中点开的商店）
  game.board.querySelectorAll('.overlay').forEach(el => el.remove());
  game._openModal = null; game._openOv = null;
  game.render(); game.updateHUD();
  toast(game, '🎓 教程完成！开始经营你的牛牛农场吧');
  audio.play('badge');
}

// ===================== 首次启动引导 =====================
export function maybeShowFirstLaunch(game) {
  if (hasSeenTutorial()) return;
  const app = game.app;
  const ov = document.createElement('div');
  ov.className = 'overlay tut-intro';
  ov.innerHTML =
    '<div class="modal">' +
    '  <h2>🐮 欢迎来到牛牛农场</h2>' +
    '  <p>这是一款「拖卡叠卡」的经营生存小游戏。第一次玩，先用 <b>3 分钟</b>学 4 个基础操作？</p>' +
    '  <div class="row">' +
    '    <button class="btn" id="tutStart">🎓 开始教程</button>' +
    '    <button class="btn alt" id="tutSkipIntro">直接玩</button>' +
    '  </div>' +
    '</div>';
  app.appendChild(ov);
  ov.querySelector('#tutStart').onclick = function () {
    if (ov.parentNode) ov.parentNode.removeChild(ov);
    startTutorial(game);
  };
  ov.querySelector('#tutSkipIntro').onclick = function () {
    if (ov.parentNode) ov.parentNode.removeChild(ov);
    markTutorialSeen();
  };
}
