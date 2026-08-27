// 精神系统（§4.6 双轨模型 · MVP 落地）
// A. Per-worker spirit ∈ [0,100]：打工扣、休闲/闲置回，归零"想家离职"（软失败，可再雇）
// B. Team morale = avg(spirit) 驱动全局 moraleMult（≥70 提速 / <40 降速）
// 全部数值 [PLACEHOLDER·待 playtest]，设计 rationale 见 design/打工旅游_目标与卡包系统设计.md §4.6/§7

import { META, SPIRIT_MAX, D_WORK, NIGHT_DRAIN_MULT, STARVE_PENALTY, IDLE_REGEN, LEISURE_REGEN, MORALE_HIGH, MORALE_LOW } from './config.js';
import { allCards, removeCardObj } from './state.js';
import { toast } from './render.js';

// 某张卡是否工人（当前只有牧民可离职；牧羊犬无精神）
export function isWorker(c) {
  return c && c.type === "herder";
}

// 全队平均精神（无工人 → 100，避免开局空队被惩罚）
export function moraleAvg(game) {
  const st = game.state;
  const workers = st.piles.reduce((a, p) => a.concat(p.cards.filter(isWorker)), []);
  if (workers.length === 0) return 100;
  let sum = 0;
  workers.forEach(w => { sum += (w.spirit != null ? w.spirit : SPIRIT_MAX); });
  return sum / workers.length;
}

// 配方耗时倍率（乘在 sec 上；>1 更慢、<1 更快）
// ≥70 → ×0.9（快 10%）| 40–70 → ×1.0 | <40 → ×1.25 线性升至 ×2（慢 50%，avg=0 封顶）
export function moraleMult(game) {
  const avg = moraleAvg(game);
  if (avg >= MORALE_HIGH) return 0.9;
  if (avg >= MORALE_LOW) return 1.0;
  return Math.min(2.0, 1.25 + (MORALE_LOW - avg) / MORALE_LOW * 0.75);
}

// 团队士气等级（HUD 预警用）：'high' | 'ok' | 'low'
export function moraleLevel(game) {
  const avg = moraleAvg(game);
  if (avg >= MORALE_HIGH) return "high";
  if (avg >= MORALE_LOW) return "ok";
  return "low";
}

// 扣工人精神（打工消耗/饥饿惩罚共用）；spirit ≤ 0 → 想家离职（软失败，卡移除，board 物资保留）
// returns true 若该工人已离职
export function drainSpirit(game, worker, amount, reason) {
  if (!isWorker(worker)) return false;
  const before = worker.spirit != null ? worker.spirit : SPIRIT_MAX;
  worker.spirit = Math.max(0, before - amount);
  if (worker.spirit <= 0) {
    removeCardObj(game, worker);
    toast(game, (reason ? reason + "，" : "") + "😢 一名牧民想家离职了");
    return true;
  }
  return false;
}

// 实时恢复：tick 调用。工人与休闲卡（篝火🔥）同堆 → 快回；否则闲置缓慢回。
// "闲置" = 该堆此刻无进行中的配方（p.action 为 null / 未在跑进度）
export function regenWorkers(game, dt) {
  const st = game.state;
  st.piles.forEach(p => {
    if (p.isPack) return;
    const worker = p.cards.find(isWorker);
    if (!worker) return;
    const busy = p.action != null && p.actionSec > 0 && p.prog > 0;
    const hasLeisure = p.cards.some(c => META[c.type] && META[c.type].cat === "leisure");
    let gain = 0;
    if (hasLeisure) gain = LEISURE_REGEN * dt;       // 篝火旁：快速恢复
    else if (!busy) gain = IDLE_REGEN * dt;          // 闲置：缓慢恢复
    if (gain > 0) {
      const cur = worker.spirit != null ? worker.spirit : SPIRIT_MAX;
      worker.spirit = Math.min(SPIRIT_MAX, cur + gain);
    }
  });
}

// 日结算：饥饿耦合（§4.6 Sinks #4）——今日有工人饿死/饿跑 → 全体精神 -STARVE_PENALTY
export function dayEndSpirit(game, starved) {
  if (starved <= 0) return 0;
  const st = game.state;
  let drained = 0;
  st.piles.forEach(p => {
    p.cards.forEach(c => {
      if (isWorker(c) && drainSpirit(game, c, STARVE_PENALTY, "又饿又累")) drained++;
    });
  });
  if (drained > 0) toast(game, "💔 断粮让 " + drained + " 名牧民精神受挫（-" + STARVE_PENALTY + "）");
  return drained;
}

// 地标落成：团队精神奖励（§4.6 Sources #4 简化版）
export function landmarkMoraleBoost(game, amount) {
  const st = game.state;
  let boosted = 0;
  st.piles.forEach(p => {
    p.cards.forEach(c => {
      if (isWorker(c)) {
        const cur = c.spirit != null ? c.spirit : SPIRIT_MAX;
        c.spirit = Math.min(SPIRIT_MAX, cur + amount);
        boosted++;
      }
    });
  });
  if (boosted > 0) toast(game, "✨ 地标落成，全队士气大振（+" + amount + "）");
  return boosted;
}
