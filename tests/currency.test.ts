import { describe, expect, it } from 'vitest';
import { formatMoney } from '../src/currency';
import type { CurrencyConfig } from '../src/currency/types';
import { currencies } from '../src/data';
import { judge } from '../src/core/judge';
import { simulateLumpSum, simulatePlayer, simulateTsumitate } from '../src/core/portfolio';
import { mulberry32 } from '../src/core/rng';
import type { Order } from '../src/core/types';
import { marketOf } from './helpers';

const jpy = currencies.JPY;

describe('金額の表記', () => {
  it('T-12 円：資産額は万円・小数1桁', () => {
    expect(formatMoney(1_685_498, 'asset', jpy)).toBe('168.5万円');
    expect(formatMoney(982_000, 'asset', jpy)).toBe('98.2万円');
    expect(formatMoney(1_000_000, 'asset', jpy)).toBe('100.0万円');
  });

  it('円：文中の初期資金は「100万円」、細かい金額は「4,167円」', () => {
    expect(formatMoney(1_000_000, 'whole', jpy)).toBe('100万円');
    expect(formatMoney(1_000_000 / 240, 'plain', jpy)).toBe('4,167円');
  });
});

describe('T-18 計算は通貨に依存しない', () => {
  // 仮の通貨：初期資金1万、最小単位0.01
  const fake: CurrencyConfig = {
    code: 'TST',
    initialCash: 10_000,
    minorUnit: 0.01,
    formats: jpy.formats,
  };

  it('同じ相場・同じ操作なら、最終資産の比と勝敗が同じ（1〜300）', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { closes } = marketOf(seed);
      const rng = mulberry32(seed * 7);
      const orders: Order[] = [];
      let holding = false;
      for (let m = 0; m < closes.length; m++) {
        if (rng() < 15 / 240) {
          orders.push({ month: m, type: holding ? 'sell' : 'buy' });
          holding = !holding;
        }
      }
      const run = (c: CurrencyConfig) => {
        const me = simulatePlayer(closes, orders, c.initialCash);
        const ts = simulateTsumitate(closes, c.initialCash);
        const lump = simulateLumpSum(closes, c.initialCash);
        return { ratio: me.final / c.initialCash, r: judge(me.final, ts.final, lump.final, me.trades, c.minorUnit) };
      };
      const a = run(jpy);
      const b = run(fake);
      expect(b.ratio).toBeCloseTo(a.ratio, 9);
      expect(b.r).toEqual(a.r);
    }
  });
});
