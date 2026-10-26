// 計測（設計書 9章）
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gaId, initAnalytics, markRetry, sellsBucket, takeRetry, track } from '../src/analytics';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('計測', () => {
  it('全イベントに lang・currency を付けて GA4 に送る', () => {
    const gtag = vi.fn();
    vi.stubGlobal('window', { gtag });
    track('finish', { scenario: 'crash', outcome: 'rout', sells: '3-9', speed: 4 });
    expect(gtag).toHaveBeenCalledWith('event', 'finish', { scenario: 'crash', outcome: 'rout', sells: '3-9', speed: 4, lang: 'ja', currency: 'JPY' });
  });

  it('GA4 を読み込めていない・失敗しても例外を出さない', () => {
    vi.stubGlobal('window', {});
    expect(() => track('retry', {})).not.toThrow();
    vi.stubGlobal('window', {
      gtag: () => {
        throw new Error('blocked');
      },
    });
    expect(() => track('main_app_click', { target: 'tameru' })).not.toThrow();
  });

  it('VITE_GA_ID が空なら GA4 は読み込まない', () => {
    expect(gaId()).toBe('');
    const append = vi.fn();
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', { head: { append }, createElement: () => ({}) });
    initAnalytics();
    expect(append).not.toHaveBeenCalled();
  });

  it('売った回数の区分は 0／1-2／3-9／10+（称号の区切りに合わせる）', () => {
    expect([0, 1, 2, 3, 9, 10, 50].map(sellsBucket)).toEqual(['0', '1-2', '1-2', '3-9', '3-9', '10+', '10+']);
  });

  it('「もう一回」「最初から」の印は、次の start で1回だけ読む（Q8）', () => {
    expect(takeRetry()).toBe(false);
    markRetry();
    expect(takeRetry()).toBe(true);
    expect(takeRetry()).toBe(false);
  });
});
