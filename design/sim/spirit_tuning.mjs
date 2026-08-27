// 牛牛牧场 · 精神系统数值 tuning 模拟器（2026-08-27）
// 目标（设计 §4.6/§7）：单局 20-40min（1200-2400s；1 天=90s → 13-27 天）
//  ① 纯打工不喘息：约 15-20min（900-1200s）触危机（有人 spirit<40 / 士气 low）
//  ② 建 1 个休闲建筑（篝火）+ 轮休策略：可撑到 40min 且精神不崩
//  ③ 夜间打工（夜班）惩罚合理：夜班×N 不会让"白天拼命晚上休息"策略崩溃
// 模型：模拟 N 牧民在"打工(E 效率)-闲置-篝火轮休"下的逐秒精神曲线。
// 全部数值输出供用户选择，非最终定案。

// —— 场景参数 ——
const WORK_SEC = 8;        // 草原典型配方耗时（采集 sec，受 moraleMult 影响）
const EFF = 0.6;           // 实际打工时间占比（拖拽/规划/喂食间隙，理论 1.0）
const SIM_SEC = 2400;      // 40min
const NIGHT_START = 54;    // 90s 一天中的夜晚起点（DAY_FRAC=0.6 → 白天 54s）
const DAY_LEN = 90;

// —— 待测方案（config 精神常量块的可替换组合）——
const PLANS = {
  // 标准（当前 MVP 值）
  "A·标准(当前)": { dWork: 2, idle: 0.2, leisure: 1.5, nightMult: 2, starvePen: 10, moraleLow: 40, moraleHigh: 70 },
  // 宽松：打工扣得少 + 闲置回得多 → 新手友好，危机来得晚
  "B·宽松": { dWork: 1.5, idle: 0.3, leisure: 2.0, nightMult: 1.5, starvePen: 8, moraleLow: 40, moraleHigh: 70 },
  // 硬核：打工扣得多 + 恢复慢 → 危机来得早，需要更主动的篝火管理
  "C·硬核": { dWork: 3, idle: 0.15, leisure: 1.2, nightMult: 2.5, starvePen: 12, moraleLow: 40, moraleHigh: 70 }
};

