import { describe, expect, it } from 'vitest';
import { config, marketParams, monthMs } from '../src/data';
import { MAX_FRAME_MS, MonthClock } from '../src/game/loop';
import { canOrder, closeMonth, isFinished, newSession, placeOrder, sessionResult } from '../src/game/session';
import { simulatePlayer } from '../src/core/portfolio';
import { t } from '../src/i18n';
import { gameVars } from '../src/ui/parts';
import { INITIAL_CASH } from './helpers';

/** 60fps 相当で最後まで進め、かかったゲーム内の時間（ミリ秒）を返す */
function runToEnd(gameMonths: number, gameSeconds: number) {
  const s = newSession(7, marketParams({ gameMonths, preMonths: config.preMonths }), INITIAL_CASH);
  const clock = new MonthClock(monthMs({ gameMonths, gameSeconds }), () => {
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

describe('1プレイの進行', () => {
  it('240か月が約80秒（±1秒）で終わる', () => {
    const { s, ms } = runToEnd(240, 80);
    expect(isFinished(s)).toBe(true);
    expect(s.history).toHaveLength(240);
    expect(Math.abs(ms - 80_000)).toBeLessThanOrEqual(1000);
  });

  it('T-13 期間120か月・全体60秒（1か月500ms）でも最後まで進み、文言も変わる', () => {
    const { s, ms } = runToEnd(120, 60);
    expect(isFinished(s)).toBe(true);
    expect(s.history).toHaveLength(120);
    expect(monthMs({ gameMonths: 120, gameSeconds: 60 })).toBe(500);
    expect(Math.abs(ms - 60_000)).toBeLessThanOrEqual(1000);
    const v = gameVars({ gameMonths: 120, gameSeconds: 60 });
    expect(t('rules.line1', v)).toBe('最初に100万円。10年分の相場が60秒で流れます');
    expect(t('params.period', v)).toBe('期間：10年（120か月）を60秒');
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

  it('注文は1か月に1回。押せない注文は受け付けない', () => {
    const s = newSession(7, marketParams(), INITIAL_CASH);
    expect(canOrder(s, 'sell')).toBe(false);
    expect(placeOrder(s, 'sell')).toBe(false);
    expect(placeOrder(s, 'buy')).toBe(true);
    expect(placeOrder(s, 'buy')).toBe(false);
    const trade = closeMonth(s);
    expect(trade?.type).toBe('buy');
    expect(canOrder(s, 'buy')).toBe(false);
    expect(canOrder(s, 'sell')).toBe(true);
  });

  it('1か月ずつ進めた結果が、一括計算（T-04 と同じ操作）と一致する', () => {
    const s = newSession(7, marketParams(), INITIAL_CASH);
    const orders = new Map<number, 'buy' | 'sell'>([
      [0, 'buy'],
      [60, 'sell'],
      [84, 'buy'],
    ]);
    while (!isFinished(s)) {
      const o = orders.get(s.month);
      if (o) placeOrder(s, o);
      closeMonth(s);
    }
    const r = sessionResult(s, 1);
    expect(Math.round(r.final)).toBe(1_685_498);
    expect(r.judgement.outcome).toBe('big_win');
    expect(r.final).toBe(simulatePlayer(s.closes, [...orders].map(([month, type]) => ({ month, type })), INITIAL_CASH).final);
  });
});
