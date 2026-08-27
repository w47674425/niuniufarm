// 游戏常量与配置数据（对齐资料库「牛牛牧场」准绳版）

// ===================== 全局配置 =====================
export const DAY_LEN   = 90;     // 一个完整昼夜的秒数
export const DAY_FRAC  = 0.6;    // 白天占比例，其余为夜晚
export const CARD_W = 96, CARD_H = 120, STACK_OFF = 28;   // 横屏 1920×1080 基准放大
export const TICK_MS = 1000 / 30;   // 主循环步长（30Hz；游戏内计时一律以秒为单位，见 tick 的 dt 换算）
export const MON_SPEED = 14;     // 怪物每 TICK 移动像素
export const ENGAGE_DIST = 64;   // 怪物与防御者交战距离
export const MAX_STACK = 16;     // 单堆基础上限（有仓库时提高到 32）
export const COMBAT_SEC = 2;     // 战斗伤害结算间隔(秒)
export const SAVE_KEY = "niuniu_ranch_save_v1";
export const META_KEY = "niuniu_meta_v1";          // 全局 Meta 槽（护照章 / 成就占位）
// 货币：内部字段仍是 gold，仅 UI 显示（当前为金币）
export const TICKET = "💰";     // 货币图标
export const MONEY_NAME = "金币";

