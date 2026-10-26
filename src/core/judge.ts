// 勝敗・称号（設計書 3.3・3.7・7.5・7.6）

import type { Outcome, ScenarioKey, Trade } from './types';

export type Judgement = {
  outcome: Outcome;
  /** 積立との差（あなた÷積立−1） */
  diff: number;
};

/** 勝敗の区切り（config.json の judge）。積立を何割上回れば圧勝・歴史的勝利か */
export type JudgeThresholds = { rout: number; historic: number };

/**
 * 最終資産を通貨の最小単位に丸めてから比べる（画面の表示と食い違わないように）。
 * 圧勝・歴史的勝利の境目も、積立×(1＋区切り) を最小単位に丸めた額と比べる（+10% ちょうどを確実に圧勝にするため）
 */
export function judge(me: number, tsumitate: number, minorUnit: number, th: JudgeThresholds): Judgement {
  const round = (x: number) => Math.round(x / minorUnit);
  const m = round(me);
  const t = round(tsumitate);
  let outcome: Outcome;
  if (m === t) outcome = 'draw';
  else if (m < t) outcome = 'lose';
  else if (m >= Math.round(t * (1 + th.historic))) outcome = 'historic';
  else if (m >= Math.round(t * (1 + th.rout))) outcome = 'rout';
  else outcome = 'win';
  return { outcome, diff: me / tsumitate - 1 };
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
      /** 約定した回数（買・売の合計） */
      trades?: { min?: number; max?: number };
      /** 約定した売りの回数 */
      sells?: { min?: number; max?: number };
      outcome?: string[];
      /** 積立との差がこれより大きい */
      diffAbove?: number;
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

const inRange = (n: number, r?: { min?: number; max?: number }) =>
  !r || ((r.min === undefined || n >= r.min) && (r.max === undefined || n <= r.max));

/** 称号：titles.json の上から順に条件を見て、最初に当てはまったもの（同じ ID が2行あれば「または」） */
export function pickTitle(
  data: TitleData,
  closes: number[],
  scenario: ScenarioKey,
  trades: Trade[],
  j: Judgement,
): TitleId {
  const n = trades.length;
  const sells = trades.filter((t) => t.type === 'sell').length;
  let near: boolean | null = null;
  const nearBottom = () => (near ??= soldNearBottom(closes, trades, data.nearBottom));
  for (const rule of data.rules) {
    const w = rule.when;
    if (!inRange(n, w.trades) || !inRange(sells, w.sells)) continue;
    if (w.outcome && !w.outcome.includes(j.outcome)) continue;
    if (w.diffAbove !== undefined && !(j.diff > w.diffAbove)) continue;
    if (w.scenario && !w.scenario.includes(scenario)) continue;
    if (w.nearBottom !== undefined && w.nearBottom !== nearBottom()) continue;
    if ((TITLE_IDS as readonly string[]).includes(rule.id)) return rule.id as TitleId;
  }
  return 'proved_tsumitate';
}
