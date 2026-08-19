// 主控制器：装配各模块、驱动昼夜循环、开局与事件绑定（对齐资料库准绳版）

import { createState, makePile, removePile, mk, scatter } from './state.js';
import { render, updateHUD, toast, renderPack, bindTaskCheck } from './render.js';
import { bindDrag } from './drag.js';
import { tick, loadGame, saveGame, checkTasks } from './systems.js';
import { showShop, showTasks, showCodex, showHelp, showSettings } from './modals.js';
import { bindToast } from './merge.js';
import { TICK_MS } from './config.js';

export class Game {
  constructor(refs) {
    this.refs = refs;
    this.board = refs.board;
    this.app = refs.app;
    this.marketEl = refs.market;
    this.toastEl = refs.toast;
    this.state = createState();
    // 注入跨层回调
    bindToast((game, msg) => toast(game, msg));
    bindTaskCheck((game) => checkTasks(game));
  }

  boardSize() { return { w: this.board.clientWidth, h: this.board.clientHeight }; }
  toast(msg) { toast(this, msg); }
  render() { render(this); }
  updateHUD() { updateHUD(this); }

  start() {
    bindDrag(this);

    // 底部导航
    this.refs.pauseBtn.onclick = () => {
      if (this.state.gameOver) return;
      this.state.paused = !this.state.paused;
      this.refs.pauseBtn.textContent = this.state.paused ? "▶" : "⏸";
    };
    this.refs.packBtn.onclick = () => { if (!this.state.gameOver) showShop(this); };
    this.refs.taskBtn.onclick = () => { if (!this.state.gameOver) showTasks(this); };
    this.refs.codexBtn.onclick = () => showCodex(this);
    this.refs.helpBtn.onclick = () => showHelp(this);
    this.refs.setBtn.onclick = () => showSettings(this);
    window.addEventListener("beforeunload", () => saveGame(this));

    // 开局：读档或新手卡包
    if (!loadGame(this)) {
      this.newGame();
    } else {
      if (this.state.phase === "night") this.app.classList.add("night");
    }
    // 卡包元素常驻：如被意外移除则补回
    setInterval(() => {
      if (this.state.paused || this.state.gameOver) return;
      const pk = this.state.piles.find(p => p.isPack);
      if (pk && !this.board.querySelector(".packobj")) renderPack(this, pk);
    }, 800);

    this.updateHUD();
    this.render();

    // 主循环
    setInterval(() => tick(this), TICK_MS);
  }

  newGame() {
    const s = this.boardSize();
    // 新手卡包（点击打开）
    const pack = makePile(this, s.w / 2 - 36, s.h / 2 - 45, []);
    pack.isPack = true;
    pack.el = null;
    renderPack(this, pack);
    pack._open = () => {
      if (pack._done) return;
      pack._done = true;
      const oldEl = this.board.querySelector(".packobj");
      if (oldEl) oldEl.remove();
      removePile(this, pack);
      const cards = [mk(this, "herder"), mk(this, "herder"), mk(this, "dog"), mk(this, "tree"), mk(this, "rock"), mk(this, "bush"), mk(this, "blueberry"), mk(this, "blueberry"), mk(this, "wood"), mk(this, "stone"), mk(this, "branch")];
      cards[0].fed = 3;
      cards[1].fed = 3; // 给新手牧民一点食物缓冲
      scatter(this, cards);
      this.render();
      this.updateHUD();
      this.toast("🎁 新手卡包已打开！拖牧民到资源上开始生产");
    };
    this.toast("👆 点击中间的新手卡包开始游戏");
  }
}
