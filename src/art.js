// 正式美术资产映射：META type / UI 键 → public/img 下的图片
// 生成脚本：scripts/prep_assets.py（缩放到游戏实际尺寸）
import { META } from './config.js';

// 卡片图（160x160）
export const CARD_ART = {
  herder: "img/herder.png", dog: "img/dog.png", cow: "img/cow.png", pig: "img/pig.png",
  tree: "img/tree.png", rock: "img/rock.png", bush: "img/bush.png",
  iron: "img/iron.png", gold: "img/gold.png", herbfield: "img/herbfield.png", farm: "img/farm.png",
  wood: "img/wood.png", branch: "img/branch.png", stone: "img/stone.png",
  ironore: "img/ironore.png", goldore: "img/goldore.png", herb: "img/herb.png",
  wheat: "img/wheat.png", flour: "img/flour.png",
  ironingot: "img/ironingot.png", goldingot: "img/goldingot.png",
  sword: "img/sword.png", ironsword: "img/ironsword.png",
  woodshield: "img/woodshield.png", ironshield: "img/ironshield.png",
  axe: "img/axe.png", pickaxe: "img/pickaxe.png", potion: "img/potion.png",
  blueberry: "img/blueberry.png", bread: "img/bread.png", cookedmeat: "img/cookedmeat.png",
  fruitplatter: "img/fruitplatter.png", milk: "img/milk.png", rawmeat: "img/rawmeat.png",
  house: "img/house.png", lumberyard: "img/lumberyard.png", quarry: "img/quarry.png",
  smelter: "img/smelter.png", kitchen: "img/kitchen.png",
  warehouse: "img/warehouse.png", wall: "img/wall.png",
};

// 变异牛统一用牛图（稀有度靠卡片边框/角标区分）
export const COW_ART = "img/cow.png";

// UI 图标（96x96）
export const UI_ART = {
  pack: "img/ui_pack.png", task: "img/ui_task.png", codex: "img/ui_codex.png",
  recipe: "img/ui_recipe.png", collect: "img/ui_collect.png",
  set: "img/ui_set.png", market: "img/ui_market.png",
};

// 背景（480x854 竖版）
export const BG_ART = { day: "img/bg_day.png", night: "img/bg_night.png" };

// 取一张卡的正式图；无图（如怪物）返回 null；变异牛统一用牛图
export function cardArt(type) {
  if (CARD_ART[type]) return CARD_ART[type];
  if (META[type] && META[type].cowKind) return COW_ART;
  return null;
}
