// 业务系统层：主循环昼夜 / 怪物 / 每日结算 / 存档 / 卡包 / 任务 / 出售 / 喂食
// 对齐资料库准绳版「主循环 / 每日结算 / 卡包 / 任务 / 存档 / 堆叠触发」区块

import { DAY_LEN, DAY_FRAC, TICK_MS, CARD_W, CARD_H, MON_SPEED, ENGAGE_DIST, META, PACKS, TASKS, SAVE_KEY, foodCapOf, COW_BREEDS, COW_WEIGHTS } from './config.js';
import { rand, clamp } from './utils.js';
import { mk, makePile, removePile, allCards, countType, removeCardObj, detach, scatter, popCount, markSeen } from './state.js';
import { isFood, pileAction as _pileAction, doAction as _doAction } from './merge.js';
import { render, updateHUD, toast, playDrop } from './render.js';
import { endGame } from './modals.js';
import * as audio from './audio.js';

// ===================== 主循环 tick（由 game 每 TICK_MS 调用） =====================
export function tick(game) {
  const st = game.state;
  if (st.paused || st.gameOver) return;
  if (!st.packOpened) return; // 新手卡包未打开：倒计时冻结，游戏未真正开始
  const dt = (TICK_MS / 1000) * (st.speed || 1); // 速度倍率：1x/2x/4x
  // 昼夜推进
  st.timeLeft -= dt;
  if (st.timeLeft <= 0) { onDayEnd(game); return; }
  updatePhase(game);
  // 生产 / 建造 / 繁殖 / 战斗
  st.piles.forEach(p => {
    if (p.isPack) return;
    if (p.cd > 0) p.cd = Math.max(0, p.cd - dt); // 繁殖冷却递减
    const info = _pileAction(game, p);
    if (!info) { p.prog = 0; p.action = null; return; }
    if (p.action !== info.type) { p.action = info.type; p.prog = 0; }
    p.actionSec = info.sec;
    p.prog += dt;
    if (p.prog >= info.sec) {
      p.prog = 0;
      _doAction(game, p, info);
      render(game); updateHUD(game);
      // 配方完成音：按配方 kind/id 映射
      if (info.recipe) {
        const rid = info.recipe.id || "";
        if (rid.startsWith("gather_")) {
          if (rid === "gather_wood") audio.play("gather.wood");
          else if (rid === "gather_stone") audio.play("gather.stone");
          else if (rid === "gather_blueberry" || rid === "gather_herb") audio.play("gather.berry");
          else audio.play("gather.ore");
        } else if (info.recipe.kind === "breed") {
          audio.play("breed");
        } else if (info.recipe.kind === "eat" || info.recipe.kind === "potion") {
          audio.play("eat");
        } else {
          // 建造/制作/冶炼/烹饪/宰杀/训练 → 完成琶音，按 kind 微调音高
          const step = info.recipe.kind === "build" ? -3 : (info.recipe.kind === "slaughter" ? -2 : 0);
          audio.play("craft.finish", { step });
        }
      }
      // 消费采集/生产产出的掉落动画
      if (st._drops && st._drops.length > 0) {
        st._drops.forEach(d => playDrop(game, d.from, d.to));
        st._drops = [];
      }
    }
  });
  // 怪物移动与交战
  moveMonsters(game);
  // 自适应音乐状态：昼夜 + 威胁等级（夜间怪物数 /6，封顶 1）
  const monCount = st.piles.reduce((a, p) => a + p.cards.filter(c => META[c.type] && META[c.type].cat === "mon").length, 0);
  audio.setMusicState(st.phase, st.phase === "night" ? Math.min(monCount / 6, 1) : 0);
  // 有进行中的生产/建造/战斗时每 tick 重绘，进度条持续显示并前进
  const anyActive = st.piles.some(p => !p.isPack && p.action && p.actionSec);
  if (anyActive) render(game);
  // 每 tick 刷新 HUD（timer 倒计时持续走动，无动作时也不再卡住）
  updateHUD(game);
  // 自动保存
  if (game._tickCount === undefined) game._tickCount = 0;
  game._tickCount++;
  if (game._tickCount % 10 === 0) saveGame(game);
}

