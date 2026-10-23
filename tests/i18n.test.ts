import { describe, expect, it } from 'vitest';
import { messagesByLocale } from '../src/data';
import { format, t } from '../src/i18n';
import { MESSAGE_KEYS, RANDOM_NEWS_KEY } from '../src/i18n/types';
import newsData from '../src/data/news.json';

describe('文言（i18n）', () => {
  it('すべてのキーに空でない文言がある（ja）', () => {
    for (const k of MESSAGE_KEYS) expect(messagesByLocale.ja[k], k).toMatch(/\S/);
  });

  it('JSON に、型にないキーがない', () => {
    const extra = Object.keys(messagesByLocale.ja).filter(
      (k) => !(MESSAGE_KEYS as readonly string[]).includes(k) && !RANDOM_NEWS_KEY.test(k),
    );
    expect(extra).toEqual([]);
  });

  it('news.json のランダムのニュースすべてに、媒体名と見出しがある', () => {
    const ja = messagesByLocale.ja as Record<string, string>;
    expect(newsData.random).toHaveLength(20);
    for (const id of newsData.random) {
      expect(ja[`news.random.${id}.source`], id).toMatch(/\S/);
      expect(ja[`news.random.${id}.headline`], id).toMatch(/\S/);
    }
  });

  it('差し込み {name} を置き換える。値がない差し込みはそのまま残す', () => {
    expect(format('{a}と{b}', { a: 1 })).toBe('1と{b}');
    expect(t('rules.line1', { initialCash: '100万円', years: 20, seconds: 80 })).toBe(
      '最初に100万円。20年分の相場が80秒で流れます',
    );
  });
});
