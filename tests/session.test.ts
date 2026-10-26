import { afterEach, describe, expect, it, vi } from 'vitest';
import { config, marketParams, monthMs, titleData } from '../src/data';
import { MAX_FRAME_MS, MonthClock } from '../src/game/loop';
import { canOrder, closeMonth, isFinished, newSession, placeOrder, sessionResult } from '../src/game/session';
import { simulatePlayer } from '../src/core/portfolio';
import { t } from '../src/i18n';
import { settings } from '../src/settings';
import { gameVars } from '../src/ui/parts';
import { INCOME } from './helpers';

/** 60fps 相当で最後まで進め、かかったゲーム内の時間（ミリ秒）を返す */
function runToEnd(gameMonths: number, yearSeconds: number) {
  const s = newSession(7, marketParams({ gameMonths, preMonths: config.preMonths }), INCOME);
  const clock = new MonthClock(monthMs(yearSeconds), () => {
    closeMonth(s);
    return !isFinished(s);
  });
  let ms = 0;
  while (!isFinished(s) && ms < 10 * 60 * 1000) {
    clock.advance(1000 / 60);
    ms += 1000 / 60;
  }
  return { s, ms };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('1プレイの進行', () => {
  it('最初の設定（1年4秒）で、240か月が約80秒（±1秒）で終わる', () => {
    const { s, ms } = runToEnd(240, config.defaultYearSeconds);
    expect(isFinished(s)).toBe(true);
    expect(s.history).toHaveLength(240);
    expect(Math.abs(ms - 80_000)).toBeLessThanOrEqual(1000);
  });

  it('T-21 速さ（1年 4・5・6・8秒）のどれでも最後まで進み、全体は 20年×1年の秒数（±1秒）', () => {
    for (const ys of config.yearSecondsOptions) {
      const { s, ms } = runToEnd(240, ys);
      expect(isFinished(s), `${ys}`).toBe(true);
      expect(Math.abs(ms - 20 * ys * 1000), `${ys}`).toBeLessThanOrEqual(1000);
      expect(t('rules.line1', gameVars(config, ys))).toBe(`毎月10万円がもらえます。20年分の相場が${20 * ys}秒で流れます`);
    }
  });

  it('T-21 選んだ速さは端末に保存され、選択肢にない値は最初の設定に戻る', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    });
    expect(settings.speed).toBe(4);
    settings.speed = 8;
    expect(store.get('baka016.speed')).toBe('8');
    expect(settings.speed).toBe(8);
    expect(gameVars().seconds).toBe(160);
    store.set('baka016.speed', '10');
    expect(settings.speed).toBe(4);
  });

  it('T-13 期間120か月・1年6秒（1か月500ms）でも最後まで進み、文言も変わる', () => {
    const { s, ms } = runToEnd(120, 6);
    expect(isFinished(s)).toBe(true);
    expect(s.history).toHaveLength(120);
    expect(monthMs(6)).toBe(500);
    expect(Math.abs(ms - 60_000)).toBeLessThanOrEqual(1000);
    const v = gameVars({ gameMonths: 120, judge: config.judge }, 6);
    expect(t('rules.line1', v)).toBe('毎月10万円がもらえます。10年分の相場が60秒で流れます');
    expect(t('params.period', v)).toBe('期間：10年（120か月）を60秒（1年6秒）');
    expect(t('rules.line3b', v)).toBe('+10%で圧勝、+20%で歴史的勝利！');
  });

  it('長く止まった後でも一気に進まない（1コマは最大100ms）', () => {
    let months = 0;
    const clock = new MonthClock(1000 / 3, () => {
      months++;
      return true;
    });
    clock.advance(10_000);
    expect(months).toBe(Math.floor(MAX_FRAME_MS / (1000 / 3)));
  });

  it('毎月受け取る。注文は1か月に1回。押せない注文は受け付けない', () => {
    const s = newSession(7, marketParams(), INCOME);
    // 最初の月の分を受け取った状態で始まる
    expect(s.portfolio.cash).toBe(INCOME);
    expect(canOrder(s, 'sell')).toBe(false);
    expect(placeOrder(s, 'sell')).toBe(false);
    expect(placeOrder(s, 'buy')).toBe(true);
    expect(placeOrder(s, 'buy')).toBe(false);
    const trade = closeMonth(s);
    expect(trade?.type).toBe('buy');
    // 次の月の分を受け取ったので、買い足しも売りも押せる
    expect(s.portfolio.cash).toBe(INCOME);
    expect(canOrder(s, 'buy')).toBe(true);
    expect(canOrder(s, 'sell')).toBe(true);
  });

  it('1か月ずつ進めた結果が、一括計算と一致する（計算例1）', () => {
    const s = newSession(7, marketParams(), INCOME);
    const orders: { month: number; type: 'buy' | 'sell' }[] = [];
    while (!isFinished(s)) {
      const type = s.month === 60 ? 'sell' : s.month < 60 || s.month >= 84 ? 'buy' : null;
      if (type && placeOrder(s, type)) orders.push({ month: s.month, type });
      closeMonth(s);
    }
    const r = sessionResult(s, 1, titleData, config.judge);
    expect(Math.round(r.final)).toBe(28_409_970);
    expect(Math.round(r.tsumitate.final)).toBe(27_447_311);
    expect(r.judgement.outcome).toBe('win');
    expect(r.title).toBe('beats_tsumitate');
    expect(r.sells).toBe(1);
    expect(r.principal[239]).toBe(24_000_000);
    expect(r.final).toBe(simulatePlayer(s.closes, orders, INCOME).final);
  });
});
