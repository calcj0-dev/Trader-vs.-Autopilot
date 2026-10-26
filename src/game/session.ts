// 1プレイの状態（設計書 7.8）。計算は core/ の関数を呼ぶだけ

import { judge, pickTitle, type JudgeThresholds, type Judgement, type TitleData, type TitleId } from '../core/judge';
import { gameCloses, generateMarket } from '../core/market';
import {
  canBuy,
  canSell,
  createPortfolio,
  principalHistory,
  receive,
  settle,
  simulateTsumitate,
  valueAt,
  type Portfolio,
} from '../core/portfolio';
import type { Market, MarketParams, Trade, TradeType } from '../core/types';

export type Session = {
  seed: number;
  market: Market;
  closes: number[];
  preMonths: number;
  /** 今のゲームの月（0〜）。closes.length になったら終わり */
  month: number;
  /** 今月の分は受け取り済み */
  portfolio: Portfolio;
  /** 今月の注文（月末に約定） */
  pending: TradeType | null;
  trades: Trade[];
  /** 月末ごとの資産 */
  history: number[];
  /** 毎月受け取る額 */
  income: number;
};

export function newSession(seed: number, params: MarketParams, income: number): Session {
  const market = generateMarket(seed, params);
  return {
    seed: market.seed,
    market,
    closes: gameCloses(market, params.preMonths),
    preMonths: params.preMonths,
    month: 0,
    // 最初の月の分を受け取った状態で始める（1か月目から「買」を押せる）
    portfolio: receive(createPortfolio(), income),
    pending: null,
    trades: [],
    history: [],
    income,
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

/** 月を締める：注文の約定 → 資産の記録 → 次の月へ → 次の月の分を受け取る。約定した売買を返す */
export function closeMonth(s: Session): Trade | null {
  if (isFinished(s)) return null;
  const price = s.closes[s.month]!;
  const r = settle(s.portfolio, s.pending, s.month, price);
  s.portfolio = r.portfolio;
  if (r.trade) s.trades.push(r.trade);
  s.history.push(valueAt(s.portfolio, price));
  s.pending = null;
  s.month++;
  if (!isFinished(s)) s.portfolio = receive(s.portfolio, s.income);
  return r.trade;
}

export type SessionResult = {
  final: number;
  tsumitate: { final: number; history: number[] };
  /** 元本（受け取ったお金の合計）の推移 */
  principal: number[];
  history: number[];
  trades: Trade[];
  /** 約定した売りの回数（結果の内訳・称号の条件） */
  sells: number;
  judgement: Judgement;
  title: TitleId;
  scenario: Market['scenario'];
};

export function sessionResult(s: Session, minorUnit: number, titles: TitleData, th: JudgeThresholds): SessionResult {
  const tsumitate = simulateTsumitate(s.closes, s.income);
  const final = s.history[s.history.length - 1] ?? 0;
  const judgement = judge(final, tsumitate.final, minorUnit, th);
  return {
    final,
    tsumitate,
    principal: principalHistory(s.closes.length, s.income),
    history: s.history,
    trades: s.trades,
    sells: s.trades.filter((t) => t.type === 'sell').length,
    judgement,
    title: pickTitle(titles, s.closes, s.market.scenario, s.trades, judgement),
    scenario: s.market.scenario,
  };
}
