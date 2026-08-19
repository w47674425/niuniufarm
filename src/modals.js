// 弹窗层：卡包商店 / 任务 / 图鉴 / 合成图鉴 / 帮助 / 设置 / 游戏结束

import { META, PACKS, TASKS, RECIPES, foodCapOf } from './config.js';
import { rand } from './utils.js';
import { mk, makePile } from './state.js';
import { render, updateHUD, toast } from './render.js';
import { buyPack } from './systems.js';
import * as audio from './audio.js';

function closeModal(game, ov) {
  if (ov && ov.parentNode) { ov.parentNode.removeChild(ov); audio.play("ui.close"); }
  // 同步清理单例弹窗记录（若关闭的是当前打开的弹窗）
  if (game && game._openOv === ov) { game._openOv = null; game._openModal = null; }
}

// 底部按钮 toggle：点同一按钮第二次关闭，点不同按钮先关旧弹窗
export function toggleModal(game, type, opener) {
  if (game._openModal === type && game._openOv) { closeModal(game, game._openOv); return; }
  if (game._openOv) closeModal(game, game._openOv);
  audio.play("ui.open");
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
  const gets = game.state.cardGets || {};
  let html = '<h2>📖 卡牌图鉴</h2><p>已发现 ' + Object.keys(game.state.seenCards).length + ' / ' + Object.keys(META).length + ' 种</p><div class="codex-grid">';
  Object.keys(META).forEach(t => {
    const seen = !!game.state.seenCards[t];
    const m = META[t];
    const n = gets[t] || 0;
    html += '<div class="codex-cell' + (seen ? "" : " locked") + '">' +
      (n > 0 ? '<span class="cc-count">×' + n + '</span>' : '') +
      '<div class="cc-emoji">' + (seen ? m.emoji : "❓") + '</div>' +
      '<div class="cc-name">' + (seen ? m.label : "未解锁") + '</div></div>';
  });
  html += '</div><button class="close" id="codexClose">关闭</button>';
  const ov = openModal(game, html);
  document.getElementById("codexClose").onclick = function () { closeModal(game, ov); };
  return ov;
}

// 合成图鉴：按类别分组展示所有配方（输入 → 输出）
const RECIPE_GROUPS = [
  { key: "produce", label: "🌾 采集/生产" },
  { key: "eat", label: "🍽 食用" },
  { key: "potion", label: "🧪 药水" },
  { key: "craft", label: "🛠️ 制作" },
  { key: "equip", label: "🛡️ 装备" },
  { key: "cook", label: "🍳 烹饪" },
  { key: "build", label: "🏗️ 建造" },
  { key: "smelt", label: "⚙️ 冶炼" },
  { key: "slaughter", label: "🔪 宰杀" },
  { key: "breed", label: "👶 繁殖" },
  { key: "train", label: "🐕 训练" }
];
// 产出物 → 产出它的配方 id（用于「点击跳转到合成配方」）
// 同一产出物可能有多个来源（如生肉=猪/牛），取第一个；跳转目标始终存在
const OUT_MAKER = {};
RECIPES.forEach(r => {
  r.out.forEach(o => { if (!OUT_MAKER[o.type]) OUT_MAKER[o.type] = r.id; });
});

