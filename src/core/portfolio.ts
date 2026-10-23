// 資産の計算（設計書 4.8・7.4）。手数料・税金・現金の利息はなし

import type { Order, Trade, TradeType } from './types';

export type Portfolio = {
  cash: number;
  shares: number;
  /** 株を持っているときの買値。現金のときは null */
  buyPrice: number | null;
};

export function createPortfolio(initialCash: number): Portfolio {
  return { cash: initialCash, shares: 0, buyPrice: null };
}

export const canBuy = (p: Portfolio): boolean => p.cash > 0;
export const canSell = (p: Portfolio): boolean => p.shares > 0;

/** 現金＋株×値段 */
export const valueAt = (p: Portfolio, price: number): number => p.cash + p.shares * price;

/**
 * 月末の約定。押せない注文（現金0の買・株0の売）は何もしない。
 * 1か月ずつ進めるゲーム中と、一括計算の両方でここを使う
 */
export function settle(
  p: Portfolio,
  order: TradeType | null,
  month: number,
  price: number,
): { portfolio: Portfolio; trade: Trade | null } {
  if (order === 'buy' && canBuy(p)) {
    return { portfolio: { cash: 0, shares: p.cash / price, buyPrice: price }, trade: { month, type: 'buy', price } };
  }
  if (order === 'sell' && canSell(p)) {
    return { portfolio: { cash: p.shares * price, shares: 0, buyPrice: null }, trade: { month, type: 'sell', price } };
  }
  return { portfolio: p, trade: null };
}

export type PlayerResult = {
  final: number;
  /** 月末ごとの資産 */
  history: number[];
  trades: Trade[];
};

/**
 * プレイヤーの資産を一括で計算する。
 * 同じ月に注文が2つ以上あるときは最初の1つだけを使う（設計書 3.2・Q3。参照実装は後のものを使うが、ここは合わせない）
 */
export function simulatePlayer(closes: number[], orders: Order[], initialCash: number): PlayerResult {
  const byMonth = new Map<number, TradeType>();
  for (const o of orders) if (!byMonth.has(o.month)) byMonth.set(o.month, o.type);

  let p = createPortfolio(initialCash);
  const history: number[] = [];
  const trades: Trade[] = [];
  for (let m = 0; m < closes.length; m++) {
    const price = closes[m]!;
    const r = settle(p, byMonth.get(m) ?? null, m, price);
    p = r.portfolio;
    if (r.trade) trades.push(r.trade);
    history.push(valueAt(p, price));
  }
  return { final: history[history.length - 1]!, history, trades };
}

/** 積立：初期資金を期間の月数で割り、毎月の終値で買う。売らない */
export function simulateTsumitate(closes: number[], initialCash: number): { final: number; history: number[] } {
  const monthly = initialCash / closes.length;
  let cash = initialCash;
  let shares = 0;
  const history: number[] = [];
  for (let m = 0; m < closes.length; m++) {
    shares += monthly / closes[m]!;
    cash -= monthly;
    history.push(cash + shares * closes[m]!);
  }
  return { final: history[history.length - 1]!, history };
}

/** 一括放置：最初の月の終値で全額買い、最後まで持つ */
export function simulateLumpSum(closes: number[], initialCash: number): PlayerResult {
  return simulatePlayer(closes, [{ month: 0, type: 'buy' }], initialCash);
}
