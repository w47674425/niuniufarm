// 业务系统层：产出 / 喂牛 / 卖牛 / 卡包 / 每日结算（原单文件中的「产出 / 喂草 / 出售 / 卡包 / 每日结算」区块）

import { META, CATTLE, FEEDABLE, PACKS, CARD_W, CARD_H, PRODUCE_SEC, EAT_SEC } from './config.js';
import { rand, clamp } from './utils.js';
import {
  mk, makePile, removePile, allCards, countMoneyOnBoard,
  removeCardObj, detach, spawnNear, scatter
} from './state.js';
import { isCattle } from './merge.js';
import { render, updateHUD, toast, showProgress } from './render.js';

// ============ 产出（一次性，消耗非员工卡） ============
export function doProduce(game, combo, pile) {
  if (combo === "grass") {
    pile.cards = pile.cards.filter(c => c.type !== "grass_pile");
    spawnNear(game, pile, [mk(game, "grass"), mk(game, "grass"), mk(game, "grass")]);
    toast(game, "🌾+员工 → 产出 3 草料（草堆已用完）");
  } else if (combo === "wood") {
    pile.cards = pile.cards.filter(c => c.type !== "stump");
    spawnNear(game, pile, [mk(game, "wood"), mk(game, "wood"), mk(game, "wood")]);
    toast(game, "🪵+员工 → 产出 3 木头（树桩已用完）");
  } else if (combo === "fence") {
    let removed = 0;
    pile.cards = pile.cards.filter(c => { if (c.type === "wood" && removed < 4) { removed++; return false; } return true; });
    spawnNear(game, pile, [mk(game, "fence")]);
    toast(game, "4🪵+员工 → 产出 1 围栏（木头已用完）");
  } else if (combo === "bank") {
    const fi = pile.cards.findIndex(c => c.type === "fence");
    if (fi >= 0) pile.cards.splice(fi, 1);            // 仅消耗 1 张围栏，其余围栏与员工保留
    spawnNear(game, pile, [mk(game, "bank")]);
    toast(game, "🚧+员工 → 产出 1 银行卡（仅消耗1张围栏）");
  }
  if (pile.cards.length === 0) removePile(game, pile);
}

// ============ 牛吃草 ============
export function startFeed(game, d, target, bx, by) {
  const cow = target.cards.find(c => isCattle(c.type));
  if (!cow) { // 兜底：目标里没牛，草料回到原处
    detach(game, d.moving, d.pile);
    makePile(game, clamp(bx, 6, game.boardSize().w - CARD_W - 6), clamp(by, 6, game.boardSize().h - CARD_H - 6), d.moving);
    render(game); updateHUD(game); return;
  }
  const avail = d.moving.filter(c => c.type === "grass").length;
  const canEat = Math.min(avail, 3 - (cow.fedToday || 0));
  if ((cow.fedToday || 0) >= 3) { toast(game, "这头牛今天已吃饱（最多3草料）"); placeLeftover(game, d, target, bx, by); return; }
  if (canEat <= 0) { toast(game, "草料不够啦"); placeLeftover(game, d, target, bx, by); return; }

  detach(game, d.moving, d.pile);   // 草料先离开原堆
  game.state.busy = true;
  let eaten = 0;
  showProgress(game, target.x, target.y, canEat, "🐮 吃草中…", () => {}); // 进度条仅作展示
  function finish() {
    if (d.moving.length > 0) {
      const x = clamp(target.x + 34, 6, game.boardSize().w - CARD_W - 6);
      const y = clamp(target.y + 34, 6, game.boardSize().h - CARD_H - 6);
      makePile(game, x, y, d.moving);
    }
    game.state.busy = false; render(game); updateHUD(game);
  }
  function eatOne() {
    if (eaten >= canEat) { finish(); return; }
    const gi = d.moving.findIndex(c => c.type === "grass");
    if (gi < 0) { finish(); return; }
    d.moving.splice(gi, 1); eaten++;
    cow.fedToday = (cow.fedToday || 0) + 1;
    render(game); updateHUD(game);
    if (cow.fedToday >= 3) {            // 吃满即长阶
      const idx = CATTLE.indexOf(cow.type);
      if (idx >= 0 && idx < CATTLE.length - 1) {
        cow.type = CATTLE[idx + 1];   // 不重置 fedToday，今天已吃饱
        toast(game, "🐮 吃满3草料，成长为「" + META[cow.type].label + "」（今天已吃饱）");
      }
      finish(); return;
    }
    setTimeout(eatOne, EAT_SEC * 1000);
  }
  setTimeout(eatOne, EAT_SEC * 1000);
}

