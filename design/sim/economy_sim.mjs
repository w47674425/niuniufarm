// 牛牛牧场 · 经济循环 Monte Carlo（当前准绳版数值）
// 模型：Stacklands 式。金币 source = 卖资源/牛奶/牲畜 + 任务 + 怪物；sink = 卡包 + 建造耗材。
// 模拟"理论手速上限"策略：空闲牧民自动挂资源点无限产出 → 多余资源自动卖 → 金币购卡包。
// 关注：金币曲线是否失控（通胀）、卡包回本、食物链自持、人口/卡数上限压力。
// [PLACEHOLDER] 数值全部来自 src/config.js，改配置后重跑即可。

import { META, PACKS, TASKS, RECIPES, COW_BREEDS, COW_WEIGHTS } from '../../src/config.js';

const RNG = (() => {
  let s = 0x2545f491;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
})();
const rr = (n) => Math.floor(RNG() * n);

// —— 模型常量（可调）——
const RUNS = 400;        // 模拟局数
const DAYS = 12;         // 每局天数（90s/天）
const TICK = 1;          // 秒/步
const DAY_LEN = 90;
const SELL_RESERVE = 2;  // 每种资源保留量（防卖光建材）

// 用真实配置构建引擎
const RECIPE_BY_ID = {};
RECIPES.forEach(r => { RECIPE_BY_ID[r.id] = r; });

// 资源点产出（gather_* 与 prod_*，consume:false 无限产出）
const PRODUCERS = RECIPES.filter(r => r.kind === "produce" && (r.id.startsWith("gather_") || r.id.startsWith("prod_")));

// 变异牛随机：先按稀有度权重（普通40/稀有30/史诗20/传说10）选稀有度，再在该稀有度内均匀随机
function makeCowBreed() {
  const total = COW_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = RNG() * total;
  let rarity = 1;
  for (let i = 0; i < COW_WEIGHTS.length; i++) { r -= COW_WEIGHTS[i]; if (r <= 0) { rarity = i + 1; break; } }
  const pool = COW_BREEDS.filter(t => META[t].rarity === rarity);
  return pool[Math.floor(RNG() * pool.length)];
}

// 卡包内容（随机包展开；抽到牛：80% 普通牛，20% 变异牛）
function packContents(pack) {
  if (pack.pool) {
    const pool = pack.pool.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = rr(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, pack.count || 1).map(t => t === "cow" ? (RNG() < 0.2 ? makeCowBreed() : "cow") : t);
  }
  const out = [];
  pack.items.forEach(it => { for (let i = 0; i < it[1]; i++) out.push(it[0]); });
  return out;
}

// 开局：新手卡包（与 game.newGame 一致）
function newRun() {
  return {
    day: 1, gold: 0, timeLeft: DAY_LEN,
    cards: {},              // type → count
    units: [],              // {type, fed}
    buildings: {},          // 建筑计数（house/lumberyard/...）
    producers: {},          // type → count（可用资源点）
    kills: 0,
    totalWood: 0,
    tasksDone: {},
    milkWorkers: 0,         // 统计产奶次数
    earned: 0,              // 累计卖钱收入
    spent: 0,               // 累计买包支出
    buyStats: {},           // 卡包购买次数
    _actAcc: 0, _milkAcc: 0, _breedT: 0,
  };
}

function mk(s, type) {
  s.cards[type] = (s.cards[type] || 0) + 1;
  if (META[type].cat === "unit") s.units.push({ type, fed: META[type].foodCap || 1 });
  if (META[type].cat === "build") s.buildings[type] = (s.buildings[type] || 0) + 1;
  // node 资源点：计入剩余总次数池（每张卡 charges 次采集）
  if (META[type].cat === "node") s.producers[type] = (s.producers[type] || 0) + (META[type].charges || 1);
}

// 采集一次资源点：消耗 1 次剩余次数
function consumeProducer(s, type) {
  if ((s.producers[type] || 0) > 0) {
    s.producers[type] -= 1;
    if (s.producers[type] <= 0) delete s.producers[type];
    return true;
  }
  return false;
}

function rmv(s, type, n = 1) {
  s.cards[type] = (s.cards[type] || 0) - n;
  if (s.cards[type] <= 0) delete s.cards[type];
}

function checkTasks(s) {
  TASKS.forEach(t => {
    if (s.tasksDone[t.id]) return;
    let done = false;
    if (t.id === "t1") done = s.units.filter(u => u.type === "herder").length >= 3;
    else if (t.id === "t2") done = (s.buildings.house || 0) >= 1;
    else if (t.id === "t3") done = s.gold >= 50;
    else if (t.id === "t4") done = s.kills >= 1;
    else if (t.id === "t5") done = s.totalWood >= 10;
    else if (t.id === "t6") done = s.units.filter(u => u.type === "herder").length >= 5;
    else if (t.id === "t7") done = (s.buildings.wall || 0) >= 1;
    else if (t.id === "t8") done = s.gold >= 200;
    else if (t.id === "t9") done = (s.buildings.smelter || 0) >= 1;
    else if (t.id === "t10") done = s.units.filter(u => u.type === "dog" && (u.atkBonus || 0) > 0).length >= 1;
    if (done) { s.tasksDone[t.id] = true; s.gold += t.rew; }
  });
}

