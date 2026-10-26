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
  /** 選べる速さ（1年の秒数）と最初の設定（設計書 3.2・Q15-4） */
  yearSecondsOptions: number[];
  defaultYearSeconds: number;
  /** 勝敗の区切り（積立を何割上回れば圧勝・歴史的勝利か） */
  judge: { rout: number; historic: number };
  preMonths: number;
  visibleCandles: number;
  visibleCandlesNarrow: number;
  narrowWidthPx: number;
  timing: { countdownStepMs: number; hintMs: number; resumeMs: number; endingMs: number; resultLineMs: number };
  /** eventMinSec：出来事のニュースを最低この秒数は出す（次の出来事のニュースはそのあと。Q14） */
  news: { intervalSec: Range; showSec: number; eventMinSec: number };
  colors: { up: string; down: string; gold: string; tsumitate: string; principal: string };
  links: { tameru: string; follow: string; xIntent: string; googlePrivacy: string; gaOptout: string; vercelPrivacy: string };
};

export const config = configJson satisfies GameConfig;
export const scenarioData = scenariosJson satisfies ScenarioData;
export const newsData = newsJson satisfies NewsData;
export const titleData = titlesJson satisfies TitleData;

/** 言語ごとの文言。言語を足すときは JSON を作ってここに1行足す */
export const messagesByLocale = { ja: jaJson } satisfies Record<Locale, Messages>;

/** 通貨ごとの設定。通貨を足すときは JSON を作ってここに1行足す */
export const currencies = { JPY: jpyJson } satisfies Record<string, CurrencyConfig>;

/** 1か月の長さ（ミリ秒）＝1年の秒数×1000÷12 */
export function monthMs(yearSeconds: number): number {
  return (yearSeconds * 1000) / 12;
}

export function marketParams(c: Pick<GameConfig, 'gameMonths' | 'preMonths'> = config): MarketParams {
  return { gameMonths: c.gameMonths, preMonths: c.preMonths, data: scenarioData };
}

/** 作品のURL（環境変数 VITE_SITE_URL。設計書 6.3）。未設定なら今のページのURL */
export function siteUrl(): string {
  const v = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim();
  if (v) return v;
  return typeof location === 'undefined' ? '' : location.origin + location.pathname;
}

/** シェアするURL。作品のURLだけ（相場番号も計測用の文字も付けない。投稿画面で短く見えるように） */
export function shareUrl(): string {
  return siteUrl();
}
