// 合并 / 产出 / 喂草 规则判定（纯函数，只依赖 config.META）

import { META } from './config.js';

export function isCattle(type) { return !!(META[type] && META[type].cattle); }

// 方向敏感的组合判定：员工必须拖到资源卡上；草料必须拖到牛上
export function comboInfo(moving, target) {
  const m = moving.map(c => c.type);
  const t = target.map(c => c.type);
  const mHas = x => m.indexOf(x) >= 0, tHas = x => t.indexOf(x) >= 0;
  const mCnt = x => m.filter(y => y === x).length;
  const tCnt = x => t.filter(y => y === x).length;

  // 产出：员工(移动方) + 资源(目标方)
  if (mHas("employee") && tHas("grass_pile")) return { kind: "produce", combo: "grass", ok: true };
  if (tHas("employee") && mHas("grass_pile")) return { kind: "produce", combo: "grass", ok: false };
  if (mHas("employee") && tHas("stump"))      return { kind: "produce", combo: "wood",  ok: true };
  if (tHas("employee") && mHas("stump"))      return { kind: "produce", combo: "wood",  ok: false };
  if (mHas("employee") && tCnt("wood") >= 4)  return { kind: "produce", combo: "fence", ok: true };
  if (tHas("employee") && mCnt("wood") >= 4)  return { kind: "produce", combo: "fence", ok: false };
  if (mHas("employee") && tHas("fence"))      return { kind: "produce", combo: "bank",  ok: true };
  if (tHas("employee") && mHas("fence"))      return { kind: "produce", combo: "bank",  ok: false };

  // 吃草：草料(移动方) 拖到 牛(目标方)；反向不行
  const cowMover   = moving.some(c => isCattle(c.type));
  const cowTarget  = target.some(c => isCattle(c.type));
  const grassMover = moving.some(c => c.type === "grass");
  const grassTarget = target.some(c => c.type === "grass");
  if (grassMover && cowTarget) {
    // 目标是牧场(围栏+牛)时，草料只叠进牧场、不立即吃（由每日自动喂食处理）
    if (target.some(c => c.type === "fence")) return { kind: "pasture", ok: true };
    return { kind: "feed", ok: true };
  }
  if (grassTarget && cowMover) return { kind: "feed", ok: false };
  return null;
}

// 综合合并判定：方向组合、同类堆叠、牧场、汉堡喂员工、钱币存卡
export function checkMerge(moving, target) {
  const info = comboInfo(moving, target);
  if (info) {
    if (!info.ok) return { ok: false, reverse: true };
    return { ok: true, info };
  }
  const combined = moving.concat(target);
  if (combined.length === 0) return { ok: false };

  const t0 = combined[0].type;
  if (combined.every(c => c.type === t0)) return { ok: true, info: { kind: "same" } };

  // 牧场：围栏 + 牛（结构性组合，持久存在）
  const hasFence  = combined.some(c => c.type === "fence");
  const hasCattle = combined.some(c => isCattle(c.type));
  if (hasFence && hasCattle) return { ok: true, info: { kind: "pasture" } };

  const types = combined.map(c => c.type);
  if (types.indexOf("burger") >= 0 && types.indexOf("employee") >= 0) return { ok: true, info: { kind: "burger" } };
  if (types.indexOf("money") >= 0 && types.indexOf("bank") >= 0)       return { ok: true, info: { kind: "bank" } };
  return { ok: false };
}
