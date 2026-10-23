// JSON のデータを読み込み、型を付けて渡す窓口（設計書 6.6）。
// satisfies により、項目の不足・型の違いはビルド時にエラーになる（T-20）

import type { TitleData } from './core/judge';
import type { NewsData } from './core/news';
import type { MarketParams, Range, ScenarioData } from './core/types';
import type { CurrencyConfig } from './currency/types';
import type { Locale, Messages } from './i18n/types';
import configJson from './data/config.json';
import jpyJson from './data/currency/jpy.json';
import jaJson from './data/i18n/ja.json';
import newsJson from './data/news.json';
import scenariosJson from './data/scenarios.json';
import titlesJson from './data/titles.json';

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
  links: { tameru: string; follow: string; xIntent: string; googlePrivacy: string; gaOptout: string };
};

export const config = configJson satisfies GameConfig;
export const scenarioData = scenariosJson satisfies ScenarioData;
export const newsData = newsJson satisfies NewsData;
export const titleData = titlesJson satisfies TitleData;

/** 言語ごとの文言。言語を足すときは JSON を作ってここに1行足す */
export const messagesByLocale = { ja: jaJson } satisfies Record<Locale, Messages>;

/** 通貨ごとの設定。通貨を足すときは JSON を作ってここに1行足す */
export const currencies = { JPY: jpyJson } satisfies Record<string, CurrencyConfig>;

/** 1か月の長さ（ミリ秒）＝全体の秒数×1000÷期間の月数 */
export function monthMs(c: Pick<GameConfig, 'gameSeconds' | 'gameMonths'>): number {
  return (c.gameSeconds * 1000) / c.gameMonths;
}

export function marketParams(c: Pick<GameConfig, 'gameMonths' | 'preMonths'> = config): MarketParams {
  return { gameMonths: c.gameMonths, preMonths: c.preMonths, data: scenarioData };
}
