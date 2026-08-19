// 游戏常量与配置数据（对齐资料库「牛牛牧场」准绳版）

// ===================== 全局配置 =====================
export const DAY_LEN   = 90;     // 一个完整昼夜的秒数
export const DAY_FRAC  = 0.6;    // 白天占比例，其余为夜晚
export const CARD_W = 72, CARD_H = 90, STACK_OFF = 22;
export const TICK_MS = 500;      // 主循环步长
export const MON_SPEED = 14;     // 怪物每 TICK 移动像素
export const ENGAGE_DIST = 64;   // 怪物与防御者交战距离
export const MAX_STACK = 16;     // 单堆基础上限（有仓库时提高到 32）
export const COMBAT_SEC = 2;     // 战斗伤害结算间隔(秒)
export const SAVE_KEY = "niuniu_ranch_save_v1";

// ===================== 卡牌数据 =====================
// cat: unit / node / res / food / item / build / life / mon
// 资源点的产出改由 RECIPES 表驱动（见后文）
// produces: 该资源点被牧民工作时产出的卡 type；sec: 产出周期(秒)
// atk/hp: 战斗；food: 食物值(喂食)；sale: 出售价(0=不可卖)
// diet: 单位饥饿时自动进食的物资 type（每日结算：饱食不足则吃一个 diet 物资，没有则死亡）
// foodCap: 该单位饱食度上限（不同单位可不同，不再用全局 FOOD_CAP）
export const META = {
  // —— 单位 ——
  herder:{cat:"unit", emoji:"🧑‍🌾", label:"牧民", atk:1, hp:5, sale:0, diet:"blueberry", foodCap:10},
  dog:   {cat:"unit", emoji:"🐕", label:"牧羊犬", atk:4, hp:15, sale:0, diet:"rawmeat", foodCap:8},
// —— 资源点（牧民叠上去按配方产出，节点本身不消耗）——
// charges: 采集次数，每次产出后 -1，归零即消耗消失（暂定统一 1）
tree:     {cat:"node", emoji:"🌳", label:"树木", note:"牧民→木头×2 树枝×1", sale:0, charges:1},
rock:     {cat:"node", emoji:"⛰️", label:"岩石", note:"牧民→石头×2", sale:0, charges:1},
bush:     {cat:"node", emoji:"🌿", label:"蓝莓丛", note:"牧民→蓝莓×2", sale:0, charges:1},
iron:     {cat:"node", emoji:"🗻", label:"铁矿脉", note:"牧民→铁矿石×2", sale:0, charges:1},
gold:     {cat:"node", emoji:"💎", label:"金矿脉", note:"牧民→金矿石×1", sale:0, charges:1},
herbfield:{cat:"node", emoji:"🌱", label:"药田", note:"牧民→药草", sale:0, charges:1},
  // —— 资源 / 材料 ——
  wood:     {cat:"res", emoji:"🪵", label:"木头", sale:2},
  branch:   {cat:"res", emoji:"🍃", label:"树枝", sale:1},
  stone:    {cat:"res", emoji:"🪨", label:"石头", sale:2},
  ironore:  {cat:"res", emoji:"🔩", label:"铁矿石", sale:5},
  goldore:  {cat:"res", emoji:"🟡", label:"金矿石", sale:8},
  herb:     {cat:"res", emoji:"🌿", label:"药草", sale:2},
  wheat:    {cat:"res", emoji:"🌾", label:"小麦", sale:2},
  flour:    {cat:"res", emoji:"🥣", label:"面粉", sale:3},
  ironingot:{cat:"res", emoji:"⚙️", label:"铁锭", sale:10},
  goldingot:{cat:"res", emoji:"🪙", label:"金锭", sale:15},
  rawmeat:  {cat:"food", emoji:"🥩", label:"生肉", food:1, sale:3},
  // —— 装备 / 道具 ——
  sword:     {cat:"item", emoji:"🗡️", label:"木剑", sale:5},
  ironsword: {cat:"item", emoji:"⚔️", label:"铁剑", sale:12},
  woodshield:{cat:"item", emoji:"🛡️", label:"木盾", sale:5},
  ironshield:{cat:"item", emoji:"🪖", label:"铁盾", sale:12},
  axe:       {cat:"item", emoji:"🪓", label:"斧头", sale:5},
  pickaxe:   {cat:"item", emoji:"⛏️", label:"镐子", sale:5},
  torch:     {cat:"item", emoji:"🔥", label:"火把", sale:2},
  potion:    {cat:"item", emoji:"🧪", label:"治疗药水", sale:6},
  blueprint: {cat:"item", emoji:"📜", label:"冶炼厂图纸", sale:0},
  // —— 食物 ——
  blueberry:  {cat:"food", emoji:"🫐", label:"蓝莓", food:1, sale:1},
  bread:      {cat:"food", emoji:"🍞", label:"面包", food:3, sale:2},
  cookedmeat: {cat:"food", emoji:"🍖", label:"烤肉", food:4, sale:4},
  fruitplatter:{cat:"food", emoji:"🥗", label:"果蔬拼盘", food:3, sale:6},
  // —— 建筑 ——
  house:     {cat:"build", emoji:"🏠", label:"房屋", note:"人口+繁殖", sale:0},
  farm:      {cat:"build", emoji:"🏡", label:"农场", note:"牧民→小麦×2", sale:0},
  lumberyard:{cat:"build", emoji:"🪓", label:"伐木场", note:"牧民→木头×3", sale:0},
  quarry:    {cat:"build", emoji:"⚒️", label:"采石场", note:"牧民→石头×3", sale:0},
  smelter:   {cat:"build", emoji:"🔥", label:"冶炼厂", note:"冶炼铁/金锭", sale:0},
  kitchen:   {cat:"build", emoji:"🍳", label:"厨房", note:"烹饪食物", sale:0},
  warehouse: {cat:"build", emoji:"📦", label:"仓库", note:"堆叠上限↑", sale:0},
  wall:      {cat:"build", emoji:"🧱", label:"城墙", note:"减刷怪", sale:0},
  market:    {cat:"build", emoji:"🏪", label:"市场", note:"卖资源换钱", sale:0},
  kennel:    {cat:"build", emoji:"🏰", label:"兵营", note:"训练牧羊犬", sale:0},
  // —— 牲畜 ——
  pig:   {cat:"life", emoji:"🐷", label:"猪", note:"牧民→生肉×3", sale:15},
  sheep: {cat:"life", emoji:"🐑", label:"绵羊", note:"+兵营→牧羊犬", sale:15},
  // —— 怪物（夜间刷新）——
  thief: {cat:"mon", emoji:"🥷", label:"小偷", atk:1, hp:6, drop:8, sale:0},
  bandit:{cat:"mon", emoji:"👹", label:"大盗", atk:4, hp:16, drop:20, sale:0}
};

