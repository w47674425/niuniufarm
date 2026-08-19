# 牛牛牧场 (Niuniu Ranch)

> 🎮 **在线试玩**：https://w47674425.github.io/niuniufarm/

一个拖拽堆叠类经营生存小游戏：把卡牌拖到一起"堆叠万物"，触发生产/建造/繁殖/战斗。

- **核心循环**：牧民拖到资源点产出资源 → 喂饱牧民 → 建造建筑/制作装备/冶炼烹饪 → 夜晚抵御怪物 → 卖资源换金币 → 抽卡包扩充卡组
- **昼夜循环**：每 90 秒一天（60% 白天 + 40% 夜晚），夜晚刷小偷/大盗，会主动扑向牧民
- **配方引擎**：45 条数据驱动配方（食用/装备/建造/制作/冶炼/烹饪/宰杀/繁殖/训练/被动生产），按优先级 + 具体度匹配，正确处理配方包含关系
- **任务系统**：10 个成就任务，完成后奖励金币
- **卡牌图鉴**：46 种卡牌，发现即解锁
- **存档**：localStorage 自动存档，离线也有收益

## 技术栈

- **Vite** 构建 / 开发服务器
- **原生 ES Module**（无框架），逻辑按职责拆分为模块

## 目录结构

```
niuniufarm/
├── index.html            # 页面骨架（挂载点）
├── niuniu-ranch.html     # 资料库准绳版（单文件，来源同步基准）
├── vite.config.js        # Vite 配置
├── package.json
├── design/               # 策划文件（GDD / 开发规划 / MonteCarlo 结论）
└── src/
    ├── main.js           # 入口：装配 DOM 与启动游戏
    ├── game.js           # 主控制器：开局、事件绑定、主循环装配
    ├── config.js         # 常量与数据（META 46 卡 / PACKS / TASKS / RECIPES）
    ├── utils.js          # 小工具（rand / clamp / $）
    ├── state.js          # 数据层：状态 + 堆/卡增删查改
    ├── merge.js          # 堆行为规则层：配方匹配 / 战斗 / 执行（纯逻辑）
    ├── render.js         # 渲染层：画棋盘 / HUD / 进度条 / toast / 卡包
    ├── systems.js        # 业务系统：昼夜 / 怪物 / 结算 / 存档 / 卡包 / 任务
    ├── drag.js           # 输入层：指针拖拽与堆叠交互
    ├── modals.js         # 弹窗：商店 / 任务 / 图鉴 / 帮助 / 设置 / 结束
    └── styles.css        # 全局样式（含夜晚模式）
```

## 本地运行

```bash
npm install      # 安装依赖（vite）
npm run dev      # 启动开发服务器，默认 http://localhost:5173
npm run build    # 产出到 dist/
npm run preview  # 预览构建产物
```

## 在线测试地址

- 构建产物预览：http://localhost:4173/（`npm run preview` 启动）

## 玩法

详见游戏内「❔ 帮助」。核心交互：按住卡片拖动，按位置抓住整堆/单张；牧民必须拖到资源卡上才产出，食物必须拖到牧民上才喂食。