// ===================== 昼夜切换 =====================
export function updatePhase(game) {
  const st = game.state;
  const daySec = DAY_LEN * DAY_FRAC;
  const isNight = st.timeLeft <= (DAY_LEN - daySec);
  const newPhase = isNight ? "night" : "day";
  if (newPhase !== st.phase) {
    st.phase = newPhase;
    game.app.classList.toggle("night", st.phase === "night");
    audio.play(st.phase === "night" ? "night.start" : "day.start");
    if (st.phase === "night") { st.nightSpawned = false; onNightStart(game); }
    else { onDayStart(game); }
  } else if (st.phase === "night" && !st.nightSpawned) {
    st.nightSpawned = true;
    spawnMonsters(game);
  }
}

export function onNightStart(game) { toast(game, "🌙 夜幕降临，当心怪物来袭！"); }
export function onDayStart(game) { toast(game, "☀️ 天亮了，怪物撤退"); clearMonsters(game); }

// ===================== 怪物 =====================
export function spawnMonsters(game) {
  const st = game.state;
  const herders = popCount(game);
  if (herders <= 0) return;
  const walls = countType(game, "wall");
  const n = (st.day <= 1) ? 0 : clamp(1 + Math.floor((st.day - 2) / 2) - walls, 0, 4);
  const s = game.boardSize();
  for (let i = 0; i < n; i++) {
    const type = (Math.random() < 0.9) ? "thief" : "bandit";
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    if (edge === 0) { x = rand(20, s.w - 92); y = 10; }
    else if (edge === 1) { x = rand(20, s.w - 92); y = s.h - CARD_H - 10; }
    else if (edge === 2) { x = 10; y = rand(20, s.h - CARD_H - 10); }
    else { x = s.w - CARD_W - 10; y = rand(20, s.h - CARD_H - 10); }
    const m = mk(game, type);
    markSeen(game, type);
    makePile(game, x, y, [m]);
  }
  if (n > 0) audio.play("combat.monster");
}

export function clearMonsters(game) {
  game.state.piles.slice().forEach(p => {
    if (p.cards.some(c => META[c.type].cat === "mon")) removePile(game, p);
  });
}

export function moveMonsters(game) {
  const st = game.state;
  if (st.phase !== "night") return;
  const dogPiles = st.piles.filter(p => p.cards.some(c => c.type === "dog"));
  const herderPiles = st.piles.filter(p => p.cards.some(c => c.type === "herder"));
  // 有牧羊犬时，所有怪物优先扑向牧羊犬（全局保护牧民）
  const targets = dogPiles.length > 0 ? dogPiles : herderPiles;
  if (targets.length === 0) return;
  const bs = game.boardSize();
  st.piles.slice().forEach(p => {
    if (p.isPack) return;
    const mon = p.cards.find(c => META[c.type].cat === "mon");
    if (!mon) return;
    // 已与防御者同堆则交由 fight 处理
    if (p.cards.some(c => c.type === "herder" || c.type === "dog")) return;
    // 找最近目标
    let best = null, bd = 1e9;
    targets.forEach(t => {
      const dx = (t.x + CARD_W / 2) - (p.x + CARD_W / 2), dy = (t.y + CARD_H / 2) - (p.y + CARD_H / 2);
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = t; }
    });
    if (!best) return;
    const dx = (best.x + CARD_W / 2) - (p.x + CARD_W / 2), dy = (best.y + CARD_H / 2) - (p.y + CARD_H / 2);
    const dist = Math.sqrt(bd);
    if (dist <= ENGAGE_DIST) {
      // 交战：把怪物并入目标堆
      const moving = p.cards.filter(c => META[c.type].cat === "mon");
      removePile(game, p);
      best.cards = best.cards.concat(moving);
      render(game); updateHUD(game);
      return;
    }
    const ux = dx / dist, uy = dy / dist;
    const spd = MON_SPEED * (st.speed || 1); // 加速时怪物同步提速
    p.x = clamp(p.x + ux * spd, 4, bs.w - CARD_W - 4);
    p.y = clamp(p.y + uy * spd, 4, bs.h - CARD_H - 4);
  });
  render(game); updateHUD(game);
}