const RNG = (() => { let s = 0x9e3779b9; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();

// 士气 → 配方耗时倍率（与 spirit.js moraleMult 一致）
function moraleMult(avg, P) {
  if (avg >= P.moraleHigh) return 0.9;
  if (avg >= P.moraleLow) return 1.0;
  return Math.min(2.0, 1.25 + (P.moraleLow - avg) / P.moraleLow * 0.75);
}

// 单局模拟：返回关键事件时间
// mode: "pure" 纯打工（无篝火，只剩闲恢复）/ "campfire" 篝火轮休（每 CYCLE 秒派 CAMP 秒休息）
function runWorker(P, { mode = "pure", workers = 1, campCycle = 300, campSec = 45 } = {}) {
  const ws = Array.from({ length: workers }, () => ({ spirit: 100, fed: 5 }));
  let t = 0, firstCrisis = null, firstLeave = null, leaveCount = 0;
  let workAcc = 0; // 配方进度（秒）
  let campIdx = 0; // 当前轮休的工人
  const history = [];

  while (t < SIM_SEC && leaveCount < workers) {
    const phase = (t % DAY_LEN) >= NIGHT_START ? "night" : "day";
    const avg = ws.reduce((a, w) => a + w.spirit, 0) / ws.length;
    const mult = moraleMult(avg, P);
    const nightMult = phase === "night" ? P.nightMult : 1;

    for (let i = 0; i < ws.length; i++) {
      const w = ws[i];
      if (w.spirit <= 0) continue;
      // 篝火轮休：每个周期指派一名工人驻篝火（其余继续打工）
      const camping = mode === "campfire" && (i === campIdx) && (t % campCycle < campSec);
      if (camping) {
        w.spirit = Math.min(100, w.spirit + P.leisure);
        continue;
      }
      // 打工/闲置：E 概率工作（配方进度累积）
      if (RNG() < EFF) {
        workAcc += 1;
        if (workAcc >= WORK_SEC * mult) {
          workAcc = 0;
          w.spirit = Math.max(0, w.spirit - P.dWork * nightMult);
          if (w.spirit <= 0 && firstLeave === null) { firstLeave = t; leaveCount++; }
          else if (w.spirit <= 0) { leaveCount++; }
        }
      } else {
        w.spirit = Math.min(100, w.spirit + P.idle);
      }
      if (w.spirit < 40 && firstCrisis === null) firstCrisis = t;
    }
    // 轮休轮换：周期结束时换人
    if (mode === "campfire" && t % campCycle >= campCycle - 1) campIdx = (campIdx + 1) % workers;
    // 采样
    if (t % 60 === 0) history.push({ t, avg: ws.reduce((a, w) => a + w.spirit, 0) / ws.length, leave: leaveCount });
    t++;
  }
  return { firstCrisis, firstLeave, leaveCount, endAvg: ws.reduce((a, w) => a + w.spirit, 0) / ws.length, history };
}

const fmt = (s) => s === null ? "∞" : Math.round(s / 60) + "min(" + Math.round(s) + "s)";

console.log("========== 精神数值 tuning 模拟 ==========");
console.log("模型：牧民打工 sec=" + WORK_SEC + "s·效率" + (EFF * 100) + "% · 模拟 40min · 单局目标 20-40min");
console.log("目标：纯打工 15-20min 触危机（士气<40）；篝火轮休可撑 40min");
console.log("");

for (const [name, P] of Object.entries(PLANS)) {
  console.log("━━━ " + name + " ━━━");
  console.log("  参数: dWork=" + P.dWork + " 闲置回=" + P.idle + "/s 篝火回=" + P.leisure + "/s 夜班×" + P.nightMult + " 断粮-" + P.starvePen);

  // 单牧民重复 200 次取中位（去随机噪声）
  const crisisTimes = [], leaveTimes = [];
  for (let i = 0; i < 200; i++) {
    const r = runWorker(P, { mode: "pure", workers: 1 });
    if (r.firstCrisis !== null) crisisTimes.push(r.firstCrisis);
    if (r.firstLeave !== null) leaveTimes.push(r.firstLeave);
  }
  crisisTimes.sort((a, b) => a - b); leaveTimes.sort((a, b) => a - b);
  const med = (a) => a.length ? a[Math.floor(a.length / 2)] : null;
  console.log("  [纯打工 1牧民] 首次士气<40: " + fmt(med(crisisTimes)) + " | 离职: " + fmt(med(leaveTimes)));

  // 3 牧民 + 篝火轮休（每 5min 一人驻篝火 45s）
  const campResults = [];
  for (let i = 0; i < 100; i++) {
    const r = runWorker(P, { mode: "campfire", workers: 3, campCycle: 300, campSec: 45 });
    campResults.push(r);
  }
  const endAvgs = campResults.map(r => r.endAvg).sort((a, b) => a - b);
  const leaves = campResults.filter(r => r.leaveCount > 0).length;
  console.log("  [3牧民+篝火轮休] 40min末平均精神: " + med(endAvgs).toFixed(0) + " | 期间离职率: " + (100 * leaves / campResults.length).toFixed(0) + "%");

  // 夜班敏感性：纯打工 1 牧民，白天效率 EFF、夜晚照常打工（×nightMult）
  const nightWorst = runWorker(P, { mode: "pure", workers: 1 });
  console.log("  [夜班全勤参考] 首次士气<40: " + fmt(nightWorst.firstCrisis));
  console.log("");
}

console.log("========== 经济节奏参考（草原地标 ¥60 + 木8石4毡2） ==========");
// 简化：牧民每秒产钱能力（采木 8s→¥6 毛/2s，采石 8s→¥4，蓝莓 5s→¥2，卖奶 4s→¥2）
// 草原目标=攒材料+¥60（起步已给 60，实际只需攒材料）
console.log("草原：起步金=地标钱(60)，实际瓶颈=材料(木8石4毡2)；毛毡=药草×2(herbfield 开局有)");
console.log("  材料时间估算：木8(2次砍伐×8s)+石4(2次×8s)+毡2(2次×6s) ≈ 44s 纯打工 × 效率1/0.6 ≈ 73s 真实时间");
console.log("  → 草原教学章实际 < 5min 即可达成（符合入门≈20min 目标，但可能偏短，需 playtest 确认）");
console.log("");
console.log("海岛(¥120)/古镇(¥120)：材料木/石 20 件 ≈ 纯打工 4×8s×2 = 64s×10次 ≈ 纯打工 80s，金币 ¥120 需卖资源约");
console.log("  产钱速率（卖奶 4s→¥2 = ¥0.5/s；卖矿更高）→ ¥120 ≈ 240s 纯打工 = 4min，真实约 7min，加上扩张节奏实际 20-30min");
console.log("");
console.log("东京(¥250+和牛镇塔)：铁锭8+金锭4 需矿→冶炼链 + 保留和牛不卖");
console.log("  铁 16 次采集×12s + 金 8 次×15s + 冶炼 12 次×10-15s ≈ 纯打工 400s+，金币 ¥250 ≈ 500s（卖铁/奶）");
console.log("  → 合计纯打工 ≈ 900s+（15min），真实 25-35min ✓ 对齐高阶目标");
console.log("");
console.log("冰岛(¥400)：铁锭10+石10 ≈ 采集 300s + 金币 ¥400 ≈ 800s → 纯打工 ≈ 1100s+（18min），真实 30-40min ✓");
