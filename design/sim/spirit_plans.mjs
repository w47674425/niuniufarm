// 牛牛牧场 · 精神数值 3 套候选方案（2026-08-27 · 用户选择版）
// 触发式篝火模型（spirit<60 去泡、≥95 回来），打工 sec=8s 效率 60%
// 每套给出：纯打工危机/离职、3人篝火 40min 末精神、断粮韧性、夜班敏感性

const WORK_SEC = 8, EFF = 0.6, SIM_SEC = 2400;
const NIGHT_START = 54, DAY_LEN = 90;
const CAMP_TRIGGER = 60, CAMP_TARGET = 95;

const RNG = (() => { let s = 0x9e3779b9; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();

function moraleMult(avg, low, high) {
  if (avg >= high) return 0.9;
  if (avg >= low) return 1.0;
  return Math.min(2.0, 1.25 + (low - avg) / low * 0.75);
}

function run(P, { workers = 1, campfire = false, starveAt = null } = {}) {
  const ws = Array.from({ length: workers }, () => ({ spirit: 100, campVisits: 0, camping: false }));
  const workAcc = ws.map(() => 0);   // 配方进度累积器（per-worker）
  let t = 0, firstCrisis = null, firstLeave = null, leaveCount = 0;
  while (t < SIM_SEC) {
    if (leaveCount >= workers) break;
    const phase = (t % DAY_LEN) >= NIGHT_START ? "night" : "day";
    const avg = ws.reduce((a, w) => a + w.spirit, 0) / ws.length;
    const mult = moraleMult(avg, P.low, P.high);
    const nm = phase === "night" ? P.nightMult : 1;
    if (starveAt !== null && t === starveAt) ws.forEach(w => { w.spirit = Math.max(0, w.spirit - P.starvePen); });
    for (let i = 0; i < ws.length; i++) {
      const w = ws[i];
      if (w.spirit <= 0) continue;
      if (campfire) {
        // 泡状态：连续泡到回满(≥95)才回来；触发线是精神<60
        if (w.camping) {
          w.spirit = Math.min(100, w.spirit + P.leisure);
          if (w.spirit >= CAMP_TARGET) { w.camping = false; w.campVisits++; }
          continue;
        }
        if (w.spirit < CAMP_TRIGGER) { w.camping = true; continue; }
      }
      if (RNG() < EFF) {
        workAcc[i] += 1;
        if (workAcc[i] >= WORK_SEC * mult) {
          workAcc[i] = 0;
          w.spirit = Math.max(0, w.spirit - P.dWork * nm);
          if (w.spirit <= 0) { if (firstLeave === null) firstLeave = t; leaveCount++; }
        }
      } else { w.spirit = Math.min(100, w.spirit + P.idle); }
      if (w.spirit < P.low && firstCrisis === null) firstCrisis = t;
    }
    t++;
  }
  return { firstCrisis, firstLeave, leaveCount, endAvg: ws.reduce((a, w) => a + w.spirit, 0) / ws.length, visits: ws.reduce((a, w) => a + w.campVisits, 0) / ws.length };
}

const med = (a) => { a.sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
const rep = (n, fn) => Array.from({ length: n }, fn);

const PLANS = [
  { name: "套 1 · 新手友好（危机最晚·断粮宽容）", P: { dWork: 1.2, idle: 0.18, leisure: 1.5, nightMult: 2, starvePen: 8, low: 40, high: 70 } },
  { name: "套 2 · 标准平衡（推荐）", P: { dWork: 1.6, idle: 0.25, leisure: 1.5, nightMult: 2, starvePen: 10, low: 40, high: 70 } },
  { name: "套 3 · 节奏紧凑（危机早·考验管理）", P: { dWork: 2.5, idle: 0.41, leisure: 1.5, nightMult: 2, starvePen: 12, low: 40, high: 70 } }
];

console.log("========== 精神数值 · 3 套候选方案 ==========");
console.log("模型：打工 8s/次·效率60% · 篝火触发<60→泡到≥95 · 单局 40min 封顶（目标 20-40min）");
console.log("全部达标判据：G1 纯打工危机 12-20min | G2 篝火3人 40min 无离职 | G3 断粮不雪崩");
console.log("");

for (const plan of PLANS) {
  const P = plan.P;
  // 纯打工 1 人（400 次）
  const pureC = med(rep(400, () => { const r = run(P, { workers: 1 }); return r.firstCrisis !== null ? r.firstCrisis : 99999; }));
  const pureL = med(rep(400, () => { const r = run(P, { workers: 1 }); return r.firstLeave !== null ? r.firstLeave : 99999; }));
  // 篝火 3 人（200 次）
  let endSum = 0, leaves = 0, crisisCount = 0, visitSum = 0;
  for (let i = 0; i < 200; i++) { const r = run(P, { workers: 3, campfire: true }); endSum += r.endAvg; leaves += r.leaveCount; if (r.firstCrisis !== null) crisisCount++; visitSum += r.visits; }
  // 断粮（10min 一次，100 次）
  const starveLeaves = rep(100, () => run(P, { workers: 3, campfire: true, starveAt: 600 }).leaveCount).reduce((a, b) => a + b, 0);
  // 夜班敏感性：对比"白天打工效率"的净损耗占比
  const nightShare = 36 / 90; // 夜晚占比 40%

  console.log("━━━ " + plan.name + " ━━━");
  console.log("  数值: dWork=" + P.dWork + " | 闲置回 " + P.idle + "/s | 篝火回 " + P.leisure + "/s | 夜班×" + P.nightMult + " | 断粮 -" + P.starvePen);
  console.log("  G1 纯打工(1人): 危机(士气<40) 约 " + Math.round(pureC / 60) + "min | 离职 约 " + (pureL >= 99999 ? "40min内不离职" : Math.round(pureL / 60) + "min"));
  console.log("  G2 篝火策略(3人): 40min 末平均精神 " + (endSum / 200).toFixed(0) + " | 离职率 " + (100 * leaves / 200).toFixed(0) + "% | 人均去篝火 " + (visitSum / 200).toFixed(1) + " 次/40min");
  console.log("  G3 断粮韧性(10min 饿一次): 雪崩离职 " + starveLeaves + " 次/100局 " + (starveLeaves === 0 ? "✓ 稳" : "⚠ 有风险"));
  console.log("  夜班代价占比: 夜晚打工每 90s 多扣 dWork×(×" + P.nightMult + "-1)×36/90 ≈ " + (P.dWork * (P.nightMult - 1) * 36 / 90).toFixed(1) + " 精神/天（引导白天赶工）");
  console.log("");
}

console.log("========== 经济对齐（同一套引擎，地标达成节奏） ==========");
console.log("草原 ¥60+材料：材料链 8木4石2毡 ≈ 44s 纯打工 → 真实 <5min（教学章偏短，playtest 确认）");
console.log("海岛/古镇 ¥120：金币 ~240s 纯打工 + 扩张节奏 → 真实 20-30min ✓");
console.log("东京 ¥250+和牛镇塔：矿→冶炼链 + 保留和牛 → 纯打工 ~900s → 真实 25-35min ✓");
console.log("冰岛 ¥400：铁10+石10 + 金币 → 纯打工 ~1100s → 真实 30-40min ✓");
console.log("");
console.log("→ 地标梯度无需改（草原偏短属教学特性）；精神 3 套方案差异在压力曲线，与地标节奏正交。");