function fmtCards(cards) {
  const parts = [];
  Object.keys(cards).forEach(k => {
    const maker = OUT_MAKER[k]; // 该输入卡是否可由其他配方合成
    if (maker) {
      // 可合成的输入 → 链接，点击滚动到对应配方并高亮
      parts.push('<a class="ri-link" data-maker="' + maker + '">' + META[k].emoji + " " + META[k].label + "×" + cards[k] + '</a>');
    } else {
      parts.push(META[k].emoji + " " + META[k].label + "×" + cards[k]);
    }
  });
  return parts.join(" + ");
}
function fmtOut(out) {
  return out.map(o => META[o.type].emoji + " " + META[o.type].label + "×" + o.n).join(" + ") || "无";
}
// 配方难度评分（升序=易→难）：
//   前置建筑 +20 ｜ 输入卡种类数 ×5 ｜ 冗余材料(超出种类的张数) ×2 ｜ 耗时 sec/10（上限 +3）
// 输入含牧民视为基础操作不增加难度；产出价值不影响难度
function recipeDifficulty(r) {
  const kinds = Object.keys(r.in).length;
  const total = Object.values(r.in).reduce((a, b) => a + b, 0);
  let d = (r.need ? 20 : 0) + (kinds - 1) * 5 + Math.max(0, total - kinds) * 2 + Math.min(r.sec / 10, 3);
  // 繁殖/训练需要建筑在场（房屋/兵营），按前置建筑对待
  if (r.kind === "breed" || r.kind === "train") d += 20;
  return d;
}
export function showRecipes(game) {
  let html = '<h2>⚗️ 合成图鉴</h2><p>把输入卡拖到牧民上合成；采集/生产/制作产物会掉落在旁边。<br><span style="font-size:12px;color:#7a715c;">已按难易排序：越靠前越容易。绿色下划线材料可点击跳到它的配方。</span></p>';
  RECIPE_GROUPS.forEach(g => {
    const list = RECIPES.filter(r => r.kind === g.key)
      .sort((a, b) => recipeDifficulty(a) - recipeDifficulty(b));
    if (list.length === 0) return;
    html += '<h3>' + g.label + '</h3><div class="recipe-list">';
    list.forEach(r => {
      html += '<div class="recipe-item" id="ri-' + r.id + '"><div class="ri-out">' + fmtOut(r.out) + '</div>' +
        '<div class="ri-arrow">←</div><div class="ri-in">' + fmtCards(r.in) + '</div>' +
        '<div class="ri-sec">' + r.sec + 's</div></div>';
    });
    html += '</div>';
  });
  html += '<button class="close" id="recipeClose">关闭</button>';
  const ov = openModal(game, html);
  // 跳转：点击可合成材料 → 滚动到产出它的配方行并高亮闪烁
  ov.querySelectorAll(".ri-link").forEach(a => {
    a.onclick = function (e) {
      e.preventDefault(); e.stopPropagation();
      const maker = a.getAttribute("data-maker");
      const row = ov.querySelector("#ri-" + maker);
      if (!row) return;
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.classList.remove("flash");
      void row.offsetWidth; // 重触发动画
      row.classList.add("flash");
    };
  });
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
    '<p><b>自动进食</b>：每天结算时，饱食不足的单位会自动吃 1 个自己偏好的食物——🧑‍🌾牧民吃 🫐蓝莓，🐕牧羊犬吃 🥩生肉；没有偏好食物会吃任意食物，全都没有才饿死。</p>' +
    '<p><b>饱食上限</b>：各单位上限不同（牧民 10、牧羊犬 8），喂食/进食都受各自上限约束。</p>' +
    '<p><b>建造</b>：把 2🪵+1🪨 堆到牧民上 → 🏠房屋（可繁殖）；3🪨 → 🧱城墙；更多建筑见卡牌图鉴。</p>' +
    '<p><b>制作/冶炼/烹饪</b>：牧民+材料 可造 🗡️木剑/🛡️盾/⚒️工具（产物掉落在旁边，需手动拖到 🐕牧羊犬 身上装备）；建 🔥冶炼厂 后炼铁锭；建 🍳厨房 后烤肉做面包。全部配方见「⚗️合成」。</p>' +
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
  const a = audio.getAudioSettings();
  const volPct = Math.round((a.master || 0) * 100);
  const sfxChecked = a.sfxOn ? "checked" : "";
  const musicChecked = a.musicOn ? "checked" : "";
  const ov = openModal(game,
    '<h2>⚙️ 设置</h2>' +
    '<p>当前进度已自动保存。</p>' +
    '<div class="set-block">' +
    '<div class="set-row"><span class="set-label">🔊 音量</span>' +
    '<input type="range" id="volRange" min="0" max="100" value="' + volPct + '" class="set-range" />' +
    '<span class="set-val" id="volVal">' + volPct + '%</span></div>' +
    '<div class="set-row"><span class="set-label">🎵 音效</span>' +
    '<label class="set-toggle"><input type="checkbox" id="sfxToggle" ' + sfxChecked + ' /><span class="set-slider"></span></label></div>' +
    '<div class="set-row"><span class="set-label">🎼 背景音乐</span>' +
    '<label class="set-toggle"><input type="checkbox" id="musicToggle" ' + musicChecked + ' /><span class="set-slider"></span></label></div>' +
    '</div>' +
    '<div class="row">' +
    '<button class="btn alt" id="testGoldBtn">💰 测试 +1000</button>' +
    '<button class="btn alt" id="resetBtn">🗑 重置存档</button>' +
    '<button class="close" id="closeSet">关闭</button>' +
    '</div>');
  // 主音量滑杆
  const volRange = document.getElementById("volRange");
  const volVal = document.getElementById("volVal");
  volRange.oninput = function () {
    const v = parseInt(this.value, 10) / 100;
    volVal.textContent = Math.round(v * 100) + "%";
    audio.setMasterVolume(v);
  };
  // 音效开关
  document.getElementById("sfxToggle").onchange = function () { audio.setSfxOn(this.checked); };
  // 音乐开关
  document.getElementById("musicToggle").onchange = function () { audio.setMusicOn(this.checked); };
  // 测试按钮：+1000 金币（仅开发/测试用）
  document.getElementById("testGoldBtn").onclick = function () {
    if (game.state.gameOver) return;
    game.state.gold += 1000;
    game.state.stats.gold = game.state.gold;
    updateHUD(game);
    audio.play("money.sell");
    toast(game, "💰 测试金币 +1000（现有 ¥" + game.state.gold + "）");
  };
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
