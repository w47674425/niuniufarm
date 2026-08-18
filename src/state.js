// 游戏数据层：全局状态 + 堆(pile)/卡(card) 的增删查改
// 所有函数都以 game 作为上下文：game.state 持有状态，game.boardSize() 提供棋盘尺寸

import { CARD_W, CARD_H, STACK_OFF, DAY_LEN } from './config.js';
import { rand, clamp } from './utils.js';

export function createState() {
  return {
    piles: [],            // [{id, x, y, cards:[cardObj,...], isPack?}]
    nextId: 1,
    day: 1,
    timeLeft: DAY_LEN,
    paused: false,
    gameOver: false,
    busy: false,          // 产出/喂食进行中，计时暂停
    bankDeposit: 0,
    drag: null
  };
}

export function mk(game, type, value) {
  const c = { id: game.state.nextId++, type, fedToday: 0 };
  if (value != null) c.value = value;
  return c;
}

export function makePile(game, x, y, cards) {
  const p = { id: game.state.nextId++, x, y, cards: cards || [] };
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

export function countMoneyOnBoard(game) {
  let n = 0;
  allCards(game).forEach(c => { if (c.type === "money") n += (c.value || 1); });
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
    if (p === exclude) continue;
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
    const x = rand(8, Math.max(20, s.w - CARD_W - 8));
    const y = rand(8, Math.max(20, s.h - CARD_H - 64));
    makePile(game, x, y, [c]);
  });
}

// 在某堆附近生成新堆（产出物落点）
export function spawnNear(game, pile, cardsArr) {
  const s = game.boardSize();
  const x = clamp(pile.x + 34, 6, s.w - CARD_W - 6);
  const y = clamp(pile.y + 34, 6, s.h - CARD_H - 60);
  makePile(game, x, y, cardsArr);
}
