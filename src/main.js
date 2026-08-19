// 入口：挂载 DOM 引用、创建游戏并启动
import './styles.css';
import { Game } from './game.js';

const refs = {
  app: document.getElementById('app'),
  board: document.getElementById('board'),
  market: document.getElementById('market'),
  toast: document.getElementById('toast'),
  dayStat: document.getElementById('dayStat'),
  phaseTag: document.getElementById('phaseTag'),
  timer: document.getElementById('timer'),
  goldStat: document.getElementById('goldStat'),
  popStat: document.getElementById('popStat'),
  foodStat: document.getElementById('foodStat'),
  pauseBtn: document.getElementById('pauseBtn'),
  packBtn: document.getElementById('packBtn'),
  taskBtn: document.getElementById('taskBtn'),
  codexBtn: document.getElementById('codexBtn'),
  helpBtn: document.getElementById('helpBtn'),
  setBtn: document.getElementById('setBtn')
};

const game = new Game(refs);
game.start();