// 每日结算：单位吃 1 餐，优先 diet，否则任意食物，没有就饿死
function dayEnd(s) {
  const deaths = [];
  s.units.forEach(u => {
    if (u.fed >= 1) { u.fed -= 1; return; }
    // 找食物
    const diet = META[u.type].diet;
    let foodType = diet && (s.cards[diet] || 0) > 0 ? diet : null;
    if (!foodType) {
      // 任意食物
      const anyFood = Object.keys(s.cards).find(t => META[t] && META[t].cat === "food" && s.cards[t] > 0);
      if (anyFood) foodType = anyFood;
    }
    if (foodType) {
      rmv(s, foodType);
      u.fed = Math.min(META[u.type].foodCap || 1, u.fed + (META[foodType].food || 1));
    } else {
      deaths.push(u);
    }
  });
  deaths.forEach(u => {
    const i = s.units.indexOf(u);
    if (i >= 0) s.units.splice(i, 1);
    rmv(s, u.type);
  });
  return deaths.length;
}

// —— 玩家策略（理论上限：所有空闲牧民立即挂上资源点，产多少卖多少超保留部分）——
function step(s) {
  const herders = s.units.filter(u => u.type === "herder");

  // 浮点动作累积器：牧民 8s/次 采集、牛 4s/次 产奶
  s._actAcc = (s._actAcc || 0) + herders.length * (TICK / 8);
  s._milkAcc = (s._milkAcc || 0) + (Object.keys(s.cards).filter(t => META[t] && META[t].cowKind === "cow").reduce((a, t) => a + (s.cards[t] || 0), 0)) * (TICK / 4);

  // 产奶优先（食物保障）
  while (s._milkAcc >= 1) {
    s._milkAcc -= 1;
    s.cards.milk = (s.cards.milk || 0) + 1;
    s.milkWorkers++;
  }

  // 采集/生产动作
  while (s._actAcc >= 1) {
    s._actAcc -= 1;
    // 选资源点：蓝莓丛(食物) > 铁矿/金矿(高价) > 树/岩石(建材)
    const hasBush = (s.producers.bush || 0) > 0;
    const hasIron = (s.producers.iron || 0) > 0;
    const hasGold = (s.producers.gold || 0) > 0;
    const hasTree = (s.producers.tree || 0) > 0;
    const hasRock = (s.producers.rock || 0) > 0;
    const hasFarm = (s.buildings.farm || 0) > 0;
    const hasLumber = (s.buildings.lumberyard || 0) > 0;
    const hasQuarry = (s.buildings.quarry || 0) > 0;

    // 食物保障：蓝莓+牛奶储备 < 单位数*1.2 时优先采蓝莓
    const foodStock = (s.cards.blueberry || 0) + (s.cards.milk || 0) * 0.5 + (s.cards.cookedmeat || 0) * 2 + (s.cards.bread || 0) * 2;
    const foodNeed = s.units.length * 1.2 - foodStock;
    if (hasBush && foodNeed > 0 && consumeProducer(s, "bush")) {
      s.cards.blueberry = (s.cards.blueberry || 0) + 2;
    } else if (hasLumber) { s.cards.wood = (s.cards.wood || 0) + 3; s.totalWood += 3; }
    else if (hasQuarry) { s.cards.stone = (s.cards.stone || 0) + 3; }
    else if (hasGold && consumeProducer(s, "gold")) { s.cards.goldore = (s.cards.goldore || 0) + 1; }
    else if (hasIron && consumeProducer(s, "iron")) { s.cards.ironore = (s.cards.ironore || 0) + 2; }
    else if (hasTree && consumeProducer(s, "tree")) { s.cards.wood = (s.cards.wood || 0) + 2; s.cards.branch = (s.cards.branch || 0) + 1; s.totalWood += 2; }
    else if (hasRock && consumeProducer(s, "rock")) { s.cards.stone = (s.cards.stone || 0) + 2; }
    else if (hasFarm) { s.cards.wheat = (s.cards.wheat || 0) + 2; }
  }

  // 3. 卖：超保留部分卖掉（牛奶/矿石/羊毛/多余食物）
  const sellable = [
    ["goldore", META.goldore.sale], ["ironore", META.ironore.sale],
    ["milk", META.milk.sale], ["goldingot", META.goldingot.sale],
    ["ironingot", META.ironingot.sale], ["blueberry", META.blueberry.sale],
    ["wood", META.wood.sale], ["stone", META.stone.sale],
    ["branch", META.branch.sale], ["wheat", META.wheat.sale],
    ["herb", META.herb.sale], ["bread", META.bread.sale],
    ["cookedmeat", META.cookedmeat.sale]
  ];
  sellable.forEach(([t, price]) => {
    const keep = (t === "wood" || t === "stone" || t === "branch") ? SELL_RESERVE * 2 : 0;
    const n = (s.cards[t] || 0) - keep;
    if (n > 0 && price > 0) {
      // 食物保留：蓝莓/牛奶留够 1 天口粮（单位数），其余卖
      let sellN = n;
      if (t === "blueberry") { sellN = Math.max(0, n - s.units.length); }
      if (t === "milk") { sellN = Math.max(0, n - Math.ceil(s.units.length * 0.5)); }
      if (sellN > 0) { s.gold += sellN * price; s.earned += sellN * price; rmv(s, t, sellN); }
    }
  });

  // 4. 买卡包（优先：补资源点(基础) → 加人口(牧场) → 动物(牛/猪/狗) → 高级(建筑)）
  const cowCount = Object.keys(s.cards).filter(t => META[t] && META[t].cowKind === "cow").reduce((a, t) => a + (s.cards[t] || 0), 0);
  const dogCount = s.units.filter(u => u.type === "dog").length;
  // 购买策略（模拟"理性玩家"）：不把手花光，保留部分金币
  // 资源点阈值按"剩余次数池"判断：不足 1 个点的总量（charges 次）就补
  const CH = (t) => META[t].charges || 1;
  const wantBasic = () => (s.producers.bush || 0) < CH("bush") * 2 || (s.producers.tree || 0) < CH("tree") * 2 || (s.producers.rock || 0) < CH("rock") * 2;
  const wantRanch = () => s.units.filter(u => u.type === "herder").length < 6;
  // 初始有 1 狗，所以"有狗"不应阻止买动物包；只看牛
  const wantAnimal = () => cowCount < 1;
  // 建筑包：只补矿点（冶炼厂建不建不影响购买决策，矿点是产出源）
  const wantBuilding = () => (s.producers.iron || 0) < CH("iron") || (s.producers.gold || 0) < CH("gold");
  const wantPlant = () => false;

  const order = [["basic", wantBasic, 0], ["ranch", wantRanch, 10], ["animal", wantAnimal, 5], ["building", wantBuilding, 0], ["plant", wantPlant, 0]];
  // 购买动作节流：每 tick 最多买 1 个包（模拟玩家间隔操作，非每秒扫商店）
  for (const [pid, want, reserve] of order) {
    const pk = PACKS.find(p => p.id === pid);
    if (!pk || !want()) continue;
    if (s.gold >= pk.price + reserve) {
      s.gold -= pk.price;
      s.spent += pk.price;
      s.buyStats[pid] = (s.buyStats[pid] || 0) + 1;
      packContents(pk).forEach(t => mk(s, t));
      break; // 每 tick 只买一次
    }
  }

  // 5. 建关键建筑（材料足够时）：房屋(人口) > 伐木场 > 冶炼厂 > 城墙
  const tryBuild = (id, needs) => {
    const r = RECIPE_BY_ID[id];
    if (!r) return;
    if ((s.buildings[r.out[0].type] || 0) > 0) return;
    let ok = true;
    for (const k in needs) { if ((s.cards[k] || 0) < needs[k]) { ok = false; break; } }
    if (ok) {
      for (const k in needs) { if (META[k].cat !== "build") rmv(s, k, needs[k]); }
      mk(s, r.out[0].type);
    }
  };
  const hasHouse = (s.buildings.house || 0) > 0;
  tryBuild("build_house", { wood: 2, stone: 1 });
  if (hasHouse) {
    tryBuild("build_lumberyard", { wood: 4, stone: 1 });
    tryBuild("build_smelter", { wood: 2, stone: 4 });
    tryBuild("build_quarry", { wood: 2, stone: 3 });
    tryBuild("build_wall", { stone: 3 });
  }

  // 6. 繁殖：房屋 + 2 牧民，120s 冷却
  if ((s.buildings.house || 0) > 0 && s.units.filter(u => u.type === "herder").length >= 2 && (s._breedT || 0) <= 0) {
    mk(s, "herder"); s._breedT = 120;
  }
  if ((s._breedT || 0) > 0) s._breedT -= TICK;
}

