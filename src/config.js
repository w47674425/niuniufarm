// 游戏常量与配置数据（原单文件中的「配置」区块）

export const DAY_LEN = 120;        // 每 2 分钟 = 1 天
export const CARD_W = 74, CARD_H = 94;
export const STACK_OFF = 24;       // 同一堆卡片竖向摞放间距
export const PRODUCE_SEC = 2;      // 员工产出进度条秒数
export const EAT_SEC = 1;          // 每棵草料咀嚼秒数

// 卡牌元数据：emoji / 名称 / 说明 / 特殊标记（cattle 牛、money 钱币、bank 银行卡、sale 售价）
export const META = {
  employee:   { emoji: "👷", label: "员工",   note: "每天结束自动吃汉堡" },
  burger:     { emoji: "🍔", label: "汉堡",   note: "员工的食物" },
  grass_pile: { emoji: "🌾", label: "草堆",   note: "员工→3草料" },
  grass:      { emoji: "🍃", label: "草料",   note: "喂牛" },
  stump:      { emoji: "🪵", label: "树桩",   note: "员工→3木头" },
  wood:       { emoji: "🪵", label: "木头",   note: "4+员工→围栏" },
  fence:      { emoji: "🚧", label: "围栏",   note: "牛可叠上做牧场；员工→银行卡" },
  bank:       { emoji: "💳", label: "银行卡", note: "存钱", bank: true },
  money:      { emoji: "🪙", label: "钱币",   note: "¥", money: true },
  calf:       { emoji: "🐮", label: "牛犊",   note: "售价¥5",  cattle: true, sale: 5 },
  juvenile:   { emoji: "🐮", label: "少年牛", note: "售价¥10", cattle: true, sale: 10 },
  young:      { emoji: "🐮", label: "青年牛", note: "售价¥20", cattle: true, sale: 20 },
  prime:      { emoji: "🐮", label: "壮年牛", note: "售价¥30", cattle: true, sale: 30 },
  middle:     { emoji: "🐮", label: "中年牛", note: "售价¥20", cattle: true, sale: 20 },
  old:        { emoji: "🐮", label: "老年牛", note: "售价¥10", cattle: true, sale: 10 }
};

// 牛的成长顺序
export const CATTLE = ["calf", "juvenile", "young", "prime", "middle", "old"];
// 还能被喂的牛（老年牛不再成长）
export const FEEDABLE = ["calf", "juvenile", "young", "prime", "middle"];

// 商店卡包
export const PACKS = [
  { id: "hire",  name: "招聘卡包", emoji: "📋", price: 5, items: [["employee", 1]] },
  { id: "cow",   name: "牛牛卡包", emoji: "🐮", price: 5, items: [["calf", 1]] },
  { id: "build", name: "建筑卡包", emoji: "🏗️", price: 5, items: [["stump", 2]] },
  { id: "food",  name: "食物卡包", emoji: "🍔", price: 5, items: [["burger", 3]] },
  { id: "grass", name: "草堆卡包", emoji: "🌾", price: 5, items: [["grass_pile", 2]] }
];
