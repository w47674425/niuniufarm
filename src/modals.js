// 弹窗层：卡包商店 / 任务 / 图鉴 / 合成图鉴 / 帮助 / 设置 / 游戏结束

import { META, PACKS, TASKS, RECIPES, foodCapOf } from './config.js';
import { rand } from './utils.js';
import { mk, makePile } from './state.js';
import { render, updateHUD, toast } from './render.js';
import { buyPack } from './systems.js';

function closeModal(game, ov) {
  if (ov && ov.parentNode) { ov.parentNode.removeChild(ov); }
  // 同步清理单例弹窗记录（若关闭的是当前打开的弹窗）
  if (game && game._openOv === ov) { game._openOv = null; game._openModal = null; }
}

// 底部按钮 toggle：点同一按钮第二次关闭，点不同按钮先关旧弹窗
export function toggleModal(game, type, opener) {
  if (game._openModal === type && game._openOv) { closeModal(game, game._openOv); return; }
  if (game._openOv) closeModal(game, game._openOv);
  game._openModal = type;
  game._openOv = opener();
  // 防御：opener 必须返回 overlay，否则单例记录失效会重复弹窗
  if (!game._openOv) { game._openModal = null; console.warn("toggleModal: opener 未返回 overlay，type=" + type); }
}

// 通用弹窗：点背景或 .close 关闭（click + pointerup 双绑定，兼容触屏/WebView）
function openModal(game, html, opts) {
  opts = opts || {};
  const ov = document.createElement("div");
  ov.className = "overlay"; ov.id = "modalOverlay";
  ov.innerHTML = '<div class="modal">' + html + '</div>';
  game.board.appendChild(ov);
  function tryClose(e) {
    const onBackdrop = (opts.dismissBackdrop !== false && e.target === ov);
    const onCloseBtn = !!(e.target.closest && e.target.closest(".close"));
    if (onBackdrop || onCloseBtn) closeModal(game, ov);
  }
  ov.addEventListener("click", tryClose);
  ov.addEventListener("pointerup", tryClose);
  return ov;
}

// 卡包商店
export function showShop(game) {
  let html = '<h2>🎁 卡包商店</h2><p>用金币购买卡包，解锁新卡牌与配方。</p>';
  PACKS.forEach(pk => {
    html += '<div class="shop-item"><div class="si-emoji">' + pk.emoji + '</div>' +
      '<div class="si-info"><div class="si-name">' + pk.name + '</div>' +
      '<div class="si-desc">' + pk.desc + '</div></div>' +
      '<button class="si-buy" data-pack="' + pk.id + '">¥' + pk.price + '</button></div>';
  });
  const ov = openModal(game, html);
  ov.querySelectorAll(".si-buy").forEach(b => {
    b.onclick = function () {
      const pk = PACKS.find(p => p.id === b.getAttribute("data-pack"));
      buyPack(game, pk);
    };
  });
  return ov;
}

// 任务列表
export function showTasks(game) {
  let html = '<h2>📜 任务</h2>';
  TASKS.forEach(t => {
    const done = !!game.state.tasksDone[t.id];
    html += '<div class="task-item' + (done ? " done" : "") + '"><div class="t-check">' + (done ? "✓" : "") + '</div>' +
      '<div class="t-name">' + t.name + '</div><div class="t-rew">+¥' + t.rew + '</div></div>';
  });
  html += '<button class="close" id="taskClose">关闭</button>';
  const ov = openModal(game, html);
  document.getElementById("taskClose").onclick = function () { closeModal(game, ov); };
  return ov;
}

// 卡牌图鉴
export function showCodex(game) {
  let html = '<h2>📖 卡牌图鉴</h2><p>已发现 ' + Object.keys(game.state.seenCards).length + ' / ' + Object.keys(META).length + ' 种</p><div class="codex-grid">';
  Object.keys(META).forEach(t => {
    const seen = !!game.state.seenCards[t];
    const m = META[t];
    html += '<div class="codex-cell' + (seen ? "" : " locked") + '"><div class="cc-emoji">' + (seen ? m.emoji : "❓") + '</div>' +
      '<div class="cc-name">' + (seen ? m.label : "未解锁") + '</div></div>';
  });
  html += '</div><button class="close" id="codexClose">关闭</button>';
  const ov = openModal(game, html);
  document.getElementById("codexClose").onclick = function () { closeModal(game, ov); };
  return ov;
}

// 合成图鉴：按类别分组展示所有配方（输入 → 输出）
const RECIPE_GROUPS = [
  { key: "eat", label: "🍽 食用" },
  { key: "potion", label: "🧪 药水" },
  { key: "equip", label: "🛡️ 装备" },
  { key: "build", label: "🏗️ 建造" },
  { key: "craft", label: "🛠️ 制作" },
  { key: "smelt", label: "⚙️ 冶炼" },
  { key: "cook", label: "🍳 烹饪" },
  { key: "slaughter", label: "🔪 宰杀" },
  { key: "breed", label: "👶 繁殖" },
  { key: "train", label: "🐕 训练" },
  { key: "produce", label: "🌾 采集/生产" }
];
function fmtCards(cards, n) {
  const parts = [];
  Object.keys(cards).forEach(k => { parts.push(META[k].emoji + " " + META[k].label + "×" + cards[k]); });
  return parts.join(" + ");
}
function fmtOut(out) {
  return out.map(o => META[o.type].emoji + " " + META[o.type].label + "×" + o.n).join(" + ") || "无";
}
export function showRecipes(game) {
  let html = '<h2>⚗️ 合成图鉴</h2><p>把输入卡拖到牧民上合成；采集/生产/制作产物会掉落在旁边。</p>';
  RECIPE_GROUPS.forEach(g => {
    const list = RECIPES.filter(r => r.kind === g.key);
    if (list.length === 0) return;
    html += '<h3>' + g.label + '</h3><div class="recipe-list">';
    list.forEach(r => {
      html += '<div class="recipe-item"><div class="ri-in">' + fmtCards(r.in, 1) + '</div>' +
        '<div class="ri-arrow">→</div><div class="ri-out">' + fmtOut(r.out) + '</div>' +
        '<div class="ri-sec">' + r.sec + 's</div></div>';
    });
    html += '</div>';
  });
  html += '<button class="close" id="recipeClose">关闭</button>';
  const ov = openModal(game, html);
  document.getElementById("recipeClose").onclick = function () { closeModal(game, ov); };
  return ov;
}

