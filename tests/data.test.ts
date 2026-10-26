// T-20 データの JSON（型はビルド時に satisfies で確認。ここでは値の範囲を確認する）
import { describe, expect, it } from 'vitest';
import { config, monthMs, scenarioData } from '../src/data';
import { SCENARIO_ORDER } from '../src/core/market';
import type { Range } from '../src/core/types';

function ranges(obj: unknown, path = ''): [string, Range][] {
  if (!obj || typeof obj !== 'object') return [];
  const o = obj as Record<string, unknown>;
  if (typeof o.min === 'number' && typeof o.max === 'number') return [[path, o as Range]];
  return Object.entries(o).flatMap(([k, v]) => ranges(v, path ? `${path}.${k}` : k));
}

describe('T-20 データの JSON', () => {
  it('config.json：最初の速さは1年4秒（1か月1/3秒）。選択肢は4・5・6・8秒', () => {
    expect(config.defaultYearSeconds).toBe(4);
    expect(monthMs(config.defaultYearSeconds)).toBeCloseTo(1000 / 3, 10);
    expect(config.yearSecondsOptions).toEqual([4, 5, 6, 8]);
    expect(config.judge).toEqual({ rout: 0.1, historic: 0.2 });
  });

  it('scenarios.json：すべてのシナリオがあり、割合は正の数', () => {
    for (const k of SCENARIO_ORDER) expect(scenarioData.scenarios[k].weight).toBeGreaterThan(0);
    expect(Object.keys(scenarioData.scenarios).sort()).toEqual([...SCENARIO_ORDER].sort());
  });

  it('範囲（min・max）はすべて min ≦ max の整数または数', () => {
    const all = [...ranges(config, 'config'), ...ranges(scenarioData, 'scenarios')];
    expect(all.length).toBeGreaterThan(5);
    for (const [path, r] of all) expect(r.min, path).toBeLessThanOrEqual(r.max);
  });
});
