// T-14 ニュースの仕組み（設計書 3.6・4.5、Q1・Q4）
import { describe, expect, it } from 'vitest';
import { config, monthMs, newsData } from '../src/data';
import { buildNewsSchedule, newsAt, placeEventNews } from '../src/core/news';
import type { MarketEvent } from '../src/core/types';
import { marketOf } from './helpers';

const mMs = monthMs(config);
const toMonths = (sec: number) => (sec * 1000) / mMs;
const opts = {
  gameMonths: config.gameMonths,
  intervalMonths: { min: toMonths(config.news.intervalSec.min), max: toMonths(config.news.intervalSec.max) },
  showMonths: toMonths(config.news.showSec),
};

describe('T-14 ニュースの仕組み', () => {
  it('秒の設定を月に換算する（80秒・240か月で 6〜10秒＝18〜30か月、4秒＝12か月）', () => {
    expect(opts.intervalMonths.min).toBeCloseTo(18, 9);
    expect(opts.intervalMonths.max).toBeCloseTo(30, 9);
    expect(opts.showMonths).toBeCloseTo(12, 9);
  });

  it('ランダムの20個は1プレイで2回出ない。間隔は設定どおり（1〜500）', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const { market } = marketOf(seed);
      const items = buildNewsSchedule(seed, market.events, newsData, opts);
      const randomIds = items.filter((i) => i.kind === 'random').map((i) => i.id);
      expect(new Set(randomIds).size).toBe(randomIds.length);
      items.forEach((it, i) => {
        expect(it.end).toBeGreaterThan(it.start);
        expect(it.start).toBeLessThan(config.gameMonths);
        if (i === 0) return;
        const prev = items[i - 1]!;
        expect(it.start).toBeGreaterThanOrEqual(prev.start);
        // ランダムは、前のニュースが消えてから 18〜30か月後に出る
        if (it.kind === 'random') {
          const gap = it.start - (prev.start + opts.showMonths);
          expect(gap).toBeGreaterThanOrEqual(opts.intervalMonths.min - 1e-9);
          expect(gap).toBeLessThanOrEqual(opts.intervalMonths.max + 1e-9);
        }
      });
    }
  });

  it('暴落と回復で A・B・C、右肩上がりで D、長期下落で E が、出来事の月（重なりは送る）に出る', () => {
    const seen = { crash: 0, steady: 0, decline: 0 };
    for (let seed = 1; seed <= 400; seed++) {
      const { market } = marketOf(seed);
      const items = buildNewsSchedule(seed, market.events, newsData, opts).filter((i) => i.kind === 'event');
      const startOf = (id: string) => items.filter((i) => i.id === id).map((i) => i.start);
      const monthsOf = (kind: MarketEvent['kind']) => market.events.filter((e) => e.kind === kind).map((e) => e.month);
      if (market.scenario === 'crash') {
        seen.crash++;
        const [a, b, c] = [startOf('A')[0]!, startOf('B')[0]!, startOf('C')[0]!];
        expect(a).toBe(monthsOf('crash_news')[0]);
        expect(a).toBeLessThan(b);
        expect(b).toBeLessThan(c);
        expect(b).toBeGreaterThanOrEqual(monthsOf('crash_bounce')[0]!);
        expect(c).toBeGreaterThanOrEqual(monthsOf('crash_gloom')[0]!);
      }
      if (market.scenario === 'steady') {
        seen.steady++;
        expect(startOf('D')).toEqual(monthsOf('correction'));
      }
      if (market.scenario === 'decline') {
        seen.decline++;
        expect(startOf('E')).toEqual(monthsOf('decline_rally'));
      }
    }
    expect(seen.crash).toBeGreaterThan(50);
    expect(seen.steady).toBeGreaterThan(50);
    expect(seen.decline).toBeGreaterThan(5);
  });

  it('Q1 出来事ニュースは1か月に1つまで。A→B→C の順を守り、後のものを次の空いている月に送る', () => {
    // A と B が同じ月、C が A より前（実際に起きる重なり）
    const events: MarketEvent[] = [
      { month: 50, kind: 'crash_gloom' },
      { month: 51, kind: 'crash_news' },
      { month: 51, kind: 'crash_bounce' },
      { month: 54, kind: 'crash_bottom' },
    ];
    expect(placeEventNews(events, newsData, 240)).toEqual([
      { month: 51, id: 'A' },
      { month: 52, id: 'B' },
      { month: 53, id: 'C' },
    ]);
  });

  it('newsAt：出ている間だけ返す。割り込まれたらそこで消える', () => {
    const items = [
      { kind: 'random' as const, id: '01', start: 10, end: 15 },
      { kind: 'event' as const, id: 'A', start: 15, end: 27 },
    ];
    expect(newsAt(items, 9.9)).toBeNull();
    expect(newsAt(items, 12)?.id).toBe('01');
    expect(newsAt(items, 15)?.id).toBe('A');
    expect(newsAt(items, 27)).toBeNull();
  });
});
