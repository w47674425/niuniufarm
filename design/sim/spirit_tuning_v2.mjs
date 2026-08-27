// 牛牛牧场 · 精神数值 tuning 模拟器 v2（2026-08-27）
// 模型 v2 改进：
//  ① 篝火策略 = 触发式：spirit < 60 自动去篝火泡，≥95 回来打工（贴近真实玩家"低精神才休息"）
//  ② 网格搜索 dWork × idle × leisure × nightMult，输出达标组合
// 达标判据：
//  G1 纯打工（1 牧民）首次士气<40 落在 12-20min（720-1200s）
//  G2 触发式篝火（3 牧民）40min 末平均精神 ≥ 50 且无离职
//  G3 断粮事件（第 10min 一次 -starvePen）后仍能靠篝火恢复（不雪崩）

const WORK_SEC = 8;      // 草原典型配方 sec
const EFF = 0.6;         // 打工时间占比
const SIM_SEC = 2400;    // 40min
const NIGHT_START = 54, DAY_LEN = 90;
const CAMP_TRIGGER = 60, CAMP_TARGET = 95;  // 篝火触发/回满阈值

const RNG = (() => { let s = 0x9e3779b9; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();

function moraleMult(avg, low, high) {
  if (avg >= high) return 0.9;
  if (avg >= low) return 1.0;
  return Math.min(2.0, 1.25 + (low - avg) / low * 0.75);
}

// 单局：返回 { firstCrisis, leaves, endAvg }
function run(P, { workers = 1, campfire = false, starveAt = null } = {}) {
  const ws = Array.from({ length: workers }, () => ({ spirit: 100 }));
  let t = 0, firstCrisis = null, firstLeave = null, leaveCount = 0, workAcc = 0;
  while (t < SIM_SEC) {
    if (leaveCount >= workers) break;
    const phase = (t % DAY_LEN) >= NIGHT_START ? "night" : "day";
    const avg = ws.reduce((a, w) => a + w.spirit, 0) / ws.length;
    const mult = moraleMult(avg, P.low, P.high);
    const nm = phase === "night" ? P.nightMult : 1;
    // 断粮事件：全体 -starvePen
    if (starveAt !== null && t === starveAt) ws.forEach(w => { w.spirit = Math.max(0, w.spirit - P.starvePen); });

    for (let i = 0; i < ws.length; i++) {
      const w = ws[i];
      if (w.spirit <= 0) continue;
      // 触发式篝火：精神低 → 驻篝火回血；回满回来
      if (campfire && w.spirit < CAMP_TRIGGER) {
        w.spirit = Math.min(100, w.spirit + P.leisure);
        continue;
      }
      if (w.spirit >= CAMP_TARGET && campfire) { /* 已回满，正常打工 */ }
      if (RNG() < EFF) {
        workAcc += 1;
        if (workAcc >= WORK_SEC * mult) {
          workAcc = 0;
          w.spirit = Math.max(0, w.spirit - P.dWork * nm);
          if (w.spirit <= 0) { if (firstLeave === null) firstLeave = t; leaveCount++; }
        }
      } else {
        w.spirit = Math.min(100, w.spirit + P.idle);
      }
      if (w.spirit < P.low && firstCrisis === null) firstCrisis = t;
    }
    t++;
  }
  return { firstCrisis, firstLeave, leaveCount, endAvg: ws.reduce((a, w) => a + w.spirit, 0) / ws.length };
}

const med = (a) => { a.sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };

// —— 网格搜索 ——
const GRID = [];
for (const dWork of [1.2, 1.5, 2, 2.5, 3]) {
  for (const idle of [0.15, 0.25, 0.35, 0.45]) {
    for (const leisure of [0.8, 1.2, 1.6, 2.0, 2.5]) {
      for (const nightMult of [1.5, 2]) {
        GRID.push({ dWork, idle, leisure, nightMult, low: 40, high: 70, starvePen: 10 });
      }
    }
  }
}

const PASS = [];
for (const P of GRID) {
  // 纯打工危机（200 次中位）
  const crisises = [];
  for (let i = 0; i < 200; i++) { const r = run(P, { workers: 1 }); if (r.firstCrisis !== null) crisises.push(r.firstCrisis); }
  if (crisises.length === 0) continue;
  const crisis = med(crisises);
  if (crisis < 720 || crisis > 1200) continue;   // G1: 12-20min

  // 篝火 3 牧民（50 次）
  let leavesAll = 0, endSum = 0;
  for (let i = 0; i < 50; i++) { const r = run(P, { workers: 3, campfire: true }); leavesAll += r.leaveCount; endSum += r.endAvg; }
  const endAvg = endSum / 50;
  if (endAvg < 50 || leavesAll > 0) continue;    // G2: 40min 末 ≥50 且无离职

  // 断粮事件（10min 一次，50 次：仍无离职）
  let starveLeaves = 0;
  for (let i = 0; i < 50; i++) { const r = run(P, { workers: 3, campfire: true, starveAt: 600 }); starveLeaves += r.leaveCount; }
  if (starveLeaves > 0) continue;                // G3: 断粮不雪崩

  PASS.push({ P, crisis });
}

console.log("========== 精神数值 tuning v2 · 触发式篝火 ==========");
console.log("模型：打工 sec=" + WORK_SEC + "s·效率60% · 篝火触发<" + CAMP_TRIGGER + " 回满≥" + CAMP_TARGET);
console.log("达标判据：G1 纯打工危机 12-20min | G2 篝火3人40min末≥50且无离职 | G3 断粮不雪崩");
console.log("网格: " + GRID.length + " 组合 → 达标 " + PASS.length + " 组");
console.log("");

// 按"危机时间接近 15min + 篝火余量(末精神)大"排序，挑 3 套差异明显的
PASS.sort((a, b) => {
  const da = Math.abs(a.crisis - 900), db = Math.abs(b.crisis - 900);
  return da - db;
});

const picked = [];
const used = new Set();
for (const p of PASS) {
  const key = p.P.dWork + "/" + p.P.idle + "/" + p.P.leisure;
  if (used.has(key)) continue;
  used.add(key);
  picked.push(p);
  if (picked.length >= 20) break;
}

// 展示 3 套代表（宽松/推荐/紧凑）+ 前 10 达标
const labels = [
  ["D·推荐平衡", 0],
  ["E·新手友好", Math.min(1, picked.length - 1)],
  ["F·节奏紧凑", Math.min(2, picked.length - 1)]
];
for (const [name, idx] of labels) {
  const p = picked[idx];
  if (!p) continue;
  const P = p.P;
  // 复算详细指标
  const pureC = med(Array.from({ length: 200 }, () => { const r = run(P, { workers: 1 }); return r.firstCrisis !== null ? r.firstCrisis : 99999; }));
  const pureL = med(Array.from({ length: 200 }, () => { const r = run(P, { workers: 1 }); return r.firstLeave !== null ? r.firstLeave : 99999; }));
  let endSum = 0, leaves = 0, crises = 0;
  for (let i = 0; i < 100; i++) { const r = run(P, { workers: 3, campfire: true }); endSum += r.endAvg; leaves += r.leaveCount; if (r.firstCrisis !== null) crises++; }
  const endAvg = (endSum / 100).toFixed(0);
  const starveTest = Array.from({ length: 50 }, () => run(P, { workers: 3, campfire: true, starveAt: 600 }).leaveCount).reduce((a, b) => a + b, 0);
  console.log("━━━ " + name + " ━━━");
  console.log("  参数: dWork=" + P.dWork + " 闲置回=" + P.idle + "/s 篝火回=" + P.leisure + "/s 夜班×" + P.nightMult + " 断粮-" + P.starvePen);
  console.log("  纯打工(1人): 危机 " + Math.round(pureC / 60) + "min | 离职 " + (pureL >= 99999 ? "∞" : Math.round(pureL / 60) + "min"));
  console.log("  篝火策略(3人): 40min末平均精神 " + endAvg + " | 离职率 " + (100 * leaves / 100).toFixed(0) + "% | 断粮事件后仍存活 ✓/✗ = " + (starveTest === 0 ? "✓" : "✗"));
  console.log("");
}

console.log("—— 全部达标组合（前 12，按危机≈15min 排序）——");
picked.slice(0, 12).forEach((p, i) => {
  const P = p.P;
  console.log("  " + (i + 1) + ". dWork=" + P.dWork + " idle=" + P.idle + " leisure=" + P.leisure + " 夜班×" + P.nightMult + " → 危机 " + Math.round(p.crisis / 60) + "min");
});
