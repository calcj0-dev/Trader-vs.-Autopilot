// T-10 バランス（設計書 4.10）。試算 sim/simulate.mjs と同じ方法で2,000相場を回す
import { describe, expect, it } from 'vitest';
import { mulberry32, type Rng } from '../src/core/rng';
import { judge } from '../src/core/judge';
import { simulateLumpSum, simulatePlayer, simulateTsumitate } from '../src/core/portfolio';
import type { Order } from '../src/core/types';
import { INITIAL_CASH, marketOf } from './helpers';

const RUNS = 2000;

function randomTrader(months: number, rng: Rng, n: number): Order[] {
  const p = n / months;
  const orders: Order[] = [];
  let holding = false;
  for (let m = 0; m < months; m++) {
    if (rng() < p) {
      orders.push({ month: m, type: holding ? 'sell' : 'buy' });
      holding = !holding;
    }
  }
  return orders;
}

describe('T-10 バランス', () => {
  const strategies: Record<string, (months: number, rng: Rng) => Order[]> = {
    lump: () => [{ month: 0, type: 'buy' }],
    random10: (m, rng) => randomTrader(m, rng, 10),
    random30: (m, rng) => randomTrader(m, rng, 30),
    random60: (m, rng) => randomTrader(m, rng, 60),
  };
  const stats = Object.fromEntries(Object.keys(strategies).map((k) => [k, { big: 0, final: 0 }]));
  let tsumitateSum = 0;

  const seedRng = mulberry32(20261023);
  for (let i = 0; i < RUNS; i++) {
    const seed = Math.floor(seedRng() * 2 ** 32);
    const { closes } = marketOf(seed);
    const ts = simulateTsumitate(closes, INITIAL_CASH);
    const lump = simulateLumpSum(closes, INITIAL_CASH);
    tsumitateSum += ts.final;
    const stratRng = mulberry32(seed ^ 0x9e3779b9);
    for (const [name, fn] of Object.entries(strategies)) {
      const me = simulatePlayer(closes, fn(closes.length, stratRng), INITIAL_CASH);
      const r = judge(me.final, ts.final, lump.final, me.trades, 1);
      const s = stats[name]!;
      if (r.outcome === 'big_win') s.big++;
      s.final += me.final;
    }
  }
  const tsumitateAvg = tsumitateSum / RUNS;

  it('「最初に買って放置」の大勝利は0%', () => {
    expect(stats.lump!.big).toBe(0);
  });

  it('ランダム売買（約10・30・60回）の平均の最終資産は、積立の平均を下回る', () => {
    for (const k of ['random10', 'random30', 'random60']) {
      expect(stats[k]!.final / RUNS).toBeLessThan(tsumitateAvg);
    }
  });

  it('ランダム売買（約30回）の大勝利は10〜30%', () => {
    const rate = stats.random30!.big / RUNS;
    expect(rate).toBeGreaterThanOrEqual(0.1);
    expect(rate).toBeLessThanOrEqual(0.3);
  });
});
