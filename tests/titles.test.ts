// T-15 称号・T-16 底値付近の判定（設計書 3.7）
import { describe, expect, it } from 'vitest';
import * as ref from '../sim/model.mjs';
import { titleData } from '../src/data';
import { pickTitle, soldNearBottom, TITLE_IDS, type TitleId } from '../src/core/judge';
import { mulberry32 } from '../src/core/rng';
import type { Order, Outcome, ScenarioKey, Trade } from '../src/core/types';
import { play } from './helpers';

const sell = (month: number, price = 100): Trade => ({ month, type: 'sell', price });
const buy = (month: number, price = 100): Trade => ({ month, type: 'buy', price });

/** 平らな相場（全部100）。売った月だけ値段を変えて底値付近を作る */
const flat = (n = 240) => Array.from({ length: n }, () => 100);

describe('T-15 称号', () => {
  const pick = (trades: Trade[], outcome: Outcome, opts: { lump?: boolean; scenario?: ScenarioKey; closes?: number[] } = {}) =>
    pickTitle(titleData, opts.closes ?? flat().map((v, i) => v + i), opts.scenario ?? 'steady', trades, {
      outcome,
      isLumpHolder: opts.lump ?? false,
    });
  // 右肩上がりの相場の後半で売買する（売った月が前後24か月の最安値付近にならない）
  const many = (n: number) => Array.from({ length: n }, (_, i) => (i % 2 === 0 ? buy(100 + i) : sell(100 + i)));

  it('11行それぞれの条件で期待した称号になる', () => {
    // 右肩上がりの相場（売った月が最安値付近にならない）
    expect(pick([], 'big_win')).toBe('cash_lover');
    expect(pick([buy(30)], 'lose', { lump: true })).toBe('one_button');
    expect(pick(many(10), 'big_win')).toBe('from_future');
    expect(pick(many(11), 'big_win')).toBe('quit_job');
    expect(pick(many(10), 'win')).toBe('beats_tsumitate');
    expect(pick(many(11), 'win')).toBe('tired_fingers');
    expect(pick(many(4), 'draw')).toBe('practically_tsumitate');
    expect(pick([buy(0), sell(5)], 'lose', { closes: flat() })).toBe('bottom_sommelier');
    expect(pick(many(30), 'lose')).toBe('chart_talker');
    expect(pick(many(4), 'lose', { scenario: 'decline' })).toBe('blame_market');
    expect(pick(many(4), 'lose')).toBe('proved_tsumitate');
  });

  it('titles.json の称号はすべて既知の ID', () => {
    expect(titleData.rules.map((r) => r.id)).toEqual([...TITLE_IDS]);
  });

  it('参照実装 pickTitle と一致（相場番号1〜500・ランダム売買）', () => {
    const counts: Partial<Record<TitleId, number>> = {};
    for (let seed = 1; seed <= 500; seed++) {
      const rng = mulberry32(seed ^ 0x1234);
      const k = [5, 10, 20, 40][seed % 4]!;
      const orders: Order[] = [];
      let holding = false;
      for (let m = 0; m < 240; m++) {
        if (rng() < k / 240) {
          orders.push({ month: m, type: holding ? 'sell' : 'buy' });
          holding = !holding;
        }
      }
      const r = play(seed, orders);
      const mine = pickTitle(titleData, r.closes, r.market.scenario, r.me.trades, r.result);
      const refCloses = ref.gameCloses(ref.generateMarket(seed));
      const rp = ref.simulatePlayer(refCloses, orders);
      const rj = ref.judge(rp, ref.simulateTsumitate(refCloses), ref.simulateLumpSum(refCloses), orders);
      expect(mine, `seed ${seed}`).toBe(ref.pickTitle(refCloses, r.market.scenario, rp, rj));
      counts[mine] = (counts[mine] ?? 0) + 1;
    }
    // いろいろな称号が出ている
    expect(Object.keys(counts).length).toBeGreaterThanOrEqual(6);
  });
});

describe('T-16 底値付近の判定', () => {
  const rule = titleData.nearBottom;
  it('売った月の終値が前後24か月の最安値の1.03倍ちょうどなら当てはまる、1.031倍なら当てはまらない', () => {
    const closes = flat();
    closes[100] = 103;
    expect(soldNearBottom(closes, [sell(100)], rule)).toBe(true);
    closes[100] = 103.1;
    expect(soldNearBottom(closes, [sell(100)], rule)).toBe(false);
  });

  it('前後24か月より外の安値は見ない。買いは見ない', () => {
    const closes = flat().map(() => 200);
    closes[50] = 100; // 売った月（100）から50か月前
    closes[100] = 200;
    expect(soldNearBottom(closes, [sell(100)], rule)).toBe(true);
    closes[80] = 100; // 20か月前（範囲内）
    expect(soldNearBottom(closes, [sell(100)], rule)).toBe(false);
    expect(soldNearBottom(closes, [buy(80)], rule)).toBe(false);
  });
});
