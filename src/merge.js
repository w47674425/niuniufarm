// 堆行为规则层（纯逻辑，不碰 DOM）：配方匹配 / 堆行为解释 / 执行 / 战斗
// 原「合并 / 产出 / 喂草」规则已由数据驱动的 RECIPES 配方表取代（对齐资料库准绳版）

import { META, RECIPES, COMBAT_SEC, foodCapOf, COW_BREEDS, DOG_BREEDS, TICKET } from './config.js';
import { mk, countType, removeCardObj, markSeen, maxStack, spawnNear } from './state.js';
import * as audio from './audio.js';

export function isFood(type) { return !!(META[type] && META[type].cat === "food"); }
export function isSellable(type) { return !!(META[type] && META[type].sale > 0); }

// 牛家族：配方 in:{cow:1} 匹配任意品种（变异牛 都算 cow）
const COW_ALIAS = {};
COW_BREEDS.forEach(t => { COW_ALIAS[t] = "cow"; });
Object.keys(META).forEach(t => { if (META[t].cowKind === "cow") COW_ALIAS[t] = "cow"; });

// 牧羊犬家族：5 种狗（宠物店）归入 "dog"，装备/药水/战斗配方 in:{dog:1} 对任意狗生效
const DOG_ALIAS = {};
DOG_BREEDS.forEach(t => { DOG_ALIAS[t] = "dog"; });
export function isDogCard(c) { return !!(c && (c.type === "dog" || DOG_ALIAS[c.type])); }

// 单位别名：牧民 + 任意狗 都归 "unit"（进食配方 in:{unit:1} 通用，属性点表）
const UNIT_ALIAS = { herder: "unit", dog: "unit" };
DOG_BREEDS.forEach(t => { UNIT_ALIAS[t] = "unit"; });
export function isUnitCard(c) { return !!(c && (c.type === "herder" || isDogCard(c))); }

// ===================== pileAction：解释每堆的行为 =====================
// 返回 {type, sec, label, recipe} 或 null
export function pileAction(game, p) {
  const cards = p.cards;
  if (cards.length === 0) return null;
  const monster = cards.find(c => META[c.type].cat === "mon");
  const hasHerder = cards.some(c => c.type === "herder");
  const hasDog = cards.some(isDogCard);
  // 战斗：怪物 + 防御者(牧民/狗) 同堆
  if (monster && (hasHerder || hasDog)) return { type: "fight", sec: COMBAT_SEC, label: "⚔️ 战斗中", recipe: null };
  // 配方匹配
  const r = matchRecipe(game, p);
  if (r) return { type: r.id, sec: r.sec, label: r.label, recipe: r };
  return null;
}

// ===================== 配方匹配 =====================
// 优先级（kind → 权重）：食用/装备 最高，其次 繁殖/宰杀/训练，
// 再次 建造/制作/冶炼/烹饪，最低 被动生产(采集/建筑产出)。
// 同级内取"输入卡数最多(最具体)"的配方，以正确处理"包含关系"的配方，
// 例如 木头×2+石头 既能建房屋也能建伐木场(木头×4+石头)，应优先建伐木场。
const KIND_PRI = { eat: 3, potion: 3, equip: 3, boost: 2, slaughter: 2, breed: 2, train: 2, build: 1, craft: 1, smelt: 1, cook: 1, produce: 0 };

function recipeWeight(r) {
  let s = 0;
  for (const k in r.in) s += r.in[k];
  return { pri: KIND_PRI[r.kind] || 0, spec: s, idx: RECIPES.indexOf(r) };
}

export function matchRecipe(game, p) {
  const cnt = {};
  p.cards.forEach(c => {
    // 牛品种归一到家族名，使配方 in:{cow:1} 对任意品种生效
    const key = COW_ALIAS[c.type] || c.type;
    cnt[key] = (cnt[key] || 0) + 1;
    // 狗同时计入 dog 与 unit（装备配方 in:{dog:1} + 进食配方 in:{unit:1} 都可用）
    if (c.type === "dog" || DOG_ALIAS[c.type]) {
      cnt.dog = (cnt.dog || 0) + 1;
      cnt.unit = (cnt.unit || 0) + 1;
    }
    // 牧民计入 unit（进食通用）
    if (c.type === "herder") cnt.unit = (cnt.unit || 0) + 1;
  });
  let best = null, bestW = null;
  for (let i = 0; i < RECIPES.length; i++) {
    const r = RECIPES[i];
    if (r.need && countType(game, r.need) === 0) continue;   // 前置建筑不在场
    if (r.cooldown && p.cd > 0) continue;                    // 冷却中
    // 牛每日限量：每头牛每天最多挤 2 次（配额跟牛走，非全局；跨天重置见 onDayEnd）
    if (r.id === "milk_cow") {
      const quotaCow = p.cards.some(c => META[c.type] && META[c.type].cowKind && (c.milkToday || 0) < 2);
      if (!quotaCow) continue;
    }
    // 羊每日限量：每只羊每天产毛 2 瓶×1 次（配额跟羊走）
    if (r.id === "sheep_wool") {
      const quotaSheep = p.cards.some(c => c.type === "sheep" && (c.sheepToday || 0) < 1);
      if (!quotaSheep) continue;
    }
    // 伐木场/采石场每日限量 1 次（策划：产出×6+3）
    if (r.id === "prod_lumberyard" && (game.state.lumberToday || 0) >= 1) continue;
    if (r.id === "prod_quarry" && (game.state.quarryToday || 0) >= 1) continue;
    let ok = true;
    for (const k in r.in) { if ((cnt[k] || 0) < r.in[k]) { ok = false; break; } }
    if (!ok) continue;
    const w = recipeWeight(r);
    if (!best
      || w.pri > bestW.pri
      || (w.pri === bestW.pri && w.spec > bestW.spec)
      || (w.pri === bestW.pri && w.spec === bestW.spec && w.idx < bestW.idx)) {
      best = r; bestW = w;
    }
  }
  return best;
}

