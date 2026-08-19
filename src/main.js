// 入口：挂载 DOM 引用、创建游戏并启动
import './styles.css';
import { Game } from './game.js';
import * as audio from './audio.js';

// 音频 autoplay 合规：任意首次手势（点击/拖拽/按键）后解禁 AudioContext
function unlockAudio() {
  audio.init();
  window.removeEventListener("pointerdown", unlockAudio);
  window.removeEventListener("keydown", unlockAudio);
}
window.addEventListener("pointerdown", unlockAudio);
window.addEventListener("keydown", unlockAudio);

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
  pauseBadge: document.getElementById('pauseBadge'),
  packBtn: document.getElementById('packBtn'),
  taskBtn: document.getElementById('taskBtn'),
  codexBtn: document.getElementById('codexBtn'),
  recipeBtn: document.getElementById('recipeBtn'),
  helpBtn: document.getElementById('helpBtn'),
  setBtn: document.getElementById('setBtn')
};

const game = new Game(refs);
game.start();