// ===================== 每日结算 =====================
export function onDayEnd(game) {
  const st = game.state;
  st.milkToday = 0; // 牛每日挤奶限量重置
  // 所有单位（牧民/牧羊犬）每天消耗 1 餐饱食；
  // 饱食不足的单位自动进食：优先吃自己 diet 偏好的食物，没有则吃场上任意食物，都没有才饿死
  const units = allCards(game).filter(c => META[c.type] && META[c.type].cat === "unit");
  let starved = 0, ateFood = 0;
  const dietEaten = {}; // {物资type: 数量}
  units.slice().forEach(c => {
    if ((c.fed || 0) >= 1) { c.fed -= 1; return; }
    const dietType = META[c.type].diet;
    // 优先 diet 偏好食物
    let foodCard = dietType ? allCards(game).find(x => x.type === dietType) : null;
    // 没有偏好食物 → 任意食物兜底
    if (!foodCard) foodCard = allCards(game).find(x => META[x.type] && META[x.type].cat === "food");
    if (foodCard) {
      removeCardObj(game, foodCard);
      c.fed = Math.min(foodCapOf(c.type), (c.fed || 0) + (META[foodCard.type].food || 1));
      ateFood++;
      dietEaten[foodCard.type] = (dietEaten[foodCard.type] || 0) + 1;
      return;
    }
    removeCardObj(game, c);
    starved++;
  });
  if (ateFood > 0) {
    const parts = Object.keys(dietEaten).map(t => META[t].emoji + " " + META[t].label + "×" + dietEaten[t]);
    toast(game, "🍽 " + ateFood + " 个单位吃了 " + parts.join("、") + " 充饥");
    audio.play("eat");
  }
  if (starved > 0) { toast(game, "💀 " + starved + " 个单位没有食物，饿死了"); audio.play("starve"); }
  else if (ateFood === 0) toast(game, "🌅 第 " + st.day + " 天结束，牧场平安度过了");
  // 是否全员阵亡（无牧民则游戏结束）
  if (popCount(game) === 0) { endGame(game); return; }
  st.day++;
  st.timeLeft = DAY_LEN;
  st.phase = "day";
  game.app.classList.remove("night");
  st.nightSpawned = false;
  clearMonsters(game);
  render(game); updateHUD(game); saveGame(game);
}

// ===================== 卡包 =====================
// 牛品种加权随机（普通牛最常见，牦牛最稀有）
function randCowBreed() {
  const total = COW_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < COW_BREEDS.length; i++) {
    r -= COW_WEIGHTS[i];
    if (r <= 0) return COW_BREEDS[i];
  }
  return COW_BREEDS[0];
}

export function buyPack(game, pack) {
  if (game.state.gold < pack.price) { audio.play("ui.error"); toast(game, "金币不足，需要 ¥" + pack.price); return; }
  game.state.gold -= pack.price;
  const cardsArr = [];
  if (pack.pool) {
    // 随机卡包：从 pool 中不重复抽取 count 种
    const pool = pack.pool.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    pool.slice(0, pack.count || 1).forEach(t => {
      // 抽到"牛"时随机一个品种
      cardsArr.push(mk(game, t === "cow" ? randCowBreed() : t));
    });
  } else {
    pack.items.forEach(it => { for (let i = 0; i < it[1]; i++) cardsArr.push(mk(game, it[0])); });
  }
  scatter(game, cardsArr);
  render(game); updateHUD(game); saveGame(game);
  audio.play("ui.open");
  toast(game, "已购买「" + pack.name + "」");
}

// ===================== 任务 =====================
export function checkTasks(game) {
  const st = game.state;
  TASKS.forEach(t => {
    if (st.tasksDone[t.id]) return;
    if (t.check(st.stats)) {
      st.tasksDone[t.id] = true;
      st.gold += t.rew;
      st.stats.gold = st.gold;
      audio.play("ui.task");
      toast(game, "✅ 任务完成：「" + t.name + "」 +¥" + t.rew);
    }
  });
}

// ===================== 拖到市场出售 / 喂食 =====================
export function sellCards(game, d) {
  const st = game.state;
  const remain = [];
  d.moving.forEach(c => {
    const price = META[c.type] ? (META[c.type].sale || 0) : 0;
    if (price > 0) { st.gold += price; st.stats.gold = st.gold; toast(game, "售出「" + META[c.type].label + "」 +¥" + price); }
    else { remain.push(c); }
  });
  detach(game, d.moving, d.pile);
  if (remain.length > 0) {
    if (d.pile.cards.length > 0) d.pile.cards = d.pile.cards.concat(remain);
    else makePile(game, clamp(d.pile.x, 6, game.boardSize().w - CARD_W - 6), clamp(d.pile.y, 6, game.boardSize().h - CARD_H - 6), remain);
  }
  if (d.pile.cards.length === 0) removePile(game, d.pile);
  checkTasks(game);
}

