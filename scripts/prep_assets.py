# 图片资产预处理：缩放图标与背景到游戏实际尺寸，输出到 public/img/
# 运行：python scripts/prep_assets.py（需 numpy + pillow，建议用 venv）
# 两条来源：
#   1) 旧源图目录 resource/图标/透明背景图标_处理后/（中文名，直接缩放，沿用既有逻辑）
#   2) 美术交付成品 resource/img/（英文名 1024×1024 / 1920×1080，见美术资产迭代需求.md）
from PIL import Image
import os, shutil
import numpy as np

SRC = "resource/图标"
NEW_DIR = "resource/img"   # 美术交付成品目录（2026-08-27 新世界观资产）
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
    "sheep":    ("羊.png", "sheep.png"),   # 复用旧羊图（美术资产迭代需求.md §5 步骤1）
}
# —— 美术交付成品（resource/img）：卡片图四角连通抠图转透明 → 160×160 ——
# capitalist 为满幅人物插画（无背景可抠），保持 RGB 浅底不抠图
NEW_CARDS_CUT = [   # 抠图转透明
    "border_collie", "golden", "husky", "german_shepherd", "corgi",
    "wool", "felt", "flint", "jam", "caesar", "plane",
    "ticket_xinjiang", "ticket_maldives", "ticket_kenya", "ticket_nz", "ticket_italy", "ticket_iceland",
    "photo_xinjiang", "photo_maldives", "photo_kenya", "photo_nz", "photo_italy", "photo_iceland",
    "thief", "bandit", "spy", "factory",
]
NEW_CARDS_FULL = ["capitalist"]  # 不抠图（满幅人物）
# 新 UI 图标：按钮自带底色，无需透明（与旧 ui_pack 一致），护照/成就 160×160 适配卡片式入口
NEW_UI = ["ui_passport", "ui_achievement"]
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
# 背景：美术交付成品已是 1920×1080 横屏，直接复制（尺寸不符则按 1920×1080 缩放兜底）
BG = {
    "bg_day":  ("bg_day.png", "bg_day.png"),
    "bg_night":("bg_night.png", "bg_night.png"),
}

def make_transparent(im, tol=14):
    """四角连通 flood fill：把与四角纸纹色相近的连通背景转透明（主体居中插画专用）"""
    a = np.array(im).astype(int)
    h, w, _ = a.shape
    seed = np.concatenate([a[0:3,0:3].reshape(-1,3), a[0:3,w-3:w].reshape(-1,3),
                           a[h-3:h,0:3].reshape(-1,3), a[h-3:h,w-3:w].reshape(-1,3)], axis=0).mean(axis=0)
    mask = np.zeros((h, w), bool)
    mask[0,:3]=True; mask[:3,0]=True; mask[0,w-3:]=True; mask[:3,w-1]=True
    mask[h-1,:3]=True; mask[h-3:,0]=True; mask[h-1,w-3:]=True; mask[h-3:,w-1]=True
    bg = (np.abs(a[...,0]-seed[0])<tol)&(np.abs(a[...,1]-seed[1])<tol)&(np.abs(a[...,2]-seed[2])<tol)
    while True:
        grow = np.zeros_like(mask)
        grow[1:,:] |= mask[:-1,:]; grow[:-1,:] |= mask[1:,:]
        grow[:,1:] |= mask[:,:-1]; grow[:,:-1] |= mask[:,1:]
        cand = grow & ~mask & bg
        if not cand.any(): break
        mask |= cand
    rgba = np.dstack([np.array(im), (~mask).astype(np.uint8) * 255])
    return Image.fromarray(rgba.astype(np.uint8), "RGBA")

def process_new(name, size, cut=True):
    src = os.path.join(NEW_DIR, name + ".png")
    if not os.path.exists(src):
        print("MISS:", name); return
    im = Image.open(src).convert("RGB")
    im = make_transparent(im) if cut else im.convert("RGB")
    im = im.resize((size, size), Image.LANCZOS)
    im.save(os.path.join(OUT, name + ".png"), "PNG", optimize=True)
    print("OK:", name + ".png", im.size, im.mode)

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
# —— 美术交付成品（resource/img）——
for name in NEW_CARDS_CUT:
    process_new(name, 160, cut=True); n += 1
for name in NEW_CARDS_FULL:
    process_new(name, 160, cut=False); n += 1
for name in NEW_UI:
    process_new(name, 160, cut=False); n += 1
# —— 背景（1920×1080 横屏成品，直接复制）——
for k, (src, out) in BG.items():
    sp = os.path.join(NEW_DIR, src)
    im = Image.open(sp).convert("RGB")
    if im.size != (1920, 1080):
        im = im.resize((1920, 1080), Image.LANCZOS)
        print("RESIZE:", out, im.size)
    im.save(os.path.join(OUT, out), "PNG", optimize=True)
    print("OK:", out, im.size); n += 1
print(f"\n共处理 {n} 张")
