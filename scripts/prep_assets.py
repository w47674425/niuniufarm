# 图片资产预处理：缩放图标与背景到游戏实际尺寸，输出到 public/img/
from PIL import Image
import os, shutil

SRC = "resource/图标"
OUT = "public/img"
os.makedirs(OUT, exist_ok=True)

# type → (源文件名, 输出名)  卡片图标统一 160x160（卡片显示 ~50px，2x 清晰）
ICONS = {
    "herder":   ("牧民.png", "herder.png"),
    "dog":      ("牧羊犬.png", "dog.png"),
    "cow":      ("牛.png", "cow.png"),
    "pig":      ("猪.png", "pig.png"),
    "tree":     ("木头.png", "tree.png"),     # 无树木图，用木头替代
    "rock":     ("石头.png", "rock.png"),
    "bush":     ("蓝莓丛.png", "bush.png"),
    "iron":     ("铁矿石.png", "iron.png"),
    "gold":     ("金矿石.png", "gold.png"),
    "herbfield":("药田.png", "herbfield.png"),
    "farm":     ("麦田.png", "farm.png"),
    "wood":     ("木头.png", "wood.png"),
    "branch":   ("树枝.png", "branch.png"),
    "stone":    ("石头.png", "stone.png"),
    "ironore":  ("铁矿石.png", "ironore.png"),
    "goldore":  ("金矿石.png", "goldore.png"),
    "herb":     ("药草.png", "herb.png"),
    "wheat":    ("小麦.png", "wheat.png"),
    "flour":    ("面粉.png", "flour.png"),
    "ironingot":("铁锭.png", "ironingot.png"),
    "goldingot":("金锭.png", "goldingot.png"),
    "sword":    ("木剑.png", "sword.png"),
    "ironsword":("铁剑.png", "ironsword.png"),
    "woodshield":("木盾.png", "woodshield.png"),
    "ironshield":("铁盾.png", "ironshield.png"),
    "axe":      ("斧子.png", "axe.png"),
    "pickaxe":  ("镐子.png", "pickaxe.png"),
    "potion":   ("治疗药水.png", "potion.png"),
    "blueberry":("蓝莓.png", "blueberry.png"),
    "bread":    ("面包.png", "bread.png"),
    "cookedmeat":("烤肉.png", "cookedmeat.png"),
    "fruitplatter":("果蔬拼盘.png", "fruitplatter.png"),
    "milk":     ("牛奶.png", "milk.png"),
    "rawmeat":  ("生肉.png", "rawmeat.png"),
    "house":    ("房屋.png", "house.png"),
    "lumberyard":("伐木场.png", "lumberyard.png"),
    "quarry":   ("采石场.png", "quarry.png"),
    "smelter":  ("冶炼厂.png", "smelter.png"),
    "kitchen":  ("厨房.png", "kitchen.png"),
    "warehouse":("仓库.png", "warehouse.png"),
    "wall":     ("城墙.png", "wall.png"),
}
# UI 图标（导航/按钮）：market 单独 160x160，其余 96x96
UI_ICONS = {
    "pack":   ("卡包.png", "ui_pack.png"),
    "task":   ("任务.png", "ui_task.png"),
    "codex":  ("图鉴.png", "ui_codex.png"),
    "recipe": ("合成.png", "ui_recipe.png"),
    "collect":("收藏.png", "ui_collect.png"),
    "set":    ("设置.png", "ui_set.png"),
}
UI_SIZES = { "market": 160 }  # market 使用 160x160 资源
# 背景：白天/黑夜 9:16 竖版 → 480x854（游戏板面）
BG = {
    "bg_day":  ("草原牧场背景图/草原牧场背景图_9x16竖版.png", "bg_day.png"),
    "bg_night":("草原牧场黑夜背景图/草原牧场黑夜背景图_9x16竖版.png", "bg_night.png"),
}

def process(src_rel, out_name, size, keep_alpha=False):
    # 卡片图标：新资产（透明背景）优先；UI 图标从旧目录取
    candidates = [os.path.join(SRC, "透明背景图标_处理后", src_rel),
                  os.path.join(SRC, "牛牛农场图标", src_rel),
                  os.path.join(SRC, src_rel)]
    src = next((p for p in candidates if os.path.exists(p)), None)
    if not src:
        print("MISS:", src_rel); return
    im = Image.open(src)
    if not keep_alpha:
        im = im.convert("RGB")
    im = im.resize((size, size), Image.LANCZOS)
    im.save(os.path.join(OUT, out_name), "PNG", optimize=True)
    print("OK:", out_name, im.size, im.mode)

n = 0
for t, (src, out) in ICONS.items():
    process(src, out, 160, keep_alpha=True); n += 1
# 普通 UI 96x96；market 单独 160x160
process("市场.png", "ui_market.png", UI_SIZES["market"], keep_alpha=False); n += 1
for k, (src, out) in UI_ICONS.items():
    process(src, out, 96, keep_alpha=False); n += 1
for k, (src, out) in BG.items():
    src = os.path.join(SRC, src)
    im = Image.open(src).convert("RGB")
    im = im.resize((480, 854), Image.LANCZOS)
    im.save(os.path.join(OUT, out), "PNG", optimize=True)
    print("OK:", out, im.size); n += 1
print(f"\n共处理 {n} 张")
