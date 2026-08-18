// 主控制器：装配各模块、驱动计时与日循环、暴露共享方法
// 各系统函数都以 game 作为上下文传入，game 持有 refs / state / board 与辅助方法

import { createState, makePile, allCards, removeCardObj } from './state.js';
import { DAY_LEN } from './config.js';
import { isCattle } from './merge.js';
import { render, updateHUD, toast } from './render.js';
import { bindDrag } from './drag.js';
import { showDayEndModal, endGame, showHelp } from './modals.js';
import { processPastures, renderPackRow } from './systems.js';

export class Game {
  constructor(refs) {
    this.refs = refs;
    this.board = refs.board;
    this.marketEl = refs.market;
    this.toastEl = refs.toast;
    this.state = createState();
  }

  boardSize() { return { w: this.board.clientWidth, h: this.board.clientHeight }; }
  toast(msg) { toast(this, msg); }
  render() { render(this); }
  updateHUD() { updateHUD(this); }

  start() {
    renderPackRow(this);
    bindDrag(this);

    this.refs.pauseBtn.onclick = () => {
      if (this.state.gameOver) return;
      this.state.paused = !this.state.paused;
      this.refs.pauseBtn.textContent = this.state.paused ? "▶ 继续" : "⏸ 暂停";
    };
    this.refs.helpBtn.onclick = () => showHelp(this);

    // 开局：画面中央放置新手卡包（点击打开）
    const s = this.boardSize();
    const pack = makePile(this, s.w / 2 - 42, s.h / 2 - 52, []);
    pack.isPack = true; pack.packKind = "beginner";
    this.updateHUD(); this.render();

    // 计时循环
    this.timerId = setInterval(() => this.tick(), 1000);
  }

  tick() {
    if (this.state.paused || this.state.gameOver || this.state.busy) return;
    this.state.timeLeft--;
    if (this.state.timeLeft <= 0) {
      this.state.timeLeft = 0; this.updateHUD(); showDayEndModal(this); return;
    }
    this.updateHUD();
  }

  // 进入下一天：牧场自动喂食 → 员工吃汉堡/饿死 → 牛进食清零 → 检查全员阵亡
  runDayEnd() {
    processPastures(this);

    const emps = allCards(this).filter(c => c.type === "employee");
    emps.forEach(emp => {
      let burger = null;
      for (let i = 0; i < this.state.piles.length && !burger; i++) {
        for (let j = 0; j < this.state.piles[i].cards.length; j++) {
          if (this.state.piles[i].cards[j].type === "burger") { burger = this.state.piles[i].cards[j]; break; }
        }
      }
      if (burger) removeCardObj(this, burger); else removeCardObj(this, emp);
    });

    // 牛的今日进食清零
    allCards(this).forEach(c => { if (isCattle(c.type)) c.fedToday = 0; });

    const left = allCards(this).filter(c => c.type === "employee").length;
    this.state.day++; this.state.timeLeft = DAY_LEN; this.state.paused = false;
    if (left === 0) endGame(this);
    else { this.render(); this.updateHUD(); }
  }
}
