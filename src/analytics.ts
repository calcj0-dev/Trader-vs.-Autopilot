// 計測（設計書 9章）。ページの表示は Vercel Analytics、イベントは GA4。
// 失敗しても例外を出さない（広告ブロックなどで読み込めなくても遊べるように）。
// 送らないもの：個人を特定できる情報、相場番号、売買の内容

import { inject } from '@vercel/analytics';
import { getCurrency } from './currency';
import { getLocale } from './i18n';

export type AnalyticsEvent =
  | { name: 'start'; props: { retry: boolean; chart: 'candle' | 'line'; speed: number } }
  | { name: 'finish'; props: { scenario: string; outcome: string; sells: SellsBucket; speed: number } }
  | { name: 'share_click'; props: { method: 'x_intent' | 'web_share' | 'save_image' } }
  | { name: 'main_app_click'; props: { target: 'tameru' | 'follow' } }
  | { name: 'retry'; props: Record<string, never> };

type Gtag = (...args: unknown[]) => void;
type GtagWindow = { dataLayer?: unknown[]; gtag?: Gtag };

/** GA4 の測定ID（環境変数 VITE_GA_ID）。空なら GA4 は読み込まない */
export function gaId(): string {
  return ((import.meta.env.VITE_GA_ID as string | undefined) ?? '').trim();
}

/** 起動時に1回呼ぶ */
export function initAnalytics(): void {
  try {
    // Vercel Analytics（ページの表示）。公開版だけ
    if (import.meta.env.PROD) inject({ mode: 'production', framework: 'vanilla' });
  } catch {
    // 読み込めなくても遊べる
  }
  const id = gaId();
  if (!id) return;
  try {
    const w = window as unknown as GtagWindow;
    w.dataLayer = w.dataLayer ?? [];
    w.gtag = function gtag() {
      // gtag.js は arguments をそのまま受け取る決まり
      w.dataLayer!.push(arguments);
    };
    w.gtag('js', new Date());
    w.gtag('config', id);
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.append(s);
  } catch {
    // 読み込めなくても遊べる
  }
}

/** イベントを送る。全イベントに lang・currency を付ける */
export function track<N extends AnalyticsEvent['name']>(name: N, props: Extract<AnalyticsEvent, { name: N }>['props']): void {
  try {
    const gtag = (window as unknown as GtagWindow).gtag;
    if (typeof gtag !== 'function') return;
    gtag('event', name, { ...props, lang: getLocale(), currency: getCurrency().code });
  } catch {
    // 計測の失敗で遊びを止めない
  }
}

export type SellsBucket = '0' | '1-2' | '3-9' | '10+';

/** 売った回数の区分（称号の区切り 9回／10回に合わせる） */
export function sellsBucket(n: number): SellsBucket {
  if (n <= 0) return '0';
  if (n <= 2) return '1-2';
  if (n <= 9) return '3-9';
  return '10+';
}

let nextIsRetry = false;

/** 「もう一回」・一時停止の「最初から」で次のプレイを始めるときに呼ぶ（start の retry を true にする。Q8） */
export function markRetry(): void {
  nextIsRetry = true;
}

/** start を送るときに1回だけ読む */
export function takeRetry(): boolean {
  const v = nextIsRetry;
  nextIsRetry = false;
  return v;
}
