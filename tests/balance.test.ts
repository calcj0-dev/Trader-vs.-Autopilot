// T-10 バランス（設計書 4.10）。試算 sim/monthly_simulate.mjs と同じ方法で2,000相場を回す
import { describe, expect, it } from 'vitest';
import { config } from '../src/data';
import { mulberry32, type Rng } from '../src/core/rng';
import { judge } from '../src/core/judge';
import { simulatePlayer, simulateTsumitate } from '../src/core/portfolio';
import type { Order, Outcome } from '../src/core/types';
import { everyMonth, humanLike, INCOME, marketOf, randomPresser } from './helpers';

const RUNS = 2000;
const WIN_UP: Outcome[] = ['win', 'rout', 'historic'];

describe('T-10 バランス', () => {
  const strategies: Record<string, (months: number, rng: Rng) => Order[]> = {
    everyMonth: (m) => everyMonth(m),
    random20: (m, rng) => randomPresser(m, rng, 20),
    random60: (m, rng) => randomPresser(m, rng, 60),
    human: (m, rng) => humanLike(m, rng),
  };
  const stats = Object.fromEntries(Object.keys(strategies).map((k) => [k, { draw: 0, winUp: 0, final: 0 }]));
  let tsumitateSum = 0;

  const seedRng = mulberry32(20261023);
  for (let i = 0; i < RUNS; i++) {
    const seed = Math.floor(seedRng() * 2 ** 32);
    const { closes } = marketOf(seed);
    const ts = simulateTsumitate(closes, INCOME);
    tsumitateSum += ts.final;
    const stratRng = mulberry32(seed ^ 0x9e3779b9);
    for (const [name, fn] of Object.entries(strategies)) {
      const me = simulatePlayer(closes, fn(closes.length, stratRng), INCOME);
      const r = judge(me.final, ts.final, 1, config.judge);
      const s = stats[name]!;
      if (r.outcome === 'draw') s.draw++;
      if (WIN_UP.includes(r.outcome)) s.winUp++;
      s.final += me.final;
    }
  }
  const tsumitateAvg = tsumitateSum / RUNS;

  it('毎月欠かさず買うと、必ず引き分け', () => {
    expect(stats.everyMonth!.draw).toBe(RUNS);
  });

  it('ランダムに押す（約20・60回）の平均の最終資産は、積立の平均を下回る', () => {
    for (const k of ['random20', 'random60']) {
      expect(stats[k]!.final / RUNS).toBeLessThan(tsumitateAvg);
    }
  });

  it('人らしい遊び方の勝利以上は20〜45%', () => {
    const rate = stats.human!.winUp / RUNS;
    expect(rate).toBeGreaterThanOrEqual(0.2);
    expect(rate).toBeLessThanOrEqual(0.45);
  });
});
