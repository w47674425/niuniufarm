// 主控制器：装配各模块、驱动昼夜循环、开局与事件绑定（对齐资料库准绳版）

import { createState, makePile, removePile, mk, scatter } from './state.js';
import { render, updateHUD, toast, renderPack, bindTaskCheck } from './render.js';
import { bindDrag } from './drag.js';
import { tick, loadGame, saveGame, checkTasks } from './systems.js';
import { showShop, showTasks, showCodex, showRecipes, showCollection, showHelp, showSettings, toggleModal } from './modals.js';
import { bindToast } from './merge.js';
import { TICK_MS, SAVE_KEY, foodCapOf } from './config.js';
import * as audio from './audio.js';

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
    this.refs.speedBtn.onclick = () => {
      if (this.state.gameOver || this.state.paused) return;
      // 循环 1x → 2x → 4x → 1x
      this.state.speed = this.state.speed === 1 ? 2 : (this.state.speed === 2 ? 4 : 1);
      this.refs.speedBtn.textContent = this.state.speed === 1 ? "▶▶" : ("▶▶×" + this.state.speed);
      this.refs.speedBtn.classList.toggle("active", this.state.speed > 1);
      audio.play("ui.click");
    };
    // 暂停状态同步（pauseBtn/空格/后台切换共用）
    const syncPause = () => {
      this.refs.pauseBtn.textContent = this.state.paused ? "▶" : "⏸";
      const badge = this.refs.pauseBadge;
      if (badge) badge.classList.toggle("show", this.state.paused);
      audio.setPaused(this.state.paused);
    };
    this.refs.pauseBtn.onclick = () => {
      if (this.state.gameOver) return;
      this.state.paused = !this.state.paused;
      syncPause();
      audio.play("badge");
    };
    // 切到后台/切出标签页：自动暂停（回到前台不自动继续，防时间流逝）
    // 【暂时关闭 2026-08-20】切后台自动暂停：visibilitychange/blur 监听已停用
    // document.addEventListener("visibilitychange", () => {
    //   if (document.hidden && !this.state.paused && !this.state.gameOver) {
    //     this.state.paused = true;
    //     syncPause();
    //   }
    // });
    // window.addEventListener("blur", () => {
    //   if (!this.state.paused && !this.state.gameOver) {
    //     this.state.paused = true;
    //     syncPause();
    //   }
    // });
    this.refs.packBtn.onclick = () => { if (!this.state.gameOver) { audio.play("ui.click"); toggleModal(this, "shop", () => showShop(this)); } };
    this.refs.taskBtn.onclick = () => { if (!this.state.gameOver) { audio.play("ui.click"); toggleModal(this, "tasks", () => showTasks(this)); } };
    this.refs.codexBtn.onclick = () => { audio.play("ui.click"); toggleModal(this, "codex", () => showCodex(this)); };
    this.refs.recipeBtn.onclick = () => { audio.play("ui.click"); toggleModal(this, "recipes", () => showRecipes(this)); };
    this.refs.collectBtn.onclick = () => { audio.play("ui.click"); toggleModal(this, "collect", () => showCollection(this)); };
    this.refs.setBtn.onclick = () => { audio.play("ui.click"); toggleModal(this, "settings", () => showSettings(this)); };
    // 空格键：暂停/继续（输入框聚焦时不触发）
    window.addEventListener("keydown", (e) => {
      if (e.code !== "Space") return;
      const tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
      e.preventDefault();
      if (this.state.gameOver) return;
      this.refs.pauseBtn.click();
    });
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
      this.state.packOpened = true; // 卡包打开，倒计时启动
      const oldEl = this.board.querySelector(".packobj");
      if (oldEl) oldEl.remove();
      removePile(this, pack);
      const cards = [mk(this, "herder"), mk(this, "dog"), mk(this, "tree"), mk(this, "rock"), mk(this, "bush"), mk(this, "blueberry"), mk(this, "blueberry"), mk(this, "wood"), mk(this, "stone"), mk(this, "branch")];
      cards[0].fed = foodCapOf("herder");
      cards[1].fed = foodCapOf("dog");    // 牧羊犬满饱食开局
      scatter(this, cards);
      audio.play("ui.open");
      this.render();
      this.updateHUD();
      this.toast("🎁 新手卡包已打开！拖牧民到资源上开始生产");
    };
    this.toast("👆 点击中间的新手卡包开始游戏");
  }

  // 重置存档并原地重开（不刷新页面，避免 beforeunload 把旧存档写回）
  resetGame() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
    // 清空棋盘 DOM（卡片/进度条/弹窗/卡包）
    this.board.querySelectorAll(".card, .pileprog, .packobj, .overlay").forEach(el => el.remove());
    this.app.classList.remove("night");
    // 重建状态并重新开局
    this.state = createState();
    this._tickCount = 0;
    this.newGame();
    this.updateHUD();
    this.render();
    this.toast("🔄 已重置存档，开始新游戏");
  }
}
