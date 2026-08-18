// 输入层：指针拖拽 / 堆叠交互（原单文件中的「拖拽 / 堆叠交互」区块）

import { CARD_W, CARD_H, STACK_OFF, PRODUCE_SEC } from './config.js';
import { clamp } from './utils.js';
import { makePile, pileOf, allCards, detach, pileAtPoint } from './state.js';
import { checkMerge, isCattle } from './merge.js';
import { render, updateHUD, toast, showProgress } from './render.js';
import { startFeed, sellCows, openPack, doProduce } from './systems.js';

export function bindDrag(game) {
  const board = game.board;
  const marketEl = game.marketEl;

  function onDown(e) {
    if (game.state.gameOver) return;
    const pel = e.target.closest ? e.target.closest(".packobj") : null;
    if (pel) {
      const pk = game.state.piles.find(p => p.isPack);
      if (pk) {
        game.state.drag = { pile: pk, isPack: true, moving: [], startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, moved: false };
        e.preventDefault(); return;
      }
    }
    const el = e.target.closest ? e.target.closest(".card") : null;
    if (!el) return;
    const cid = parseInt(el.getAttribute("data-id"), 10);
    let card = null;
    allCards(game).forEach(c => { if (c.id === cid) card = c; });
    if (!card) return;
    const pile = pileOf(game, card);
    if (!pile) return;
    const idx = pile.cards.indexOf(card);       // 0 = 最底，n-1 = 最顶
    const moving = pile.cards.slice(idx);       // 抓这张 + 它上面所有
    game.state.drag = { pile, index: idx, moving, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, moved: false };
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

    // 新手卡包：轻点打开，拖动则移动卡包
    if (d.pile && d.pile.isPack) {
      if (!d.moved) { openPack(game, d.pile); return; }
      d.pile.x = clamp(d.pile.x + d.dx, 6, game.boardSize().w - 84 - 6);
      d.pile.y = clamp(d.pile.y + d.dy, 6, game.boardSize().h - 104 - 6);
      render(game); updateHUD(game);
      return;
    }

    const bx = d.pile.x + d.dx;
    const by = d.pile.y + d.index * STACK_OFF + d.dy;
    const cx = bx + CARD_W / 2, cy = by + CARD_H / 2;

    // 拖到市场 → 卖牛
    const mr = marketEl.getBoundingClientRect();
    const br = board.getBoundingClientRect();
    if (cx > mr.left - br.left && cx < mr.right - br.left && cy > mr.top - br.top && cy < mr.bottom - br.top) {
      sellCows(game, d);
      render(game); updateHUD(game);
      return;
    }

    const target = pileAtPoint(game, cx, cy, d.pile);
    if (target) {
      const res = checkMerge(d.moving, target.cards);
      if (res.ok) {
        if (res.info.kind === "feed") { startFeed(game, d, target, bx, by); return; }
        // 其它合并：从原堆取出，并入目标堆
        detach(game, d.moving, d.pile);
        target.cards = target.cards.concat(d.moving);
        if (res.info.kind === "pasture") {
          const wasPasture = target.cards.some(c => c.type === "fence") && target.cards.some(c => isCattle(c.type));
          toast(game, wasPasture ? "🌿 草料已叠入牧场（每天自动消耗3草料喂牛）" : "🏞 牧场组成：围栏+牛(+草料)，每天自动喂3草料");
        }
        if (res.info.kind === "bank") {
          let tot = 0;
          target.cards = target.cards.filter(c => { if (c.type === "money") { tot += (c.value || 1); return false; } return true; });
          if (tot > 0) { game.state.bankDeposit += tot; toast(game, "存入银行卡 ¥" + tot); }
        }
        if (res.info.kind === "produce") {
          game.state.busy = true;
          showProgress(game, target.x, target.y + (target.cards.length - 1) * STACK_OFF, PRODUCE_SEC,
            "👷 产出中…", function () {
              doProduce(game, res.info.combo, target);
              game.state.busy = false; render(game); updateHUD(game);
            });
          render(game); updateHUD(game);
          return;
        }
        render(game); updateHUD(game);
        return;
      } else {
        if (res.reverse) {
          if (res.info && res.info.kind === "feed") toast(game, "要把草料拖到牛上才行（反向不行）");
          else toast(game, "要把员工拖到对应卡上才行（反向不行）");
        } else { toast(game, "这两类不能叠在一起"); }
        // 非法 → 放到空地（不合并）
        detach(game, d.moving, d.pile);
        const nx = clamp(bx, 6, game.boardSize().w - CARD_W - 6), ny = clamp(by, 6, game.boardSize().h - CARD_H - 6);
        makePile(game, nx, ny, d.moving);
        render(game); updateHUD(game);
        return;
      }
    }

    // 空地 → 拆成一堆
    detach(game, d.moving, d.pile);
    const x = clamp(bx, 6, game.boardSize().w - CARD_W - 6), y = clamp(by, 6, game.boardSize().h - CARD_H - 6);
    makePile(game, x, y, d.moving);
    render(game); updateHUD(game);
  }

  board.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}
