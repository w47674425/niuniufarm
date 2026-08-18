// 激进模式：玩家零储备、拼命扩张，测 board 理论上限（决定 cardCap 该给多少富余）
const MOONS = 24, RUNS = 600;
const AV = 30, START_COINS = 25;
const COW = 5, GRASS = 5, HIRE = 5, BUILD = 5, FOOD = 5;
const STAGES = ['calf', 'juvenile', 'young', 'prime', 'middle', 'old'];
const SALE = { calf: 5, juvenile: 10, young: 20, prime: 30, middle: 20, old: 10 };
const tc = s => { let n = 1; for (const k in s.cards) n += s.cards[k]; n += s.cattle.length; return n; };

function plan(s, cap) {
  // 激进：不留储备，能买就买
  while (s.cards.employee > (s.cards.burger || 0) && s.coins >= FOOD && tc(s) + 3 <= cap) { s.coins -= FOOD; s.cards.burger = (s.cards.burger || 0) + 3; }
  const needy = s.cattle.filter(c => c.stage < 5).length;
  while ((s.cards.grass_pile || 0) < needy && s.coins >= GRASS && tc(s) + 2 <= cap) { s.coins -= GRASS; s.cards.grass_pile = (s.cards.grass_pile || 0) + 2; }
  while (s.coins >= COW && (s.cards.grass_pile || 0) >= 1 && tc(s) + 1 <= cap) { s.coins -= COW; s.cattle.push({ stage: 0, fed: 0 }); s.cards.grass_pile -= 1; }
  while (s.coins >= HIRE && tc(s) + 1 <= cap) { s.coins -= HIRE; s.cards.employee++; }   // 无限雇人
  while (s.coins >= BUILD && tc(s) + 2 <= cap) { s.coins -= BUILD; s.cards.stump = (s.cards.stump || 0) + 2; }
}
function labor(s, cap) {
  let budget = s.cards.employee * AV, acted = true;
  while (budget > 0 && acted) { acted = false;
    const nc = s.cattle.filter(c => c.fed < 3 && c.stage < 5).length;
    if ((s.cards.grass_pile || 0) > 0 && (s.cards.grass || 0) < nc * 3) { if (tc(s) + 2 <= cap) { s.cards.grass_pile--; s.cards.grass = (s.cards.grass || 0) + 3; budget--; acted = true; return; } }
    const t = s.cattle.find(c => c.fed < 3 && c.stage < 5 && (s.cards.grass || 0) >= 1);
    if (t) { s.cards.grass--; t.fed++; if (t.fed >= 3 && t.stage < 5) t.stage++; budget--; acted = true; continue; }
    if ((s.cards.stump || 0) > 0 && (s.cards.wood || 0) < 12) { if (tc(s) + 2 <= cap) { s.cards.stump--; s.cards.wood = (s.cards.wood || 0) + 3; budget--; acted = true; continue; } }
    if ((s.cards.wood || 0) >= 4) { s.cards.wood -= 4; s.cards.fence = (s.cards.fence || 0) + 1; budget--; acted = true; continue; }
    if ((s.cards.fence || 0) >= 1) { s.cards.fence--; s.cards.bank = (s.cards.bank || 0) + 1; budget--; acted = true; continue; }
  }
}
function run(cap) {
  const s = { cards: { employee: 1, burger: 1, grass_pile: 1, stump: 1 }, cattle: [{ stage: 0, fed: 0 }], coins: START_COINS };
  let peak = 0; const last = [];
  for (let m = 1; m <= MOONS; m++) {
    s.cattle.forEach(c => c.fed = 0); plan(s, cap); labor(s, cap);
    s.cattle = s.cattle.filter(c => { if (c.stage >= 3) { s.coins += SALE[STAGES[c.stage]]; return false; } return true; });
    let bg = s.cards.burger || 0, empN = s.cards.employee, d = 0; for (let i = 0; i < empN; i++) { if (bg > 0) bg--; else d++; }
    s.cards.employee = empN - d; s.cards.burger = bg;
    const t = tc(s); peak = Math.max(peak, t);
    if (m > MOONS - 5) last.push(t);
    if (s.cards.employee === 0 && s.cattle.length === 0) break;
  }
  return { steady: last.length ? last.reduce((a, b) => a + b, 0) / last.length : tc(s), peak };
}
console.log('【激进模式】cardCap | 稳态卡数 | 峰值卡数 | 触顶率%');
for (const cap of [30, 40, 50, 60, 80, 100, 120, 150]) {
  let ss = 0, sp = 0, hit = 0;
  for (let i = 0; i < RUNS; i++) { const r = run(cap); ss += r.steady; sp += r.peak; if (r.peak >= cap) hit++; }
  console.log(`${cap}\t| ${(ss / RUNS).toFixed(1)}\t| ${(sp / RUNS).toFixed(1)}\t| ${((hit / RUNS) * 100).toFixed(0)}`);
}
