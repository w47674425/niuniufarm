// 首页：品牌启动页（单主界面版，新世界观 2026-08-27）
// 职责：打开游戏即主菜单——品牌区 + 主 CTA（开始经营/继续经营）+ 护照/成就/设置入口
// 新世界观：单主界面无关卡；护照/成就只做入口占位（内容下次加）

import { loadMeta } from './systems.js';
import { showSettings } from './modals.js';
import { countType } from './state.js';
import { META } from './config.js';
import * as audio from './audio.js';

// 创建 overlay（全屏），挂到整个 app，并纳入弹窗单例管理
// zIndex：默认 2000；子面板（护照/成就/设置，从首页进入）传 2100 叠加在首页之上，
// 且不覆盖 game._openOv（首页记录），关闭子面板后仍停留首页（验收反馈⑬）
function makeOverlay(game, className, html, zIndex) {
  const ov = document.createElement('div');
  ov.className = 'overlay ' + className;
  ov.innerHTML = html;
  // 内联定位（优先级最高）：#app.bgimg > * 内容层规则会强制子元素 relative，必须用内联覆盖
  ov.style.position = 'absolute';
  ov.style.inset = '0';
  ov.style.zIndex = zIndex || '2000';
  game.app.appendChild(ov);   // 挂到 app：首页是主菜单，必须遮住整个屏幕
  // 首页在底下时：子面板不接管单例记录（首页保持冻结）；否则正常记录
  if (game._openOv && game._openModal === 'home') { /* 保留首页作为 _openOv */ }
  else game._openOv = ov;
  return ov;
}

function dismiss(game, ov) {
  if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  if (game._openOv === ov) { game._openOv = null; game._openModal = null; }
  else if (game._openModal === 'passport' || game._openModal === 'achievements') {
    game._openModal = 'home'; // 子面板关闭 → 回到首页（首页 overlay 仍是 _openOv，保持冻结）
  }
}

// ===================== 品牌首页 =====================
export function showHome(game) {
  const hasSave = !!localStorage.getItem('niuniu_ranch_save_v1');
  const mainLabel = hasSave ? '▶ 继续经营牧场' : '🚀 开始经营';

  const html =
    '<div class="home-inner">' +
      '<div class="home-cow">🐮</div>' +
      '<div class="home-title">牛牛农场</div>' +
      '<div class="home-sub">叠卡经营 · 养牛致富 · 环游世界</div>' +
      '<div class="home-row home-ctas">' +
        '<button class="home-main" id="homeMain">' + mainLabel + '</button>' +
      '</div>' +
      '<div class="home-row">' +
        '<button class="home-mini" id="homePass"><img src="img/ui_passport.png" alt="" />旅行护照</button>' +
        '<button class="home-mini" id="homeAch"><img src="img/ui_achievement.png" alt="" />成就</button>' +
        '<button class="home-mini" id="homeSet">⚙️ 设置</button>' +
      '</div>' +
      '<div class="home-foot">新世界观 · 试玩版</div>' +
    '</div>';

  const ov = makeOverlay(game, 'home-overlay', html);
  game._openModal = 'home';

  const close = () => dismiss(game, ov);
  document.getElementById('homeMain').onclick = () => {
    audio.play('ui.open');
    close();
    if (hasSave) game.continueGame();
    else game.newGame();
  };
  // 护照/成就/设置：叠加在首页之上（不关闭首页），关闭后仍停留首页（验收反馈⑬）
  document.getElementById('homePass').onclick = () => { audio.play('ui.click'); showPassport(game); };
  document.getElementById('homeAch').onclick = () => { audio.play('ui.click'); showAchievements(game); };
  document.getElementById('homeSet').onclick = () => { audio.play('ui.click'); showSettings(game, { attachApp: true }); };
  return ov;
}

// ===================== 旅行护照（飞机链打卡图收藏） =====================
export function showPassport(game) {
  // 打卡图收藏：场上拥有的 photo_* 卡（飞机+机票 产出）
  const photos = Object.keys(META).filter(t => t.startsWith("photo_"));
  const owned = photos.filter(t => countType(game, t) > 0);
  const photoHtml = photos.map(t => {
    const got = owned.includes(t);
    return '<div class="pp-card' + (got ? ' got' : '') + '">' +
      '<div class="pp-emoji">' + (got ? '<img src="img/' + t + '.png" alt="" />' : '🔒') + '</div>' +
      '<div class="pp-name">' + META[t].label.replace("打卡图", "") + '</div>' +
      '<div class="pp-lm">打卡图</div>' +
      '<div class="pp-st">' + (got ? '✅ 已盖章' : '🔒 未打卡') + '</div>' +
    '</div>';
  }).join("");
  const html =
    '<h2>📒 旅行护照</h2>' +
    '<p>造出飞机、带上机票，就能去世界各地打卡盖章！</p>' +
    '<div class="passport-grid">' + photoHtml + '</div>' +
    '<div class="passport-sum">已打卡 <b>' + owned.length + '</b>/' + photos.length + ' 站</div>' +
    '<button class="close">关闭</button>';
  const ov = makeOverlay(game, 'passport-overlay', '<div class="modal">' + html + '</div>', '2100');
  game._openModal = 'passport';
  ov.addEventListener('click', e => {
    if (e.target === ov || (e.target.closest && e.target.closest('.close'))) dismiss(game, ov);
  });
  return ov;
}

// ===================== 成就（入口占位，内容下次加） =====================
export function showAchievements(game) {
  const html =
    '<h2>🏆 成就</h2>' +
    '<p style="text-align:center;font-size:40px;margin:8px 0;">🎖️</p>' +
    '<p>经营牧场、饲养动物、造出飞机……成就系统制作中，敬请期待。</p>' +
    '<button class="close">关闭</button>';
  const ov = makeOverlay(game, 'ach-overlay', '<div class="modal">' + html + '</div>', '2100');
  game._openModal = 'achievements';
  ov.addEventListener('click', e => {
    if (e.target === ov || (e.target.closest && e.target.closest('.close'))) dismiss(game, ov);
  });
  return ov;
}
