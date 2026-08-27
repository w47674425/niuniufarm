// 主控制器：装配各模块、驱动昼夜循环、开局与事件绑定（对齐资料库准绳版）

import { createState, makePile, removePile, mk, scatter } from './state.js';
import { render, updateHUD, toast, renderPack, bindTaskCheck } from './render.js';
import { bindDrag } from './drag.js';
import { tick, loadGame, saveGame, checkTasks, loadDestGame, deleteDestSave, loadMeta, saveMeta } from './systems.js';
import { showShop, showTasks, showCodexBook, showHelp, showSettings, toggleModal, showChapterSelect, showLandmarkBuild } from './modals.js';
import { startTutorial, maybeShowFirstLaunch } from './tutorial.js';
import { showHome } from './home.js';
import { bindToast } from './merge.js';
import { TICK_MS, SAVE_KEY, SAVE_DEST_PREFIX, foodCapOf, DESTINATIONS, destById, TICKET } from './config.js';
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
    this.refs.codexBtn.onclick = () => { audio.play("ui.click"); toggleModal(this, "codex", () => showCodexBook(this, "codex")); };
    this.refs.setBtn.onclick = () => { audio.play("ui.click"); toggleModal(this, "settings", () => showSettings(this)); };
    // 旅行/章节选择按钮
    if (this.refs.travelBtn) {
      this.refs.travelBtn.onclick = () => { audio.play("ui.click"); toggleModal(this, "travel", () => showChapterSelect(this)); };
    }
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

    // 开局：优先加载上次目的地的独立存档，否则进入章节选择
    const meta = loadMeta();
    let loaded = false;
    if (meta.lastDest && localStorage.getItem(SAVE_DEST_PREFIX + meta.lastDest)) {
      loaded = loadDestGame(this, meta.lastDest);
      if (loaded && this.state.phase === "night") this.app.classList.add("night");
    }
    if (!loaded && localStorage.getItem(SAVE_KEY)) {
      // 兼容旧版单存档
      loaded = loadGame(this);
      if (loaded && this.state.phase === "night") this.app.classList.add("night");
    }
    // 首页：打开游戏总是先到品牌首页（主菜单）；无存档首次启动叠加教程引导
    showHome(this);
    if (!loaded) maybeShowFirstLaunch(this);
    // 注意：有存档时棋盘已恢复在首页背后，点「继续旅程」→ continueDestination 重新加载
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
      const cards = [mk(this, "herder"), mk(this, "tree"), mk(this, "rock"), mk(this, "bush"), mk(this, "blueberry"), mk(this, "blueberry"), mk(this, "wood"), mk(this, "stone"), mk(this, "branch")];
      cards[0].fed = foodCapOf("herder");
      scatter(this, cards);
      audio.play("ui.open");
      this.render();
      this.updateHUD();
      this.toast("🎁 新手卡包已打开！拖牧民到资源上开始生产");
    };
    this.toast("👆 点击中间的新手卡包开始游戏");
  }

  // 重置存档：清当前目的地存档 → 回到章节选择
  resetGame() {
    const destId = this.state.destId;
    if (destId) {
      deleteDestSave(destId);
    } else {
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
    }
    this.board.querySelectorAll(".card, .pileprog, .packobj, .overlay").forEach(el => el.remove());
    this.app.classList.remove("night");
    this.state = createState();
    this._tickCount = 0;
    this.updateHUD();
    this.render();
    showChapterSelect(this);
    this.toast("🔄 已重置，选择新的目的地出发");
  }

  // 开始一个新目的地旅程
  startDestination(destId) {
    const dest = destById(destId);
    if (!dest) return;
    // 清空棋盘
    this.board.querySelectorAll(".card, .pileprog, .packobj, .overlay").forEach(el => el.remove());
    this.app.classList.remove("night");
    // 重建状态
    this.state = createState();
    this.state.destId = destId;
    this.state.gold = dest.startTickets;
    this.state.packOpened = true; // 跳过新手卡包，直接开始
    this._tickCount = 0;
    // 发放初始卡牌（通用打工引擎）
    const cards = [
      mk(this, "herder"), mk(this, "tree"), mk(this, "rock"),
      mk(this, "bush"), mk(this, "blueberry"), mk(this, "blueberry"),
      mk(this, "wood"), mk(this, "stone"), mk(this, "branch")
    ];
    cards[0].fed = foodCapOf("herder");
    // 发放目的地专属 starter 卡
    dest.starter.forEach(t => cards.push(mk(this, t)));
    // 发放工地卡（地标建造入口）
    cards.push(mk(this, dest.siteType));
    scatter(this, cards);
    // 更新 meta
    const meta = loadMeta();
    meta.lastDest = destId;
    saveMeta(meta);
    this.updateHUD();
    this.render();
    this.toast("🧳 出发！" + dest.emoji + " " + dest.name + " · 攒" + TICKET + "建" + dest.landmark.emoji + dest.landmark.name);
    saveGame(this);
  }

  // 继续一个目的地的存档
  continueDestination(destId) {
    this.board.querySelectorAll(".card, .pileprog, .packobj, .overlay").forEach(el => el.remove());
    this.app.classList.remove("night");
    this.state = createState();
    this._tickCount = 0;
    if (loadDestGame(this, destId)) {
      if (this.state.phase === "night") this.app.classList.add("night");
      const meta = loadMeta();
      meta.lastDest = destId;
      saveMeta(meta);
      this.updateHUD();
      this.render();
      const dest = destById(destId);
      this.toast("📍 继续旅程：" + (dest ? dest.name : destId));
    } else {
      // 存档损坏 → 重新开始
      this.startDestination(destId);
    }
  }
}