export function doAction(game, p, info) {
  if (info.type === "fight") { fightStep(game, p); return; }
  applyRecipe(game, p, info.recipe);
}

// 执行配方：消耗输入(牧民与建筑除外)→产出→即时效果
function applyRecipe(game, p, r) {
  if (r.consume) {
    for (const k in r.in) {
      if (k === "herder") continue;                       // 牧民永不消耗
      if (META[k] && (META[k].cat === "build" || META[k].cat === "unit")) continue; // 建筑/单位不消耗
      // 牛家族：消耗任意品种的牛
      if (COW_ALIAS[k]) {
        p.cards = removeCow(p.cards, r.in[k]);
      } else {
        p.cards = removeN(p.cards, k, r.in[k]);
      }
    }
  }
  // 产出（堆叠上限保护）
  if (r.kind === "produce" && p.cards.length >= maxStack(game)) { return; }
  // 采集/生产/制作类配方：生成物掉落到附近空白处（spawnNear + 掉落动画）
  // craft 类产物掉落而非叠入原堆，避免装备/工具卡被「牧民直接吃掉」（即时触发 equip）
  if (r.kind === "produce" || r.kind === "craft") {
    // 多种产物各占一堆（如砍树：木头堆与树枝堆分开掉落，不叠加）
    const groups = r.out.map(o => {
      const cards = [];
      for (let i = 0; i < o.n; i++) cards.push(mk(game, o.type));
      return cards;
    });
    if (!game.state._drops) game.state._drops = [];
    groups.forEach(g => {
      g.forEach(c => { markSeen(game, c.type); if (c.type === "wood") game.state.stats.totalWood++; });
      const target = spawnNear(game, p, g);
      // 记录掉落动画（由渲染层在 tick 中消费）
      game.state._drops.push({ from: p, to: target });
    });
  } else {
    r.out.forEach(o => {
      for (let i = 0; i < o.n; i++) {
        const c = mk(game, o.type);
        p.cards.push(c);
        markSeen(game, o.type);
        if (o.type === "wood") game.state.stats.totalWood++;
      }
    });
  }
  // 挤奶计数：配额跟牛走（每头牛每天最多 2 次）
  if (r.id === "milk_cow") {
    const cow = p.cards.find(c => META[c.type] && META[c.type].cowKind && (c.milkToday || 0) < 2);
    if (cow) cow.milkToday = (cow.milkToday || 0) + 1;
  }
  // 剪毛计数：配额跟羊走（每只羊每天 1 次）
  if (r.id === "sheep_wool") {
    const sheep = p.cards.find(c => c.type === "sheep" && (c.sheepToday || 0) < 1);
    if (sheep) sheep.sheepToday = (sheep.sheepToday || 0) + 1;
  }
  // 伐木场/采石场每日限量 1 次
  if (r.id === "prod_lumberyard") game.state.lumberToday = (game.state.lumberToday || 0) + 1;
  if (r.id === "prod_quarry") game.state.quarryToday = (game.state.quarryToday || 0) + 1;
  // 资源点采集次数：每次采集 -1，归零即消耗消失（仅采集类配方：输入含 node 卡）
  const rInputsNode = Object.keys(r.in).some(k => META[k] && META[k].cat === "node" && META[k].charges);
  if (r.kind === "produce" && rInputsNode) {
    const node = p.cards.find(c => META[c.type] && META[c.type].cat === "node" && META[c.type].charges);
    if (node) {
      node.charges = (node.charges || META[node.type].charges) - 1;
      if (node.charges <= 0) {
        p.cards = p.cards.filter(c => c !== node);
        toast(game, META[node.type].emoji + " " + META[node.type].label + " 采集完毕，已消失");
      }
    }
  }
  // 繁殖冷却（房屋 120s）
  if (r.kind === "breed") { p.cd = r.cooldown; }
  // 即时效果：进食（unit 通用：牧民或狗，优先牧民）
  if (r.kind === "eat" || r.kind === "potion") {
    // 药水一次一次消耗：每次使用扣 1 次；用完即消失；
    // 若还有剩余则从堆中弹出掉落到旁边（需玩家重新拖放才用第二次，避免自动连用）
    const potion = r.kind === "potion" ? p.cards.find(c => c.type === "potion") : null;
    if (potion) {
      potion.charges = (potion.charges != null ? potion.charges : META.potion.charges) - 1;
      p.cards = p.cards.filter(c => c !== potion);
      if (potion.charges > 0) {
        const target = spawnNear(game, p, [potion]);
        if (!game.state._drops) game.state._drops = [];
        game.state._drops.push({ from: p, to: target });
      }
    }
    // 进食目标：优先牧民，其次任意狗
    const eater = p.cards.find(c => c.type === "herder") || p.cards.find(isDogCard);
    if (eater) {
      if (r.foodGain) { eater.fed = Math.min(foodCapOf(eater.type), (eater.fed || 0) + r.foodGain); toast(game, "🍽 " + META[eater.type].label + " 食用" + r.name + "：饱食 " + eater.fed); }
      if (r.hpGain) { if (eater.hp == null) eater.hp = META[eater.type].hp; eater.hp += r.hpGain; toast(game, "❤️ " + r.name + "：血量+" + r.hpGain + (potion && potion.charges > 0 ? "（药水剩 " + potion.charges + " 次）" : "")); }
    }
  }
  // 同种狗强化（属性点表）：保留第一只，消耗第二只，攻/血成长
  if (r.kind === "boost") {
    const breed = Object.keys(r.in).find(k => META[k] && META[k].cat === "unit" && DOG_BREEDS.includes(k));
    if (breed) {
      const dogs = p.cards.filter(c => c.type === breed);
      if (dogs.length >= 2) {
        const keep = dogs[0], sacrifice = dogs[1];
        keep.atkBonus = (keep.atkBonus || 0) + (r.atk || 0);
        keep.hpBonus = (keep.hpBonus || 0) + (r.hp || 0);
        removeCardObj(game, sacrifice);
        toast(game, "🐕 " + META[breed].label + " 训练完成！攻击+" + (r.atk || 0) + " 血量+" + (r.hp || 0));
      }
    }
  }
  if (r.kind === "equip") {
    // 装备只给牧羊犬穿戴（牧民不能穿）
    const dog = p.cards.find(isDogCard);
    if (dog) {
      dog.atkBonus = (dog.atkBonus || 0) + (r.atk || 0);
      dog.hpBonus = (dog.hpBonus || 0) + (r.hp || 0);
      toast(game, "🛡️ " + META[dog.type].label + " 装备成功！攻击+" + (r.atk || 0) + " 血量+" + (r.hp || 0));
    }
  }
  if (r.kind === "build") { toast(game, "🔨 建成：" + r.name.replace("建造", "")); }
  else if (r.kind === "breed") { toast(game, "👶 一名新牧民出生！"); }
  else if (r.kind === "train") { toast(game, "🐕 牧羊犬训练完成！"); }
  else if (r.kind === "slaughter") { toast(game, "🔪 宰杀完成，获得生肉"); }
}

