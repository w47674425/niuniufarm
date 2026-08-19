// 游戏数据层：全局状态 + 堆(pile)/卡(card) 的增删查改
// 所有函数都以 game 作为上下文：game.state 持有状态，game.boardSize() 提供棋盘尺寸

import { CARD_W, CARD_H, STACK_OFF, DAY_LEN, META, MAX_STACK, foodCapOf } from './config.js';
import { rand, clamp } from './utils.js';

export function createState() {
  return {
    piles: [],            // [{id, x, y, cards:[cardObj,...], cd, isPack?}]
    nextId: 1,
    day: 1,
    timeLeft: DAY_LEN,
    phase: "day",         // "day" | "night"
    paused: false,
    packOpened: false,    // 新手卡包是否已打开（未打开时倒计时冻结）
    speed: 1,             // 游戏速度倍率：1/2/4
    milkToday: 0,         // 今日已挤奶次数（牛每日限量）
    gameOver: false,
    gold: 0,
    drag: null,
    seenCards: {},        // 图鉴：见过的卡 type
    cardGets: {},         // 图鉴：每种卡累计获取次数（mk 时 +1）
    tasksDone: {},        // 已完成任务 id
    stats: { herders: 0, houses: 0, walls: 0, kills: 0, totalWood: 0, gold: 0, smelters: 0, equipped: 0 },
    nightSpawned: false,  // 本夜是否已刷怪
    lastSave: Date.now()
  };
}

export function mk(game, type) {
  const c = { id: game.state.nextId++, type };
  if (META[type].hp) c.hp = META[type].hp;
  if (META[type].cat === "unit") c.fed = foodCapOf(type); // 新单位满饱食，避免"空血"秒饿死
  if (META[type].charges) c.charges = META[type].charges; // 资源点采集次数
  // 图鉴获取计数：卡包开出/采集产出/建造/繁殖/怪物掉落都走 mk
  game.state.cardGets[type] = (game.state.cardGets[type] || 0) + 1;
  return c;
}

export function makePile(game, x, y, cards) {
  const p = { id: game.state.nextId++, x, y, cards: cards || [], cd: 0 };
  game.state.piles.push(p);
  return p;
}

export function removePile(game, p) {
  const i = game.state.piles.indexOf(p);
  if (i >= 0) game.state.piles.splice(i, 1);
}

export function pileOf(game, card) {
  for (const p of game.state.piles) {
    if (p.cards.indexOf(card) >= 0) return p;
  }
  return null;
}

export function allCards(game) {
  const r = [];
  game.state.piles.forEach(p => p.cards.forEach(c => r.push(c)));
  return r;
}

export function countType(game, type) {
  let n = 0;
  allCards(game).forEach(c => { if (c.type === type) n++; });
  return n;
}

export function removeCardObj(game, c) {
  const p = pileOf(game, c);
  if (p) {
    p.cards = p.cards.filter(x => x !== c);
    if (p.cards.length === 0) removePile(game, p);
  }
}

// 从原堆取出 moving（含它本身与上面的卡），原堆空了则移除
export function detach(game, moving, fromPile) {
  fromPile.cards = fromPile.cards.filter(c => moving.indexOf(c) < 0);
  if (fromPile.cards.length === 0) removePile(game, fromPile);
}

// 命中检测：返回包含 (x,y) 的最上层堆（排除 exclude）
export function pileAtPoint(game, x, y, exclude) {
  const piles = game.state.piles;
  for (let i = piles.length - 1; i >= 0; i--) {
    const p = piles[i];
    if (p === exclude || p.isPack) continue;
    for (let j = 0; j < p.cards.length; j++) {
      const cx = p.x, cy = p.y + j * STACK_OFF;
      if (x >= cx && x <= cx + CARD_W && y >= cy && y <= cy + CARD_H) return p;
    }
  }
  return null;
}

// 在棋盘随机散落若干卡片（各自成堆）
export function scatter(game, cardsArr) {
  const s = game.boardSize();
  cardsArr.forEach(c => {
    markSeen(game, c.type);
    const x = rand(8, Math.max(20, s.w - CARD_W - 8));
    const y = rand(8, Math.max(20, s.h - CARD_H - 64));
    makePile(game, x, y, [c]);
  });
}

export function markSeen(game, type) { game.state.seenCards[type] = true; }

// 人口上限 = 4 * 房屋数
export function popCap(game) { return 4 * countType(game, "house"); }
export function popCount(game) { return countType(game, "herder"); }
// 单堆上限：有仓库时 32，否则 MAX_STACK
export function maxStack(game) { return countType(game, "warehouse") > 0 ? 32 : MAX_STACK; }

// 在某堆附近寻找空白处生成新堆（采集产物掉落用）
// 尝试围绕源堆随机偏转，直到落点不与任何堆（含源堆）重叠；最多尝试 12 次，兜底取最近一次候选
export function spawnNear(game, sourcePile, cardsArr) {
  const s = game.boardSize();
  let bestX = null, bestY = null, bestScore = 1e9;
  for (let i = 0; i < 12; i++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 70;
    const x = clamp(sourcePile.x + Math.cos(ang) * dist, 6, s.w - CARD_W - 6);
    const y = clamp(sourcePile.y + Math.sin(ang) * dist, 6, s.h - CARD_H - 60);
    // 评分：与已有堆（含源堆）的重叠惩罚，重叠越少越好
    let overlap = 0;
    game.state.piles.forEach(p => {
      if (p.isPack) return;
      if (x < p.x + CARD_W + 6 && x + CARD_W + 6 > p.x && y < p.y + CARD_H + 6 && y + CARD_H + 6 > p.y) overlap += 1;
    });
    const score = overlap * 1000 + (x - sourcePile.x) * (x - sourcePile.x) + (y - sourcePile.y) * (y - sourcePile.y);
    if (overlap === 0) { bestX = x; bestY = y; bestScore = score; break; } // 找到无重叠位置
    if (score < bestScore) { bestScore = score; bestX = x; bestY = y; }   // 记录候选
  }
  return makePile(game, bestX, bestY, cardsArr);
}
