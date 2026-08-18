// 入口：挂载 DOM 引用、创建游戏并启动
import './styles.css';
import { Game } from './game.js';

const refs = {
  board: document.getElementById('board'),
  market: document.getElementById('market'),
  toast: document.getElementById('toast'),
  dayStat: document.getElementById('dayStat'),
  timer: document.getElementById('timer'),
  cashStat: document.getElementById('cashStat'),
  bankStat: document.getElementById('bankStat'),
  packRow: document.getElementById('packRow'),
  pauseBtn: document.getElementById('pauseBtn'),
  helpBtn: document.getElementById('helpBtn')
};

const game = new Game(refs);
game.start();