// 战斗一步：防御者攻击怪物，怪物反击
function fightStep(game, p) {
  const monster = p.cards.find(c => META[c.type].cat === "mon");
  const def = p.cards.find(isDogCard) || p.cards.find(c => c.type === "herder");
  if (!monster || !def) return;
  if (monster.hp == null) monster.hp = META[monster.type].hp;
  if (def.hp == null) def.hp = META[def.type].hp;
  const defAtk = META[def.type].atk + (def.atkBonus || 0);
  monster.hp -= defAtk;
  def.hp -= META[monster.type].atk;
  if (monster.hp <= 0) { killMonster(game, p, monster); }
  else if (def.hp <= 0) { removeCardObj(game, def); toast(game, "💀 " + META[def.type].label + " 倒下了"); }
  else { audio.play("combat.hit"); }
}

function removeN(cards, type, n) {
  let removed = 0;
  return cards.filter(c => { if (c.type === type && removed < n) { removed++; return false; } return true; });
}

// 消耗 n 头任意品种的牛
function removeCow(cards, n) {
  let removed = 0;
  return cards.filter(c => { if (COW_ALIAS[c.type] && removed < n) { removed++; return false; } return true; });
}

function killMonster(game, p, monster) {
  const drop = META[monster.type].drop || 0;
  game.state.gold += drop;
  game.state.stats.kills++;
  removeCardObj(game, monster);
  audio.play("combat.kill");
  toast(game, "🗡 击败" + META[monster.type].label + "！+" + TICKET + drop);
}

// 为避免循环引用，toast 由外层注入
let toast = () => {};
export function bindToast(fn) { toast = fn; }
