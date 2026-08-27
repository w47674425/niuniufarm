// 牛牛农场 · 新世界观 数值校准（迭代8）
// 用真实 src/config.js 跑 Monte Carlo：理性玩家 生产→卖钱→买包→建造→训狗→夜晚战斗→造飞机集齐 6 打卡图
// 输出：金币曲线 / 存活率 / 卡包回本 / 造飞机可达性 / 夜晚压力 vs 狗战力 对照表
import {
  META, PACKS, RECIPES, TASKS, DAY_LEN, COMBAT_SEC, DOG_BREEDS
} from '../../src/config.js';

const RNG = (() => { let s = 0x2545f491; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();
const rr = (n) => Math.floor(RNG() * n);
const sale = (t) => (META[t] && META[t].sale) || 0;
const foodVal = (t) => (META[t] && META[t].food) || (t === 'blueberry' ? 1 : 0);

const TICK = 1;
const RUNS = 200;
const DAYS = 50;
const DAY_PHASE = Math.round(DAY_LEN * 0.6);   // 白天 54s
const SELL_RESERVE = 3;

// 夜晚刷怪表（与 systems.nightMonsters 对齐；城墙每座 -1）
function nightMonsters(day) {
  if (day <= 1) return [];
  if (day <= 5) return [0];
  if (day <= 10) return [0, 0];
  if (day <= 15) return [0, 0];
  if (day <= 20) return [0, 0, 0];
  if (day <= 25) return [0, 0, 0];
  if (day <= 30) return [1];
  if (day <= 35) return [1, 1];
  if (day <= 40) return [1, 1, 1];
  if (day <= 45) return [1, 1, 1];
  if (day <= 50) return [2];
  if (day <= 55) return [2, 2];
  if (day <= 60) return [2, 2, 2];
  if (day <= 65) return [2, 2, 2];
  if (day <= 70) return [3];
  if (day <= 75) return [3, 3];
  return [3, 3, 3];
}
const MON_NAMES = { 0: 'thief', 1: 'bandit', 2: 'capitalist', 3: 'spy' };

// —— 开局状态（对齐 game.newGame 新手礼包）——
function newRun() {
  return {
    day: 1, gold: 30, timeLeft: DAY_LEN,
    cards: {}, units: [], buildings: {}, producers: {},
    dogs: [], kills: 0, earned: 0, spent: 0, buyStats: {},
    totalWood: 0, tasksDone: {},
    milkAcc: 0, woolAcc: 0, woodAcc: 0, stoneAcc: 0, blueAcc: 0,
    ironAcc: 0, goldAcc: 0, wheatAcc: 0, herbAcc: 0,
    foodStock: 0, planeBuilt: false, checkins: 0, breaches: 0, nightKills: 0,
    _breedT: 0,
  };
}
function mk(s, type) {
  s.cards[type] = (s.cards[type] || 0) + 1;
  if (META[type].cat === 'unit') s.units.push({ type, atkBonus: 0, hpBonus: 0, hp: META[type].hp });
  if (META[type].cat === 'build') s.buildings[type] = (s.buildings[type] || 0) + 1;
  if (META[type].cat === 'node') s.producers[type] = (s.producers[type] || 0) + (META[type].charges || 1);
  if (META[type].cowKind === 'cow' || type === 'sheep' || type === 'pig') s.cards[type] = (s.cards[type] || 0); // 计数已在 cards
}
function rmv(s, type, n = 1) { s.cards[type] = (s.cards[type] || 0) - n; if (s.cards[type] <= 0) delete s.cards[type]; }
function has(s, type, n = 1) { return (s.cards[type] || 0) >= n; }
function cowCount(s) { return Object.keys(s.cards).filter(t => META[t] && META[t].cowKind === 'cow').reduce((a, t) => a + (s.cards[t] || 0), 0); }
function dogCount(s) { return s.units.filter(u => DOG_BREEDS.includes(u.type)).length; }

function packContents(pack) {
  if (pack.pool) {
    const pool = pack.pool.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = rr(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, pack.count || 1);
  }
  const out = []; pack.items.forEach(it => { for (let i = 0; i < it[1]; i++) out.push(it[0]); }); return out;
}

// —— 白天生产（劳工池模型：所有牧民共享一份劳动力，按优先级分配）——
let __PROD_TRACE = {};
function produce(s) {
  const herders = s.units.filter(u => u.type === 'herder').length;
  const H = Math.max(0, herders);
  const cows = cowCount(s);
  const sheep = s.cards.sheep || 0;
  // 持续产出（无 charges）：牛奶 / 羊毛
  s.milkAcc += cows * (TICK / 4);
  while (s.milkAcc >= 1) { s.milkAcc -= 1; s.cards.milk = (s.cards.milk || 0) + 1; }
  s.woolAcc += sheep * (TICK / 4);
  while (s.woolAcc >= 1) { s.woolAcc -= 1; s.cards.wool = (s.cards.wool || 0) + 2; }
  // 劳工动作池（8s/次 基准）。优先级：先攒建筑基础材料(tree/rock) → 采矿 → 口粮(bush) → 麦田
  s.actAcc = (s.actAcc || 0) + H * (TICK / 8);
  const MAT = { wood: 8, stone: 8, branch: 8 };
  while (s.actAcc >= 1) {
    s.actAcc -= 1;
    const hasBush = (s.producers.bush || 0) > 0;
    const hasIron = (s.producers.iron || 0) > 0;
    const hasGold = (s.producers.gold || 0) > 0;
    const hasTree = (s.producers.tree || 0) > 0;
    const hasRock = (s.producers.rock || 0) > 0;
    const hasLumber = (s.buildings.lumberyard || 0) > 0;
    const hasQuarry = (s.buildings.quarry || 0) > 0;
    const hasFarm = (s.buildings.farm || 0) > 0;
    const foodStock = (s.cards.blueberry || 0) + (s.cards.milk || 0) * 0.5 + (s.cards.cookedmeat || 0) * 2 + (s.cards.bread || 0) * 2;
    const foodNeed = s.units.length * 3 - foodStock;   // 维持 ~3 天口粮缓冲
    let act = 'idle';
    if (hasBush && foodNeed > 0) { (s.producers.bush -= 1); s.cards.blueberry = (s.cards.blueberry || 0) + 2; act = 'bush'; }
    else if (hasTree && (s.cards.wood || 0) < MAT.wood) { (s.producers.tree -= 1); s.cards.wood = (s.cards.wood || 0) + 2; s.cards.branch = (s.cards.branch || 0) + 1; s.totalWood += 2; act = 'tree'; }
    else if (hasRock && (s.cards.stone || 0) < MAT.stone) { (s.producers.rock -= 1); s.cards.stone = (s.cards.stone || 0) + 2; act = 'rock'; }
    else if (hasIron && (s.cards.ironore || 0) < 30) { (s.producers.iron -= 1); s.cards.ironore = (s.cards.ironore || 0) + 2; act = 'iron'; }
    else if (hasGold && (s.cards.goldore || 0) < 16) { (s.producers.gold -= 1); s.cards.goldore = (s.cards.goldore || 0) + 1; act = 'gold'; }
    else if (hasFarm) { s.cards.wheat = (s.cards.wheat || 0) + 2; act = 'farm'; }
    else if (hasLumber) { s.cards.wood = (s.cards.wood || 0) + 6; s.cards.branch = (s.cards.branch || 0) + 3; s.totalWood += 6; act = 'lumber'; }
    else if (hasQuarry) { s.cards.stone = (s.cards.stone || 0) + 6; s.cards.flint = (s.cards.flint || 0) + 3; act = 'quarry'; }
    else break; // 无活可干
    if (s.day <= 50) __PROD_TRACE[act] = (__PROD_TRACE[act] || 0) + 1;
  }
  // 建筑被动生产（需斧/镐，假设已建即有产出）
  if ((s.buildings.lumberyard || 0) > 0) { s.cards.wood = (s.cards.wood || 0) + 6; s.cards.branch = (s.cards.branch || 0) + 3; s.totalWood += 6; }
  if ((s.buildings.quarry || 0) > 0) { s.cards.stone = (s.cards.stone || 0) + 6; s.cards.flint = (s.cards.flint || 0) + 3; }
  // 冶炼（需冶炼厂）
  if ((s.buildings.smelter || 0) > 0) {
    while (has(s, 'ironore', 2) && (s.cards.ironingot || 0) < 20) { rmv(s, 'ironore', 2); s.cards.ironingot = (s.cards.ironingot || 0) + 1; }
    while (has(s, 'goldore', 2) && (s.cards.goldingot || 0) < 20) { rmv(s, 'goldore', 2); s.cards.goldingot = (s.cards.goldingot || 0) + 1; }
  }
  // 织毛毡（羊毛→毛毡，供房屋/厨房/飞机）
  while (has(s, 'wool', 2)) { rmv(s, 'wool', 2); s.cards.felt = (s.cards.felt || 0) + 1; }
}

// 建造/制造关键材料尽量囤积（仅卖超出囤量部分换钱）
const BUILD_KEEP = { wood: 16, stone: 16, branch: 10, felt: 10, flint: 10, ironore: 10, goldore: 8, ironingot: 8, goldingot: 6, wool: 6 };
function sell(s) {
  const units = s.units.length;
  const trySell = (t, keep) => {
    const n = (s.cards[t] || 0) - keep;
    if (n > 0 && sale(t) > 0) { s.gold += n * sale(t); s.earned += n * sale(t); rmv(s, t, n); }
  };
  // 蓝莓全部留作口粮缓冲（不卖），牛奶留半数换钱
  trySell('milk', Math.ceil(units * 0.5));
  // 可卖换钱的副产物
  ['cookedmeat', 'rawmeat', 'wheat', 'herb', 'bread', 'jam', 'caesar', 'fruitplatter'].forEach(t => trySell(t, 0));
  // 建造/制造材料（卖超出囤量部分）
  for (const t in BUILD_KEEP) trySell(t, BUILD_KEEP[t]);
}

// 买包策略（理性：口粮兜底 → 保树/岩 → 牛/羊(奶+毛毡) → 矿山(金币/锭引擎) → 买狗 → 机票）
function buyPacks(s) {
  const CH = (t) => META[t].charges || 1;
  const foodEq = (s.cards.blueberry || 0) + (s.cards.milk || 0) * 0.5 + (s.cards.cookedmeat || 0) * 2 + (s.cards.bread || 0) * 2;
  const wantFood = () => foodEq < s.units.length * 2 && (s.producers.bush || 0) === 0;   // 灌木耗尽才补口粮
  const wantPlant = () => (s.producers.farm || 0) < CH('farm') || (s.producers.herbfield || 0) < CH('herbfield');
  const wantMat = () => (s.producers.tree || 0) === 0 && (s.producers.rock || 0) === 0;
  const wantAnimal = () => cowCount(s) < 3 || (s.cards.sheep || 0) < 3;
  const wantMine = () => s.gold >= 30 && ((s.producers.iron || 0) < CH('iron') || (s.producers.gold || 0) < CH('gold'));
  const wantPet = () => dogCount(s) < 4;
  const tickets = (s.cards.ticket_xinjiang || 0) + (s.cards.ticket_maldives || 0) + (s.cards.ticket_kenya || 0) + (s.cards.ticket_nz || 0) + (s.cards.ticket_italy || 0) + (s.cards.ticket_iceland || 0);
  const wantTicket = () => tickets < 6 && (s.gold >= 60 || s.planeBuilt);
  const order = [['plant', wantFood, 0], ['material', wantMat, 0], ['animal', wantAnimal, 0], ['mine', wantMine, 0], ['plant', wantPlant, 0], ['pet', wantPet, 10], ['ticket', wantTicket, 30]];
  for (const [pid, want, reserve] of order) {
    const pk = PACKS.find(p => p.id === pid);
    if (!pk || !want()) continue;
    if (s.gold >= pk.price + reserve) {
      s.gold -= pk.price; s.spent += pk.price; s.buyStats[pid] = (s.buyStats[pid] || 0) + 1;
      packContents(pk).forEach(t => mk(s, t));
      break;
    }
  }
}

// 建造（材料足够即建，按优先级）
let __BUILD_TRACE = [];
function tryBuild(s, id, needs) {
  const r = RECIPES.find(x => x.id === id);
  if (!r || (s.buildings[r.out[0].type] || 0) > 0) return;
  const miss = [];
  for (const k in needs) if ((s.cards[k] || 0) < needs[k]) miss.push(k + '(' + (s.cards[k] || 0) + '/' + needs[k] + ')');
  if (miss.length && __BUILD_TRACE.length < 12) __BUILD_TRACE.push('d' + s.day + ' ' + id + ' MISS ' + miss.join(','));
  if (miss.length) return;
  for (const k in needs) rmv(s, k, needs[k]);
  mk(s, r.out[0].type);
  if (__BUILD_TRACE.length < 12) __BUILD_TRACE.push('d' + s.day + ' OK ' + id);
}
function build(s) {
  tryBuild(s, 'build_house', { wood: 3, stone: 3, branch: 2, felt: 2 });
  if ((s.buildings.house || 0) > 0) {
    tryBuild(s, 'build_lumberyard', { wood: 5, stone: 3 });
    tryBuild(s, 'build_quarry', { wood: 3, stone: 5 });
    tryBuild(s, 'build_smelter', { wood: 3, stone: 3, branch: 1, flint: 2 });
    tryBuild(s, 'build_kitchen', { wood: 3, stone: 3, flint: 2, felt: 2 });
    tryBuild(s, 'build_factory', { wood: 3, stone: 3, branch: 2, flint: 1 });
    tryBuild(s, 'build_wall', { stone: 3 });
  }
}

// 训狗（同种狗×2 + 房屋 → 强化第一只，消耗第二只）
function boostDogs(s) {
  if ((s.buildings.house || 0) === 0) return;
  DOG_BREEDS.forEach(b => {
    const same = s.units.filter(u => u.type === b);
    if (same.length >= 2) {
      const r = RECIPES.find(x => x.id === 'boost_' + b);
      const keep = same[0], dead = same[1];
      keep.atkBonus = (keep.atkBonus || 0) + (r.atk || 0);
      keep.hpBonus = (keep.hpBonus || 0) + (r.hp || 0);
      s.units = s.units.filter(u => u !== dead);
      rmv(s, b);
    }
  });
}
// 装备（铁剑+5攻 / 铁盾+5血，需制造厂+锭）
function equipDogs(s) {
  if ((s.buildings.factory || 0) === 0) return;
  s.units.filter(u => DOG_BREEDS.includes(u.type)).forEach(d => {
    if ((d.atkBonus || 0) < 8 && has(s, 'ironsword')) { rmv(s, 'ironsword'); d.atkBonus = (d.atkBonus || 0) + 5; }
    if ((d.hpBonus || 0) < 8 && has(s, 'ironshield')) { rmv(s, 'ironshield'); d.hpBonus = (d.hpBonus || 0) + 5; }
  });
  // 造武器
  if (has(s, 'ironingot') && has(s, 'wood', 2)) { rmv(s, 'ironingot'); rmv(s, 'wood', 2); s.cards.ironsword = (s.cards.ironsword || 0) + 1; }
  if (has(s, 'ironingot') && has(s, 'branch', 2)) { rmv(s, 'ironingot'); rmv(s, 'branch', 2); s.cards.ironshield = (s.cards.ironshield || 0) + 1; }
}

// 造飞机 + 飞 6 次（集齐 6 打卡图）
function tryPlane(s) {
  if (!s.planeBuilt && (s.buildings.factory || 0) > 0 && has(s, 'flint', 5) && has(s, 'branch', 5) && has(s, 'felt', 5) && has(s, 'ironingot', 3) && has(s, 'goldingot', 2)) {
    ['flint', 'branch', 'felt'].forEach(t => rmv(s, t, 5));
    rmv(s, 'ironingot', 3); rmv(s, 'goldingot', 2);
    s.cards.plane = (s.cards.plane || 0) + 1; s.planeBuilt = true;
  }
  if (s.planeBuilt && (s.cards.plane || 0) > 0) {
    ['ticket_xinjiang', 'ticket_maldives', 'ticket_kenya', 'ticket_nz', 'ticket_italy', 'ticket_iceland'].forEach(tk => {
      if ((s.cards[tk] || 0) > 0) { rmv(s, tk); rmv(s, 'plane'); s.checkins += 1; }
    });
  }
}

// 夜晚战斗（聚合模型）：每怪找能击杀的狗，狗受伤后继续；无人能杀→突破
function nightFight(s, day) {
  const walls = s.buildings.wall || 0;
  const table = nightMonsters(day);
  const types = table.slice(0, Math.max(0, table.length - walls)).map(v => MON_NAMES[v]);
  if (types.length === 0) return;
  const dogs = s.units.filter(u => DOG_BREEDS.includes(u.type)).map(u => ({ atk: META[u.type].atk + (u.atkBonus || 0), hp: (META[u.type].hp || 0) + (u.hpBonus || 0) }));
  for (const mt of types) {
    const mhp = META[mt].hp, matk = META[mt].atk, drop = META[mt].drop;
    // 选能击杀且剩血最多的狗
    let best = -1, bestLeft = -1;
    dogs.forEach((d, i) => {
      const rounds = Math.ceil(mhp / d.atk);
      const taken = matk * rounds;
      if (d.hp > taken && (d.hp - taken) > bestLeft) { best = i; bestLeft = d.hp - taken; }
    });
    if (best >= 0) { dogs[best].hp = bestLeft; s.kills += 1; s.nightKills += 1; s.gold += drop; s.earned += drop; }
    else { s.breaches += 1; } // 突破：该怪未被击杀（实际会攻击牧民/狗，此处记为压力点）
  }
  // 同步狗受伤/死亡回 units
  let di = 0;
  s.units = s.units.filter(u => {
    if (!DOG_BREEDS.includes(u.type)) return true;
    const d = dogs[di++]; return d && d.hp > 0;
  });
}

// 每日结算：喂食（优先保牧民）
function dayEnd(s) {
  const units = s.units.slice();
  const need = units.length;
  // 食物库存
  ['cookedmeat', 'bread', 'caesar', 'jam', 'milk', 'blueberry', 'rawmeat'].forEach(t => {
    while ((s.cards[t] || 0) > 0 && s.foodStock < need + 2) { rmv(s, t); s.foodStock += foodVal(t); }
  });
  if (s.foodStock >= need) { s.foodStock -= need; return 0; }
  // 食物不足：先扣狗，再扣牧民
  let dead = 0;
  const dogs = s.units.filter(u => DOG_BREEDS.includes(u.type));
  const hers = s.units.filter(u => u.type === 'herder');
  let need2 = need - s.foodStock; s.foodStock = 0;
  for (const d of dogs) { if (need2 <= 0) break; s.units = s.units.filter(u => u !== d); rmv(s, d.type); need2--; dead++; }
  for (const h of hers) { if (need2 <= 0) break; s.units = s.units.filter(u => u !== h); rmv(s, h.type); need2--; dead++; }
  return dead;
}

function checkTasks(s) {
  const herders = s.units.filter(u => u.type === 'herder').length;
  const houses = s.buildings.house || 0;
  const walls = s.buildings.wall || 0;
  const smelters = s.buildings.smelter || 0;
  const equipped = s.units.filter(u => DOG_BREEDS.includes(u.type) && ((u.atkBonus || 0) > 0 || (u.hpBonus || 0) > 0)).length;
  TASKS.forEach(t => {
    if (s.tasksDone[t.id]) return;
    let done = false;
    if (t.id === 't1') done = herders >= 3;
    else if (t.id === 't2') done = houses >= 1;
    else if (t.id === 't3') done = s.gold >= 50;
    else if (t.id === 't5') done = s.totalWood >= 10;
    else if (t.id === 't6') done = herders >= 5;
    else if (t.id === 't4') done = herders >= 8;
    else if (t.id === 't7') done = walls >= 1;
    else if (t.id === 't8') done = s.gold >= 200;
    else if (t.id === 't9') done = smelters >= 1;
    else if (t.id === 't10') done = equipped >= 1;
    if (done) { s.tasksDone[t.id] = true; s.gold += t.rew; }
  });
}

function step(s) {
  produce(s); sell(s); buyPacks(s); build(s); boostDogs(s); equipDogs(s); tryPlane(s); checkTasks(s);
}

function runSim(debug) {
  const s = newRun();
  // 新手礼包 8 张
  ['herder', 'herder', 'border_collie', 'tree', 'rock', 'bush', 'wood', 'stone'].forEach(t => mk(s, t));
  const goldByDay = {};
  for (let d = 1; d <= DAYS; d++) {
    s.day = d;
    for (let t = 0; t < DAY_PHASE; t += TICK) step(s);
    nightFight(s, d);
    const dead = dayEnd(s);
    goldByDay[d] = s.gold;
    if (s.units.filter(u => u.type === 'herder').length === 0) return { failed: true, day: d, gold: s.gold, planeBuilt: s.planeBuilt, checkins: s.checkins, breaches: s.breaches };
    if (s.planeBuilt && s.checkins >= 6) return { failed: false, day: d, gold: s.gold, planeBuilt: true, checkins: 6, breaches: s.breaches, goldByDay };
  }
  if (debug) console.error('DEBUG_END', JSON.stringify({
    buildings: s.buildings, felt: s.cards.felt || 0, ironingot: s.cards.ironingot || 0, goldingot: s.cards.goldingot || 0,
    ironore: s.cards.ironore || 0, goldore: s.cards.goldore || 0, pIron: s.producers.iron || 0, pGold: s.producers.gold || 0,
    flint: s.cards.flint || 0, branch: s.cards.branch || 0, wool: s.cards.wool || 0, sheep: s.cards.sheep || 0,
    wood: s.cards.wood || 0, stone: s.cards.stone || 0,
    tickets: (s.cards.ticket_xinjiang || 0) + (s.cards.ticket_maldives || 0) + (s.cards.ticket_kenya || 0) + (s.cards.ticket_nz || 0) + (s.cards.ticket_italy || 0) + (s.cards.ticket_iceland || 0),
    plane: s.cards.plane || 0, planeBuilt: s.planeBuilt, gold: s.gold, herders: s.units.filter(u => u.type === 'herder').length, dogs: dogCount(s),
    buyStats: s.buyStats
  }));
  if (debug && __BUILD_TRACE.length) console.error('BUILD_TRACE\n' + __BUILD_TRACE.join('\n'));
  if (debug) console.error('PROD_TRACE(day1-3) ' + JSON.stringify(__PROD_TRACE));
  return { failed: false, day: DAYS, gold: s.gold, planeBuilt: s.planeBuilt, checkins: s.checkins, breaches: s.breaches, goldByDay };
}

// —— 主跑 ——
const results = [];
let failures = 0, failDaySum = 0;
for (let i = 0; i < RUNS; i++) { const r = runSim(i === 0); if (r.failed) { failures++; failDaySum += r.day; } results.push(r); }
const done = results.filter(r => !r.failed);
const golds = done.map(r => r.gold).sort((a, b) => a - b);
const median = (a) => a[Math.floor(a.length / 2)];
const pct = (a, p) => a[Math.floor(a.length * p)];
const planeDone = done.filter(r => r.planeBuilt && r.checkins >= 6);
const planeDays = planeDone.map(r => r.day).sort((a, b) => a - b);

console.log('========== 牛牛农场 · 新世界观 数值校准 (Monte Carlo) ==========');
console.log('局数 ' + RUNS + ' | 每局 ' + DAYS + ' 天 (白天 ' + DAY_PHASE + 's/天) | TICK=' + TICK + 's');
console.log('\n—— 生存率 ——');
console.log('存活 ' + DAYS + ' 天: ' + (100 * done.length / RUNS).toFixed(1) + '%');
if (failures) console.log('饿死/崩盘局: ' + failures + ' (平均第 ' + (failDaySum / failures).toFixed(1) + ' 天)');
console.log('\n—— 金币（第 ' + DAYS + ' 天末，存活局）——');
console.log('中位 ¥' + median(golds) + ' | P25 ¥' + pct(golds, .25) + ' | P75 ¥' + pct(golds, .75) + ' | 最高 ¥' + golds[golds.length - 1]);
console.log('\n—— 造飞机 + 集齐 6 打卡图 ——');
if (planeDone.length) console.log('完成率: ' + (100 * planeDone.length / done.length).toFixed(1) + '% | 完成局到达天数 中位 ' + median(planeDays) + ' / P75 ' + pct(planeDays, .75) + ' / 最晚 ' + planeDays[planeDays.length - 1]);
else { const anyPlane = done.filter(r => r.planeBuilt).length; console.log('无局集齐 6 打卡图；仅造出飞机 ' + anyPlane + ' 局。'); }
console.log('\n—— 金币按天（存活局中位）——');
[5, 10, 15, 20, 30, 40].forEach(d => {
  const arr = done.map(r => (r.goldByDay && r.goldByDay[d]) || 0).sort((a, b) => a - b);
  if (arr.length) console.log('  第' + d + '天: ¥' + median(arr));
});
console.log('\n—— 夜晚突破统计（累计未被击杀的怪次数，存活局）——');
const br = done.map(r => r.breaches);
console.log('中位突破 ' + median(br) + ' | 最大 ' + Math.max(...br));
console.log('\n—— 卡包购买（平均/局）——');
const buyAgg = {}; done.forEach(r => { for (const k in r.buyStats) buyAgg[k] = (buyAgg[k] || 0) + r.buyStats[k]; });
console.log(Object.keys(buyAgg).map(k => k + ':' + (buyAgg[k] / done.length).toFixed(1)).join('  '));
