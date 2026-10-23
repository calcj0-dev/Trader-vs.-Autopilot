// 投稿文（設計書 3.9）。文面は i18n の share.* に置き、ここでは差し込む値を決めるだけ

import { config } from '../data';
import { formatMoney, getCurrency } from '../currency';
import type { Outcome } from '../core/types';
import type { SessionResult } from '../game/session';
import { t } from '../i18n';

/** 投稿文（URL は含めない。X の投稿画面・Web Share には URL を別に渡す） */
export function postText(r: Pick<SessionResult, 'final' | 'tsumitate' | 'trades' | 'judgement' | 'title'>): string {
  const c = getCurrency();
  const vars = {
    initialCash: formatMoney(c.initialCash, 'whole'),
    years: config.gameMonths / 12,
    trades: r.trades.length,
    amount: formatMoney(r.final),
    tsumitate: formatMoney(r.tsumitate.final),
    title: t(`honor.${r.title}`),
  };
  const o: Outcome = r.judgement.outcome;
  if (r.judgement.isLumpHolder) {
    const verdict = o === 'draw' ? 'draw' : o === 'lose' ? 'lose' : 'win';
    return t('share.lump', { ...vars, verdict: t(`share.verdict.${verdict}`) });
  }
  return t(`share.${o}`, vars);
}

/** X の文字数の数え方：URL は23、下の範囲の文字は1、それ以外（日本語など）は2。上限280 */
export const X_LIMIT = 280;
const X_URL_WEIGHT = 23;
const LIGHT_RANGES: [number, number][] = [
  [0, 4351],
  [8192, 8205],
  [8208, 8223],
  [8242, 8247],
];

export function xLength(text: string, withUrl = true): number {
  let n = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    n += LIGHT_RANGES.some(([a, b]) => code >= a && code <= b) ? 1 : 2;
  }
  // 本文と URL の間の空白1つ＋URL
  return withUrl ? n + 1 + X_URL_WEIGHT : n;
}
