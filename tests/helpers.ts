import { config, marketParams } from '../src/data';
import { gameCloses, generateMarket } from '../src/core/market';
import { simulatePlayer, simulateTsumitate } from '../src/core/portfolio';
import { judge } from '../src/core/judge';
import type { Rng } from '../src/core/rng';
import type { Order } from '../src/core/types';

/** 毎月受け取る額（円） */
export const INCOME = 100_000;
export const params = marketParams();

export function marketOf(seed: number) {
  const market = generateMarket(seed, params);
  return { market, closes: gameCloses(market, config.preMonths) };
}

/** 1プレイ分をまとめて計算する（円・最小単位1円） */
export function play(seed: number, orders: Order[]) {
  const { market, closes } = marketOf(seed);
  const me = simulatePlayer(closes, orders, INCOME);
  const ts = simulateTsumitate(closes, INCOME);
  const result = judge(me.final, ts.final, 1, config.judge);
  return { market, closes, me, ts, result };
}

/** 毎月「買」（積立と同じ操作） */
export const everyMonth = (months: number): Order[] => Array.from({ length: months }, (_, month) => ({ month, type: 'buy' }));

/** 約 n 回ランダムに押す。株を持っていれば半々で売り、それ以外は買い（sim/monthly_simulate.mjs と同じ） */
export function randomPresser(months: number, rng: Rng, n: number): Order[] {
  const orders: Order[] = [];
  let holding = false;
  for (let m = 0; m < months; m++) {
    if (rng() < n / months) {
      const type: Order['type'] = holding && rng() < 0.5 ? 'sell' : 'buy';
      orders.push({ month: m, type });
      holding = type === 'buy';
    }
  }
  return orders;
}

/** 人らしい遊び方：2〜4か月に1回買い足し、たまに売る（sim/monthly_simulate.mjs と同じ） */
export function humanLike(months: number, rng: Rng): Order[] {
  const orders: Order[] = [];
  let holding = false;
  let next = 1 + Math.floor(rng() * 3);
  for (let m = 0; m < months; m++) {
    if (m < next) continue;
    next = m + 2 + Math.floor(rng() * 3);
    const type: Order['type'] = holding && rng() < 0.12 ? 'sell' : 'buy';
    orders.push({ month: m, type });
    holding = type === 'buy';
  }
  return orders;
}
