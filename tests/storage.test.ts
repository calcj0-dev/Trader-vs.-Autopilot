import { afterEach, describe, expect, it, vi } from 'vitest';
import { load, save } from '../src/storage';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('端末への保存', () => {
  it('保存できない環境（localStorage がない）では初期値で動く', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(load('sound', 'on')).toBe('on');
    expect(() => save('sound', 'off')).not.toThrow();
  });

  it('localStorage が例外を出しても止まらない', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    });
    expect(load('chart', 'candle')).toBe('candle');
    expect(() => save('chart', 'line')).not.toThrow();
  });

  it('保存した値を読み出せる（キーには baka016. を付ける）', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    });
    save('rulesSeen', '1');
    expect(store.get('baka016.rulesSeen')).toBe('1');
    expect(load('rulesSeen', '0')).toBe('1');
  });
});
