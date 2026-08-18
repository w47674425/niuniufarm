# 堆叠大陆式卡牌经营游戏 · 落地 GDD

> 版本：v0.1（paper prototype 阶段）
> 阅读对象：接手实现的工程师 / 策划实习生。目标：30 分钟内读完能动手实现核心循环。
> 纪律：模糊形容词不进本文档。进文档的只有 **输入 / 输出 / 边界 / tuning levers**。
> 所有未经 playtest 的数值标 `[PLACEHOLDER]`，并附 **假设 + 验证路径**。
> 设计定位：受 Stacklands（Sokpop Collective, 2022）方法论启发的新作，非逐数值复刻——原作大量配方随版本漂移，复刻无意义。

---

## 0. 如何使用本文档

1. 先读 §1–§3 建立心智模型（核心循环 + 系统边界）。
2. 实现按 §4 系统顺序落地，每个系统严格按 Inputs / Outputs / Edge cases / Failure states 实现。
3. 所有标 `[PLACEHOLDER]` 的数值先填"假设值"，进 §6 的 tuning 表登记，playtest 前不许当作最终值。
4. §8 的 A/B/C 失败信号是上线门槛——任一触发即代表循环"坏掉了"。

---

## 1. Fun Hypothesis（一句话）

**这游戏好玩的核心是：把任意两张卡叠在一起都会发生点什么——低门槛、高上限的组合探索欲，配上"月周期生存压力 + 死亡即重开"的肉鸽受苦循环。**

写不清楚就不往下走，这是地基。

---

## 2. Design Pillars（不可妥协的体验标准）

| # | 支柱 | 含义 | 验收标准（可测） |
|---|------|------|------------------|
| P1 | 操作极简·信息全显 | 没有传统菜单，一切皆实体卡 | 新玩家 0 教学能在 60s 内完成"村民采浆果" |
| P2 | 探索驱动进步 | 机制不教，靠实验发现配方 | 前 10 个核心配方中至少 6 个需玩家自己触发发现 |
| P3 | 生存 vs 发展张力 | 每月既要喂饱人又要扩张 | 第 1–3 月有大概率因扩张过快饿死（见 §8-B） |
| P4 | 死亡零惩罚 | 重开成本极低 | 单局无持久存档；新开一局心理成本 < 5s |

每一条后续决策用这四条过审。违反任意一条的设计不进 build。

---

## 3. Core Loop（三层钩子）

### 3.1 Moment-to-moment（0–30s）
```
拖卡A 压到 卡B → 进度条(duration) → 产出新卡 / 触发动作
```
最短爽点单元。反馈必须即时：卡牌音效 + 进度条 + 产出弹出。

### 3.2 Session loop（5–30min，一个月亮年 Moon）
```
[生产/采集] → 月尾结算(喂村民 + 卖卡换币 + 买卡包) → 解锁配方/扩张 → 应对怪物潮
```
月尾结算伪流程（每 Moon 结束自动触发）：
```
on MoonEnd:
  feedAllVillagers()        // 每个村民消耗 1 食物，不足→饿死
  settleSales()             // 拖到"卖卡堆"的卡按币值结算为硬币
  openShop()                // 玩家用硬币买卡包
  maybeSpawnMonster()       // 非和平模式下按节奏刷怪
```

### 3.3 Long-term（数小时–数周，跨 run）
- Cardopedia：已发现卡牌与配方永久保存，新局可提前搭核心建筑。
- 科技树阶段：原始部落（浆果丛）→ 工业文明（冶炼厂/农场）→ 飞向宇宙（火箭/科学家）。

---

## 4. 系统规格（Systems）

每个系统含：Purpose / Player experience goal / Inputs / Outputs / Edge cases / Failure states。

### 4.1 卡牌与堆叠机制（Card & Stack）
- **Purpose**：用单一交互语法承载全部经营操作。
- **Player experience goal**：玩家拖一张卡压到另一张卡上时，期待"发生点什么"。
- **Inputs**：`cardA`, `cardB`（拖拽落点），当前 board 状态。
- **Outputs**：命中配方→进度条→`producedCard(s)`；未命中→无效果（卡回到原位）。
- **Edge cases**：
  - 卡已在某个生产栈中（如村民正在采浆果）→ 不允许二次堆叠，提示"占用中"。
  - 落点无配方 → 卡弹回，无任何惩罚（保护探索欲）。