// 卡包定义
export const PACKS = [
  {id:"basic", name:"基础卡包", emoji:"📦", price:10,
    desc:"牧民/资源/食物/犬", items:[["herder",2],["dog",1],["bush",1],["tree",1],["rock",1],["blueberry",2],["wood",2]]},
  {id:"build", name:"建造卡包", emoji:"🏗️", price:25,
    desc:"建材/树枝/工具", items:[["wood",4],["stone",4],["branch",2],["axe",1]]},
  {id:"ranch", name:"牧场卡包", emoji:"🐮", price:30,
    desc:"牲畜/作物", items:[["pig",1],["sheep",1],["wheat",2]]},
  {id:"smith", name:"冶炼卡包", emoji:"⚒️", price:50,
    desc:"矿石/药草/图纸", items:[["iron",1],["gold",1],["herb",2],["blueprint",1]]},
  {id:"rare", name:"稀有卡包", emoji:"💎", price:60,
    desc:"铁矿/药水/烤肉", items:[["iron",1],["potion",1],["cookedmeat",2],["ironsword",1]]}
];

// 任务定义
export const TASKS = [
  {id:"t1", name:"雇佣 3 名牧民", check:function(s){return s.herders>=3;}, rew:15},
  {id:"t2", name:"建造 1 座房屋", check:function(s){return s.houses>=1;}, rew:20},
  {id:"t3", name:"金币达到 50", check:function(s){return s.gold>=50;}, rew:25},
  {id:"t4", name:"击杀 1 个怪物", check:function(s){return s.kills>=1;}, rew:20},
  {id:"t5", name:"产出 10 个木头", check:function(s){return s.totalWood>=10;}, rew:20},
  {id:"t6", name:"拥有 5 名牧民", check:function(s){return s.herders>=5;}, rew:30},
  {id:"t7", name:"建造城墙", check:function(s){return s.walls>=1;}, rew:25},
  {id:"t8", name:"金币达到 200", check:function(s){return s.gold>=200;}, rew:50},
  {id:"t9", name:"建造冶炼厂", check:function(s){return s.smelters>=1;}, rew:40},
  {id:"t10", name:"装备一件武器", check:function(s){return s.equipped>=1;}, rew:30}
];