function runSim() {
  const s = newRun();
  // 新手卡包
  ["herder", "herder", "dog", "tree", "rock", "bush", "blueberry", "blueberry", "wood", "stone", "branch"].forEach(t => mk(s, t));
  s.units.forEach(u => u.fed = META[u.type].foodCap || 1);

  for (let d = 1; d <= DAYS; d++) {
    s.timeLeft = DAY_LEN;
    for (let t = 0; t < DAY_LEN; t += TICK) {
      step(s);
    }
    checkTasks(s);
    const deaths = dayEnd(s);
    s.day = d + 1;
    // 失败：无牧民
    if (s.units.filter(u => u.type === "herder").length === 0) return { failed: true, day: d, gold: s.gold };
  }
  return { failed: false, day: DAYS, gold: s.gold, cards: s.cards, units: s.units.length, herders: s.units.filter(u => u.type === "herder").length, dogs: s.units.filter(u => u.type === "dog").length, builds: s.buildings, milk: s.milkWorkers, tasks: Object.keys(s.tasksDone).length, earned: s.earned, spent: s.spent, buyStats: s.buyStats };
}

// —— 主跑 ——
const results = [];
let failures = 0, failDaySum = 0;
for (let i = 0; i < RUNS; i++) {
  const r = runSim();
  if (r.failed) { failures++; failDaySum += r.day; }
  results.push(r);
}

