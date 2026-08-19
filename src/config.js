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
// —— 资源点（牧民叠上去按配方产出，每次采集消耗 1 次，归零即消失）——
// charges: 采集次数（2026-08-19 经济修复 P0：限制无限产出通胀；树/岩/莓 5 次、矿 8 次 [PLACEHOLDER·待 playtest]）
tree:     {cat:"node", emoji:"🌳", label:"树木", note:"牧民→木头×2 树枝×1", sale:0, charges:1},
rock:     {cat:"node", emoji:"⛰️", label:"岩石", note:"牧民→石头×2", sale:0, charges:1},
bush:     {cat:"node", emoji:"🌿", label:"蓝莓丛", note:"牧民→蓝莓×2", sale:0, charges:1},
iron:     {cat:"node", emoji:"🗻", label:"铁矿脉", note:"牧民→铁矿石×2", sale:0, charges:1},
gold:     {cat:"node", emoji:"💎", label:"金矿脉", note:"牧民→金矿石×1", sale:0, charges:1},
herbfield:{cat:"node", emoji:"🌱", label:"药田", note:"牧民→药草", sale:0, charges:1},
farm:     {cat:"node", emoji:"🌾", label:"麦田", note:"牧民→小麦×2（一次性）", sale:0, charges:1},
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
  // —— 装备 / 道具 ——
  sword:     {cat:"item", emoji:"🗡️", label:"木剑", sale:5},
  ironsword: {cat:"item", emoji:"⚔️", label:"铁剑", sale:12},
  woodshield:{cat:"item", emoji:"🛡️", label:"木盾", sale:5},
  ironshield:{cat:"item", emoji:"🪖", label:"铁盾", sale:12},
  axe:       {cat:"item", emoji:"🪓", label:"斧头", sale:5},
  pickaxe:   {cat:"item", emoji:"⛏️", label:"镐子", sale:5},
  potion:    {cat:"item", emoji:"🧪", label:"治疗药水", sale:6, charges:2},
  // —— 食物 ——
  blueberry:  {cat:"food", emoji:"🫐", label:"蓝莓", food:1, sale:1},
  bread:      {cat:"food", emoji:"🍞", label:"面包", food:3, sale:2},
  cookedmeat: {cat:"food", emoji:"🍖", label:"烤肉", food:4, sale:4},
  fruitplatter:{cat:"food", emoji:"🥗", label:"果蔬拼盘", food:3, sale:6},
  milk:       {cat:"food", emoji:"🥛", label:"牛奶", food:1, sale:2},
  rawmeat:  {cat:"food", emoji:"🥩", label:"生肉", food:1, sale:3},
  // —— 建筑 ——
  house:     {cat:"build", emoji:"🏠", label:"房屋", note:"人口+繁殖", sale:0},
  lumberyard:{cat:"build", emoji:"🪓", label:"伐木场", note:"牧民→木头×3", sale:0},
  quarry:    {cat:"build", emoji:"⚒️", label:"采石场", note:"牧民→石头×3", sale:0},
  smelter:   {cat:"build", emoji:"🔥", label:"冶炼厂", note:"冶炼铁/金锭", sale:0},
  kitchen:   {cat:"build", emoji:"🍳", label:"厨房", note:"烹饪食物", sale:0},
  warehouse: {cat:"build", emoji:"📦", label:"仓库", note:"堆叠上限↑", sale:0},
  wall:      {cat:"build", emoji:"🧱", label:"城墙", note:"减刷怪", sale:0},
  // —— 牲畜 ——
  pig:   {cat:"life", emoji:"🐷", label:"猪", note:"牧民→生肉×3", sale:15},
  // 普通牛：动物卡包 80% 概率开出（产奶），变异牛仅 20%（见 COW_BREEDS 收藏体系）
  cow:    {cat:"life", emoji:"🐮", label:"普通牛", note:"牧民→牛奶（产奶）", sale:30, rarity:1, cowKind:"cow"},
  // 变异牛 12 种（动物卡包 20% 概率开出时随机一种），稀有度影响出售价与收藏
  qixi:   {cat:"life", emoji:"🐮", label:"七夕牛", note:"普通·产奶", sale:30, rarity:1, cowKind:"cow"},
  duanwu: {cat:"life", emoji:"🐂", label:"端午牛", note:"普通·产奶", sale:30, rarity:1, cowKind:"cow"},
  yuandan:{cat:"life", emoji:"🐃", label:"元旦牛", note:"普通·产奶", sale:30, rarity:1, cowKind:"cow"},
  taifeng:{cat:"life", emoji:"🦬", label:"太疯牛", note:"稀有·产奶", sale:40, rarity:2, cowKind:"cow"},
  yimou:  {cat:"life", emoji:"🐮", label:"易某牛", note:"稀有·产奶", sale:40, rarity:2, cowKind:"cow"},
  jingshen:{cat:"life", emoji:"🐂", label:"景深牛", note:"稀有·产奶", sale:40, rarity:2, cowKind:"cow"},
  shanmu: {cat:"life", emoji:"🐃", label:"山牡牛", note:"史诗·产奶", sale:55, rarity:3, cowKind:"cow"},
  hema:   {cat:"life", emoji:"🦬", label:"河马牛", note:"史诗·产奶", sale:55, rarity:3, cowKind:"cow"},
  dingdong:{cat:"life", emoji:"🐮", label:"丁冬牛", note:"史诗·产奶", sale:55, rarity:3, cowKind:"cow"},
  agu:    {cat:"life", emoji:"🐂", label:"A股牛", note:"传说·产奶", sale:75, rarity:4, cowKind:"cow"},
  ai:     {cat:"life", emoji:"🐃", label:"AI牛", note:"传说·产奶", sale:75, rarity:4, cowKind:"cow"},
  qiguo:  {cat:"life", emoji:"🦬", label:"奇异果牛", note:"传说·产奶", sale:75, rarity:4, cowKind:"cow"},
  // —— 怪物（夜间刷新）——
  thief: {cat:"mon", emoji:"🥷", label:"小偷", atk:1, hp:6, drop:8, sale:0},
  bandit:{cat:"mon", emoji:"👹", label:"大盗", atk:4, hp:16, drop:20, sale:0}
};

