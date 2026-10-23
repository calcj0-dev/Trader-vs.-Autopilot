// BAKA-016 積立投資を超えろ！ 毎月10万円の形の参照実装（2026-10-23 オーナー決定 Q15）
// 相場の作り方は model.mjs をそのまま使う。資産の計算・勝敗・称号はこのファイルが正。
// 実装（src/core/）と食い違う場合はこちらを正とする。

import { generateMarket, gameCloses, CONFIG } from './model.mjs';
export { generateMarket, gameCloses, CONFIG };
export { mulberry32 } from './model.mjs';

export const MONTHLY = {
  income: 100_000, // 毎月の初めに受け取るお金
  rout: 0.1, // 積立を +10% 以上上回ると「圧勝」
  historic: 0.2, // +20% 以上で「歴史的勝利」
  nearTsumitate: 0.01, // 負けでも差が 1% 未満なら称号「実質、積立」
  manySells: 10, // 売った回数がこれ以上なら「多い」
  nearBottom: { windowMonths: 24, ratio: 1.03 },
};

// ---- 資産の計算（手数料・税金なし） ----
// actions: [{ month, type: 'buy'|'sell' }]。同じ月に2つ以上あるときは最初の1つだけを使う。
// 毎月：受け取る → その月の終値で約定（買＝手元の現金を全部、売＝持っている株を全部）→ 月末の資産を記録
export function simulatePlayer(closes, actions, income = MONTHLY.income) {
  const byMonth = new Map();
  for (const a of actions) if (!byMonth.has(a.month)) byMonth.set(a.month, a.type);
  let cash = 0, shares = 0, cost = 0;
  const history = [], log = [];
  for (let m = 0; m < closes.length; m++) {
    cash += income;
    const p = closes[m];
    const t = byMonth.get(m);
    if (t === 'buy' && cash > 0) {
      shares += cash / p; cost += cash; cash = 0;
      log.push({ month: m, type: 'buy', price: p });
    } else if (t === 'sell' && shares > 0) {
      cash += shares * p; shares = 0; cost = 0;
      log.push({ month: m, type: 'sell', price: p });
    }
    history.push(cash + shares * p);
  }
  return { final: history[history.length - 1], history, log, trades: log.length, sells: log.filter((t) => t.type === 'sell').length };
}

// 積立：毎月受け取った分を、その月の終値で全部買う（＝毎月「買」を押すのと同じ）
export function simulateTsumitate(closes, income = MONTHLY.income) {
  return simulatePlayer(closes, closes.map((_, m) => ({ month: m, type: 'buy' })), income);
}

// 元本：受け取ったお金の合計
export const principal = (months, income = MONTHLY.income) => Array.from({ length: months }, (_, m) => (m + 1) * income);

// ---- 勝敗（Q15-1）：円単位に四捨五入して比べる ----
export function judge(player, tsumitate) {
  const me = Math.round(player.final), ts = Math.round(tsumitate.final);
  const diff = player.final / tsumitate.final - 1; // 積立との差（割合）
  let outcome;
  if (me === ts) outcome = 'draw';
  else if (me < ts) outcome = 'lose';
  else if (diff >= MONTHLY.historic) outcome = 'historic';
  else if (diff >= MONTHLY.rout) outcome = 'rout';
  else outcome = 'win';
  return { outcome, diff };
}

// ---- 称号（Q15-3）。上から順に判定し、最初に当てはまったもの ----
export function soldNearBottom(closes, log) {
  const { windowMonths, ratio } = MONTHLY.nearBottom;
  return log.some((t) => {
    if (t.type !== 'sell') return false;
    let min = Infinity;
    for (let i = Math.max(0, t.month - windowMonths); i <= Math.min(closes.length - 1, t.month + windowMonths); i++) min = Math.min(min, closes[i]);
    return closes[t.month] <= min * ratio;
  });
}

export function pickTitle(closes, scenario, player, result) {
  const n = player.trades, sells = player.sells, o = result.outcome;
  if (n === 0) return 'cash_lover';
  if (n === 1) return 'one_button';
  if (o === 'historic') return 'from_future';
  if (o === 'rout') return 'quit_job';
  if (o === 'win') return sells < MONTHLY.manySells ? 'beats_tsumitate' : 'tired_fingers';
  if (o === 'draw' || result.diff > -MONTHLY.nearTsumitate) return 'practically_tsumitate';
  if (soldNearBottom(closes, player.log)) return 'bottom_sommelier';
  if (sells >= MONTHLY.manySells) return 'chart_talker';
  if (scenario === 'decline') return 'blame_market';
  return 'proved_tsumitate';
}