// ===================== 卡牌数据 =====================
// cat: unit / node / res / food / item / build / life / mon
// 资源点的产出改由 RECIPES 表驱动（见后文）
// produces: 该资源点被牧民工作时产出的卡 type；sec: 产出周期(秒)
// atk/hp: 战斗；food: 食物值(喂食)；sale: 出售价(0=不可卖)
// diet: 单位饥饿时自动进食的物资 type（每日结算：饱食不足则吃一个 diet 物资，没有则死亡）
// foodCap: 该单位饱食度上限（不同单位可不同，不再用全局 FOOD_CAP）
export const META = {
  // —— 单位 ——
  // 牧民（策划图鉴：牧民（一一）/牧民（二二），仅 2 名）：无攻击属性，专职生产；被怪攻击时不会反击
  herder:{cat:"unit", emoji:"🧑‍🌾", label:"牧民", hp:5, sale:0, diet:"blueberry", foodCap:5},
  dog:   {cat:"unit", emoji:"🐕", label:"牧羊犬", atk:4, hp:15, sale:0, diet:"rawmeat", foodCap:8},
  // —— 5 种牧羊犬（宠物店随机出，属性见策划「属性点」表；DOG_ALIAS 归入 dog 家族）——
  border_collie:  {cat:"unit", emoji:"🐕", label:"边牧", atk:4, hp:6, sale:0, diet:"rawmeat", foodCap:5},
  golden:         {cat:"unit", emoji:"🦮", label:"金毛", atk:6, hp:4, sale:0, diet:"rawmeat", foodCap:5},
  husky:          {cat:"unit", emoji:"🐺", label:"哈士奇", atk:8, hp:2, sale:0, diet:"rawmeat", foodCap:5},
  german_shepherd:{cat:"unit", emoji:"🐕‍🦺", label:"德牧", atk:6, hp:4, sale:0, diet:"rawmeat", foodCap:5},
  corgi:          {cat:"unit", emoji:"🐶", label:"柯基", atk:2, hp:8, sale:0, diet:"rawmeat", foodCap:5},
// —— 资源点（牧民叠上去按配方产出，每次采集消耗 1 次，归零即消失）——
// charges: 采集次数（2026-08-27 用户拍板：全部 =1，采集一次即消失，靠建材店/植物店补充）
tree:     {cat:"node", emoji:"🌳", label:"树木", note:"牧民→木头×2 树枝×1", sale:0, charges:1},
rock:     {cat:"node", emoji:"⛰️", label:"岩石", note:"牧民→石头×2", sale:0, charges:1},
bush:     {cat:"node", emoji:"🌿", label:"蓝莓丛", note:"牧民→蓝莓×2", sale:0, charges:1},
iron:     {cat:"node", emoji:"🗻", label:"铁矿脉", note:"牧民→铁矿石×2", sale:0, charges:1},
gold:     {cat:"node", emoji:"💎", label:"金矿脉", note:"牧民→金矿石×1", sale:0, charges:1},
herbfield:{cat:"node", emoji:"🌱", label:"药田", note:"牧民→药草", sale:0, charges:1},
farm:     {cat:"node", emoji:"🌾", label:"麦田", note:"牧民→小麦×2", sale:0, charges:1},
  // —— 资源 / 材料 ——
  wood:     {cat:"res", emoji:"🪵", label:"木头", sale:2},
  branch:   {cat:"res", emoji:"🍃", label:"树枝", sale:1},
  felt:     {cat:"res", emoji:"🧶", label:"毛毡", sale:2},
  wool:     {cat:"res", emoji:"🧵", label:"羊毛", sale:2},
  flint:    {cat:"res", emoji:"🔪", label:"燧石", sale:2},
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
  plane:     {cat:"item", emoji:"✈️", label:"飞机", note:"带上机票环游世界", sale:0},
  // —— 食物 ——
  blueberry:  {cat:"food", emoji:"🫐", label:"蓝莓", food:1, sale:1},
  bread:      {cat:"food", emoji:"🍞", label:"面包", food:3, sale:2},
  cookedmeat: {cat:"food", emoji:"🍖", label:"烤肉", food:4, sale:4},
  fruitplatter:{cat:"food", emoji:"🥗", label:"果蔬拼盘", food:3, sale:6},
  jam:        {cat:"food", emoji:"🫙", label:"蓝莓酱", food:2, sale:4},
  caesar:     {cat:"food", emoji:"🥗", label:"凯撒沙拉", food:5, sale:8},
  milk:       {cat:"food", emoji:"🥛", label:"牛奶", food:1, sale:2},
  rawmeat:  {cat:"food", emoji:"🥩", label:"生肉", food:1, sale:3},
  // —— 建筑 ——
  house:     {cat:"build", emoji:"🏠", label:"房屋", note:"同种牧羊犬×2 可在此训练强化", sale:0},
  lumberyard:{cat:"build", emoji:"🪓", label:"伐木场", note:"牧民→木头×6 树枝×3（每日1次）", sale:0},
  quarry:    {cat:"build", emoji:"⚒️", label:"采石场", note:"牧民→石头×6 燧石×3（每日1次）", sale:0},
  smelter:   {cat:"build", emoji:"🔥", label:"冶炼厂", note:"冶炼铁/金锭", sale:0},
  factory:   {cat:"build", emoji:"🏭", label:"制造厂", note:"打造武器/飞机", sale:0},
  kitchen:   {cat:"build", emoji:"🍳", label:"厨房", note:"烹饪食物", sale:0},
  // —— 旅行打卡图（飞机+机票 产出，收藏进旅行护照）——
  photo_xinjiang: {cat:"item", emoji:"🏜️", label:"新疆打卡图", note:"已收藏进旅行护照", sale:0},
  photo_maldives: {cat:"item", emoji:"🏝️", label:"马尔代夫打卡图", note:"已收藏进旅行护照", sale:0},
  photo_kenya:    {cat:"item", emoji:"🦁", label:"肯尼亚打卡图", note:"已收藏进旅行护照", sale:0},
  photo_nz:       {cat:"item", emoji:"🐑", label:"新西兰打卡图", note:"已收藏进旅行护照", sale:0},
  photo_italy:    {cat:"item", emoji:"🍕", label:"意大利打卡图", note:"已收藏进旅行护照", sale:0},
  photo_iceland:  {cat:"item", emoji:"❄️", label:"冰岛打卡图", note:"已收藏进旅行护照", sale:0},
  // —— 牲畜 ——
  pig:   {cat:"life", emoji:"🐷", label:"猪", note:"牧民→生肉×3", sale:15},
  sheep: {cat:"life", emoji:"🐑", label:"羊", note:"牧民→羊毛×2（产毛）", sale:20},
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
  // —— 怪物（夜间刷新，属性/价值对齐策划「小偷」表）——
  thief:    {cat:"mon", emoji:"🥷", label:"小偷", atk:1, hp:3, drop:10, sale:0},
  bandit:   {cat:"mon", emoji:"👹", label:"大盗", atk:2, hp:6, drop:20, sale:0},
  capitalist:{cat:"mon", emoji:"🕴️", label:"资本家", atk:3, hp:12, drop:30, sale:0},
  spy:      {cat:"mon", emoji:"🕵️", label:"间谍", atk:4, hp:20, drop:50, sale:0},
  // —— 世界机票（机票盲盒开出；飞机+机票→打卡图，迭代3 接玩法）——
  ticket_xinjiang: {cat:"item", emoji:"✈️🏜️", label:"新疆机票", note:"新疆 · 打卡图", sale:0},
  ticket_maldives: {cat:"item", emoji:"✈️🏝️", label:"马尔代夫机票", note:"马尔代夫 · 打卡图", sale:0},
  ticket_kenya:    {cat:"item", emoji:"✈️🦁", label:"肯尼亚机票", note:"肯尼亚 · 打卡图", sale:0},
  ticket_nz:       {cat:"item", emoji:"✈️🐑", label:"新西兰机票", note:"新西兰 · 打卡图", sale:0},
  ticket_italy:    {cat:"item", emoji:"✈️🍕", label:"意大利机票", note:"意大利 · 打卡图", sale:0},
  ticket_iceland:  {cat:"item", emoji:"✈️❄️", label:"冰岛机票", note:"冰岛 · 打卡图", sale:0}
};