// ===================== 变异牛品种 =====================
// 牛家族：milk_cow 配方 in:{cow:1} 匹配任意品种（见 merge.matchRecipe 的 COW_ALIAS）
// 卡包开出 "cow" 时按权重随机替换为具体品种（普通>稀有>史诗>传说）
export const COW_BREEDS = ["qixi", "duanwu", "yuandan", "taifeng", "yimou", "jingshen", "shanmu", "hema", "dingdong", "agu", "ai", "qiguo"];
// 变异牛稀有度权重（普通40/稀有30/史诗20/传说10），randCowBreed 按此先选稀有度再均匀随机品种
export const COW_WEIGHTS = [40, 30, 20, 10];

// 卡包定义（2026-08-19 重构：基础/牧场/动物/植物/建筑）
// 动物卡包：pool 随机抽出 count 种，各 1 张；其余卡包固定 items
export const PACKS = [
  {id:"basic", name:"基础卡包", emoji:"📦", price:10,
    desc:"蓝莓丛/树木/岩石", items:[["bush",1],["tree",1],["rock",1]]},
  {id:"ranch", name:"牧场卡包", emoji:"🧑‍🌾", price:20,
    desc:"牧民×1", items:[["herder",1]]},
  {id:"animal", name:"动物卡包", emoji:"🐑", price:20,
    desc:"猪/狗/牛 随机出 2 个（牛随机品种）", pool:["pig","dog","cow"], count:2},
  {id:"plant", name:"植物卡包", emoji:"🌾", price:15, // [PLACEHOLDER·价格待确认]
    desc:"麦田/药田", items:[["farm",1],["herbfield",1]]},
  {id:"building", name:"建筑卡包", emoji:"🏗️", price:30,
    desc:"铁矿脉/金矿脉", items:[["iron",1],["gold",1]]}
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
  {id:"use_potion", name:"使用药水", in:{herder:1, potion:1}, out:[], sec:1, consume:false, kind:"potion", hpGain:5, label:"🧪 治疗中"},
  {id:"use_potion_dog", name:"给狗用药", in:{dog:1, potion:1}, out:[], sec:1, consume:false, kind:"potion", hpGain:5, label:"🧪 治疗中"},
  {id:"equip_sword", name:"狗装备木剑", in:{dog:1, sword:1}, out:[], sec:1, consume:true, kind:"equip", atk:1, label:"🗡️ 装备中"},
  {id:"equip_ironsword", name:"狗装备铁剑", in:{dog:1, ironsword:1}, out:[], sec:1, consume:true, kind:"equip", atk:3, label:"⚔️ 装备中"},
  {id:"equip_shield", name:"狗装备木盾", in:{dog:1, woodshield:1}, out:[], sec:1, consume:true, kind:"equip", hp:3, label:"🛡️ 装备中"},
  {id:"equip_ironshield", name:"狗装备铁盾", in:{dog:1, ironshield:1}, out:[], sec:1, consume:true, kind:"equip", hp:6, label:"🪖 装备中"},
  // —— 建造（动作类，优先于手工：凑齐建材即建成建筑，而非误做手工）——
  {id:"build_house", name:"建造房屋", in:{herder:1, wood:2, stone:1}, out:[{type:"house",n:1}], sec:15, consume:true, kind:"build", label:"🏠 建造中"},
  {id:"build_lumberyard", name:"建造伐木场", in:{herder:1, wood:4, stone:1}, out:[{type:"lumberyard",n:1}], sec:20, consume:true, kind:"build", label:"🪓 建造中"},
  {id:"build_quarry", name:"建造采石场", in:{herder:1, wood:2, stone:3}, out:[{type:"quarry",n:1}], sec:20, consume:true, kind:"build", label:"⚒️ 建造中"},
  {id:"build_smelter", name:"建造冶炼厂", in:{herder:1, wood:2, stone:4}, out:[{type:"smelter",n:1}], sec:25, consume:true, kind:"build", label:"🔥 建造中"},
  {id:"build_kitchen", name:"建造厨房", in:{herder:1, wood:2, stone:2}, out:[{type:"kitchen",n:1}], sec:18, consume:true, kind:"build", label:"🍳 建造中"},
  {id:"build_warehouse", name:"建造仓库", in:{herder:1, wood:4, stone:2}, out:[{type:"warehouse",n:1}], sec:22, consume:true, kind:"build", label:"📦 建造中"},
  {id:"build_wall", name:"建造城墙", in:{herder:1, stone:3}, out:[{type:"wall",n:1}], sec:12, consume:true, kind:"build", label:"🧱 建造中"},
  // —— 制作（手工）——
  {id:"craft_wooden_sword", name:"制作木剑", in:{herder:1, branch:2}, out:[{type:"sword",n:1}], sec:5, consume:true, kind:"craft", label:"🗡️ 制作中"},
  {id:"craft_iron_sword", name:"制作铁剑", in:{herder:1, ironingot:1, branch:1}, out:[{type:"ironsword",n:1}], sec:10, consume:true, kind:"craft", need:"smelter", label:"⚔️ 制作中"},
  {id:"craft_wooden_shield", name:"制作木盾", in:{herder:1, wood:3}, out:[{type:"woodshield",n:1}], sec:6, consume:true, kind:"craft", label:"🛡️ 制作中"},
  {id:"craft_iron_shield", name:"制作铁盾", in:{herder:1, ironingot:2, wood:1}, out:[{type:"ironshield",n:1}], sec:12, consume:true, kind:"craft", need:"smelter", label:"🪖 制作中"},
  {id:"craft_axe", name:"制作斧头", in:{herder:1, wood:1, stone:1}, out:[{type:"axe",n:1}], sec:6, consume:true, kind:"craft", label:"🪓 制作中"},
  {id:"craft_pickaxe", name:"制作镐子", in:{herder:1, wood:1, stone:2}, out:[{type:"pickaxe",n:1}], sec:6, consume:true, kind:"craft", label:"⛏️ 制作中"},
  {id:"craft_potion", name:"制作治疗药水", in:{herder:1, herb:3}, out:[{type:"potion",n:1}], sec:8, consume:true, kind:"craft", label:"🧪 制作中"},
  // —— 冶炼（需冶炼厂）——
  {id:"smelt_iron", name:"冶炼铁锭", in:{herder:1, ironore:2}, out:[{type:"ironingot",n:1}], sec:10, consume:true, kind:"smelt", need:"smelter", label:"⚙️ 冶炼中"},
  {id:"smelt_gold", name:"冶炼金锭", in:{herder:1, goldore:2}, out:[{type:"goldingot",n:1}], sec:15, consume:true, kind:"smelt", need:"smelter", label:"🪙 冶炼中"},
  // —— 烹饪（全部需厨房）——
  {id:"mill_flour", name:"磨面粉", in:{herder:1, wheat:2}, out:[{type:"flour",n:1}], sec:5, consume:true, kind:"cook", need:"kitchen", label:"🌾 磨粉中"},
  {id:"cook_bread", name:"烤面包", in:{herder:1, milk:1, flour:1}, out:[{type:"bread",n:1}], sec:8, consume:true, kind:"cook", need:"kitchen", label:"🍞 烘焙中"},
  {id:"cook_meat", name:"烤肉", in:{herder:1, rawmeat:1}, out:[{type:"cookedmeat",n:1}], sec:6, consume:true, kind:"cook", need:"kitchen", label:"🍖 烤肉中"},
  {id:"cook_platter", name:"果蔬拼盘", in:{herder:1, blueberry:3}, out:[{type:"fruitplatter",n:1}], sec:10, consume:true, kind:"cook", need:"kitchen", label:"🥗 拼盘中"},
  // —— 宰杀 / 繁殖 / 训练 / 畜牧 ——
  {id:"slaughter_pig", name:"宰杀猪", in:{herder:1, pig:1}, out:[{type:"rawmeat",n:3}], sec:3, consume:true, kind:"slaughter", label:"🔪 宰杀中"},
  // 牛是持续资产：牧民+任意品种牛 产奶不消耗牛（品种间配方通用，见 COW_KINDS）
  {id:"milk_cow", name:"挤牛奶", in:{herder:1, cow:1}, out:[{type:"milk",n:1}], sec:4, consume:false, kind:"produce", label:"🥛 挤奶中"},
  {id:"breed_baby", name:"繁殖", in:{herder:2, house:1}, out:[{type:"herder",n:1}], sec:10, consume:true, kind:"breed", cooldown:120, label:"👶 繁殖中"},
  // —— 建筑生产（被动，建筑已建好后的自动产出）——
  {id:"prod_lumberyard", name:"伐木", in:{herder:1, lumberyard:1}, out:[{type:"wood",n:3}], sec:6, consume:false, kind:"produce", label:"🪓 生产中"},
  {id:"prod_quarry", name:"采石", in:{herder:1, quarry:1}, out:[{type:"stone",n:3}], sec:6, consume:false, kind:"produce", label:"⚒️ 生产中"},
  // —— 采集（资源点，每次采集消耗 charges，归零即消失；麦田一次性）——
  {id:"gather_wood", name:"伐木", in:{herder:1, tree:1}, out:[{type:"wood",n:2},{type:"branch",n:1}], sec:8, consume:false, kind:"produce", label:"🌳 砍伐中"},
  {id:"gather_stone", name:"采石", in:{herder:1, rock:1}, out:[{type:"stone",n:2}], sec:8, consume:false, kind:"produce", label:"⛰️ 采石中"},
  {id:"gather_blueberry", name:"采蓝莓", in:{herder:1, bush:1}, out:[{type:"blueberry",n:2}], sec:5, consume:false, kind:"produce", label:"🌿 采摘中"},
  {id:"gather_iron", name:"采铁矿", in:{herder:1, iron:1}, out:[{type:"ironore",n:2}], sec:12, consume:false, kind:"produce", label:"🗻 开采中"},
  {id:"gather_gold", name:"采金矿", in:{herder:1, gold:1}, out:[{type:"goldore",n:1}], sec:15, consume:false, kind:"produce", label:"💎 开采中"},
  {id:"gather_herb", name:"采药草", in:{herder:1, herbfield:1}, out:[{type:"herb",n:1}], sec:4, consume:false, kind:"produce", label:"🌱 采集中"},
  {id:"gather_farm", name:"收割小麦", in:{herder:1, farm:1}, out:[{type:"wheat",n:2}], sec:4, consume:false, kind:"produce", label:"🌾 收割中"}
];

// 取单位饱食度上限：META 中 foodCap 缺失时回退到 1（兜底）
export function foodCapOf(type) {
  const m = META[type];
  return m && m.foodCap ? m.foodCap : 1;
}
