// 資産の計算（設計書 4.8・7.4）。毎月の初めに受け取り、その月の終値で約定する。手数料・税金・現金の利息はなし

import type { Order, Trade, TradeType } from './types';

export type Portfolio = {
  cash: number;
  shares: number;
  /** 株を買うのに使った額（買い足しを含む）。売ると0 */
  cost: number;
};

export function createPortfolio(): Portfolio {
  return { cash: 0, shares: 0, cost: 0 };
}

/** 月の初めに受け取る */
export const receive = (p: Portfolio, income: number): Portfolio => ({ ...p, cash: p.cash + income });

export const canBuy = (p: Portfolio): boolean => p.cash > 0;
export const canSell = (p: Portfolio): boolean => p.shares > 0;

/** 平均の買値＝株に使った額÷株数。株がなければ null */
export const avgPrice = (p: Portfolio): number | null => (p.shares > 0 ? p.cost / p.shares : null);

/** 現金＋株×値段 */
export const valueAt = (p: Portfolio, price: number): number => p.cash + p.shares * price;

/**
 * 月末の約定。買は手元の現金を全部（株を持っていれば買い足し）、売は全部。
 * 押せない注文（現金0の買・株0の売）は何もしない。1か月ずつ進めるゲーム中と、一括計算の両方でここを使う
 */
export function settle(
  p: Portfolio,
  order: TradeType | null,
  month: number,
  price: number,
): { portfolio: Portfolio; trade: Trade | null } {
  if (order === 'buy' && canBuy(p)) {
    return {
      portfolio: { cash: 0, shares: p.shares + p.cash / price, cost: p.cost + p.cash },
      trade: { month, type: 'buy', price },
    };
  }
  if (order === 'sell' && canSell(p)) {
    return { portfolio: { cash: p.cash + p.shares * price, shares: 0, cost: 0 }, trade: { month, type: 'sell', price } };
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
 * プレイヤーの資産を一括で計算する（参照実装 sim/monthly.mjs の simulatePlayer と同じ）。
 * 同じ月に注文が2つ以上あるときは最初の1つだけを使う（設計書 3.2・Q3）
 */
export function simulatePlayer(closes: number[], orders: Order[], income: number): PlayerResult {
  const byMonth = new Map<number, TradeType>();
  for (const o of orders) if (!byMonth.has(o.month)) byMonth.set(o.month, o.type);

  let p = createPortfolio();
  const history: number[] = [];
  const trades: Trade[] = [];
  for (let m = 0; m < closes.length; m++) {
    const price = closes[m]!;
    p = receive(p, income);
    const r = settle(p, byMonth.get(m) ?? null, m, price);
    p = r.portfolio;
    if (r.trade) trades.push(r.trade);
    history.push(valueAt(p, price));
  }
  return { final: history[history.length - 1]!, history, trades };
}

/** 積立：毎月受け取った分を、その月の終値で全部買う（毎月「買」を押すのと同じ）。売らない */
export function simulateTsumitate(closes: number[], income: number): { final: number; history: number[] } {
  const { final, history } = simulatePlayer(
    closes,
    closes.map((_, month) => ({ month, type: 'buy' })),
    income,
  );
  return { final, history };
}

/** 元本：m か月目の終わりで (m+1)×income */
export function principalHistory(months: number, income: number): number[] {
  return Array.from({ length: months }, (_, m) => (m + 1) * income);
}