// ===================== 变异牛品种 =====================
// 牛家族：milk_cow 配方 in:{cow:1} 匹配任意品种（见 merge.matchRecipe 的 COW_ALIAS）
// 卡包开出 "cow" 时按权重随机替换为具体品种（普通>稀有>史诗>传说）
export const COW_BREEDS = ["qixi", "duanwu", "yuandan", "taifeng", "yimou", "jingshen", "shanmu", "hema", "dingdong", "agu", "ai", "qiguo"];
// 变异牛稀有度权重（普通40/稀有30/史诗20/传说10），randCowBreed 按此先选稀有度再均匀随机品种
export const COW_WEIGHTS = [40, 30, 20, 10];

// 牧羊犬品种（宠物店随机出；DOG_ALIAS 归入 "dog" 家族使装备/战斗配方通用）
export const DOG_BREEDS = ["border_collie", "golden", "husky", "german_shepherd", "corgi"];

// 卡包定义（2026-08-19 重构：基础/牧场/动物/植物/建筑）
// 动物卡包：pool 随机抽出 count 种，各 1 张；其余卡包固定 items
// 卡包定义（2026-08-27 迭代2：对齐策划「卡包」表 6 类）
// pool：随机抽出 count 种各 1 张（重复项模拟策划概率）；items：固定内容
export const PACKS = [
  {id:"pet", name:"宠物店", emoji:"🐕", price:20,
    desc:"随机出一只牧羊犬（边牧/金毛/哈士奇/德牧/柯基）",
    pool:["border_collie","golden","husky","german_shepherd","corgi"], count:1},
  {id:"material", name:"建材店", emoji:"🪵", price:10,
    desc:"树木×1 / 岩石×1", items:[["tree",1],["rock",1]]},
  {id:"plant", name:"植物店", emoji:"🌾", price:15,
    desc:"麦田×1 / 药田×1 / 蓝莓丛×1", items:[["farm",1],["herbfield",1],["bush",1]]},
  {id:"animal", name:"动物店", emoji:"🐑", price:20,
    desc:"牛/羊/猪 随机出一只（牛随机品种）",
    pool:["cow","cow","cow","sheep","sheep","sheep","pig","pig","pig","pig"], count:1},
  {id:"mine", name:"矿山", emoji:"🗻", price:30,
    desc:"铁矿脉/金矿脉 随机出一座",
    pool:["iron","iron","iron","iron","iron","iron","iron","iron","iron","gold"], count:1},
  {id:"ticket", name:"机票盲盒", emoji:"✈️", price:50,
    desc:"随机一张世界机票（新疆/马尔代夫/肯尼亚/新西兰/意大利/冰岛）",
    pool:["ticket_xinjiang","ticket_xinjiang","ticket_xinjiang","ticket_maldives","ticket_maldives","ticket_kenya","ticket_kenya","ticket_nz","ticket_italy","ticket_iceland"], count:1}
];

