import { describe, expect, it } from 'vitest';
import * as ref from '../sim/monthly.mjs';
import { titleData } from '../src/data';
import { pickTitle } from '../src/core/judge';
import { mulberry32 } from '../src/core/rng';
import { avgPrice, createPortfolio, principalHistory, receive, settle, simulatePlayer, simulateTsumitate } from '../src/core/portfolio';
import type { Order } from '../src/core/types';
import { everyMonth, INCOME, marketOf, play, randomPresser } from './helpers';

/** 計算例1：毎月買い、60で売り、61〜83は買わず、84から再び毎月買う */
const example1: Order[] = [];
for (let m = 0; m < 240; m++) {
  if (m === 60) example1.push({ month: m, type: 'sell' });
  else if (m < 60 || m >= 84) example1.push({ month: m, type: 'buy' });
}

describe('資産の計算と勝敗', () => {
  it('T-04 計算例（相場番号7。設計書 4.9 の例1〜5）', () => {
    const cases: [Order[], number, string, string, number][] = [
      [example1, 28_409_970, 'win', 'beats_tsumitate', 0.0351],
      [
        [
          { month: 0, type: 'buy' },
          { month: 60, type: 'sell' },
          { month: 84, type: 'buy' },
        ],
        26_162_234,
        'lose',
        'proved_tsumitate',
        -0.0468,
      ],
      [everyMonth(240), 27_447_311, 'draw', 'practically_tsumitate', 0],
      [Array.from({ length: 20 }, (_, i) => ({ month: 11 + i * 12, type: 'buy' as const })), 27_213_767, 'lose', 'practically_tsumitate', -0.0085],
      [[], 24_000_000, 'lose', 'cash_lover', -0.1256],
    ];
    for (const [orders, final, outcome, title, diff] of cases) {
      const r = play(7, orders);
      expect(r.market.scenario).toBe('steady');
      expect(Math.round(r.ts.final)).toBe(27_447_311);
      expect(Math.round(r.me.final)).toBe(final);
      expect(r.result.outcome).toBe(outcome);
      expect(r.result.diff).toBeCloseTo(diff, 4);
      expect(pickTitle(titleData, r.closes, r.market.scenario, r.me.trades, r.result)).toBe(title);
    }
    expect(play(7, example1).me.trades).toHaveLength(217);
  });

  it('T-05 毎月受け取り、株を持っていても買い足せる。平均の買値は株に使った額÷株数', () => {
    let p = receive(createPortfolio(), INCOME);
    expect(p).toEqual({ cash: 100_000, shares: 0, cost: 0 });
    p = settle(p, 'buy', 0, 100).portfolio;
    expect(p).toEqual({ cash: 0, shares: 1_000, cost: 100_000 });
    p = receive(p, INCOME);
    const r = settle(p, 'buy', 1, 200);
    expect(r.trade).toEqual({ month: 1, type: 'buy', price: 200 });
    p = r.portfolio;
    expect(p.shares).toBe(1_500);
    expect(avgPrice(p)).toBeCloseTo(200_000 / 1_500, 9);
    // 売ると全部現金になり、平均の買値は消える
    p = settle(p, 'sell', 2, 300).portfolio;
    expect(p).toEqual({ cash: 450_000, shares: 0, cost: 0 });
    expect(avgPrice(p)).toBeNull();
  });

  it('T-06 同じ月の2回目は無視される（最初の注文が約定する）', () => {
    const { closes } = marketOf(7);
    const r = simulatePlayer(
      closes,
      [
        { month: 5, type: 'buy' },
        { month: 5, type: 'sell' },
      ],
      INCOME,
    );
    expect(r.trades).toEqual([{ month: 5, type: 'buy', price: closes[5] }]);
  });

  it('T-07 押せない操作は何も起きない', () => {
    const empty = createPortfolio();
    expect(settle(empty, 'buy', 0, 100)).toEqual({ portfolio: empty, trade: null });
    expect(settle(empty, 'sell', 0, 100)).toEqual({ portfolio: empty, trade: null });
    const cashOnly = receive(empty, INCOME);
    expect(settle(cashOnly, 'sell', 0, 100)).toEqual({ portfolio: cashOnly, trade: null });
  });

  it('元本は (m+1)×毎月の額', () => {
    const p = principalHistory(240, INCOME);
    expect(p[0]).toBe(100_000);
    expect(p[239]).toBe(24_000_000);
  });

  it('プレイヤー・積立の計算が参照実装 sim/monthly.mjs と一致（1〜200・ランダムな操作）', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { closes } = marketOf(seed);
      const orders = randomPresser(closes.length, mulberry32(seed), 40);
      const refCloses = ref.gameCloses(ref.generateMarket(seed));
      expect(simulatePlayer(closes, orders, INCOME).final).toBeCloseTo(ref.simulatePlayer(refCloses, orders).final!, 4);
      expect(simulateTsumitate(closes, INCOME).final).toBeCloseTo(ref.simulateTsumitate(refCloses).final!, 4);
    }
  });
});
