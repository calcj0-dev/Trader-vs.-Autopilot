import { config, marketParams } from '../src/data';
import { gameCloses, generateMarket } from '../src/core/market';
import { simulateLumpSum, simulatePlayer, simulateTsumitate } from '../src/core/portfolio';
import { judge } from '../src/core/judge';
import type { Order } from '../src/core/types';

export const INITIAL_CASH = 1_000_000;
export const params = marketParams();

export function marketOf(seed: number) {
  const market = generateMarket(seed, params);
  return { market, closes: gameCloses(market, config.preMonths) };
}

/** 1プレイ分をまとめて計算する（円・最小単位1円） */
export function play(seed: number, orders: Order[]) {
  const { market, closes } = marketOf(seed);
  const me = simulatePlayer(closes, orders, INITIAL_CASH);
  const ts = simulateTsumitate(closes, INITIAL_CASH);
  const lump = simulateLumpSum(closes, INITIAL_CASH);
  const result = judge(me.final, ts.final, lump.final, me.trades, 1);
  return { market, closes, me, ts, lump, result };
}
