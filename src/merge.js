// 堆行为规则层（纯逻辑，不碰 DOM）：配方匹配 / 堆行为解释 / 执行 / 战斗
// 原「合并 / 产出 / 喂草」规则已由数据驱动的 RECIPES 配方表取代（对齐资料库准绳版）

import { META, RECIPES, COMBAT_SEC, foodCapOf } from './config.js';
import { mk, countType, removeCardObj, markSeen, maxStack, spawnNear } from './state.js';

export function isFood(type) { return !!(META[type] && META[type].cat === "food"); }
export function isSellable(type) { return !!(META[type] && META[type].sale > 0); }

// ===================== pileAction：解释每堆的行为 =====================
// 返回 {type, sec, label, recipe} 或 null
export function pileAction(game, p) {
  const cards = p.cards;
  if (cards.length === 0) return null;
  const monster = cards.find(c => META[c.type].cat === "mon");
  const hasHerder = cards.some(c => c.type === "herder");
  const hasDog = cards.some(c => c.type === "dog");
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
const KIND_PRI = { eat: 3, potion: 3, equip: 3, slaughter: 2, breed: 2, train: 2, build: 1, craft: 1, smelt: 1, cook: 1, produce: 0 };

function recipeWeight(r) {
  let s = 0;
  for (const k in r.in) s += r.in[k];
  return { pri: KIND_PRI[r.kind] || 0, spec: s, idx: RECIPES.indexOf(r) };
}

export function matchRecipe(game, p) {
  const cnt = {};
  p.cards.forEach(c => { cnt[c.type] = (cnt[c.type] || 0) + 1; });
  let best = null, bestW = null;
  for (let i = 0; i < RECIPES.length; i++) {
    const r = RECIPES[i];
    if (r.need && countType(game, r.need) === 0) continue;   // 前置建筑不在场
    if (r.cooldown && p.cd > 0) continue;                    // 冷却中
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
      if (META[k] && META[k].cat === "build") continue;   // 建筑(房屋/兵营/市场)不消耗
      p.cards = removeN(p.cards, k, r.in[k]);
    }
  }
  // 产出（堆叠上限保护）
  if (r.kind === "produce" && p.cards.length >= maxStack(game)) { return; }
  // 采集/生产/制作类配方：生成物掉落到附近空白处（spawnNear + 掉落动画）
  // craft 类产物掉落而非叠入原堆，避免装备/工具卡被「牧民直接吃掉」（即时触发 equip）
  if (r.kind === "produce" || r.kind === "craft") {
    const outCards = [];
    r.out.forEach(o => { for (let i = 0; i < o.n; i++) outCards.push(mk(game, o.type)); });
    outCards.forEach(c => { markSeen(game, c.type); if (c.type === "wood") game.state.stats.totalWood++; });
    const target = spawnNear(game, p, outCards);
    // 记录掉落动画（由渲染层在 tick 中消费）
    if (!game.state._drops) game.state._drops = [];
    game.state._drops.push({ from: p, to: target });
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
  // 即时效果
  if (r.kind === "eat" || r.kind === "potion") {
    const h = p.cards.find(c => c.type === "herder");
    if (h) {
      if (r.foodGain) { h.fed = Math.min(foodCapOf(h.type), (h.fed || 0) + r.foodGain); toast(game, "🍽 " + r.name + "：饱食 " + h.fed); }
      if (r.hpGain) { if (h.hp == null) h.hp = META.herder.hp; h.hp += r.hpGain; toast(game, "❤️ " + r.name + "：血量+" + r.hpGain); }
    }
  }
  if (r.kind === "equip") {
    const h2 = p.cards.find(c => c.type === "herder");
    if (h2) {
      h2.atkBonus = (h2.atkBonus || 0) + (r.atk || 0);
      h2.hpBonus = (h2.hpBonus || 0) + (r.hp || 0);
      toast(game, "🛡️ 装备成功！攻击+" + (r.atk || 0) + " 血量+" + (r.hp || 0));
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
  const def = p.cards.find(c => c.type === "dog") || p.cards.find(c => c.type === "herder");
  if (!monster || !def) return;
  if (monster.hp == null) monster.hp = META[monster.type].hp;
  if (def.hp == null) def.hp = META[def.type].hp;
  const defAtk = META[def.type].atk + (def.atkBonus || 0);
  monster.hp -= defAtk;
  def.hp -= META[monster.type].atk;
  if (monster.hp <= 0) { killMonster(game, p, monster); }
  else if (def.hp <= 0) { removeCardObj(game, def); toast(game, "💀 " + META[def.type].label + " 倒下了"); }
}

function removeN(cards, type, n) {
  let removed = 0;
  return cards.filter(c => { if (c.type === type && removed < n) { removed++; return false; } return true; });
}

function killMonster(game, p, monster) {
  const drop = META[monster.type].drop || 0;
  game.state.gold += drop;
  game.state.stats.kills++;
  removeCardObj(game, monster);
  toast(game, "🗡 击败" + META[monster.type].label + "！+¥" + drop);
}

// 为避免循环引用，toast 由外层注入
let toast = () => {};
export function bindToast(fn) { toast = fn; }