- **Failure states**：堆叠命中后进度条不触发 / 产出卡丢失 → bug，回滚该操作。

### 4.2 配方系统（Ideas / 科技树）
- **Purpose**：不解释机制，靠"把卡同时摆在场上看是否触发"解锁配方。
- **Player experience goal**：玩家自己发现"原来村民+房子能生娃"时的惊喜。
- **Inputs**：board 上同时存在的卡组合。
- **Outputs**：命中未知组合→生成 Idea 卡（永久入 Cardopedia）+ 解锁对应合成。
- **Edge cases**：Sequence breaking 允许——配方未解锁也能手动拼出成品（设计允许，非 bug）。
- **Failure states**：已发现配方未写入 Cardopedia → 跨局丢失，破坏 P4 长期成就感。

### 4.3 时间系统（月亮年 Moon）
- **Purpose**：把软经营变成有截止压力的经营（P3 节奏来源）。
- **Player experience goal**：玩家在月末前安排"这月先扩产还是先囤粮"。
- **Inputs**：`moonLength`（可在开局选 短/长）。
- **Outputs**：每 `moonLength` 秒触发一次 §3.2 结算。
- **Edge cases**：暂停时不推进 Moon 计时。
- **Failure states**：结算与怪物刷新同帧卡死 → 怪物刷新延后到结算后。
- **Tuning**：`moonLength` 见 §6。

### 4.4 经济系统（硬币 Coins）
- **Purpose**：内部代币，驱动"卡→币→包→卡"正反馈环。
- **Player experience goal**：玩家在"留卡生产 vs 卖卡换包"间做取舍。
- **Sources**：卖卡（生产链末端产出卡可拖到卖卡堆，月尾按币值结算）。
- **Sinks**：买卡包（唯一硬 sink）。
- **Edge cases**：
  - 卡位上限：board 卡数 ≥ `cardCap` 时禁止开新包 / 产新卡（防通胀物理闸门）。
  - 不可卖卡（如古杯）→ 只能 Dustbin 销毁。
- **Failure states**：硬币通胀失控（见 §6 卡位论证）——若 `cardCap` 形同虚设，产卡速度 >> 消耗速度，经济崩。

### 4.5 食物与人口系统（Food & Population）
- **Purpose**：食物 = 唯一真实 sink；人口 = 核心生产力单位。
- **Player experience goal**：玩家扩张人口前先想"下个月粮够吗"。
- **Inputs**：每月 `feedCost = villagerCount × 1 食物`。
- **Outputs**：足额→人口存活；不足→缺额村民饿死（变死体，无用途）。
- **Sources（食物）**：浆果丛 / 农场 / 烹饪链。
- **Sinks（食物）**：月末喂村民（线性绑定人口）。
- **Sources（人口）**：房子繁殖（2 村民 + 房子 → 婴儿 → 长大）。
- **Sinks（人口）**：饿死 / 战斗死亡（HP 归零永久死亡）。
- **Edge cases**：食物有腐坏计时器（生肉等易腐品超时变废料）→ 逼玩家优先消耗。
- **Failure states**：扩张过快→食物线性增长跟不上→连环饿死（这是 P3 张力，非 bug；但 §8-B 定义"坏掉的阈值"）。

### 4.6 战斗系统（Combat）
- **Purpose**：把无限扩张的人口变成风险（双 sink 之一）。
- **Player experience goal**：玩家在 Monster 出现前备好"空闲且满装"的战斗村民。
- **Inputs**：空闲村民自动迎战；武器卡叠到村民身上加 ATK。
- **Outputs**：胜→掉落（骨/生肉等）；负→村民永久死亡。
- **Edge cases**：村民正在生产任务中→不自动参战（避免误死）。
- **Failure states**：属性克制未生效（如魔法师克骷髅失效）→ 平衡崩。

