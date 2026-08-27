// 首页：品牌启动页（方案 A，2026-08-27 用户选定）
// 职责：打开游戏即主菜单——品牌区 + 主 CTA（继续/开始）+ 目的地/护照/设置入口
// 设计要点（§首页设计）：认识（这是什么游戏）→ 决策（我该干嘛）→ 回顾（护照进度）
// 与现有系统关系：复用 loadMeta/章节选择/设置；不新增状态字段，纯 UI 层

import { DESTINATIONS, destById } from './config.js';
import { loadMeta } from './systems.js';
import { showChapterSelect, showSettings } from './modals.js';
import * as audio from './audio.js';

// 创建 overlay（全屏或弹窗），挂到整个 app（遮住 topbar/棋盘/底部栏），并纳入弹窗单例管理
function makeOverlay(game, className, html) {
  const ov = document.createElement('div');
  ov.className = 'overlay ' + className;
  ov.innerHTML = html;
  // 内联定位（优先级最高）：#app.bgimg > * 内容层规则会强制子元素 relative，必须用内联覆盖
  ov.style.position = 'absolute';
  ov.style.inset = '0';
  ov.style.zIndex = '2000';
  game.app.appendChild(ov);   // 挂到 app：首页/护照是主菜单，必须遮住整个屏幕
  game._openOv = ov;
  return ov;
}

function dismiss(game, ov) {
  if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  if (game._openOv === ov) { game._openOv = null; game._openModal = null; }
}

// ===================== 品牌首页 =====================
export function showHome(game) {
  const meta = loadMeta();
  const lastDest = meta.lastDest ? destById(meta.lastDest) : null;
  const hasSave = !!(lastDest && localStorage.getItem('niuniu_dest_' + lastDest.id));
  const stampedCount = DESTINATIONS.filter(d => meta.stamps[d.id]).length;

  const mainLabel = hasSave && lastDest
    ? '▶ 继续旅程 · ' + lastDest.emoji + ' ' + lastDest.name
    : '🚀 开始打工';

  const html =
    '<div class="home-inner">' +
      '<div class="home-cow">🐮</div>' +
      '<div class="home-title">牛牛农场</div>' +
      '<div class="home-sub">打工旅游 · 环游世界建地标</div>' +
      '<div class="home-map">' +
        DESTINATIONS.map(d => '<span class="hm-dot' + (meta.stamps[d.id] ? ' got' : '') + '" title="' + d.name + '">' + d.emoji + '</span>').join('') +
      '</div>' +
      '<div class="home-progress">📒 已达成 ' + stampedCount + '/' + DESTINATIONS.length + ' 站' +
      (hasSave && lastDest ? ' · 上次在 ' + lastDest.name : '') + '</div>' +
      '<button class="home-main" id="homeMain">' + mainLabel + '</button>' +
      '<div class="home-row">' +
        '<button class="home-mini" id="homeDest">🗺️ 选择目的地</button>' +
        '<button class="home-mini" id="homePass">📒 旅行护照</button>' +
        '<button class="home-mini" id="homeSet">⚙️ 设置</button>' +
      '</div>' +
      '<div class="home-foot">v0.3 · 试玩版</div>' +
    '</div>';

  const ov = makeOverlay(game, 'home-overlay', html);
  game._openModal = 'home';

  const close = () => dismiss(game, ov);
  document.getElementById('homeMain').onclick = () => {
    audio.play('ui.open');
    close();
    if (hasSave && lastDest) game.continueDestination(lastDest.id);
    else showChapterSelect(game); // 无存档：先选目的地
  };
  document.getElementById('homeDest').onclick = () => { audio.play('ui.click'); close(); showChapterSelect(game); };
  document.getElementById('homePass').onclick = () => { audio.play('ui.click'); close(); showPassport(game); };
  document.getElementById('homeSet').onclick = () => { audio.play('ui.click'); close(); showSettings(game); };
  return ov;
}

// ===================== 旅行护照面板 =====================
export function showPassport(game) {
  const meta = loadMeta();
  const stampedCount = DESTINATIONS.filter(d => meta.stamps[d.id]).length;
  const html =
    '<h2>📒 旅行护照</h2>' +
    '<p>每建成一个目的地地标，护照盖上一枚章。集齐 ' + DESTINATIONS.length + ' 章走遍世界！</p>' +
    '<div class="passport-grid">' +
      DESTINATIONS.map(d => {
        const got = !!meta.stamps[d.id];
        const unlocked = meta.unlocked.includes(d.id);
        return '<div class="pp-card' + (got ? ' got' : '') + '">' +
          '<div class="pp-emoji">' + d.emoji + '</div>' +
          '<div class="pp-name">' + d.name + '</div>' +
          '<div class="pp-lm">' + d.landmark.emoji + ' ' + d.landmark.name + '</div>' +
          '<div class="pp-st">' + (got ? '✅ 已盖章' : (unlocked ? '🆕 可出发' : '🔒 未解锁')) + '</div>' +
        '</div>';
      }).join('') +
    '</div>' +
    '<div class="passport-sum">已达成 <b>' + stampedCount + '</b>/' + DESTINATIONS.length + ' 站</div>' +
    '<button class="close">关闭</button>';

  const ov = makeOverlay(game, 'passport-overlay', '<div class="modal">' + html + '</div>');
  game._openModal = 'passport';
  ov.addEventListener('click', e => {
    if (e.target === ov || (e.target.closest && e.target.closest('.close'))) dismiss(game, ov);
  });
  return ov;
}
