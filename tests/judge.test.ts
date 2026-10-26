import { describe, expect, it } from 'vitest';
import { config } from '../src/data';
import { judge } from '../src/core/judge';
import { simulatePlayer, simulateTsumitate } from '../src/core/portfolio';
import { everyMonth, INCOME, marketOf } from './helpers';

const th = config.judge;

describe('勝敗の判定', () => {
  it('T-08 勝敗の境目（円単位）', () => {
    const ts = 1_000_000;
    // 積立と同額（四捨五入して同じ円）→ 引き分け
    expect(judge(1_000_000.4, ts + 0.2, 1, th).outcome).toBe('draw');
    // 1円上 → 勝利、1円下 → 負け
    expect(judge(1_000_001, ts, 1, th).outcome).toBe('win');
    expect(judge(999_999, ts, 1, th).outcome).toBe('lose');
    // +10% ちょうど → 圧勝、その1円下 → 勝利
    expect(judge(1_100_000, ts, 1, th).outcome).toBe('rout');
    expect(judge(1_099_999, ts, 1, th).outcome).toBe('win');
    // +20% ちょうど → 歴史的勝利、その1円下 → 圧勝
    expect(judge(1_200_000, ts, 1, th).outcome).toBe('historic');
    expect(judge(1_199_999, ts, 1, th).outcome).toBe('rout');
    // 積立との差
    expect(judge(1_123_000, ts, 1, th).diff).toBeCloseTo(0.123, 9);
  });

  it('T-09 毎月「買」を押すと、どの相場でも積立と同じ額で引き分け（1〜500）', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const { closes } = marketOf(seed);
      const me = simulatePlayer(closes, everyMonth(closes.length), INCOME);
      const ts = simulateTsumitate(closes, INCOME);
      expect(judge(me.final, ts.final, 1, th).outcome, `seed ${seed}`).toBe('draw');
    }
  });

  it('最小単位が0.01の通貨でも、丸めた値で比べる', () => {
    expect(judge(100.004, 100.001, 0.01, th).outcome).toBe('draw');
    expect(judge(100.006, 100.001, 0.01, th).outcome).toBe('win');
    expect(judge(120.001, 100.001, 0.01, th).outcome).toBe('historic');
  });
});
