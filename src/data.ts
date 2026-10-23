// JSON のデータを読み込み、型を付けて渡す窓口（設計書 6.6）。
// satisfies により、項目の不足・型の違いはビルド時にエラーになる（T-20）

import type { MarketParams, Range, ScenarioData } from './core/types';
import configJson from './data/config.json';
import scenariosJson from './data/scenarios.json';

export type GameConfig = {
  gameMonths: number;
  gameSeconds: number;
  preMonths: number;
  visibleCandles: number;
  visibleCandlesNarrow: number;
  narrowWidthPx: number;
  timing: { countdownStepMs: number; hintMs: number; resumeMs: number; endingMs: number; resultLineMs: number };
  news: { intervalSec: Range; showSec: number };
  colors: { up: string; down: string; gold: string; tsumitate: string; lump: string };
  links: { tameru: string; follow: string; xIntent: string };
};

export const config = configJson satisfies GameConfig;
export const scenarioData = scenariosJson satisfies ScenarioData;

/** 1か月の長さ（ミリ秒）＝全体の秒数×1000÷期間の月数 */
export function monthMs(c: Pick<GameConfig, 'gameSeconds' | 'gameMonths'>): number {
  return (c.gameSeconds * 1000) / c.gameMonths;
}

export function marketParams(c: Pick<GameConfig, 'gameMonths' | 'preMonths'> = config): MarketParams {
  return { gameMonths: c.gameMonths, preMonths: c.preMonths, data: scenarioData };
}