// ===================== 配方表（数据驱动） =====================
// in: 所需卡牌及数量；out: 产出卡牌及数量；sec: 耗时(秒)
// consume: 完成后是否消耗输入（牧民与建筑永远不消耗；其余按规则消失）
// need: 需要场上存在该建筑；cooldown: 完成后该堆冷却(秒)
// 匹配规则（见 matchRecipe）：一堆卡可能同时满足多个配方（配方间存在"包含"关系，
// 如 房屋=木头×2+石头，而 伐木场=木头×4+石头）。为避免误判，matchRecipe 这样选：
//  ① 按 kind 分优先级：食用/装备(3) > 繁殖/宰杀/训练(2) > 建造/制作/冶炼/烹饪(1) > 被动生产(0)；
//  ② 同级内取"输入卡数最多(最具体)"的配方；再同级同具体度按数组顺序。
export const RECIPES = [
  // —— 食用 / 药剂 / 装备（即时类，最优先）——
  {id:"eat_blueberry", name:"食用蓝莓", in:{herder:1, blueberry:1}, out:[], sec:1, consume:true, kind:"eat", foodGain:1, label:"🫐 进食中"},
  {id:"eat_bread", name:"食用面包", in:{herder:1, bread:1}, out:[], sec:1, consume:true, kind:"eat", foodGain:3, label:"🍞 进食中"},
  {id:"eat_cookedmeat", name:"食用烤肉", in:{herder:1, cookedmeat:1}, out:[], sec:1, consume:true, kind:"eat", foodGain:4, hpGain:2, label:"🍖 进食中"},
  {id:"eat_fruitplatter", name:"食用果蔬拼盘", in:{herder:1, fruitplatter:1}, out:[], sec:1, consume:true, kind:"eat", foodGain:3, label:"🥗 进食中"},
  {id:"use_potion", name:"使用药水", in:{herder:1, potion:1}, out:[], sec:1, consume:true, kind:"potion", hpGain:10, label:"🧪 治疗中"},
  {id:"equip_sword", name:"装备木剑", in:{herder:1, sword:1}, out:[], sec:1, consume:true, kind:"equip", atk:1, label:"🗡️ 装备中"},
  {id:"equip_ironsword", name:"装备铁剑", in:{herder:1, ironsword:1}, out:[], sec:1, consume:true, kind:"equip", atk:3, label:"⚔️ 装备中"},
  {id:"equip_shield", name:"装备木盾", in:{herder:1, woodshield:1}, out:[], sec:1, consume:true, kind:"equip", hp:3, label:"🛡️ 装备中"},
  {id:"equip_ironshield", name:"装备铁盾", in:{herder:1, ironshield:1}, out:[], sec:1, consume:true, kind:"equip", hp:6, label:"🪖 装备中"},
  // —— 建造（动作类，优先于手工：凑齐建材即建成建筑，而非误做手工）——
  {id:"build_house", name:"建造房屋", in:{herder:1, wood:2, stone:1}, out:[{type:"house",n:1}], sec:15, consume:true, kind:"build", label:"🏠 建造中"},
  {id:"build_farm", name:"建造农场", in:{herder:1, wood:3, stone:1}, out:[{type:"farm",n:1}], sec:20, consume:true, kind:"build", label:"🏡 建造中"},
  {id:"build_lumberyard", name:"建造伐木场", in:{herder:1, wood:4, stone:1}, out:[{type:"lumberyard",n:1}], sec:20, consume:true, kind:"build", label:"🪓 建造中"},
  {id:"build_quarry", name:"建造采石场", in:{herder:1, wood:2, stone:3}, out:[{type:"quarry",n:1}], sec:20, consume:true, kind:"build", label:"⚒️ 建造中"},
  {id:"build_smelter", name:"建造冶炼厂", in:{herder:1, wood:2, stone:4, blueprint:1}, out:[{type:"smelter",n:1}], sec:25, consume:true, kind:"build", label:"🔥 建造中"},
  {id:"build_kitchen", name:"建造厨房", in:{herder:1, wood:2, stone:2}, out:[{type:"kitchen",n:1}], sec:18, consume:true, kind:"build", label:"🍳 建造中"},
  {id:"build_warehouse", name:"建造仓库", in:{herder:1, wood:4, stone:2}, out:[{type:"warehouse",n:1}], sec:22, consume:true, kind:"build", label:"📦 建造中"},
  {id:"build_wall", name:"建造城墙", in:{herder:1, stone:3}, out:[{type:"wall",n:1}], sec:12, consume:true, kind:"build", label:"🧱 建造中"},
  {id:"build_market", name:"建造市场", in:{herder:1, wood:3, stone:2}, out:[{type:"market",n:1}], sec:20, consume:true, kind:"build", label:"🏪 建造中"},
  {id:"build_kennel", name:"建造兵营", in:{herder:1, wood:4, stone:3, ironingot:1}, out:[{type:"kennel",n:1}], sec:25, consume:true, kind:"build", label:"🏰 建造中"},
  // —— 制作（手工）——
  {id:"craft_wooden_sword", name:"制作木剑", in:{herder:1, branch:2}, out:[{type:"sword",n:1}], sec:5, consume:true, kind:"craft", label:"🗡️ 制作中"},
  {id:"craft_iron_sword", name:"制作铁剑", in:{herder:1, ironingot:1, branch:1}, out:[{type:"ironsword",n:1}], sec:10, consume:true, kind:"craft", need:"smelter", label:"⚔️ 制作中"},
  {id:"craft_wooden_shield", name:"制作木盾", in:{herder:1, wood:2}, out:[{type:"woodshield",n:1}], sec:6, consume:true, kind:"craft", label:"🛡️ 制作中"},
  {id:"craft_iron_shield", name:"制作铁盾", in:{herder:1, ironingot:2, wood:1}, out:[{type:"ironshield",n:1}], sec:12, consume:true, kind:"craft", need:"smelter", label:"🪖 制作中"},
  {id:"craft_axe", name:"制作斧头", in:{herder:1, wood:1, stone:1}, out:[{type:"axe",n:1}], sec:6, consume:true, kind:"craft", label:"🪓 制作中"},
  {id:"craft_pickaxe", name:"制作镐子", in:{herder:1, wood:1, stone:2}, out:[{type:"pickaxe",n:1}], sec:6, consume:true, kind:"craft", label:"⛏️ 制作中"},
  {id:"craft_torch", name:"制作火把", in:{herder:1, branch:1}, out:[{type:"torch",n:1}], sec:3, consume:true, kind:"craft", label:"🔥 制作中"},
  {id:"craft_potion", name:"制作治疗药水", in:{herder:1, herb:2, blueberry:1}, out:[{type:"potion",n:1}], sec:8, consume:true, kind:"craft", label:"🧪 制作中"},
  // —— 冶炼（需冶炼厂）——
  {id:"smelt_iron", name:"冶炼铁锭", in:{herder:1, ironore:2}, out:[{type:"ironingot",n:1}], sec:10, consume:true, kind:"smelt", need:"smelter", label:"⚙️ 冶炼中"},
  {id:"smelt_gold", name:"冶炼金锭", in:{herder:1, goldore:2}, out:[{type:"goldingot",n:1}], sec:15, consume:true, kind:"smelt", need:"smelter", label:"🪙 冶炼中"},
  // —— 烹饪（需厨房）——
  {id:"mill_flour", name:"磨面粉", in:{herder:1, wheat:2}, out:[{type:"flour",n:1}], sec:5, consume:true, kind:"cook", label:"🌾 磨粉中"},
  {id:"cook_bread", name:"烤面包", in:{herder:1, flour:1}, out:[{type:"bread",n:1}], sec:8, consume:true, kind:"cook", need:"kitchen", label:"🍞 烘焙中"},
  {id:"cook_meat", name:"烤肉", in:{herder:1, rawmeat:1}, out:[{type:"cookedmeat",n:1}], sec:6, consume:true, kind:"cook", need:"kitchen", label:"🍖 烤肉中"},
  {id:"cook_platter", name:"果蔬拼盘", in:{herder:1, blueberry:3, herb:1}, out:[{type:"fruitplatter",n:1}], sec:10, consume:true, kind:"cook", need:"kitchen", label:"🥗 拼盘中"},
  // —— 宰杀 / 繁殖 / 训练 ——
  {id:"slaughter_pig", name:"宰杀猪", in:{herder:1, pig:1}, out:[{type:"rawmeat",n:3}], sec:3, consume:true, kind:"slaughter", label:"🔪 宰杀中"},
  {id:"breed_baby", name:"繁殖", in:{herder:2, house:1}, out:[{type:"herder",n:1}], sec:10, consume:true, kind:"breed", cooldown:120, label:"👶 繁殖中"},
  {id:"train_dog", name:"训练牧羊犬", in:{herder:1, sheep:1, kennel:1}, out:[{type:"dog",n:1}], sec:15, consume:true, kind:"train", label:"🐕 训练中"},
  // —— 建筑生产（被动，建筑已建好后的自动产出）——
  {id:"prod_lumberyard", name:"伐木", in:{herder:1, lumberyard:1}, out:[{type:"wood",n:3}], sec:6, consume:false, kind:"produce", label:"🪓 生产中"},
  {id:"prod_quarry", name:"采石", in:{herder:1, quarry:1}, out:[{type:"stone",n:3}], sec:6, consume:false, kind:"produce", label:"⚒️ 生产中"},
  {id:"prod_farm", name:"种植", in:{herder:1, farm:1}, out:[{type:"wheat",n:2}], sec:4, consume:false, kind:"produce", label:"🌾 种植中"},
  // —— 采集（资源点，节点不消耗，被动生产，最后匹配）——
  {id:"gather_wood", name:"伐木", in:{herder:1, tree:1}, out:[{type:"wood",n:2},{type:"branch",n:1}], sec:8, consume:false, kind:"produce", label:"🌳 砍伐中"},
  {id:"gather_stone", name:"采石", in:{herder:1, rock:1}, out:[{type:"stone",n:2}], sec:8, consume:false, kind:"produce", label:"⛰️ 采石中"},
  {id:"gather_blueberry", name:"采蓝莓", in:{herder:1, bush:1}, out:[{type:"blueberry",n:2}], sec:5, consume:false, kind:"produce", label:"🌿 采摘中"},
  {id:"gather_iron", name:"采铁矿", in:{herder:1, iron:1}, out:[{type:"ironore",n:2}], sec:12, consume:false, kind:"produce", label:"🗻 开采中"},
  {id:"gather_gold", name:"采金矿", in:{herder:1, gold:1}, out:[{type:"goldore",n:1}], sec:15, consume:false, kind:"produce", label:"💎 开采中"},
  {id:"gather_herb", name:"采药草", in:{herder:1, herbfield:1}, out:[{type:"herb",n:1}], sec:4, consume:false, kind:"produce", label:"🌱 采集中"}
];

// 取单位饱食度上限：META 中 foodCap 缺失时回退到 1（兜底）
export function foodCapOf(type) {
  const m = META[type];
  return m && m.foodCap ? m.foodCap : 1;
}