export function feedUnit(game, d, target) {
  const st = game.state;
  const unit = target.cards.find(c => META[c.type] && META[c.type].cat === "unit");
  if (!unit) return;
  const cap = foodCapOf(unit.type);
  d.moving.slice().forEach(c => {
    if (!isFood(c.type)) return;
    if ((unit.fed || 0) >= cap) { return; } // 已吃饱
    const v = META[c.type].food || 1;
    unit.fed = Math.min(cap, (unit.fed || 0) + v);
    // 从 moving 移除该食物卡
    const i = d.moving.indexOf(c);
    if (i >= 0) d.moving.splice(i, 1);
    toast(game, "🍽 " + META[c.type].label + " 喂给" + META[unit.type].label + "（饱食 " + unit.fed + "/" + cap + "）");
  });
}

// ===================== 存档 =====================
export function saveGame(game) {
  // 失败后不再写档：gameOver 状态下任何保存（含 beforeunload）都改为删档，
  // 保证刷新即开新局，而不是恢复失败前的旧状态
  if (game.state.gameOver) {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
    return;
  }
  try {
    const st = game.state;
    const data = {
      day: st.day, timeLeft: st.timeLeft, phase: st.phase, gold: st.gold,
      seenCards: st.seenCards, cardGets: st.cardGets, tasksDone: st.tasksDone, lastSave: Date.now(),
      piles: st.piles.map(p => ({
        x: p.x, y: p.y, isPack: p.isPack,
        cards: p.cards.map(c => {
          const o = { type: c.type };
          if (c.hp != null) o.hp = c.hp;
          if (c.fed != null) o.fed = c.fed;
          if (c.charges != null) o.charges = c.charges;
          if (c.atkBonus) o.atkBonus = c.atkBonus;
          if (c.hpBonus) o.hpBonus = c.hpBonus;
          return o;
        })
      }))
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { }
}

export function loadGame(game) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    const st = game.state;
    st.piles = [];
    st.nextId = 1;
    st.day = data.day || 1;
    st.timeLeft = data.timeLeft || DAY_LEN;
    st.gold = data.gold || 0;
    st.seenCards = data.seenCards || {};
    st.cardGets = data.cardGets || {};
    st.tasksDone = data.tasksDone || {};
    (data.piles || []).forEach(sp => {
      const cards = (sp.cards || []).map(sc => {
        const c = mk(game, sc.type);
        if (sc.hp != null) c.hp = sc.hp;
        if (sc.fed != null) c.fed = sc.fed;
        if (sc.charges != null) {
          // 旧档迁移兜底：META 配置更新后（如 charges 1→5），
          // 若存档值 ≤ 1 视为旧默认值，重置为当前 META 配置；
          // 已部分消耗（>1）的保留实际剩余次数
          c.charges = sc.charges <= 1 ? (META[sc.type] && META[sc.type].charges || sc.charges) : sc.charges;
        }
        if (sc.atkBonus) c.atkBonus = sc.atkBonus;
        if (sc.hpBonus) c.hpBonus = sc.hpBonus;
        return c;
      });
      const p = makePile(game, sp.x, sp.y, cards);
      p.isPack = sp.isPack;
    });
    // 新手卡包状态：存档含未开的 pack → 倒计时冻结；否则已开
    st.packOpened = !st.piles.some(p => p.isPack);
    // 离线收益（仅在有房屋且离线较久时）
    const elapsed = Math.max(0, (Date.now() - (data.lastSave || Date.now())) / 1000);
    if (elapsed > 60 && countType(game, "house") > 0) {
      const off = Math.floor(elapsed / 30); // 每30秒 ¥3
      if (off > 0) { st.gold += off * 3; showOffline(game, off * 3, elapsed); }
    }
    return true;
  } catch (e) { return false; }
}

export function showOffline(game, amount, sec) {
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = '<div class="modal"><h2>🌙 离线收益</h2>' +
    '<p>你离开了 ' + Math.floor(sec / 60) + ' 分 ' + Math.floor(sec % 60) + ' 秒，牧场帮你赚到了：</p>' +
    '<p style="font-size:22px;font-weight:800;color:#c0392b;text-align:center;">+¥' + amount + '</p>' +
    '<button class="close" id="offClose">收下</button></div>';
  game.board.appendChild(ov);
  document.getElementById("offClose").onclick = function () { if (ov.parentNode) ov.parentNode.removeChild(ov); };
}
