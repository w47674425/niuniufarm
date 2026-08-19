// 渲染层：把状态画到 DOM 上（对齐资料库准绳版「渲染 / HUD」区块）

import { CARD_W, CARD_H, STACK_OFF, META, foodCapOf } from './config.js';
import { clamp } from './utils.js';
import { allCards, countType, popCap, popCount } from './state.js';
import { pileAction } from './merge.js';

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
  if (st.phase === "day") { ph.textContent = "☀️ 白天"; ph.className = "stat"; ph.classList.add("day"); }
  else { ph.textContent = "🌙 夜晚"; ph.className = "stat"; ph.classList.add("night"); }
  game.refs.timer.textContent = fmtTime(st.timeLeft);
  game.refs.goldStat.textContent = "💰 ¥" + st.gold;
  game.refs.popStat.textContent = "🧑 " + popCount(game) + "/" + popCap(game);
  let herderFood = 0;
  allCards(game).forEach(c => { if (META[c.type] && META[c.type].cat === "unit") herderFood += (c.fed || 0); });
  game.refs.foodStat.textContent = "🍖 " + herderFood;
  // 刷新统计（任务依赖）
  st.stats.herders = popCount(game);
  st.stats.houses = countType(game, "house");
  st.stats.walls = countType(game, "wall");
  st.stats.smelters = countType(game, "smelter");
  st.stats.gold = st.gold;
  st.stats.equipped = allCards(game).filter(c => c.type === "herder" && (c.atkBonus || 0) > 0).length;
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
      let html = '<div class="ce">' + meta.emoji + '</div><div class="cn">' + meta.label + '</div>';
      if (meta.cat === "mon" || (meta.atk && (c.type === "herder" || c.type === "dog"))) {
        const hpc = c.hp != null ? c.hp : meta.hp;
        const max = meta.hp;
        const pct = clamp(Math.round(hpc / max * 100), 0, 100);
        html += '<div class="hpbar"><div class="hpfill" style="width:' + pct + '%"></div></div>';
        if (c.type === "herder" && (c.atkBonus || 0) > 0) {
          html += '<div class="cb">⚔️+' + (c.atkBonus || 0) + '</div>';
        }
      }
      // 所有单位显示饱食度（上限取该单位自身配置）
      if (meta.cat === "unit" && c.fed != null) {
        html += '<div class="cb">饱食 ' + c.fed + '/' + foodCapOf(c.type) + '</div>';
      } else if (meta.cat === "node" && meta.charges) {
        const left = (c.charges != null ? c.charges : meta.charges);
        html += '<div class="cb">可采 ' + left + ' 次</div>';
      } else if (meta.note) {
        html += '<div class="cb">' + meta.note + '</div>';
      }
      el.innerHTML = html;
      board.appendChild(el);
    });
  });
}

// 新手卡包（常驻元素，不随 cards 循环）
export function renderPack(game, pack) {
  const board = game.board;
  const old = board.querySelector(".packobj");
  if (old) old.remove();
  const el = document.createElement("div");
  el.className = "packobj";
  el.style.cssText = "position:absolute;width:80px;height:96px;border-radius:16px;background:linear-gradient(180deg,#fff,#fff3cf);border:2px solid var(--gold);box-shadow:0 4px 10px rgba(0,0,0,.2);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;user-select:none;text-align:center;z-index:6;";
  el.innerHTML = '<div style="font-size:34px">🎁</div><div style="font-size:12px;font-weight:800;margin-top:4px">新手卡包</div>';
  el.style.left = pack.x + "px";
  el.style.top = pack.y + "px";
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
