// 渲染层：把状态画到 DOM 上（对齐资料库准绳版「渲染 / HUD」区块）

import { CARD_W, CARD_H, STACK_OFF, META, DAY_LEN, DAY_FRAC, foodCapOf } from './config.js';
import { clamp } from './utils.js';
import { allCards, countType, popCount } from './state.js';
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
  // 夜晚来临前 10 秒：timer 放大警示（仅白天段生效，入夜后恢复）
  const nightAt = DAY_LEN * (1 - DAY_FRAC); // 夜晚开始剩余秒数
  const warn = (st.phase === "day" && st.timeLeft <= nightAt + 10);
  game.refs.timer.classList.toggle("night-warn", warn);
  game.refs.goldStat.textContent = "💰 ¥" + st.gold;
  // 刷新统计（任务依赖）
  st.stats.herders = popCount(game);
  st.stats.houses = countType(game, "house");
  st.stats.walls = countType(game, "wall");
  st.stats.smelters = countType(game, "smelter");
  st.stats.gold = st.gold;
  st.stats.equipped = allCards(game).filter(c => c.type === "dog" && (c.atkBonus || 0) > 0).length;
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
// 手绘风单位形象：牧民（草帽小人）/牧羊犬（手绘狗）用内联 SVG，其余用 emoji
function artFor(c, meta) {
  if (c.type === "herder") {
    return '<svg viewBox="0 0 64 64" width="34" height="34" class="art">' +
      '<circle cx="32" cy="26" r="14" fill="#ffd9b3" stroke="#5b5340" stroke-width="2.5"/>' +
      '<path d="M20 18 Q32 4 44 18 L44 24 Q32 10 20 24 Z" fill="#e8b04b" stroke="#5b5340" stroke-width="2.5"/>' +
      '<circle cx="26" cy="24" r="2" fill="#3d4a30"/><circle cx="38" cy="24" r="2" fill="#3d4a30"/>' +
      '<path d="M29 31 Q32 35 35 31" stroke="#5b5340" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<path d="M20 60 Q32 46 44 60 L56 58 Q48 40 44 34 Q32 42 20 34 Q16 40 8 58 Z" fill="#f5b942" stroke="#5b5340" stroke-width="2.5"/>' +
      '<path d="M18 50 Q32 42 46 50" stroke="#5b5340" stroke-width="2" fill="none"/>' +
      '</svg>';
  }
  if (c.type === "dog") {
    return '<svg viewBox="0 0 64 64" width="34" height="34" class="art">' +
      '<path d="M18 40 Q10 22 22 14 Q26 22 30 20 Q30 8 42 12 Q46 20 40 26 Q46 32 44 40 Z" fill="#e8d5b0" stroke="#5b5340" stroke-width="2.5"/>' +
      '<circle cx="34" cy="24" r="2" fill="#3d4a30"/><circle cx="42" cy="20" r="1.6" fill="#3d4a30"/>' +
      '<path d="M14 40 Q8 54 12 60 L18 58 Q16 48 20 42 Z" fill="#e8d5b0" stroke="#5b5340" stroke-width="2"/>' +
      '<path d="M44 42 Q50 54 46 60 L40 58 Q42 48 40 42 Z" fill="#e8d5b0" stroke="#5b5340" stroke-width="2"/>' +
      '<path d="M22 50 Q32 44 40 50" stroke="#5b5340" stroke-width="2" fill="none"/>' +
      '</svg>';
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
      // 牧民/牧羊犬：血量以卡片背景色块呈现（血多绿、中黄、低红）
      if (c.type === "herder" || c.type === "dog") {
        const hpc = c.hp != null ? c.hp : meta.hp;
        const max = (meta.hp || 0) + (c.hpBonus || 0);
        const pct = clamp(Math.round(hpc / max * 100), 0, 100);
        const color = pct > 60 ? "rgba(110,190,80,.5)" : (pct > 30 ? "rgba(240,190,60,.55)" : "rgba(225,90,70,.6)");
        html += '<div class="hpbg" style="height:' + pct + '%;background:' + color + '"></div>';
      }
      html += '<div class="ce">' + artFor(c, meta) + '</div><div class="cn">' + meta.label + '</div>';
      if (meta.cat === "mon") {
        const hpc = c.hp != null ? c.hp : meta.hp;
        const max = meta.hp;
        const pct = clamp(Math.round(hpc / max * 100), 0, 100);
        html += '<div class="hpbar"><div class="hpfill" style="width:' + pct + '%"></div></div>';
      }
      // 单位直接显示属性：⚔️攻击(含加成) ❤️血量(当前/上限)
      if (meta.cat === "unit") {
        const atk = (meta.atk || 0) + (c.atkBonus || 0);
        const cur = c.hp != null ? c.hp : (meta.hp || 0);
        const max2 = (meta.hp || 0) + (c.hpBonus || 0);
        html += '<div class="cb">⚔️' + atk + ' ❤️' + cur + '/' + max2 + '</div>';
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
  el.style.left = pack.x + "px";
  el.style.top = pack.y + "px";
  el.innerHTML = '<div class="pe">🎁</div><div class="pn">新手卡包</div>';
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
