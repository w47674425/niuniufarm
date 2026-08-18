// 弹窗层：每日结算 / 游戏结束 / 帮助（原单文件中的相关区块）

import { META } from './config.js';
import { rand } from './utils.js';
import { mk, makePile } from './state.js';
import { render, updateHUD, toast } from './render.js';

// 每日结算弹窗（暂停计时，点「开始下一天」触发 game.runDayEnd）
export function showDayEndModal(game) {
  game.state.paused = true;
  const ov = document.createElement("div");
  ov.className = "overlay"; ov.id = "dayOverlay";
  ov.innerHTML =
    '<div class="modal">' +
    '<h2>🌙 第 ' + game.state.day + ' 天已结束</h2>' +
    '<p>员工会自动在农场里找 1 个汉堡吃掉；没找到汉堡的员工会饿死。</p>' +
    '<p>牛今天吃的草料会清零，明天可以再吃。</p>' +
    '<div class="row"><button class="btn" id="nextDayBtn">▶ 开始第 ' + (game.state.day + 1) + ' 天</button></div>' +
    '</div>';
  game.board.appendChild(ov);
  document.getElementById("nextDayBtn").onclick = function () {
    if (ov.parentNode) ov.parentNode.removeChild(ov);
    game.runDayEnd();
  };
}

// 游戏结束（全员阵亡）
export function endGame(game) {
  game.state.gameOver = true;
  const ov = document.createElement("div");
  ov.className = "overlay"; ov.id = "overOverlay";
  ov.innerHTML =
    '<div class="modal adbox">' +
    '<h2>🪦 本轮结束</h2>' +
    '<p>所有员工都饿死啦！</p>' +
    '<p style="color:#2e86de;font-weight:800;">看广告可复活 1 名员工（附赠 1 汉堡）</p>' +
    '<div class="row">' +
    '<button class="btn" id="adBtn">📺 看广告复活</button>' +
    '<button class="btn alt" id="restartBtn">🔄 重新开始</button>' +
    '</div></div>';
  game.board.appendChild(ov);
  document.getElementById("adBtn").onclick = function () {
    const box = ov.querySelector(".modal");
    box.innerHTML = '<h2>📺 广告播放中…</h2><div class="spinner"></div><p>复活 1 名员工，请稍候</p>';
    setTimeout(function () {
      const s = game.boardSize();
      makePile(game, rand(40, s.w - 120), rand(40, s.h - 180), [mk(game, "employee"), mk(game, "burger")]);
      game.state.gameOver = false;
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      render(game); updateHUD(game);
      toast(game, "员工已复活，记得留汉堡！");
    }, 1600);
  };
  document.getElementById("restartBtn").onclick = function () { location.reload(); };
}

// 帮助 / 玩法说明
export function showHelp(game) {
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML =
    '<div class="modal">' +
    '<h2>🐮 牛牛农场 · 玩法</h2>' +
    '<p><b>目标</b>：赚钱抽卡包 → 雇员工 → 养牛卖牛，经营农场。</p>' +
    '<p><b>怎么拿/拖</b></p>' +
    '<ul>' +
    '<li>按住<b>最底下</b>一张 → 整堆一起挪动。</li>' +
    '<li>按住<b>中间</b>一张 → 只带走这张和它上面的。</li>' +
    '<li>按住<b>最顶上</b>一张 → 只拆出那一张。</li>' +
    '</ul>' +
    '<p><b>产出（必须员工拖到卡上，2 秒进度条）</b></p>' +
    '<ul>' +
    '<li>👷员工 拖到 🌾草堆 → 3🍃草料（草堆消失）</li>' +
    '<li>👷员工 拖到 🪵树桩 → 3🪵木头（树桩消失）</li>' +
    '<li>👷员工 拖到 4🪵木头 → 1🚧围栏（木头消失）</li>' +
    '<li>👷员工 拖到 🚧围栏 → 1💳银行卡（<b>仅消耗1张围栏</b>，其余围栏与员工保留）</li>' +
    '</ul>' +
    '<p><b>喂牛（每只牛无论形态，每天最多吃 3 草料）</b></p>' +
    '<ul>' +
    '<li>🍃草料 拖到 🐮牛（单独牛）→ 牛吃草，每棵1秒，吃满3棵长一阶（反向不行）</li>' +
    '<li>🐮牛 拖到 🚧围栏 → 组成<b>牧场</b>；再往牧场里叠 🍃草料，每天<b>自动</b>消耗3草料喂牛长大（围栏不消失）</li>' +
    '<li>牛犊→少年→青年→壮年→中年→老年，阶段越高卖越贵</li>' +
    '</ul>' +
    '<p>卡包（均 ¥5）：招聘/牛牛(1牛犊)/建筑/食物/🌾草堆(2草堆)。每天结束弹窗提醒；员工自动吃1汉堡，没汉堡饿死。把牛拖到 🏪市场 卖钱。</p>' +
    '<button class="close" id="helpClose">知道啦</button>' +
    '</div>';
  game.board.appendChild(ov);
  document.getElementById("helpClose").onclick = function () { if (ov.parentNode) ov.parentNode.removeChild(ov); };
}
