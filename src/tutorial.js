// 新手教程：3 分钟内引导玩家完成 4 个基础操作。
// 设计纪律（对齐 GDD §4.1 / P1 操作极简）：
//   1) 教程在「受控沙盘」运行，拦截 saveGame，绝不污染玩家真实存档。
//   2) 结束教程时优先 loadGame 还原玩家进度，无档才开新局 → 随时重看不丢档。
//   3) 每步用「高亮目标卡 + 自动检测完成」驱动，玩家跟着拖一遍即毕业。

import { mk, makePile, pileOf, removePile, createState } from './state.js';
import { render, updateHUD, toast, renderPack } from './render.js';
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

// ===================== 教程步骤定义（新世界观 v2·按最新设计迭代 7 步） =====================
// 设计依据：策划「新手引导」表（礼包→树→莓→木剑→装狗→买动物店）+ 最新设计补漏：
//   · 采集资源点现在"采一次即消失"（charges=1，需建材店/植物店补种）→ 步骤②文案传达
//   · 饱食/喂食是生存核心（饿跑/复活按钮），策划表漏了喂食教学 → 新增步骤④
// check(game) 返回 true 即视为该步完成，自动进入下一步。
// targets: 需要高亮的卡 id 或 DOM 选择器（'packobj'/'packBtn' 等）。
const STEPS = [
  {
    title: '① 打开新手礼包',
    text: '点击中间的新手礼包，开出牧场起步卡：牧民（一一、二二）、边牧、树木、蓝莓丛、木头、石头。',
    targets: ['packobj'],
    // 用教程沙盘自己的标记判定（不能用全局 state.packOpened——从已开过礼包的存档进教程时它已是 true，会误判跳过）
    check: (g) => !!(g.tutorial && g.tutorial.packOpened)
  },
  {
    title: '② 拖牧民到树木',
    text: '按住【牧民】拖到【树木】上松手——"叠卡生产"：牧民采树得 木头×2+树枝×1。<b>树木采一次就消失</b>，记得去建材店补种。',
    targets: ['herder', 'tree'],
    check: (g) => (g.state.stats.totalWood || 0) > 0
  },
  {
    title: '③ 拖牧民到蓝莓丛',
    text: '再拖【牧民】到【蓝莓丛】采出蓝莓——<b>食物</b>的来源。牧场里的每个人每天都要吃一餐。',
    targets: ['herder', 'bush'],
    check: (g) => (g.state.cardGets['blueberry'] || 0) > 0
  },
  {
    title: '④ 把蓝莓喂给牧民',
    text: '把刚采的【蓝莓】拖到【牧民】身上喂饱（饱食 5/5）。<b>吃饱才有力气干活</b>，断粮会饿跑哦。',
    targets: ['herder', 'blueberry'],
    check: (g) => (g.tutorial.flags.feed || 0) > 0
  },
  {
    title: '⑤ 打造木剑',
    text: '把【牧民】+【制造厂】+【木头×2】叠在一起，打造出【木剑】——夜晚小偷来袭，武器是保家关键。',
    targets: ['herder', 'factory', 'wood'],
    check: (g) => (g.state.cardGets['sword'] || 0) > 0
  },
  {
    title: '⑥ 给狗装备木剑',
    text: '把【木剑】拖到【边牧】身上，攻击力 +1。牧民不打架，<b>夜晚全靠牧羊犬自动迎击小偷</b>。',
    targets: ['border_collie', 'sword'],
    check: (g) => (g.state.stats.equipped || 0) > 0
  },
  {
    title: '⑦ 买动物店卡包',
    text: '点底部【卡包】→ 买一个【动物店】（💰20）——牛产奶、羊产毛、猪出肉，是牧场经济引擎！完成就毕业啦！',
    targets: ['packBtn'],
    check: (g) => (g.tutorial.flags.buyAnimal || 0) > 0
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
  else if (sel === 'packobj') el = game.board.querySelector('.packobj');
  else el = game.board.querySelector('[data-id="' + sel + '"]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const a = game.app.getBoundingClientRect();
  return { left: r.left - a.left, top: r.top - a.top, width: r.width, height: r.height };
}

// ===================== 教程核心流程 =====================
export function startTutorial(game) {
  // 每次教程都用全新的 state（用户拍板：不复用玩家当前状态/进度/任务/礼包标记）
  game.state = createState();
  const st = game.state;
  st.tutorialActive = true;
  st.paused = false;
  st.gameOver = false;
  st.speed = 1;
  st.gold = 50;            // 教程启动金：够买动物店卡包(💰20)
  // 清空所有遮罩（含首页/欢迎页/设置等 app 级 overlay——教程 UI zIndex 1700 低于首页 2000，
  // 不清理会被首页盖住导致引导不可见、礼包点不到），再搭沙盘
  game.app.querySelectorAll('.overlay').forEach(el => el.remove());
  game.board.querySelectorAll('.card,.pileprog,.packobj,.overlay').forEach(el => el.remove());
  st.day = 1; st.timeLeft = 9999; st.phase = 'day';
  st.packOpened = false; // 教程沙盘独立管理礼包状态（第 0 步用 tutorial.packOpened 判定）
  game.app.classList.remove('night');
  game._openModal = null; game._openOv = null;

  const s = game.boardSize();
  const colL = Math.max(8, s.w * 0.16);
  const colR = Math.max(8, s.w * 0.48);
  const midX = s.w * 0.34;
  const topY = Math.max(8, s.h * 0.24);

  // ① 新手礼包（第 0 步：点击打开，按策划散布 8 卡，固定布局便于后续高亮）
  const pack = makePile(game, s.w / 2 - 48, s.h / 2 - 60, []);
  pack.isPack = true;
  pack.el = null;
  renderPack(game, pack);
  pack._open = () => {
    if (pack._done) return;
    pack._done = true;
    game.state.packOpened = true; // 第 0 步完成信号
    if (game.tutorial) game.tutorial.packOpened = true; // 教程沙盘自己的标记（见 STEPS[0].check）
    const oldEl = game.board.querySelector('.packobj');
    if (oldEl) oldEl.remove();
    removePile(game, pack);
    const h1 = mk(game, 'herder'), h2 = mk(game, 'herder');
    h1.name = '一一'; h2.name = '二二'; // 牧民命名（策划图鉴）
    h1.fed = foodCapOf('herder');
    h1.fed = 2; // 一一先饿着（2/5），步骤④喂蓝莓有真实反馈（2→3）
    h2.fed = 2; // 二二先饿着（2/5），步骤④喂蓝莓有真实反馈（2→3）
    const bc = mk(game, 'border_collie'); bc.fed = foodCapOf('border_collie');
    // 固定布局：牧民×2 左列、资源点右列、木/狗中列（与下方教学材料呼应，高亮可定位）
    makePile(game, colL, topY, [h1]);
    makePile(game, colL, topY + 150, [h2]);
    makePile(game, colL, topY + 300, [mk(game, 'tree')]);
    makePile(game, colR, topY, [mk(game, 'bush')]);
    makePile(game, colR, topY + 150, [mk(game, 'rock')]);
    makePile(game, midX, topY + 90, [mk(game, 'wood'), mk(game, 'wood'), mk(game, 'wood')]); // 礼包木1 + 教学木2 = 木剑材料
    makePile(game, midX, topY + 240, [bc]);
    makePile(game, midX + 90, topY + 240, [mk(game, 'stone')]);
    render(game); game.updateHUD();
    if (game.tutorial) game.tutorial.notify('pack', pack);
  };

  // ② 教学材料：制造厂（木剑配方前置建筑）+ 额外木头
  const factory = mk(game, 'factory');
  const fPile = makePile(game, colR, topY + 300, [factory]);
  const wPile = makePile(game, midX, topY + 390, [mk(game, 'wood'), mk(game, 'wood')]);

  const tut = {
    step: 0, factory, fPile, wPile,
    packOpened: false, // 教程礼包是否已打开（第 0 步判定，与全局 state.packOpened 隔离）
    flags: {}, _advanced: false, _poll: null,
    notify(type, payload) {
      // 买动物店卡包才算完成第 7 步
      if (type === 'buy' && payload && payload.id === 'animal') this.flags.buyAnimal = (this.flags.buyAnimal || 0) + 1;
      else this.flags[type] = (this.flags[type] || 0) + 1;
      checkStep(game);
    }
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
  // 清掉可能残留的弹窗（如教程中点开的商店 / 首页等 app 级遮罩）
  game.app.querySelectorAll('.overlay').forEach(el => el.remove());
  game.board.querySelectorAll('.overlay').forEach(el => el.remove());
  game._openModal = null; game._openOv = null;
  game.render(); game.updateHUD();
  toast(game, '🎓 开始经营牧场吧！');
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
    '  <p>这是一款「拖卡叠卡」的经营生存小游戏。第一次玩，先用 <b>几分钟</b>学 7 步基础操作？</p>' +
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
