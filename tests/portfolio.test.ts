import { describe, expect, it } from 'vitest';
import * as ref from '../sim/model.mjs';
import { mulberry32 } from '../src/core/rng';
import { createPortfolio, settle, simulatePlayer, simulateTsumitate } from '../src/core/portfolio';
import type { Order } from '../src/core/types';
import { INITIAL_CASH, marketOf, play } from './helpers';

describe('資産の計算と勝敗', () => {
  it('T-04 計算例（相場番号7・0か月目 買、60 売、84 買）', () => {
    const r = play(7, [
      { month: 0, type: 'buy' },
      { month: 60, type: 'sell' },
      { month: 84, type: 'buy' },
    ]);
    expect(r.market.scenario).toBe('steady');
    expect(Math.round(r.me.final)).toBe(1_685_498);
    expect(Math.round(r.ts.final)).toBe(1_143_638);
    expect(Math.round(r.lump.final)).toBe(1_560_677);
    expect(r.me.trades).toHaveLength(3);
    expect(r.result.outcome).toBe('big_win');
    expect(r.result.isLumpHolder).toBe(false);
  });

  it('T-05 一括投資派と勝利（相場番号7・0か月目 買のみ）', () => {
    const r = play(7, [{ month: 0, type: 'buy' }]);
    expect(Math.round(r.me.final)).toBe(Math.round(r.lump.final));
    expect(r.result.outcome).toBe('win');
    expect(r.result.isLumpHolder).toBe(true);
  });

  it('T-06 同じ月の2回目は無視される（買が約定する）', () => {
    const { closes } = marketOf(7);
    const r = simulatePlayer(
      closes,
      [
        { month: 5, type: 'buy' },
        { month: 5, type: 'sell' },
      ],
      INITIAL_CASH,
    );
    expect(r.trades).toEqual([{ month: 5, type: 'buy', price: closes[5] }]);
  });

  it('T-07 押せない操作は何も起きない', () => {
    const cashOnly = createPortfolio(INITIAL_CASH);
    expect(settle(cashOnly, 'sell', 0, 100)).toEqual({ portfolio: cashOnly, trade: null });
    const bought = settle(cashOnly, 'buy', 0, 100).portfolio;
    expect(bought).toEqual({ cash: 0, shares: 10_000, buyPrice: 100 });
    expect(settle(bought, 'buy', 1, 120)).toEqual({ portfolio: bought, trade: null });
  });

  it('積立・プレイヤーの計算が参照実装と一致（1〜200・ランダム売買）', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { closes } = marketOf(seed);
      const rng = mulberry32(seed);
      const orders: Order[] = [];
      let holding = false;
      for (let m = 0; m < closes.length; m++) {
        if (rng() < 20 / 240) {
          orders.push({ month: m, type: holding ? 'sell' : 'buy' });
          holding = !holding;
        }
      }
      const refCloses = ref.gameCloses(ref.generateMarket(seed));
      expect(simulatePlayer(closes, orders, INITIAL_CASH).final).toBeCloseTo(ref.simulatePlayer(refCloses, orders).final!, 6);
      expect(simulateTsumitate(closes, INITIAL_CASH).final).toBeCloseTo(ref.simulateTsumitate(refCloses).final!, 6);
    }
  });
});
