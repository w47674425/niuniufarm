// 渲染层：把状态画到 DOM 上（原单文件中的「渲染 / HUD」区块）

import { CARD_W, CARD_H, STACK_OFF, META } from './config.js';
import { clamp } from './utils.js';
import { isCattle } from './merge.js';
import { countMoneyOnBoard } from './state.js';

export function fmtTime(s) {
  const m = Math.floor(s / 60), ss = s % 60;
  return (m < 10 ? "0" : "") + m + ":" + (ss < 10 ? "0" : "") + ss;
}

export function updateHUD(game) {
  game.refs.dayStat.textContent = "第 " + game.state.day + " 天";
  game.refs.timer.textContent = fmtTime(game.state.timeLeft);
  game.refs.cashStat.textContent = "💰 ¥" + countMoneyOnBoard(game);
  game.refs.bankStat.textContent = "🏦 ¥" + game.state.bankDeposit;
}

export function toast(game, msg) {
  const el = game.toastEl;
  el.textContent = msg;
  el.classList.add("show");
  if (game._toastTimer) clearTimeout(game._toastTimer);
  game._toastTimer = setTimeout(() => { el.classList.remove("show"); }, 1900);
}

// 进度条（产出/喂食展示用）
export function showProgress(game, x, y, seconds, label, onDone) {
  const board = game.board;
  const el = document.createElement("div");
  el.className = "progress";
  el.innerHTML = '<div class="pt">' + label + '</div><div class="ptrack"><div class="pbar"></div></div>';
  el.style.left = clamp(x, 4, board.clientWidth - 134) + "px";
  el.style.top = clamp(y - 34, 4, board.clientHeight - 40) + "px";
  board.appendChild(el);
  const bar = el.querySelector(".pbar");
  const start = Date.now(), dur = seconds * 1000;
  const iv = setInterval(() => {
    const f = Math.min(1, (Date.now() - start) / dur);
    bar.style.width = (f * 100) + "%";
  }, 50);
  setTimeout(() => {
    clearInterval(iv);
    if (el.parentNode) el.parentNode.removeChild(el);
    onDone();
  }, dur);
}

export function render(game) {
  const board = game.board;
  const drag = game.state.drag;
  const old = board.querySelectorAll(".card, .packobj");
  for (let i = 0; i < old.length; i++) old[i].remove();

  game.state.piles.forEach((p, pi) => {
    if (p.isPack) {
      let x = p.x, y = p.y;
      if (drag && drag.pile === p) { x += drag.dx; y += drag.dy; }
      const el = document.createElement("div");
      el.className = "packobj";
      el.style.left = x + "px"; el.style.top = y + "px";
      el.innerHTML = '<div class="pe">🎁</div><div class="pn">新手卡包</div>';
      board.appendChild(el);
      return;
    }
    p.cards.forEach((c, ci) => {
      let x = p.x, y = p.y + ci * STACK_OFF;
      if (drag && drag.moving.indexOf(c) >= 0) { x += drag.dx; y += drag.dy; }
      const el = document.createElement("div");
      el.className = "card";
      if (isCattle(c.type)) el.className += " cattle";
      if (c.type === "bank") el.className += " bankcard";
      if (drag && drag.moving.indexOf(c) >= 0) el.className += " dragging";
      el.style.left = x + "px"; el.style.top = y + "px";
      el.style.zIndex = (pi * 20 + ci);
      el.setAttribute("data-id", c.id);
      const emo = META[c.type] ? META[c.type].emoji : "❓";
      let label = META[c.type] ? META[c.type].label : c.type;
      if (c.type === "money") label = "¥" + (c.value || 1);
      if (c.type === "bank") label = "¥" + game.state.bankDeposit;
      let html = '<div class="ce">' + emo + '</div><div class="cn">' + label + '</div>';
      if (isCattle(c.type)) {
        const f = c.fedToday || 0;
        const inPasture = p.cards.some(x => x.type === "fence");
        if (inPasture) html += '<div class="cb">🏞牧场自动喂</div>';
        else html += '<div class="cb">今日吃' + f + '/3</div>';
      } else if (META[c.type] && META[c.type].note) {
        html += '<div class="cb">' + META[c.type].note + '</div>';
      }
      if (c.type === "money" && (c.value || 1) > 1) {
        html += '<div class="moneybadge">¥' + (c.value || 1) + '</div>';
      }
      el.innerHTML = html;
      board.appendChild(el);
    });
  });
}