### 4.7 卡位与整理（Board & Card Cap）
- **Purpose**：给 board 拥挤制造组织压力，同时做防通胀闸门。
- **Player experience goal**：玩家保持卡牌分区（资源区/生产区/战斗区）。
- **Inputs**：每建筑（棚子/仓库）提升 `cardCap`。
- **Outputs**：`cardCap` 上限决定经济滚雪球天花板。
- **Failure states**：卡位满且全是低值卡又无 Dustbin → 死锁（需保证 Dustbin 可达）。

---

## 5. 数据模型（Data Schema，伪代码）

```jsonc
Card {
  id: string
  type: "villager" | "resource" | "building" | "food" | "mob" | "idea" | "pack"
  name: string
  coinValue: number          // 卖卡堆结算价；不可卖卡 = null
  perishable: boolean         // 是否有腐坏计时器
  spoilTimer: number|null     // 秒；[PLACEHOLDER]
  hp: number|null             // 村民/怪物才有
  atk: number|null            // 战斗单位才有；[PLACEHOLDER]
}

Recipe {
  id: string
  inputs: Card[]              // 需同时在场/堆叠的卡
  output: Card               // 产出
  duration: number           // 进度条秒数；[PLACEHOLDER]
  isIdea: boolean            // 是否首次发现时入 Cardopedia
  unlocks: Recipe[]|null      // 解锁的下游配方
}

Moon {
  length: number              // 见 §6；[PLACEHOLDER]
  peacefulMode: boolean
}

Economy {
  cardCap: number             // 基础；[PLACEHOLDER]
  cardCapPerShed: number      // [PLACEHOLDER]
  cardCapPerWarehouse: number // [PLACEHOLDER]
  packPrices: { [packId]: number }  // 已知 cheapest=3
}
```

---

## 6. 数值与 Tuning Levers（核心表）

格式：变量 | 默认值/假设 | rationale | 状态 | 验证路径

| 变量 | 假设值 | rationale | 状态 | 验证路径 |
|------|--------|-----------|------|---------|
| 月长 `moonLength`（新手/老兵） | 90s / 45s | 必须 > 早期食物回本周期，否则必饿死 | `[PLACEHOLDER]` | playtest 测"首个饿死发生在第几月"，目标新手前 2–3 月不饿死 |
| 每村民月食物消耗 | 1 食物/月 | 让人口=线性食物压力，扩张须配套产线 | 已验证逻辑 | 监控后期"饿死率"曲线 |
| 浆果丛产出 | 3 浆果/次，1 币/浆果 | 单村民可自养+盈余，作安全垫 | 已验证 | 测新手前 3 月存活率 |
| 树产出链 | 2 木→2 树枝→4 币 | 木比浆果更值钱，引导向工具建筑 | 已验证 | 观测玩家转向工具链的速度 |
| 最便宜卡包价 | 3 币 / 3 卡 | 一棵树或一丛浆果即回本，早期正循环成立 | 已验证 | 测首包购买时点 |
| 卡位上限 base `cardCap` | 60 | 防拥挤/防死锁安全网（非通胀主刹车，见 §7 修订）；太低卡死，太高无意义 | `[PLACEHOLDER]` | Monte Carlo 初值 60，首轮 playtest 按 board 占用率 40–70% 微调（design/MonteCarlo_cardCap结论.md） |
| 每棚子 `+cardCap` | +20 | 扩容成本需 > 单棚子产卡收益 | `[PLACEHOLDER]` | 同上 |
| 每仓库 `+cardCap` | +50 | 高级扩容，对应高级产线 | `[PLACEHOLDER]` | 同上 |
| 村民基础 ATK | `[PLACEHOLDER]` | 须使"3–4 满装精英"可过 Boss | `[PLACEHOLDER]` | 战斗 playtest 测通关阵容伤亡 |
| 武器 ATK 加成（矛/剑/枪） | `[PLACEHOLDER]` | 梯度决定装备优先级 | `[PLACEHOLDER]` | 同上 |
| 怪物 HP（哥布林/熊/恶魔） | 恶魔领主 666（梗） | 真 Boss 是战力检定门槛 | 部分验证 | 同上 |
| 食物腐坏计时 `spoilTimer` | `[PLACEHOLDER]` | 逼玩家优先消耗，防囤积躺赢 | `[PLACEHOLDER]` | 测"囤粮躺过 Boss"是否可行 |