// 帮助 / 玩法说明
export function showHelp(game) {
  const ov = openModal(game,
    '<h2>🐮 牛牛牧场 · 玩法</h2>' +
    '<p><b>核心</b>：把卡牌拖到一起"堆叠万物"，触发生产/建造/繁殖/战斗。</p>' +
    '<p><b>怎么拖</b></p><ul>' +
    '<li>按住<b>最底</b>一张 → 整堆一起挪。</li>' +
    '<li>按住<b>中间</b>一张 → 只带走它和上面的。</li>' +
    '<li>按住<b>最顶</b>一张 → 只拆出那张。</li></ul>' +
    '<p><b>生产</b>：把 🧑‍🌾牧民 拖到 🌳树木/⛰️岩石/🌿蓝莓丛/🗻铁矿脉/💎金矿脉/🌱药田 上 → 自动产出资源（进度条）。</p>' +
    '<p><b>喂食</b>：把 🫐蓝莓/🍞面包/🍖烤肉/🥗拼盘 拖到 🧑‍🌾牧民 或 🐕牧羊犬 上喂饱（每天每单位消耗 1 餐，否则饿死）。</p>' +
    '<p><b>自动进食</b>：每天结算时，饱食不足的单位会自动吃 1 个自己偏好的食物——🧑‍🌾牧民吃 🫐蓝莓，🐕牧羊犬吃 🥩生肉；场上没有对应食物才会饿死。</p>' +
    '<p><b>饱食上限</b>：各单位上限不同（牧民 10、牧羊犬 8），喂食/进食都受各自上限约束。</p>' +
    '<p><b>建造</b>：把 2🪵+1🪨 堆到牧民上 → 🏠房屋（可繁殖）；3🪨 → 🧱城墙；更多建筑见卡牌图鉴。</p>' +
    '<p><b>制作/冶炼/烹饪</b>：牧民+材料 可造 🗡️木剑/🛡️盾/⚒️工具（产物掉落在旁边，需手动拖到牧民身上装备）；建 🔥冶炼厂 后炼铁锭；建 🍳厨房 后烤肉做面包。全部配方见「⚗️合成」。</p>' +
    '<p><b>繁殖</b>：🏠房屋 + 2🧑‍🌾牧民 同堆 → 自动生出小牧民（房屋冷却 120 秒）。</p>' +
    '<p><b>战斗</b>：🌙夜晚刷 🥷小偷/👹大盗，会自动扑向牧民；把 🐕牧羊犬/牧民 拖到怪物上迎战，击杀掉落金币。</p>' +
    '<p><b>赚钱</b>：把可卖的卡（🪵🪨⚙️…）拖到 🏪市场 换金币，再去 🎁卡包 抽新卡。</p>' +
    '<p>进度自动存档，关掉也能离线攒钱。</p>' +
    '<button class="close" id="helpClose">知道啦</button>');
  document.getElementById("helpClose").onclick = function () { closeModal(game, ov); };
  return ov;
}

// 设置
export function showSettings(game) {
  const ov = openModal(game,
    '<h2>⚙️ 设置</h2>' +
    '<p>当前进度已自动保存。</p>' +
    '<div class="row">' +
    '<button class="btn alt" id="resetBtn">🗑 重置存档</button>' +
    '<button class="close" id="closeSet">关闭</button>' +
    '</div>');
  document.getElementById("resetBtn").onclick = function () { game.resetGame(); };
  document.getElementById("closeSet").onclick = function () { closeModal(game, ov); };
  return ov;
}

// 游戏结束（全员饿死）
export function endGame(game) {
  game.state.gameOver = true;
  const ov = document.createElement("div");
  ov.className = "overlay"; ov.id = "overOverlay";
  ov.innerHTML =
    '<div class="modal adbox">' +
    '<h2>🪦 牧场荒废了</h2>' +
    '<p>所有牧民都饿死啦！</p>' +
    '<p style="color:#2e86de;font-weight:800;">看广告可复活 2 名牧民（附赠食物）</p>' +
    '<div class="row">' +
    '<button class="btn gold" id="adBtn">📺 看广告复活</button>' +
    '<button class="btn alt" id="restartBtn">🔄 重新开始</button>' +
    '</div></div>';
  game.board.appendChild(ov);
  document.getElementById("adBtn").onclick = function () {
    const box = ov.querySelector(".modal");
    box.innerHTML = '<h2>📺 广告播放中…</h2><div class="spinner"></div><p>复活牧民，请稍候</p>';
    setTimeout(function () {
      const s = game.boardSize();
      const h1 = mk(game, "herder"), h2 = mk(game, "herder");
      h1.fed = foodCapOf("herder"); h2.fed = foodCapOf("herder"); // 复活即满饱食，避免立刻饿死
      makePile(game, rand(40, s.w - 140), rand(40, s.h - 200), [h1, h2, mk(game, "bread")]);
      game.state.gameOver = false;
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      render(game); updateHUD(game);
    }, 1600);
  };
  document.getElementById("restartBtn").onclick = function () { game.resetGame(); };
}
