// 渲染层：把状态画到 DOM 上（对齐资料库准绳版「渲染 / HUD」区块）

import { CARD_W, CARD_H, STACK_OFF, META, DAY_LEN, DAY_FRAC, foodCapOf, TICKET, DOG_BREEDS } from './config.js';
import { clamp } from './utils.js';
import { allCards, countType, popCount } from './state.js';
import { pileAction } from './merge.js';
import { cardArt } from './art.js';

export function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  const m = Math.floor(s / 60), ss = s % 60;
  return (m < 10 ? "0" : "") + m + ":" + (ss < 10 ? "0" : "") + ss;
}

export function updateHUD(game) {
  const st = game.state;
  checkTasksSafe(game);
  game.refs.dayStat.textContent = "第 " + st.day + " 天";
  const ph = game.refs.phaseTag;
  if (st.phase === "day") { ph.textContent = "☀️"; ph.className = "stat"; ph.classList.add("day"); }
  else { ph.textContent = "🌙"; ph.className = "stat"; ph.classList.add("night"); }
  // 正式背景图：用内联样式图层，避免构建后 CSS 相对路径(resolve 到 dist/assets)导致 404
  const app = game.app;
  if (app) {
    app.classList.add("bgimg");
    let bg = app.querySelector("#bg-layer");
    if (!bg) {
      bg = document.createElement("div");
      bg.id = "bg-layer";
      app.prepend(bg);
      const base = import.meta.env.BASE_URL || "./";
      const setBg = () => {
        const key = app.classList.contains("night") ? "night" : "day";
        bg.style.backgroundImage = `url("${base}img/bg_${key}.png")`;
      };
      setBg();
      // 跟随 .night 类切换昼/夜背景
      new MutationObserver(setBg).observe(app, { attributes: true, attributeFilter: ["class"] });
    }
  }
  game.refs.timer.textContent = fmtTime(st.timeLeft);
  // 夜晚来临前 10 秒：timer 放大警示（仅白天段生效，入夜后恢复）
  const nightAt = DAY_LEN * (1 - DAY_FRAC); // 夜晚开始剩余秒数
  const warn = (st.phase === "day" && st.timeLeft <= nightAt + 10);
  game.refs.timer.classList.toggle("night-warn", warn);
  game.refs.goldStat.textContent = TICKET + " " + st.gold;
  // 刷新统计（任务依赖）
  st.stats.herders = popCount(game);
  st.stats.houses = countType(game, "house");
  st.stats.smelters = countType(game, "smelter");
  st.stats.gold = st.gold;
  st.stats.dogs = allCards(game).filter(c => (c.type === "dog" || DOG_BREEDS.includes(c.type))).length;
  st.stats.equipped = allCards(game).filter(c => (c.type === "dog" || DOG_BREEDS.includes(c.type)) && (c.atkBonus || 0) > 0).length;
  // 复活按钮（市场旁）：有死亡牧民且还有活口时显示
  if (game._reviveBtn) {
    const show = (st.deadHerders || 0) > 0 && popCount(game) > 0 && !st.gameOver && !st.tutorialActive && !st.paused;
    game._reviveBtn.style.display = show ? "flex" : "none";
  }
}

export function toast(game, msg) {
  const el = game.toastEl;
  el.textContent = msg;
  el.classList.add("show");
  if (game._toastTimer) clearTimeout(game._toastTimer);
  game._toastTimer = setTimeout(() => { el.classList.remove("show"); }, 1900);
}

// 任务检查（updateHUD 内联调用；由 game 注入，避免循环依赖）
let checkTasksSafe = () => {};
export function bindTaskCheck(fn) { checkTasksSafe = fn; }

// ===================== 渲染棋盘 =====================
// 正式资产：有图的卡用 <img>（160x160 缩放至卡片内 ~52px），无图（怪物）退回 emoji
function artFor(c, meta) {
  const src = cardArt(c.type);
  if (src) {
    // 牛品种：统一牛图 + 稀有度星标在名称行（cow-r 类）
    return '<img class="cimg" src="' + src + '" alt="' + meta.label + '" draggable="false" />';
  }
  return meta.emoji;
}