const done = results.filter(r => !r.failed);
const golds = done.map(r => r.gold).sort((a, b) => a - b);
const median = (arr) => arr[Math.floor(arr.length / 2)];
const pct = (arr, p) => arr[Math.floor(arr.length * p)];

console.log("========== 牛牛牧场 · 经济循环 Monte Carlo ==========");
console.log("局数:", RUNS, "| 每局:", DAYS, "天 ×", DAY_LEN, "s/天");
console.log("");
console.log("—— 生存率 ——");
console.log("成功存活", DAYS, "天:", (100 * done.length / RUNS).toFixed(1) + "%");
if (failures > 0) console.log("饿死局:", failures, "（平均死于第", (failDaySum / failures).toFixed(1), "天）");
console.log("");
console.log("—— 金币（存活局，第 12 天末）——");
console.log("中位数: ¥" + median(golds), "| P25: ¥" + pct(golds, 0.25), "| P75: ¥" + pct(golds, 0.75), "| 最大: ¥" + golds[golds.length - 1]);
console.log("");
console.log("—— 卡包回本分析（单位: 秒）——");
const ROIS = [
  ["基础卡包 ¥10（蓝莓丛/树/岩石 无限产出）", 10 / (META.blueberry.sale * 2 / 5), "蓝莓 2/5s = ¥0.4/s"],
  ["牧场卡包 ¥20（牧民=1 个永久劳动力）", 20 / ((META.wood.sale * 2 + META.branch.sale) / 8), "采木 ¥5/8s = ¥0.625/s"],
  ["动物卡包 ¥20（牛=持续产奶）", 20 / (META.milk.sale / 4), "牛奶 ¥2/4s = ¥0.5/s"],
  ["建筑卡包 ¥30（铁矿 ¥5×2/12s）", 30 / (META.ironore.sale * 2 / 12), "铁矿 ¥0.83/s"]
];
ROIS.forEach(([name, roi, note]) => {
  console.log("  " + name + " → 回本约 " + roi.toFixed(0) + "s（" + note + "）");
});
console.log("");
console.log("—— 人口/卡数（存活局第 12 天）——");
const units = done.map(r => r.units);
const herders = done.map(r => r.herders);
console.log("单位数 中位:", median(units), "| 牧民 中位:", median(herders));
console.log("");
console.log("—— 任务完成（存活局）——");
const tasks = done.map(r => r.tasks);
console.log("平均完成任务:", (tasks.reduce((a, b) => a + b, 0) / done.length).toFixed(1), "/ 10");
console.log("—— 奶牛产奶总量（存活局）——");
const milks = done.map(r => r.milk);
console.log("平均产奶:", Math.round(milks.reduce((a, b) => a + b, 0) / done.length), "瓶");
console.log("");
console.log("—— 收入/支出对账（存活局，12 天累计）——");
const earned = done.map(r => r.earned);
const spent = done.map(r => r.spent);
console.log("累计卖钱收入 中位: ¥" + median(earned), "| 累计买包支出 中位: ¥" + median(spent));
// 各类卡包平均购买次数
const buyAgg = {};
done.forEach(r => { for (const k in r.buyStats) { buyAgg[k] = (buyAgg[k] || 0) + r.buyStats[k]; } });
console.log("卡包购买次数（平均）:", Object.keys(buyAgg).map(k => k + ":" + (buyAgg[k] / done.length).toFixed(1)).join("  "));
console.log("");
console.log("—— 关键通胀指标 ——");
const spentRatio = median(spent) / (median(earned) || 1);
console.log("买包支出/总收入 = " + (spentRatio * 100).toFixed(0) + "%（>70% 说明金币大量回流卡包，接近稳态）");
console.log("期末金币/总收入 = " + ((median(golds) / (median(earned) || 1)) * 100).toFixed(0) + "%");

