import { describe, expect, it } from 'vitest';
import { formatMoney, formatRate } from '../src/currency';
import type { CurrencyConfig } from '../src/currency/types';
import { config, currencies, titleData } from '../src/data';
import { judge, pickTitle } from '../src/core/judge';
import { simulatePlayer, simulateTsumitate } from '../src/core/portfolio';
import { mulberry32 } from '../src/core/rng';
import { marketOf, randomPresser } from './helpers';

const jpy = currencies.JPY;

describe('金額の表記', () => {
  it('T-12 円：資産額は万円・小数1桁・3桁区切り', () => {
    expect(formatMoney(51_234_000, 'asset', jpy)).toBe('5,123.4万円');
    expect(formatMoney(123_456_000, 'asset', jpy)).toBe('12,345.6万円');
    expect(formatMoney(982_000, 'asset', jpy)).toBe('98.2万円');
    expect(formatMoney(1_000_000, 'asset', jpy)).toBe('100.0万円');
  });

  it('円：文中の金額は「10万円」「2,400万円」、細かい金額は「4,167円」', () => {
    expect(formatMoney(100_000, 'whole', jpy)).toBe('10万円');
    expect(formatMoney(24_000_000, 'whole', jpy)).toBe('2,400万円');
    expect(formatMoney(1_000_000 / 240, 'plain', jpy)).toBe('4,167円');
  });

  it('積立との差は小数1桁、+・−（全角）付き', () => {
    expect(formatRate(0.12345)).toBe('+12.3%');
    expect(formatRate(-0.0468)).toBe('−4.7%');
    expect(formatRate(0)).toBe('0.0%');
    expect(formatRate(-0.00001)).toBe('0.0%');
  });
});

describe('T-18 計算は通貨に依存しない', () => {
  // 仮の通貨：毎月100、最小単位0.01
  const fake: CurrencyConfig = {
    code: 'TST',
    monthlyIncome: 100,
    minorUnit: 0.01,
    formats: jpy.formats,
  };

  it('同じ相場・同じ操作なら、最終資産の比・勝敗・称号が同じ（1〜300）', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { market, closes } = marketOf(seed);
      const orders = randomPresser(closes.length, mulberry32(seed * 7), 40);
      const run = (c: CurrencyConfig) => {
        const me = simulatePlayer(closes, orders, c.monthlyIncome);
        const ts = simulateTsumitate(closes, c.monthlyIncome);
        const r = judge(me.final, ts.final, c.minorUnit, config.judge);
        return { ratio: me.final / c.monthlyIncome, r, title: pickTitle(titleData, closes, market.scenario, me.trades, r) };
      };
      const a = run(jpy);
      const b = run(fake);
      expect(b.ratio).toBeCloseTo(a.ratio, 6);
      expect(b.r.outcome).toBe(a.r.outcome);
      expect(b.r.diff).toBeCloseTo(a.r.diff, 9);
      expect(b.title).toBe(a.title);
    }
  });
});
