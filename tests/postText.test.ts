// T-11 投稿文の長さ（設計書 3.9・7.12）
import { describe, expect, it } from 'vitest';
import { shareUrl, siteUrl } from '../src/data';
import { TITLE_IDS, type TitleId } from '../src/core/judge';
import type { Outcome, Trade } from '../src/core/types';
import { postText, X_LIMIT, xLength } from '../src/share/postText';

const trades = (n: number): Trade[] => Array.from({ length: n }, (_, i) => ({ month: i, type: i % 2 ? 'sell' : 'buy', price: 1 }));

function result(outcome: Outcome, opts: { lump?: boolean; final?: number; ts?: number; n?: number; title?: TitleId } = {}) {
  return {
    final: opts.final ?? 1_685_498,
    tsumitate: { final: opts.ts ?? 1_143_638, history: [] },
    trades: trades(opts.n ?? 3),
    judgement: { outcome, isLumpHolder: opts.lump ?? false, countsForWinRate: !opts.lump },
    title: opts.title ?? 'from_future',
  };
}

describe('T-11 投稿文', () => {
  it('5種類の文面（設計書 3.9）', () => {
    expect(postText(result('big_win'))).toBe(
      '100万円を20年売買して、積立にも一括投資にも勝ちました！ 売買3回・最終168.5万円 称号：「未来から来た人（たぶん偶然）」 #積立投資を超えろ',
    );
    expect(postText(result('win', { title: 'beats_tsumitate' }))).toBe(
      '100万円を20年売買して、積立に勝ちました。売買3回・最終168.5万円 称号：「積立には勝てる男（女）」 #積立投資を超えろ',
    );
    expect(postText(result('draw', { title: 'practically_tsumitate' }))).toContain('積立と引き分けました。');
    expect(postText(result('lose', { final: 982_000, title: 'proved_tsumitate' }))).toBe(
      '100万円を20年売買して積立に挑戦した結果、売買3回・最終98.2万円で負けました（積立は114.4万円） 称号：「20年かけて積立の凄さを証明した人」 #積立投資を超えろ',
    );
    expect(postText(result('win', { lump: true, n: 1, title: 'one_button' }))).toBe(
      '100万円を20年…1回買って放置しました。最終168.5万円で、積立に勝ちました 称号：「ボタンを1回しか押していない人」 #積立投資を超えろ',
    );
    // 一括投資派で大勝利（遅れて買った場合）も「勝ちました」
    expect(postText(result('big_win', { lump: true, n: 1, title: 'one_button' }))).toContain('積立に勝ちました');
    expect(postText(result('lose', { lump: true, n: 1, title: 'one_button' }))).toContain('積立に負けました');
  });

  it('金額が最大桁・称号が一番長くても、X の上限（全角2・URL 23・280）に収まる', () => {
    const longest = [...TITLE_IDS].sort((a, b) => postText(result('lose', { title: b })).length - postText(result('lose', { title: a })).length)[0]!;
    for (const o of ['big_win', 'win', 'draw', 'lose'] as const) {
      for (const lump of [false, true]) {
        const text = postText(result(o, { lump, final: 99_999_999_999, ts: 99_999_999_999, n: 240, title: longest }));
        expect(xLength(text), text).toBeLessThanOrEqual(X_LIMIT);
      }
    }
  });

  it('文字数の数え方：英数字は1、日本語は2、URLは23', () => {
    expect(xLength('abc', false)).toBe(3);
    expect(xLength('あいう', false)).toBe(6);
    expect(xLength('abc')).toBe(3 + 1 + 23);
  });

  it('シェアするURLに相場番号は付けない。計測用のパラメータを付ける', () => {
    expect(siteUrl()).toBe('https://trader-vs-autopilot.vercel.app/');
    expect(shareUrl()).toBe('https://trader-vs-autopilot.vercel.app/?utm_source=x&utm_medium=share&utm_campaign=baka016');
    expect(shareUrl()).not.toMatch(/seed/);
  });
});