export function placeLeftover(game, d, target, bx, by) {
  if (d.moving.length > 0) {
    makePile(game, clamp(bx, 6, game.boardSize().w - CARD_W - 6), clamp(by, 6, game.boardSize().h - CARD_H - 6), d.moving);
  }
  render(game); updateHUD(game);
}

// ============ 卖牛 ============
export function sellCows(game, d) {
  const remaining = [];
  d.moving.forEach(c => {
    if (isCattle(c.type)) {
      const price = META[c.type].sale || 0;
      if (price > 0) scatter(game, [mk(game, "money", price)]);
      toast(game, "售出「" + META[c.type].label + "」 +¥" + price);
    } else { remaining.push(c); }
  });
  detach(game, d.moving, d.pile);
  if (remaining.length > 0) {
    if (d.pile.cards.length > 0) d.pile.cards = d.pile.cards.concat(remaining);
    else makePile(game, clamp(d.pile.x, 6, game.boardSize().w - CARD_W - 6), clamp(d.pile.y, 6, game.boardSize().h - CARD_H - 6), remaining);
  }
  if (d.pile.cards.length === 0) removePile(game, d.pile);
}

// ============ 卡包 ============
export function spawnPackCards(game, pack) {
  const cardsArr = [];
  pack.items.forEach(it => { for (let i = 0; i < it[1]; i++) cardsArr.push(mk(game, it[0])); });
  scatter(game, cardsArr);
}
export function openPack(game, p) {
  removePile(game, p);
  const cardsArr = [
    mk(game, "employee"), mk(game, "burger"), mk(game, "calf"),
    mk(game, "grass_pile"), mk(game, "stump"), mk(game, "money", 10)
  ];
  scatter(game, cardsArr);
  render(game); updateHUD(game);
  toast(game, "🎁 新手卡包已打开！");
}
export function buyPack(game, pack) {
  if (countMoneyOnBoard(game) + game.state.bankDeposit < pack.price) {
    toast(game, "钱不够，需要 ¥" + pack.price); return;
  }
  let need = pack.price;
  game.state.piles.forEach(p => {
    for (let i = p.cards.length - 1; i >= 0 && need > 0; i--) {
      const c = p.cards[i];
      if (c.type === "money") {
        const v = c.value || 1;
        if (v <= need) { need -= v; p.cards.splice(i, 1); }
        else { c.value = v - need; need = 0; }
      }
    }
  });
  if (need > 0) { game.state.bankDeposit -= need; need = 0; }
  spawnPackCards(game, pack);
  render(game); updateHUD(game);
  toast(game, "已购买「" + pack.name + "」");
}

// 顶栏卡包按钮
export function renderPackRow(game) {
  const row = game.refs.packRow;
  row.innerHTML = "";
  PACKS.forEach(pack => {
    const d = document.createElement("div");
    d.className = "pack";
    d.innerHTML =
      '<div class="pemoji">' + pack.emoji + '</div>' +
      '<div class="pname">' + pack.name + '</div>' +
      '<div class="pprice">¥' + pack.price + '</div>';
    d.onclick = () => buyPack(game, pack);
    row.appendChild(d);
  });
}

// ============ 每日结算 ============
// 牧场（围栏+牛+草料）每日自动消耗 3 草料并喂牛长大
export function processPastures(game) {
  game.state.piles.forEach(p => {
    const hasFence = p.cards.some(c => c.type === "fence");
    const cow = p.cards.find(c => isCattle(c.type));
    if (!hasFence || !cow) return;
    const grassCount = p.cards.filter(c => c.type === "grass").length;
    if (grassCount < 3) return;
    let removed = 0;
    p.cards = p.cards.filter(c => { if (c.type === "grass" && removed < 3) { removed++; return false; } return true; });
    if (FEEDABLE.indexOf(cow.type) >= 0) {
      const idx = CATTLE.indexOf(cow.type);
      if (idx >= 0 && idx < CATTLE.length - 1) {
        cow.type = CATTLE[idx + 1];
        toast(game, "🌿牧场自动喂食：「" + META[cow.type].label + "」成长（围栏保留）");
      }
    }
    render(game); updateHUD(game);
  });
}