> **红线**：任何标 `[PLACEHOLDER]` 的数值，build 里先用假设值跑通，但**禁止在 playtest 前宣称平衡**。每条都有上表验证路径。

---

## 7. 通胀论证（平衡偏执必查）

硬币闭环：卖卡 → 币 → 包 → 卡 → 再产卡，是正反馈环。

**修订（Monte Carlo 结论，design/MonteCarlo_cardCap结论.md）**：在「牛牛农场」cattle-centric 设计里，硬币唯一来源是卖牛，而牛需 3 个月亮年成长 + 草料（草堆卡包）成本，故硬币产出被「牛成长吞吐量」锁死，board 卡数同步被锁死。模拟显示任何 ≥30 的 `cardCap` 触顶率均为 0%，board 自然稳态 ~20、峰值 ~22。**因此 board 是「硬币约束」而非「卡位约束」**。

- **刹车 1（物理/安全网）**：`cardCap` 卡位上限。在牛-centric 设计里**基本不触发**为通胀刹车（经济自我收敛），其真实角色是防拥挤 / 防死锁的安全网。初值 60，给自然稳态 ~3× 富余。
- **刹车 2（门控）**：高级包价格梯度锁住高级配方解锁节奏。
- **刹车 3（泄洪）**：Dustbin 销毁不可卖卡。**必须与 `cardCap` 同期落地**——board 偶发填满时无 Dustbin 即死锁（§4.7 failure state）。
- **真实约束**：食物（草料）消耗是唯一直绑人口的 sink，制造真稀缺；硬币是伪稀缺，靠「草料包 sink + 包价梯度」间接模拟，而非卡位。

**验证动作（已做）**：用 Monte Carlo 模拟「不同 villagerCount × 产线配置」下的产卡速率（标准理性玩家 + 激进囤包压力测试），确认 `cardCap` 在后期既不过松（通胀）也不过死（卡住）。脚本见 `design/sim/montecarlo_cardcap.mjs` 与 `montecarlo_aggressive.mjs`。结论：`cardCap=60` 为初值，首轮 playtest 按 board 占用率微调。

---

## 8. Playtest 计划（先定义"坏掉长什么样"）

没有失败定义的 playtest = 没做。以下为上线门槛：

| 信号 | 触发条件 | 判定 |
|------|----------|------|
| **A（循环不成立）** | 新玩家 0 教学 60s 内无法完成"村民采浆果" | 失败 → P1 崩，回炉交互 |
| **B（张力失效）** | 前 3 月饿死率 < 10%（太松）或 > 70%（太劝退） | 失败 → 调 `moonLength` / 食物产出 |
| **C（通胀失控）** | 第 5 月后硬币可无限滚雪球且卡位无压力 | 警告（本设计近不可能，见 §7 修订）→ 监测 board 占用率，必要时调包价梯度 |
| **D（长期留存）** | 通关后 7 日留存 < 20% | 警告 → 检查 Cardopedia / DLC 内容厚度 |

---

## 9. 开放问题 / PLACEHOLDER 登记

1. 原作配方计数跨版本漂移（House 有 2木1石 / 1木1石 两种记法；剑有 1铁条1树枝 / 1铁条2树枝）。**本作配方以 §5 Schema + §6 表为准，不复刻原作具体计数。**
2. 战斗 ATK / HP / 克制表全 `[PLACEHOLDER]`，需战斗 playtest 后定。
3. `moonLength`、卡位上限、腐坏计时器需 Monte Carlo + 首轮 playtest 定。
4. 是否做 DLC 内容厚度（海岛/诅咒世界式）决定 D 信号达标与否——属发行决策，非设计范畴。

---

### 下一步建议
- 想先验证经济：我可以用 Monte Carlo 跑 §7 通胀模型，给 `cardCap` 初值。
- 想先验证手感：用 §4.1 + §3.1 做纸面 prototype（卡纸 + 进度条计时），1 天可跑通 fun hypothesis。
