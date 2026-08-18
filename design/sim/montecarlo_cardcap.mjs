// 牛牛农场 · cardCap Monte Carlo（GDD §7 落地前必做）v3（终稿）
// 模型：cattle-centric。硬币只来自卖牛；草料只来自草堆卡包（包=主 sink，无可再生刷草源）。
// cardCap = 物理闸门（board 卡数 >= cap 时禁止产卡/开包）。
// 本模拟结论性发现：草料包限导致经济自我限制，board 自然稳态远低于任何合理 cap，
// 故 cardCap 主要作「防拥挤/防死锁」闸门，而非 GDD 原设的「通胀物理刹车」。
//
// [PLACEHOLDER] 假设值 —— 须首轮 playtest 验证。改顶部常量即可复跑。

const RNG = (() => {
  let s = 0x2545f491;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
})();

const MOONS = 24;
const RUNS = 600;

const ACTIONS_PER_VILLAGER = 30;   // [PLACEHOLDER] 每村民每月动作上限（设为非瓶颈，让 cardCap 成为绑定约束）
const START_COINS = 25;            // [PLACEHOLDER] 新手启动金（原 beginner 包 money=10 实测养不出首头 prime，属信号 B 早期坡度，此处给可爬坡值）
const RESERVE = 15;                // [PLACEHOLDER] 扩张储备金（保命+草料缓冲）
const COW = 5, GRASS = 5, HIRE = 5, BUILD = 5, FOOD = 5;
const STAGES = ['calf', 'juvenile', 'young', 'prime', 'middle', 'old'];
const SALE = { calf: 5, juvenile: 10, young: 20, prime: 30, middle: 20, old: 10 };

function tc(s) { let n = 1; for (const k in s.cards) n += s.cards[k]; n += s.cattle.length; return n; }

function plan(s, cap) {
  while (s.cards.employee > (s.cards.burger || 0) && s.coins >= FOOD && tc(s) + 3 <= cap) { s.coins -= FOOD; s.cards.burger = (s.cards.burger || 0) + 3; }
  const needy = s.cattle.filter(c => c.stage < 5).length;
  const target = needy + 1;
  while ((s.cards.grass_pile || 0) < target && s.coins >= GRASS && tc(s) + 2 <= cap) { s.coins -= GRASS; s.cards.grass_pile = (s.cards.grass_pile || 0) + 2; }
  while (s.coins > RESERVE + COW && (s.cards.grass_pile || 0) >= 1 && tc(s) + 1 <= cap) { s.coins -= COW; s.cattle.push({ stage: 0, fed: 0 }); s.cards.grass_pile -= 1; }
  while (s.coins > RESERVE + HIRE && s.cards.employee <= s.cattle.length && tc(s) + 1 <= cap) { s.coins -= HIRE; s.cards.employee++; }
  while (s.coins > RESERVE + BUILD + 45 && tc(s) + 2 <= cap) { s.coins -= BUILD; s.cards.stump = (s.cards.stump || 0) + 2; }
}

function labor(s, cap) {
  let budget = s.cards.employee * ACTIONS_PER_VILLAGER, acted = true;
  while (budget > 0 && acted) { acted = false;
    const nc = s.cattle.filter(c => c.fed < 3 && c.stage < 5).length;
    if ((s.cards.grass_pile || 0) > 0 && (s.cards.grass || 0) < nc * 3) { if (tc(s) + 2 <= cap) { s.cards.grass_pile--; s.cards.grass = (s.cards.grass || 0) + 3; budget--; acted = true; continue; } }
    const t = s.cattle.find(c => c.fed < 3 && c.stage < 5 && (s.cards.grass || 0) >= 1);
    if (t) { s.cards.grass--; t.fed++; if (t.fed >= 3 && t.stage < 5) t.stage++; budget--; acted = true; continue; }
    if ((s.cards.stump || 0) > 0 && (s.cards.wood || 0) < 12) { if (tc(s) + 2 <= cap) { s.cards.stump--; s.cards.wood = (s.cards.wood || 0) + 3; budget--; acted = true; continue; } }
    if ((s.cards.wood || 0) >= 4) { s.cards.wood -= 4; s.cards.fence = (s.cards.fence || 0) + 1; budget--; acted = true; continue; }
    if ((s.cards.fence || 0) >= 1) { s.cards.fence--; s.cards.bank = (s.cards.bank || 0) + 1; budget--; acted = true; continue; }
  }
}

function run(cap) {
  const s = { cards: { employee: 1, burger: 1, grass_pile: 1, stump: 1 }, cattle: [{ stage: 0, fed: 0 }], coins: START_COINS };
  let deadlock = false, peak = 0; const last = [];
  for (let m = 1; m <= MOONS; m++) {
    s.cattle.forEach(c => c.fed = 0);
    plan(s, cap); labor(s, cap);
    s.cattle = s.cattle.filter(c => { if (c.stage >= 3) { s.coins += SALE[STAGES[c.stage]]; return false; } return true; });
    let bg = s.cards.burger || 0, empN = s.cards.employee, deaths = 0;
    for (let i = 0; i < empN; i++) { if (bg > 0) bg--; else deaths++; }
    s.cards.employee = empN - deaths; s.cards.burger = bg;
    const t = tc(s); peak = Math.max(peak, t);
    if (t >= cap && s.cattle.length === 0 && (s.cards.grass_pile || 0) === 0 && s.coins < 5) deadlock = true;
    if (m > MOONS - 5) last.push(t);
    if (s.cards.employee === 0 && s.cattle.length === 0) break;
  }
  const steady = last.length ? last.reduce((a, b) => a + b, 0) / last.length : tc(s);
  return { steady: Math.round(steady), peak, deadlock, coins: s.coins };
}

console.log('cardCap | 稳态卡数 | 峰值卡数 | 触顶率% | 死锁率% | 末月硬币均值');
for (const cap of [30, 40, 50, 60, 80, 100, 120, 150]) {
  let ss = 0, sp = 0, sc = 0, hit = 0, dead = 0;
  for (let i = 0; i < RUNS; i++) { const r = run(cap); ss += r.steady; sp += r.peak; sc += r.coins; if (r.peak >= cap) hit++; if (r.deadlock) dead++; }
  console.log(`${cap}\t| ${(ss / RUNS).toFixed(1)}\t| ${(sp / RUNS).toFixed(1)}\t| ${((hit / RUNS) * 100).toFixed(0)}\t| ${((dead / RUNS) * 100).toFixed(0)}\t| ${(sc / RUNS).toFixed(0)}`);
}
