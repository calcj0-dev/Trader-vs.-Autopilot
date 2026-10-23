import { describe, expect, it } from 'vitest';
import { judge } from '../src/core/judge';
import type { Trade } from '../src/core/types';

const buy = (month: number): Trade => ({ month, type: 'buy', price: 100 });
const sell = (month: number): Trade => ({ month, type: 'sell', price: 100 });

describe('勝敗の判定', () => {
  it('T-08 勝敗の境目（円単位）', () => {
    const t = [buy(3), sell(10)];
    // 積立と同額（四捨五入して同じ円）→ 引き分け
    expect(judge(1_500_000.4, 1_500_000.2, 1_400_000, t, 1).outcome).toBe('draw');
    // 一括放置と同額で積立より上 → 勝利
    expect(judge(1_600_000, 1_500_000, 1_600_000.3, t, 1).outcome).toBe('win');
    // 両方を上回る → 大勝利
    expect(judge(1_600_001, 1_500_000, 1_600_000, t, 1).outcome).toBe('big_win');
    // 積立より1円でも下 → 負け
    expect(judge(1_499_999, 1_500_000, 900_000, t, 1).outcome).toBe('lose');
  });

  it('T-09 一括投資派の条件', () => {
    expect(judge(1, 1, 1, [buy(0)], 1).isLumpHolder).toBe(true);
    expect(judge(1, 1, 1, [buy(57)], 1).isLumpHolder).toBe(true);
    expect(judge(1, 1, 1, [buy(0), sell(10)], 1).isLumpHolder).toBe(false);
    expect(judge(1, 1, 1, [], 1).isLumpHolder).toBe(false);
    expect(judge(1, 1, 1, [buy(0)], 1).countsForWinRate).toBe(false);
  });

  it('最小単位が0.01の通貨でも、丸めた値で比べる', () => {
    expect(judge(100.004, 100.001, 50, [], 0.01).outcome).toBe('draw');
    expect(judge(100.006, 100.001, 50, [], 0.01).outcome).toBe('big_win');
  });
});
