import { mulberry32, generateMarket, gameCloses, simulatePlayer, simulateTsumitate, simulateLumpSum, judge, pickTitle, TITLES } from './model.mjs';
const R = mulberry32(20261023); const cnt = {}; let N = 0;
for (let i = 0; i < 20000; i++) {
  const s = Math.floor(R() * 2 ** 32), mk = generateMarket(s), c = gameCloses(mk);
  const t = simulateTsumitate(c), l = simulateLumpSum(c), rr = mulberry32(s);
  const k = [5, 10, 20, 40][i % 4]; const a = []; let h = false;
  for (let m = 0; m < 240; m++) if (rr() < k / 240) { a.push({ month: m, type: h ? 'sell' : 'buy' }); h = !h; }
  const p = simulatePlayer(c, a), j = judge(p, t, l, a), id = pickTitle(c, mk.scenario, p, j);
  cnt[id] = (cnt[id] || 0) + 1; N++;
}
for (const [id, name] of Object.entries(TITLES)) console.log(`| ${name} | ${(100 * (cnt[id] || 0) / N).toFixed(1)}% |`);