// 任务定义（对齐策划「任务」表 10 条；check 接收 game.state，可访问 stats 与全局状态）
export const TASKS = [
  {id:"t1", name:"打开新手礼包", check:function(s){return !!s.packOpened;}, rew:10},
  {id:"t2", name:"获得十个木头", check:function(s){return s.stats.totalWood>=10;}, rew:10},
  {id:"t3", name:"拥有两只牧羊犬", check:function(s){return s.stats.dogs>=2;}, rew:20},
  {id:"t4", name:"装备一件武器", check:function(s){return s.stats.equipped>=1;}, rew:30},
  {id:"t5", name:"建造房屋", check:function(s){return s.stats.houses>=1;}, rew:20},
  {id:"t6", name:"建造冶炼厂", check:function(s){return s.stats.smelters>=1;}, rew:30},
  {id:"t7", name:"采集十瓶牛奶", check:function(s){return s.stats.milkProduced>=10;}, rew:10},
  {id:"t8", name:"建造飞机", check:function(s){return s.stats.planes>=1;}, rew:50},
  {id:"t9", name:"首次旅行", check:function(s){return s.stats.trips>=1;}, rew:50},
  {id:"t10", name:"成功驱逐一个小偷", check:function(s){return s.stats.kills>=1;}, rew:10}
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
  // —— 食用 / 药剂 / 装备（即时类，最优先；eat 用 unit 通用：牧民+5种狗都可吃，见属性点表）——
  {id:"eat_blueberry", name:"食用蓝莓", in:{unit:1, blueberry:1}, out:[], sec:1, consume:true, kind:"eat", foodGain:1, label:"🫐 进食中"},
  {id:"eat_milk", name:"喝牛奶", in:{unit:1, milk:1}, out:[], sec:1, consume:true, kind:"eat", foodGain:1, label:"🥛 喝奶中"},
  {id:"eat_bread", name:"食用面包", in:{unit:1, bread:1}, out:[], sec:1, consume:true, kind:"eat", foodGain:3, label:"🍞 进食中"},
  {id:"eat_cookedmeat", name:"食用烤肉", in:{unit:1, cookedmeat:1}, out:[], sec:1, consume:true, kind:"eat", foodGain:3, label:"🍖 进食中"},
  {id:"eat_jam", name:"食用蓝莓酱", in:{unit:1, jam:1}, out:[], sec:1, consume:true, kind:"eat", foodGain:2, label:"🫙 进食中"},
  {id:"eat_caesar", name:"食用凯撒沙拉", in:{unit:1, caesar:1}, out:[], sec:1, consume:true, kind:"eat", foodGain:5, label:"🥗 进食中"},
  {id:"use_potion", name:"使用药水", in:{unit:1, potion:1}, out:[], sec:1, consume:false, kind:"potion", hpGain:5, label:"🧪 治疗中"},
  {id:"equip_sword", name:"狗装备木剑", in:{dog:1, sword:1}, out:[], sec:1, consume:true, kind:"equip", atk:1, label:"🗡️ 装备中"},
  {id:"equip_ironsword", name:"狗装备铁剑", in:{dog:1, ironsword:1}, out:[], sec:1, consume:true, kind:"equip", atk:5, label:"⚔️ 装备中"},
  {id:"equip_shield", name:"狗装备木盾", in:{dog:1, woodshield:1}, out:[], sec:1, consume:true, kind:"equip", hp:1, label:"🛡️ 装备中"},
  {id:"equip_ironshield", name:"狗装备铁盾", in:{dog:1, ironshield:1}, out:[], sec:1, consume:true, kind:"equip", hp:5, label:"🪖 装备中"},
  // —— 同种狗强化（属性点表：狗×2+房屋 → 保留第一只，消耗第二只，攻/血成长）——
  {id:"boost_border_collie", name:"边牧训练", in:{border_collie:2, house:1}, out:[], sec:10, consume:true, kind:"boost", atk:2, hp:3, label:"🐕 训练中"},
  {id:"boost_golden", name:"金毛训练", in:{golden:2, house:1}, out:[], sec:10, consume:true, kind:"boost", atk:3, hp:2, label:"🦮 训练中"},
  {id:"boost_husky", name:"哈士奇训练", in:{husky:2, house:1}, out:[], sec:10, consume:true, kind:"boost", atk:4, hp:1, label:"🐺 训练中"},
  {id:"boost_german_shepherd", name:"德牧训练", in:{german_shepherd:2, house:1}, out:[], sec:10, consume:true, kind:"boost", atk:3, hp:2, label:"🐕‍🦺 训练中"},
  {id:"boost_corgi", name:"柯基训练", in:{corgi:2, house:1}, out:[], sec:10, consume:true, kind:"boost", atk:1, hp:4, label:"🐶 训练中"},
  // —— 建造（动作类，优先于手工：凑齐建材即建成建筑，而非误做手工）——
  // —— 建造（2026-08-27 迭代3：对齐策划「合成」表建材）——
  {id:"build_house", name:"建造房屋", in:{herder:1, wood:3, stone:3, branch:2, felt:2}, out:[{type:"house",n:1}], sec:15, consume:true, kind:"build", label:"🏠 建造中"},
  {id:"build_lumberyard", name:"建造伐木场", in:{herder:1, wood:5, stone:3}, out:[{type:"lumberyard",n:1}], sec:20, consume:true, kind:"build", label:"🪓 建造中"},
  {id:"build_quarry", name:"建造采石场", in:{herder:1, wood:3, stone:5}, out:[{type:"quarry",n:1}], sec:20, consume:true, kind:"build", label:"⚒️ 建造中"},
  {id:"build_smelter", name:"建造冶炼厂", in:{herder:1, wood:3, stone:3, branch:1, flint:2}, out:[{type:"smelter",n:1}], sec:25, consume:true, kind:"build", label:"🔥 建造中"},
  {id:"build_factory", name:"建造制造厂", in:{herder:1, wood:3, stone:3, branch:2, flint:1}, out:[{type:"factory",n:1}], sec:28, consume:true, kind:"build", label:"🏭 建造中"},
  {id:"build_kitchen", name:"建造厨房", in:{herder:1, wood:3, stone:3, flint:2, felt:2}, out:[{type:"kitchen",n:1}], sec:18, consume:true, kind:"build", label:"🍳 建造中"},
  // —— 制作（手工；武器类全部需制造厂）——
  {id:"craft_wooden_sword", name:"制作木剑", in:{herder:1, factory:1, wood:2}, out:[{type:"sword",n:1}], sec:5, consume:true, kind:"craft", label:"🗡️ 制作中"},
  {id:"craft_iron_sword", name:"制作铁剑", in:{herder:1, factory:1, wood:2, ironingot:1}, out:[{type:"ironsword",n:1}], sec:10, consume:true, kind:"craft", label:"⚔️ 制作中"},
  {id:"craft_wooden_shield", name:"制作木盾", in:{herder:1, factory:1, branch:2}, out:[{type:"woodshield",n:1}], sec:6, consume:true, kind:"craft", label:"🛡️ 制作中"},
  {id:"craft_iron_shield", name:"制作铁盾", in:{herder:1, factory:1, branch:2, ironingot:1}, out:[{type:"ironshield",n:1}], sec:12, consume:true, kind:"craft", label:"🪖 制作中"},
  {id:"craft_axe", name:"制作斧头", in:{herder:1, wood:3, stone:2}, out:[{type:"axe",n:1}], sec:6, consume:true, kind:"craft", label:"🪓 制作中"},
  {id:"craft_pickaxe", name:"制作镐子", in:{herder:1, wood:2, stone:3}, out:[{type:"pickaxe",n:1}], sec:6, consume:true, kind:"craft", label:"⛏️ 制作中"},
  {id:"craft_potion", name:"制作治疗药水", in:{herder:1, herb:2}, out:[{type:"potion",n:1}], sec:8, consume:true, kind:"craft", label:"🧪 制作中"},
  {id:"craft_felt", name:"织毛毡", in:{herder:1, wool:2}, out:[{type:"felt",n:1}], sec:6, consume:true, kind:"craft", label:"🧶 织毛毡中"},
  // —— 冶炼（需冶炼厂）——
  {id:"smelt_iron", name:"冶炼铁锭", in:{herder:1, ironore:2}, out:[{type:"ironingot",n:1}], sec:10, consume:true, kind:"smelt", need:"smelter", label:"⚙️ 冶炼中"},
  {id:"smelt_gold", name:"冶炼金锭", in:{herder:1, goldore:2}, out:[{type:"goldingot",n:1}], sec:15, consume:true, kind:"smelt", need:"smelter", label:"🪙 冶炼中"},
  // —— 烹饪（厨房）——
  {id:"mill_flour", name:"磨面粉", in:{herder:1, wheat:2}, out:[{type:"flour",n:1}], sec:5, consume:true, kind:"cook", label:"🌾 磨粉中"},
  {id:"cook_bread", name:"烤面包", in:{herder:1, flour:2}, out:[{type:"bread",n:1}], sec:8, consume:true, kind:"cook", need:"kitchen", label:"🍞 烘焙中"},
  {id:"cook_meat", name:"烤肉", in:{herder:1, rawmeat:1}, out:[{type:"cookedmeat",n:1}], sec:6, consume:true, kind:"cook", need:"kitchen", label:"🍖 烤肉中"},
  {id:"cook_jam", name:"熬蓝莓酱", in:{herder:1, blueberry:2}, out:[{type:"jam",n:1}], sec:8, consume:true, kind:"cook", need:"kitchen", label:"🫙 熬制中"},
  {id:"cook_caesar", name:"凯撒沙拉", in:{herder:1, blueberry:1, flour:1, rawmeat:1}, out:[{type:"caesar",n:1}], sec:12, consume:true, kind:"cook", need:"kitchen", label:"🥗 拌制中"},
  // —— 宰杀 / 畜牧 ——（策划合成表：无繁殖，牧民固定 2 名（一一/二二））
  {id:"slaughter_pig", name:"宰杀猪", in:{herder:1, pig:1}, out:[{type:"rawmeat",n:3}], sec:3, consume:true, kind:"slaughter", label:"🔪 宰杀中"},
  // 牛/羊是持续资产：产奶/产毛不消耗（每日配额跟卡走）
  {id:"milk_cow", name:"挤牛奶", in:{herder:1, cow:1}, out:[{type:"milk",n:1}], sec:4, consume:false, kind:"produce", label:"🥛 挤奶中"},
  {id:"sheep_wool", name:"剪羊毛", in:{herder:1, sheep:1}, out:[{type:"wool",n:2}], sec:4, consume:false, kind:"produce", label:"🧵 剪毛中"},
  // —— 建筑生产（被动，需工具，每日一次配额）——
  {id:"prod_lumberyard", name:"伐木", in:{herder:1, lumberyard:1, axe:1}, out:[{type:"wood",n:6},{type:"branch",n:3}], sec:6, consume:false, kind:"produce", label:"🪓 生产中"},
  {id:"prod_quarry", name:"采石", in:{herder:1, quarry:1, pickaxe:1}, out:[{type:"stone",n:6},{type:"flint",n:3}], sec:6, consume:false, kind:"produce", label:"⚒️ 生产中"},
  // —— 采集（资源点，每次采集消耗 charges，归零即消失）——
  {id:"gather_wood", name:"伐木", in:{herder:1, tree:1}, out:[{type:"wood",n:2},{type:"branch",n:1}], sec:8, consume:false, kind:"produce", label:"🌳 砍伐中"},
  {id:"gather_stone", name:"采石", in:{herder:1, rock:1}, out:[{type:"stone",n:2},{type:"flint",n:1}], sec:8, consume:false, kind:"produce", label:"⛰️ 采石中"},
  {id:"gather_blueberry", name:"采蓝莓", in:{herder:1, bush:1}, out:[{type:"blueberry",n:2}], sec:5, consume:false, kind:"produce", label:"🌿 采摘中"},
  {id:"gather_iron", name:"采铁矿", in:{herder:1, iron:1}, out:[{type:"ironore",n:2}], sec:12, consume:false, kind:"produce", label:"🗻 开采中"},
  {id:"gather_gold", name:"采金矿", in:{herder:1, gold:1}, out:[{type:"goldore",n:2}], sec:15, consume:false, kind:"produce", label:"💎 开采中"},
  {id:"gather_herb", name:"采药草", in:{herder:1, herbfield:1}, out:[{type:"herb",n:2}], sec:4, consume:false, kind:"produce", label:"🌱 采集中"},
  {id:"gather_farm", name:"收割小麦", in:{herder:1, farm:1}, out:[{type:"wheat",n:2}], sec:4, consume:false, kind:"produce", label:"🌾 收割中"},
  // —— 飞机链（制造厂+材料 → 飞机；飞机+机票 → 打卡图，收藏进护照）——
  {id:"craft_plane", name:"制造飞机", in:{herder:1, factory:1, flint:5, branch:5, felt:5, ironingot:3, goldingot:2}, out:[{type:"plane",n:1}], sec:40, consume:true, kind:"craft", label:"✈️ 制造中"},
  {id:"fly_xinjiang", name:"飞往新疆", in:{herder:1, plane:1, ticket_xinjiang:1}, out:[{type:"photo_xinjiang",n:1}], sec:5, consume:true, kind:"craft", label:"✈️ 飞行中"},
  {id:"fly_maldives", name:"飞往马尔代夫", in:{herder:1, plane:1, ticket_maldives:1}, out:[{type:"photo_maldives",n:1}], sec:5, consume:true, kind:"craft", label:"✈️ 飞行中"},
  {id:"fly_kenya", name:"飞往肯尼亚", in:{herder:1, plane:1, ticket_kenya:1}, out:[{type:"photo_kenya",n:1}], sec:5, consume:true, kind:"craft", label:"✈️ 飞行中"},
  {id:"fly_nz", name:"飞往新西兰", in:{herder:1, plane:1, ticket_nz:1}, out:[{type:"photo_nz",n:1}], sec:5, consume:true, kind:"craft", label:"✈️ 飞行中"},
  {id:"fly_italy", name:"飞往意大利", in:{herder:1, plane:1, ticket_italy:1}, out:[{type:"photo_italy",n:1}], sec:5, consume:true, kind:"craft", label:"✈️ 飞行中"},
  {id:"fly_iceland", name:"飞往冰岛", in:{herder:1, plane:1, ticket_iceland:1}, out:[{type:"photo_iceland",n:1}], sec:5, consume:true, kind:"craft", label:"✈️ 飞行中"}
];

// 取单位饱食度上限：META 中 foodCap 缺失时回退到 1（兜底）
export function foodCapOf(type) {
  const m = META[type];
  return m && m.foodCap ? m.foodCap : 1;
}
