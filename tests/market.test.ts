import { describe, expect, it } from 'vitest';
import * as ref from '../sim/model.mjs';
import { generateMarket, MIN_GAME_MONTHS, SCENARIO_ORDER } from '../src/core/market';
import { marketParams } from '../src/data';
import { params } from './helpers';

describe('相場の生成', () => {
  it('T-01 同じ相場番号なら同じ相場（1〜1,000）', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      expect(generateMarket(seed, params)).toEqual(generateMarket(seed, params));
    }
  });

  it('T-02 参照実装と一致（1〜200、誤差1e-9以内）', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const mine = generateMarket(seed, params);
      const theirs = ref.generateMarket(seed);
      expect(mine.scenario).toBe(theirs.scenario);
      expect(mine.events).toEqual(theirs.events);
      expect(mine.candles).toHaveLength(theirs.candles.length);
      mine.candles.forEach((k, i) => {
        const r = theirs.candles[i]!;
        for (const f of ['o', 'h', 'l', 'c'] as const) {
          expect(Math.abs(k[f] - r[f])).toBeLessThanOrEqual(1e-9);
        }
      });
    }
  });

  it('T-03 ローソク足に矛盾がない（1〜5,000）', () => {
    for (let seed = 1; seed <= 5000; seed++) {
      const { candles } = generateMarket(seed, params);
      expect(candles).toHaveLength(264);
      for (const k of candles) {
        if (!(k.h >= Math.max(k.o, k.c) && k.l <= Math.min(k.o, k.c) && k.l > 0)) {
          throw new Error(`seed ${seed}: ${JSON.stringify(k)}`);
        }
      }
    }
  });

  it('Q2 期間120か月でも全シナリオで相場が作れる（1〜1,000）', () => {
    const short = marketParams({ gameMonths: 120, preMonths: 24 });
    const seen = new Set<string>();
    for (let seed = 1; seed <= 1000; seed++) {
      const m = generateMarket(seed, short);
      expect(m.candles).toHaveLength(144);
      for (const e of m.events) expect(e.month).toBeLessThan(120);
      seen.add(m.scenario);
    }
    expect([...seen].sort()).toEqual([...SCENARIO_ORDER].sort());
  });

  it(`Q2 期間${MIN_GAME_MONTHS}か月未満はエラー`, () => {
    expect(() => generateMarket(1, marketParams({ gameMonths: MIN_GAME_MONTHS - 1, preMonths: 24 }))).toThrow();
    expect(() => generateMarket(1, marketParams({ gameMonths: MIN_GAME_MONTHS, preMonths: 24 }))).not.toThrow();
  });
});
