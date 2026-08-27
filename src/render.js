// 渲染层：把状态画到 DOM 上（对齐资料库准绳版「渲染 / HUD」区块）

import { CARD_W, CARD_H, STACK_OFF, META, DAY_LEN, DAY_FRAC, foodCapOf, TICKET, destById } from './config.js';
import { clamp } from './utils.js';
import { allCards, countType, popCount } from './state.js';
import { pileAction } from './merge.js';
import { cardArt } from './art.js';
import { moraleAvg, moraleLevel } from './spirit.js';

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
  // 地标目标 HUD：进入目的地后常驻显示本章目标（材料+金币进度），可建造时高亮
  const goal = game.refs.goalStat;
  if (goal) {
    if (st.destId && st.landmarkBuilt) {
      goal.hidden = false;
      goal.textContent = "✅ 旅程达成";
      goal.classList.remove("ready");
    } else if (st.destId) {
      const dest = destById(st.destId);
      if (dest) {
        const lm = dest.landmark;
        let matsOk = true;
        let matsHave = 0, matsNeed = 0;
        Object.keys(lm.need).forEach(t => {
          const have = countType(game, t);
          const need = lm.need[t];
          matsHave += Math.min(have, need); matsNeed += need;
          if (have < need) matsOk = false;
        });
        const ticketOk = st.gold >= lm.tickets;
        const ready = matsOk && ticketOk;
        goal.hidden = false;
        let txt;
        if (ready) txt = "🏗️ " + lm.name + " 可建造！";
        else if (matsOk) txt = lm.emoji + " " + lm.name + " " + TICKET + Math.min(st.gold, lm.tickets) + "/" + lm.tickets + " 材料✓";
        else txt = lm.emoji + " " + lm.name + " " + TICKET + Math.min(st.gold, lm.tickets) + "/" + lm.tickets + " ✦" + matsHave + "/" + matsNeed;
        goal.textContent = txt;
        goal.classList.toggle("ready", ready);
      }
    } else {
      goal.hidden = true;
    }
  }
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
  // 团队士气 HUD（精神系统 §4.6）：进入目的地后显示 💚均值，<40 红色预警、≥70 绿色
  const moraleEl = game.refs.moraleStat;
  if (moraleEl) {
    if (st.destId) {
      moraleEl.hidden = false;
      moraleEl.textContent = "💚 " + Math.round(moraleAvg(game));
      moraleEl.classList.remove("low", "high");
      const lvl = moraleLevel(game);
      if (lvl === "low") moraleEl.classList.add("low");
      else if (lvl === "high") moraleEl.classList.add("high");
    } else {
      moraleEl.hidden = true;
    }
  }
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
      // 工人精神徽标（卡片右上角，精神系统 §4.6）：绿=充足 / 黄=偏低 / 红=危险
      if (c.type === "herder" && c.spirit != null) {
        const sp = Math.round(c.spirit);
        const cls = sp >= 70 ? "ok" : (sp >= 40 ? "warn" : "bad");
        html += '<div class="spirit-tag ' + cls + '">💚' + sp + '</div>';
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
