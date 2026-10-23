// 勝敗・一括投資派・称号（設計書 3.3・3.7・7.5・7.6）

import type { Outcome, ScenarioKey, Trade } from './types';

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

export type TitleId =
  | 'cash_lover'
  | 'one_button'
  | 'from_future'
  | 'quit_job'
  | 'beats_tsumitate'
  | 'tired_fingers'
  | 'practically_tsumitate'
  | 'bottom_sommelier'
  | 'chart_talker'
  | 'blame_market'
  | 'proved_tsumitate';

export const TITLE_IDS: readonly TitleId[] = [
  'cash_lover',
  'one_button',
  'from_future',
  'quit_job',
  'beats_tsumitate',
  'tired_fingers',
  'practically_tsumitate',
  'bottom_sommelier',
  'chart_talker',
  'blame_market',
  'proved_tsumitate',
];

/** data/titles.json の形 */
export type TitleData = {
  nearBottom: { windowMonths: number; ratio: number };
  rules: {
    id: string;
    when: {
      trades?: { min?: number; max?: number };
      outcome?: string[];
      lumpHolder?: boolean;
      nearBottom?: boolean;
      scenario?: string[];
    };
  }[];
};

/**
 * 底値付近で売った：約定した売りのうち、その月の終値が前後 windowMonths か月（ゲーム期間内）の
 * 終値の最安値の ratio 倍以下のものが1回以上ある
 */
export function soldNearBottom(closes: number[], trades: Trade[], rule: TitleData['nearBottom']): boolean {
  return trades.some((t) => {
    if (t.type !== 'sell') return false;
    const from = Math.max(0, t.month - rule.windowMonths);
    const to = Math.min(closes.length - 1, t.month + rule.windowMonths);
    let min = Infinity;
    for (let i = from; i <= to; i++) min = Math.min(min, closes[i]!);
    return closes[t.month]! <= min * rule.ratio;
  });
}

/** 称号：titles.json の上から順に条件を見て、最初に当てはまったもの */
export function pickTitle(
  data: TitleData,
  closes: number[],
  scenario: ScenarioKey,
  trades: Trade[],
  j: Pick<Judgement, 'outcome' | 'isLumpHolder'>,
): TitleId {
  const n = trades.length;
  let near: boolean | null = null;
  const nearBottom = () => (near ??= soldNearBottom(closes, trades, data.nearBottom));
  for (const rule of data.rules) {
    const w = rule.when;
    if (w.trades?.min !== undefined && n < w.trades.min) continue;
    if (w.trades?.max !== undefined && n > w.trades.max) continue;
    if (w.outcome && !w.outcome.includes(j.outcome)) continue;
    if (w.lumpHolder !== undefined && w.lumpHolder !== j.isLumpHolder) continue;
    if (w.scenario && !w.scenario.includes(scenario)) continue;
    if (w.nearBottom !== undefined && w.nearBottom !== nearBottom()) continue;
    if ((TITLE_IDS as readonly string[]).includes(rule.id)) return rule.id as TitleId;
  }
  return 'proved_tsumitate';
}
