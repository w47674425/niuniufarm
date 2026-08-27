// 主控制器：装配各模块、驱动昼夜循环、开局与事件绑定（对齐资料库准绳版）

import { createState, makePile, removePile, mk, scatter, allCards } from './state.js';
import { render, updateHUD, toast, renderPack, bindTaskCheck } from './render.js';
import { bindDrag } from './drag.js';
import { tick, loadGame, saveGame, checkTasks, loadMeta } from './systems.js';
import { showShop, showTasks, showCodexBook, showHelp, showSettings, toggleModal } from './modals.js';
import { startTutorial, maybeShowFirstLaunch } from './tutorial.js';
import { showHome, showPassport } from './home.js';
import { bindToast } from './merge.js';
import { TICK_MS, SAVE_KEY, CARD_W, CARD_H, foodCapOf } from './config.js';
import { clamp } from './utils.js';
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
    // 底部「护照」按钮：旅行护照入口（内容占位）
    if (this.refs.travelBtn) {
      this.refs.travelBtn.onclick = () => { audio.play("ui.click"); toggleModal(this, "passport", () => showPassport(this)); };
    }
    // 复活按钮（市场旁，小按钮）：牧民死亡后出现；点击看广告复活 1 名牧民（验收反馈）
    const reviveBtn = document.createElement("button");
    reviveBtn.id = "reviveBtn";
    reviveBtn.className = "revive-btn";
    reviveBtn.title = "复活牧民";
    reviveBtn.innerHTML = "👼";
    reviveBtn.style.display = "none";
    this.marketEl.parentNode.appendChild(reviveBtn);   // 挂到 #board，与市场并列
    this._reviveBtn = reviveBtn;
    reviveBtn.onclick = () => {
      if (this.state.reviving || this.state.gameOver || (this.state.deadHerders || 0) <= 0) return;
      this.state.reviving = true;
      reviveBtn.disabled = true;
      reviveBtn.textContent = "📺";
      toast(this, "📺 看广告中…");
      setTimeout(() => {
        this.state.reviving = false;
        reviveBtn.disabled = false;
        reviveBtn.innerHTML = "👼";
        if ((this.state.deadHerders || 0) > 0) {
          this.state.deadHerders--;
          const h = mk(this, "herder");
          // 复活名字取场上空缺的牧民名（一一/二二）
          h.name = ["一一", "二二"].find(n => !allCards(this).some(c => c.type === "herder" && c.name === n)) || "";
          h.fed = foodCapOf("herder"); // 复活即满饱食
          const s = this.boardSize();
          const m = this.marketEl.getBoundingClientRect(), b = this.board.getBoundingClientRect();
          const mx = m.left - b.left, my = m.top - b.top;
          makePile(this, clamp(mx - CARD_W - 46, 8, s.w - CARD_W - 8), clamp(my, 8, s.h - CARD_H - 8), [h]);
          render(this); updateHUD(this);
          toast(this, "👼 牧民复活了！");
        }
        saveGame(this);
      }, 1600);
    };
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

    // 开局：单主界面——优先恢复单存档，否则新档；总是先到品牌首页（主菜单）
    let loaded = false;
    if (localStorage.getItem(SAVE_KEY)) {
      loaded = loadGame(this);
      if (loaded && this.state.phase === "night") this.app.classList.add("night");
    }
    // 首页：打开游戏总是先到品牌首页（主菜单）；无存档首次启动叠加教程引导
    showHome(this);
    if (!loaded) maybeShowFirstLaunch(this);
    // 注意：有存档时棋盘已恢复在首页背后，点「继续经营」→ continueGame 重新加载
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

  // 新手礼包（对齐策划「新手引导」表）：牧民2、边牧1、金币30、树木1、岩石1、蓝莓丛1、木头1、石头1
  newGame() {
    const s = this.boardSize();
    this.board.querySelectorAll(".card, .pileprog, .packobj, .overlay").forEach(el => el.remove());
    this.app.classList.remove("night");
    this.state = createState();
    this.state.gold = 30;
    this._tickCount = 0;
    // 新手卡包（点击打开）
    const pack = makePile(this, s.w / 2 - 48, s.h / 2 - 60, []);
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
      const cards = [
        mk(this, "herder"), mk(this, "herder"), mk(this, "border_collie"),
        mk(this, "tree"), mk(this, "rock"), mk(this, "bush"),
        mk(this, "wood"), mk(this, "stone")
      ];
      // 牧民命名（策划图鉴：牧民（一一）/牧民（二二））
      cards[0].name = "一一"; cards[1].name = "二二";
      cards[0].fed = foodCapOf("herder"); cards[1].fed = foodCapOf("herder");
      scatter(this, cards);
      audio.play("ui.open");
      this.render();
      this.updateHUD();
      this.toast("🎁 新手礼包已打开！拖牧民到资源上开始生产");
    };
    this.toast("👆 点击中间的新手礼包开始游戏");
    this.updateHUD();
    this.render();
    saveGame(this);
  }

  // 重置存档：清档 → 回首页主菜单
  resetGame() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
    this.board.querySelectorAll(".card, .pileprog, .packobj, .overlay").forEach(el => el.remove());
    this.app.classList.remove("night");
    this.state = createState();
    this._tickCount = 0;
    this.updateHUD();
    this.render();
    showHome(this);
    this.toast("🔄 已重置存档");
  }

  // 继续经营：恢复单存档（首页主 CTA 有存档时调用）
  continueGame() {
    this.board.querySelectorAll(".card, .pileprog, .packobj, .overlay").forEach(el => el.remove());
    this.app.classList.remove("night");
    this.state = createState();
    this._tickCount = 0;
    if (loadGame(this)) {
      if (this.state.phase === "night") this.app.classList.add("night");
      this.updateHUD();
      this.render();
      this.toast("📍 欢迎回来，继续经营牧场");
    } else {
      // 存档损坏 → 开新档
      this.newGame();
    }
  }
}
