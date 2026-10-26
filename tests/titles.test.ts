// T-15 称号・T-16 底値付近の判定（設計書 3.7）
import { describe, expect, it } from 'vitest';
import * as ref from '../sim/monthly.mjs';
import { titleData } from '../src/data';
import { pickTitle, soldNearBottom, TITLE_IDS, type TitleId } from '../src/core/judge';
import { mulberry32 } from '../src/core/rng';
import type { Outcome, ScenarioKey, Trade } from '../src/core/types';
import { humanLike, play, randomPresser } from './helpers';

const sell = (month: number, price = 100): Trade => ({ month, type: 'sell', price });
const buy = (month: number, price = 100): Trade => ({ month, type: 'buy', price });

/** 平らな相場（全部100）。売った月だけ値段を変えて底値付近を作る */
const flat = (n = 240) => Array.from({ length: n }, () => 100);

describe('T-15 称号', () => {
  const pick = (trades: Trade[], outcome: Outcome, opts: { diff?: number; scenario?: ScenarioKey; closes?: number[] } = {}) =>
    pickTitle(titleData, opts.closes ?? flat().map((v, i) => v + i), opts.scenario ?? 'steady', trades, {
      outcome,
      diff: opts.diff ?? (outcome === 'lose' ? -0.05 : 0.05),
    });
  /** 右肩上がりの相場の後半で、買い・売りを交互に（売った月が前後24か月の最安値付近にならない）。sells 回売る */
  const withSells = (sells: number) => Array.from({ length: sells * 2 }, (_, i) => (i % 2 === 0 ? buy(100 + i) : sell(100 + i)));

  it('各行の条件で期待した称号になる', () => {
    expect(pick([], 'historic')).toBe('cash_lover');
    expect(pick([buy(30)], 'lose')).toBe('one_button');
    expect(pick(withSells(20), 'historic')).toBe('from_future');
    expect(pick(withSells(20), 'rout')).toBe('quit_job');
    expect(pick(withSells(9), 'win')).toBe('beats_tsumitate');
    expect(pick(withSells(10), 'win')).toBe('tired_fingers');
    expect(pick(withSells(2), 'draw')).toBe('practically_tsumitate');
    // 負けでも積立との差が1%未満なら「実質、積立」。1%ちょうどは当てはまらない
    expect(pick(withSells(2), 'lose', { diff: -0.0099 })).toBe('practically_tsumitate');
    expect(pick(withSells(2), 'lose', { diff: -0.01 })).toBe('proved_tsumitate');
    expect(pick([buy(0), sell(5)], 'lose', { closes: flat() })).toBe('bottom_sommelier');
    expect(pick(withSells(10), 'lose')).toBe('chart_talker');
    expect(pick(withSells(9), 'lose')).toBe('proved_tsumitate');
    expect(pick(withSells(2), 'lose', { scenario: 'decline' })).toBe('blame_market');
    expect(pick(withSells(2), 'lose')).toBe('proved_tsumitate');
  });

  it('titles.json の称号はすべて既知の ID で、11個すべてが出てくる', () => {
    const ids = titleData.rules.map((r) => r.id);
    for (const id of ids) expect(TITLE_IDS as readonly string[]).toContain(id);
    expect(new Set(ids)).toEqual(new Set(TITLE_IDS));
  });

  it('参照実装 sim/monthly.mjs の pickTitle と一致（相場番号1〜500・ランダムな操作と人らしい遊び方）', () => {
    const counts: Partial<Record<TitleId, number>> = {};
    for (let seed = 1; seed <= 500; seed++) {
      const rng = mulberry32(seed ^ 0x1234);
      const orders = seed % 2 === 0 ? humanLike(240, rng) : randomPresser(240, rng, [20, 60, 120][seed % 3]!);
      const r = play(seed, orders);
      const mine = pickTitle(titleData, r.closes, r.market.scenario, r.me.trades, r.result);
      const refCloses = ref.gameCloses(ref.generateMarket(seed));
      const rp = ref.simulatePlayer(refCloses, orders);
      const rj = ref.judge(rp, ref.simulateTsumitate(refCloses));
      expect(r.result.outcome, `seed ${seed}`).toBe(rj.outcome);
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
