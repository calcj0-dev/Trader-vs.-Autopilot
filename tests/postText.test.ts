// T-11 投稿文の長さ（設計書 3.9・7.12）
import { describe, expect, it } from 'vitest';
import { shareUrl, siteUrl } from '../src/data';
import { TITLE_IDS, type TitleId } from '../src/core/judge';
import type { Outcome } from '../src/core/types';
import { postText, X_LIMIT, xLength } from '../src/share/postText';

function result(outcome: Outcome, opts: { final?: number; ts?: number; title?: TitleId } = {}) {
  const final = opts.final ?? 51_234_000;
  const ts = opts.ts ?? 45_621_000;
  return {
    final,
    tsumitate: { final: ts, history: [] },
    judgement: { outcome, diff: final / ts - 1 },
    title: opts.title ?? 'from_future',
  };
}

describe('T-11 投稿文', () => {
  it('5種類の文面（設計書 3.9）', () => {
    expect(postText(result('historic', { final: 56_000_000 }))).toBe(
      '毎月10万円を20年売買して、積立に歴史的勝利！（積立より+22.8%）最終5,600.0万円 称号：「未来から来た人（たぶん偶然）」 #積立投資を超えろ',
    );
    expect(postText(result('rout', { title: 'quit_job' }))).toBe(
      '毎月10万円を20年売買して、積立に圧勝しました！（積立より+12.3%）最終5,123.4万円 称号：「明日から仕事を辞めそうな人」 #積立投資を超えろ',
    );
    expect(postText(result('win', { final: 46_000_000, title: 'beats_tsumitate' }))).toBe(
      '毎月10万円を20年売買して、積立に勝ちました。（積立より+0.8%）最終4,600.0万円 称号：「積立には勝てる男（女）」 #積立投資を超えろ',
    );
    expect(postText(result('draw', { final: 45_621_000, title: 'practically_tsumitate' }))).toBe(
      '毎月10万円を20年売買して、積立と引き分けました。最終4,562.1万円 称号：「実質、積立」 #積立投資を超えろ',
    );
    expect(postText(result('lose', { final: 40_000_000, title: 'proved_tsumitate' }))).toBe(
      '毎月10万円を20年売買して積立に挑戦した結果、最終4,000.0万円で負けました（積立は4,562.1万円） 称号：「20年かけて積立の凄さを証明した人」 #積立投資を超えろ',
    );
  });

  it('金額が最大桁・称号が一番長くても、X の上限（全角2・URL 23・280）に収まる', () => {
    const longest = [...TITLE_IDS].sort((a, b) => postText(result('lose', { title: b })).length - postText(result('lose', { title: a })).length)[0]!;
    for (const o of ['historic', 'rout', 'win', 'draw', 'lose'] as const) {
      // 12桁の万円（9,999億円）・差も大きい場合
      const text = postText(result(o, { final: 9_999_999_999_999, ts: 99_999_999_999, title: longest }));
      expect(xLength(text), text).toBeLessThanOrEqual(X_LIMIT);
    }
  });

  it('文字数の数え方：英数字は1、日本語は2、URLは23', () => {
    expect(xLength('abc', false)).toBe(3);
    expect(xLength('あいう', false)).toBe(6);
    expect(xLength('abc')).toBe(3 + 1 + 23);
  });

  it('シェアするURLは作品のURLだけ（相場番号も計測用の文字も付けない）', () => {
    expect(siteUrl()).toBe('https://trader-vs-autopilot.vercel.app/');
    expect(shareUrl()).toBe('https://trader-vs-autopilot.vercel.app/');
    expect(shareUrl()).not.toMatch(/seed/);
  });
});