export function render(game) {
  const board = game.board;
  const st = game.state;
  const drag = st.drag;
  const old = board.querySelectorAll(".card, .pileprog");
  for (let i = 0; i < old.length; i++) old[i].remove();
  const bs = game.boardSize();

  st.piles.forEach((p, pi) => {
    if (p.isPack) return;
    // 生产/建造进度条
    if (p.action && p.actionSec) {
      const frac = clamp(p.prog / p.actionSec, 0, 1);
      const info = pileAction(game, p);
      const label = info ? info.label : "";
      const pe = document.createElement("div");
      pe.className = "pileprog";
      pe.style.left = clamp(p.x + (CARD_W - 84) / 2, 2, bs.w - 86) + "px";
      pe.style.top = clamp(p.y - 26, 2, bs.h - 20) + "px";
      pe.innerHTML = '<div class="pp-label">' + label + '</div><div class="pp-track"><div class="pp-fill" style="width:' + (frac * 100) + '%"></div></div>';
      board.appendChild(pe);
    }
    p.cards.forEach((c, ci) => {
      let x = p.x, y = p.y + ci * STACK_OFF;
      if (drag && drag.moving.indexOf(c) >= 0) { x += drag.dx; y += drag.dy; }
      const el = document.createElement("div");
      const meta = META[c.type] || { emoji: "❓", label: c.type, cat: "res" };
      el.className = "card cat-" + meta.cat;
      if (drag && drag.moving.indexOf(c) >= 0) el.className += " dragging";
      el.style.left = x + "px"; el.style.top = y + "px";
      el.style.zIndex = (pi * 20 + ci);
      el.setAttribute("data-id", c.id);
      let html = '';
      // 单位（牧民/牧羊犬等）：血量以卡片背景色块呈现（血多绿、中黄、低红）
      if (meta.cat === "unit") {
        const hpc = c.hp != null ? c.hp : meta.hp;
        const max = (meta.hp || 0) + (c.hpBonus || 0);
        const pct = clamp(Math.round(hpc / max * 100), 0, 100);
        const color = pct > 60 ? "rgba(110,190,80,.5)" : (pct > 30 ? "rgba(240,190,60,.55)" : "rgba(225,90,70,.6)");
        html += '<div class="hpbg" style="height:' + pct + '%;background:' + color + '"></div>';
      }
      html += '<div class="ce">' + artFor(c, meta) + '</div><div class="cn">' + (c.name ? meta.label + '·' + c.name : meta.label) + '</div>';
      if (meta.cat === "mon") {
        const hpc = c.hp != null ? c.hp : meta.hp;
        const max = meta.hp;
        const pct = clamp(Math.round(hpc / max * 100), 0, 100);
        html += '<div class="hpbar"><div class="hpfill" style="width:' + pct + '%"></div></div>';
      }
      // 单位直接显示属性：⚔️攻击(含加成) ❤️血量(当前/上限)；牧民无攻击（策划）→ 只显示血量
      if (meta.cat === "unit") {
        const atk = (meta.atk || 0) + (c.atkBonus || 0);
        const cur = c.hp != null ? c.hp : (meta.hp || 0);
        const max2 = (meta.hp || 0) + (c.hpBonus || 0);
        html += '<div class="cb">' + (atk > 0 ? '⚔️' + atk + ' ' : '') + '❤️' + cur + '/' + max2 + '</div>';
      }
      // 所有单位显示饱食度（上限取该单位自身配置）
      if (meta.cat === "unit" && c.fed != null) {
        html += '<div class="cb">饱食 ' + c.fed + '/' + foodCapOf(c.type) + '</div>';
      } else if (meta.cat === "node" && meta.charges) {
        const left = (c.charges != null ? c.charges : meta.charges);
        html += '<div class="cb">可采 ' + left + ' 次</div>';
      } else if (meta.cowKind && meta.rarity) {
        // 牛品种：稀有度星标（note 不重复显示，卡片空间有限）
        html += '<div class="cb cow-r' + meta.rarity + '">' + "★".repeat(meta.rarity) + ' ' + meta.label + '</div>';
      } else if (meta.note) {
        html += '<div class="cb">' + meta.note + '</div>';
      }
      el.innerHTML = html;
      bindCardTip(game, el, c);
      board.appendChild(el);
    });
  });
}

