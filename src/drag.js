// 输入层：指针拖拽与堆叠交互（对齐资料库准绳版「拖拽交互」区块）

import { CARD_W, CARD_H, STACK_OFF } from './config.js';
import { clamp } from './utils.js';
import { makePile, pileOf, allCards, detach, pileAtPoint } from './state.js';
import { render, updateHUD } from './render.js';
import { sellCards, feedHerder } from './systems.js';
import { isFood } from './merge.js';

export function bindDrag(game) {
  const board = game.board;
  const marketEl = game.marketEl;

  function onDown(e) {
    if (game.state.gameOver) return;
    // 新手卡包：点到它就打开。走 onDown 主路径，保证任何环境都能触发，
    // 不再依赖卡包元素自身挂的监听器（某些浏览器/WebView 下可能不生效）。
    if (e.target && e.target.closest && e.target.closest(".packobj")) {
      e.preventDefault();
      const pk = game.state.piles.find(p => p.isPack);
      if (pk && pk._open) pk._open();
      return;
    }
    const el = e.target.closest ? e.target.closest(".card") : null;
    if (!el) return;
    const cid = parseInt(el.getAttribute("data-id"), 10);
    let card = null;
    allCards(game).forEach(c => { if (c.id === cid) card = c; });
    if (!card) return;
    const p = pileOf(game, card);
    if (!p) return;
    if (p.isPack) { return; }
    const idx = p.cards.indexOf(card);
    const moving = p.cards.slice(idx);
    game.state.drag = { pile: p, index: idx, moving, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, moved: false };
    e.preventDefault();
  }

  function onMove(e) {
    const d = game.state.drag;
    if (!d) return;
    d.dx = e.clientX - d.startX;
    d.dy = e.clientY - d.startY;
    if (Math.abs(d.dx) > 4 || Math.abs(d.dy) > 4) d.moved = true;
    render(game);
  }

  function onUp(e) {
    const d = game.state.drag;
    if (!d) return;
    game.state.drag = null;
    const bx = d.pile.x + d.dx;
    const by = d.pile.y + d.index * STACK_OFF + d.dy;
    const cx = bx + CARD_W / 2, cy = by + CARD_H / 2;

    // 拖到市场 → 出售
    const mr = marketEl.getBoundingClientRect(), br = board.getBoundingClientRect();
    if (cx > mr.left - br.left && cx < mr.right - br.left && cy > mr.top - br.top && cy < mr.bottom - br.top) {
      sellCards(game, d);
      render(game); updateHUD(game);
      return;
    }

    const target = pileAtPoint(game, cx, cy, d.pile);
    if (target) {
      // 喂食：移动方是食物，目标堆有牧民
      if (d.moving.some(c => isFood(c.type)) && target.cards.some(c => c.type === "herder")) {
        detach(game, d.moving, d.pile);
        feedHerder(game, d, target);
        // 没喂完的食物卡（含吃撑了的）叠到目标堆
        if (d.moving.length > 0) target.cards = target.cards.concat(d.moving);
        render(game); updateHUD(game);
        return;
      }
      detach(game, d.moving, d.pile);
      target.cards = target.cards.concat(d.moving);
      render(game); updateHUD(game);
      return;
    }
    // 空地 → 新堆
    detach(game, d.moving, d.pile);
    const x = clamp(bx, 6, game.boardSize().w - CARD_W - 6), y = clamp(by, 6, game.boardSize().h - CARD_H - 6);
    makePile(game, x, y, d.moving);
    render(game); updateHUD(game);
  }

  board.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}
