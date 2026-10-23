// 1プレイの状態（設計書 7.8）。計算は core/ の関数を呼ぶだけ

import { judge, type Judgement } from '../core/judge';
import { gameCloses, generateMarket } from '../core/market';
import { canBuy, canSell, createPortfolio, settle, simulateLumpSum, simulateTsumitate, valueAt, type Portfolio } from '../core/portfolio';
import type { Market, MarketParams, Trade, TradeType } from '../core/types';

export type Session = {
  seed: number;
  market: Market;
  closes: number[];
  preMonths: number;
  /** 今のゲームの月（0〜）。closes.length になったら終わり */
  month: number;
  portfolio: Portfolio;
  /** 今月の注文（月末に約定） */
  pending: TradeType | null;
  trades: Trade[];
  /** 月末ごとの資産 */
  history: number[];
  initialCash: number;
};

export function newSession(seed: number, params: MarketParams, initialCash: number): Session {
  const market = generateMarket(seed, params);
  return {
    seed: market.seed,
    market,
    closes: gameCloses(market, params.preMonths),
    preMonths: params.preMonths,
    month: 0,
    portfolio: createPortfolio(initialCash),
    pending: null,
    trades: [],
    history: [],
    initialCash,
  };
}

export const isFinished = (s: Session): boolean => s.month >= s.closes.length;

/** 今押せるか（終わっていない・今月まだ注文していない・現金／株がある） */
export function canOrder(s: Session, type: TradeType): boolean {
  if (isFinished(s) || s.pending !== null) return false;
  return type === 'buy' ? canBuy(s.portfolio) : canSell(s.portfolio);
}

/** 注文を受け付ける。同じ月の2回目・押せない注文は受け付けない（設計書 3.2・Q3） */
export function placeOrder(s: Session, type: TradeType): boolean {
  if (!canOrder(s, type)) return false;
  s.pending = type;
  return true;
}

/** 月を締める：注文の約定 → 資産の記録 → 次の月へ。約定した売買を返す */
export function closeMonth(s: Session): Trade | null {
  if (isFinished(s)) return null;
  const price = s.closes[s.month]!;
  const r = settle(s.portfolio, s.pending, s.month, price);
  s.portfolio = r.portfolio;
  if (r.trade) s.trades.push(r.trade);
  s.history.push(valueAt(s.portfolio, price));
  s.pending = null;
  s.month++;
  return r.trade;
}

export type SessionResult = {
  final: number;
  tsumitate: { final: number; history: number[] };
  lump: { final: number; history: number[] };
  history: number[];
  trades: Trade[];
  judgement: Judgement;
  scenario: Market['scenario'];
};

export function sessionResult(s: Session, minorUnit: number): SessionResult {
  const tsumitate = simulateTsumitate(s.closes, s.initialCash);
  const lump = simulateLumpSum(s.closes, s.initialCash);
  const final = s.history[s.history.length - 1] ?? s.initialCash;
  return {
    final,
    tsumitate,
    lump,
    history: s.history,
    trades: s.trades,
    judgement: judge(final, tsumitate.final, lump.final, s.trades, minorUnit),
    scenario: s.market.scenario,
  };
}