// ===================== 卡牌介绍浮层（迭代7·UI 修改意见①：悬停/长按查看卡牌介绍） =====================
// 桌面：mouseenter 显示、mouseleave 隐藏；移动端：长按 300ms 显示（拖动/滚动取消），松手后隐藏
const CAT_LABEL = { unit: "单位", res: "资源", food: "食物", build: "建筑", life: "牲畜", tech: "科技", node: "资源点", item: "物品", mon: "怪物" };
let _tipEl = null;
let _tipTimer = null;
function hideTip() {
  if (_tipTimer) { clearTimeout(_tipTimer); _tipTimer = null; }
  if (_tipEl) { _tipEl.remove(); _tipEl = null; }
}
function bindCardTip(game, el, c) {
  const meta = META[c.type] || { emoji: "❓", label: c.type, cat: "res" };
  function show() {
    // 拖拽中的卡不弹介绍
    if (game.state.drag && game.state.drag.moving && game.state.drag.moving.indexOf(c) >= 0) return;
    hideTip();
    _tipEl = document.createElement("div");
    _tipEl.className = "cardtip";
    const catName = CAT_LABEL[meta.cat] || meta.cat;
    const price = meta.sale ? TICKET + meta.sale : "不可售";
    _tipEl.innerHTML =
      '<div class="ct-head">' + (meta.emoji || "❓") + ' ' + (meta.label || c.type) + '<span class="ct-cat">' + catName + '</span></div>' +
      '<div class="ct-body">' + (meta.note || "暂无说明") + '</div>' +
      '<div class="ct-foot">售价 ' + price + '</div>';
    const bs = game.boardSize();
    const cardRect = el.getBoundingClientRect();
    const boardRect = game.board.getBoundingClientRect();
    const x = cardRect.left - boardRect.left + (CARD_W - 160) / 2;
    let y = cardRect.top - boardRect.top - 74;
    if (y < 4) y = cardRect.top - boardRect.top + CARD_H + 6; // 顶部放不下 → 显示在卡下方
    _tipEl.style.left = clamp(x, 4, bs.w - 164) + "px";
    _tipEl.style.top = clamp(y, 4, bs.h - 64) + "px";
    game.board.appendChild(_tipEl);
  }
  el.addEventListener("mouseenter", show);
  el.addEventListener("mouseleave", hideTip);
  let hold = null;
  el.addEventListener("touchstart", () => { hold = setTimeout(show, 300); }, { passive: true });
  el.addEventListener("touchmove", () => { if (hold) { clearTimeout(hold); hold = null; } }, { passive: true });
  el.addEventListener("touchend", () => { if (hold) { clearTimeout(hold); hold = null; } setTimeout(hideTip, 150); }, { passive: true });
  el.addEventListener("touchcancel", () => { if (hold) { clearTimeout(hold); hold = null; } hideTip(); }, { passive: true });
}

// 新手卡包（常驻元素，不随 cards 循环）
export function renderPack(game, pack) {
  const board = game.board;
  const old = board.querySelector(".packobj");
  if (old) old.remove();
  const el = document.createElement("div");
  el.className = "packobj";
  el.style.left = pack.x + "px";
  el.style.top = pack.y + "px";
  el.innerHTML = '<div class="pe"><img src="img/ui_pack.png" alt="新手卡包" /></div><div class="pn">新手卡包</div>';
  // 打开逻辑统一由 onDown 处理（已在其中识别 .packobj）；这里保留 onclick 作为兜底
  el.onclick = function () { if (pack._open) pack._open(); };
  board.appendChild(el);
}

// 掉落动画：从源堆位置飞出一个 emoji 到目标堆（CSS transition 抛物线感）
export function playDrop(game, from, to) {
  const board = game.board;
  const emo = META[to.cards[to.cards.length - 1]?.type]?.emoji || "✨";
  const el = document.createElement("div");
  el.className = "drop-fx";
  el.textContent = emo;
  el.style.left = (from.x + CARD_W / 2 - 14) + "px";
  el.style.top = (from.y - 18) + "px";
  board.appendChild(el);
  // 双 rAF 确保 transition 生效
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.left = (to.x + CARD_W / 2 - 14) + "px";
    el.style.top = (to.y - 18) + "px";
    el.classList.add("fly");
  }));
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 650);
}
