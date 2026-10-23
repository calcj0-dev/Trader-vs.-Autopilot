// 勝敗と一括投資派（設計書 3.3・7.5）。称号の判定は #12 で足す

import type { Outcome, Trade } from './types';

export type Judgement = {
  outcome: Outcome;
  /** 約定した売買が「買」1回だけ（買った月は問わない） */
  isLumpHolder: boolean;
  /** 公開後の「全体の勝率」に数えるか（一括投資派は除く） */
  countsForWinRate: boolean;
};

/**
 * 3者の最終資産を通貨の最小単位に丸めてから比べる（画面の表示と食い違わないように）。
 * trades には約定した売買を渡す
 */
export function judge(me: number, tsumitate: number, lump: number, trades: Trade[], minorUnit: number): Judgement {
  const round = (x: number) => Math.round(x / minorUnit);
  const m = round(me);
  const t = round(tsumitate);
  const l = round(lump);
  const isLumpHolder = trades.length === 1 && trades[0]!.type === 'buy';
  let outcome: Outcome;
  if (m > t && m > l) outcome = 'big_win';
  else if (m > t) outcome = 'win';
  else if (m === t) outcome = 'draw';
  else outcome = 'lose';
  return { outcome, isLumpHolder, countsForWinRate: !isLumpHolder };
}
