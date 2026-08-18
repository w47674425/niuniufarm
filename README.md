# 牛牛农场 (Niuniu Farm)

一个拖拽合成类经营小游戏：赚钱抽卡包 → 雇员工 → 养牛卖牛，经营你的农场。

- 员工产出资源（草料/木头/围栏/银行卡）
- 草料喂牛，牛吃满 3 棵长一阶，越高级卖越贵
- 围栏 + 牛组成「牧场」，每天自动消耗 3 草料喂牛长大
- 把牛拖到市场出售换钱，钱用于购买卡包

## 技术栈

- **Vite** 构建 / 开发服务器
- **原生 ES Module**（无框架），逻辑按职责拆分为模块

## 目录结构

```
niuniufarm/
├── index.html            # 页面骨架（挂载点）
├── vite.config.js        # Vite 配置
├── package.json
└── src/
    ├── main.js           # 入口：装配 DOM 与启动游戏
    ├── game.js           # 主控制器：计时、日循环、共享方法
    ├── config.js         # 常量与数据（META / 卡包 / 成长线）
    ├── utils.js          # 小工具（rand / clamp / $）
    ├── state.js          # 数据层：状态 + 堆/卡增删查改
    ├── merge.js          # 合并 / 产出 / 喂草 规则判定（纯函数）
    ├── render.js         # 渲染层：画棋盘 / HUD / 进度条 / toast
    ├── systems.js        # 业务系统：产出 / 喂牛 / 卖牛 / 卡包 / 每日结算
    ├── drag.js           # 输入层：指针拖拽与堆叠交互
    ├── modals.js         # 弹窗：日终 / 结束 / 帮助
    └── styles.css        # 全局样式
```

## 本地运行

```bash
npm install      # 安装依赖（vite）
npm run dev      # 启动开发服务器，默认 http://localhost:5173
npm run build    # 产出到 dist/
npm run preview  # 预览构建产物
```

## 玩法

详见游戏内「❔ 帮助」。核心交互：按住卡片拖动，按位置抓住整堆/单张；员工必须拖到资源卡上才产出，草料必须拖到牛上才喂食（反向无效）。
