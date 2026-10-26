// S3 プレイ（設計書 5.7・8章）。カウントダウン → 進行 → 終了の演出 → 結果画面

import { sfx, vibrate } from '../../audio';
import { config, marketParams, monthMs, newsData, titleData } from '../../data';
import { formatMoney, formatRate, getCurrency } from '../../currency';
import { avgPrice } from '../../core/portfolio';
import { buildNewsSchedule, newsAt, type NewsItem } from '../../core/news';
import type { TradeType } from '../../core/types';
import { setLastPlay } from '../../game/lastResult';
import { MonthClock, Ticker } from '../../game/loop';
import { canOrder, closeMonth, isFinished, newSession, placeOrder, sessionResult } from '../../game/session';
import { t } from '../../i18n';
import { settings } from '../../settings';
import type { App, ModalName, ScreenFactory } from '../app';
import { CandleChart, partialCandle, type ChartMark } from '../chart/candles';
import { h } from '../dom';
import { gameVars, pauseButton, soundButton } from '../parts';

type Phase = 'hint' | 'countdown' | 'playing' | 'resuming' | 'ending';

/** 開発用ビルドだけ ?seed= で相場番号を指定できる（設計書 4.2） */
function pickSeed(): number {
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search).get('seed');
    if (q !== null && /^\d+$/.test(q)) return Number(q) >>> 0;
  }
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

const HISTORY_MARK = 'baka016';

/** ブラウザの「戻る」を受け取るための履歴を1つだけ積む（S3・S4 で共用） */
export function ensureHistoryEntry(): void {
  if ((history.state as Record<string, unknown> | null)?.[HISTORY_MARK] !== true) {
    history.pushState({ [HISTORY_MARK]: true }, '');
  }
}

const isTouch = () => matchMedia('(pointer: coarse)').matches;
const landscapeQuery = () => matchMedia('(orientation: landscape)');
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const playScreen: ScreenFactory = (app: App) => {
  const currency = getCurrency();
  const session = newSession(pickSeed(), marketParams(), currency.monthlyIncome);
  const N = session.closes.length;
  const pre = session.preMonths;
  const stepMs = config.timing.countdownStepMs;

  // 初回だけ、カウントダウンの前に「右端のローソク足が今月です」を2秒出す（設計書 5.7）
  let phase: Phase = settings.hintSeen ? 'countdown' : 'hint';
  let paused = false;
  let phaseElapsed = 0;

  // 速さはプレイの開始時に決める（途中で設定を変えても、次のプレイから）
  const mMs = monthMs(settings.speed);
  const clock = new MonthClock(mMs, () => {
    if (closeMonth(session)) onSettled();
    return !isFinished(session);
  });

  // ニュースの予定表：秒の設定を1か月の長さで月に換算する（Q4）
  const toMonths = (sec: number) => (sec * 1000) / mMs;
  const news = buildNewsSchedule(session.seed, session.market.events, newsData, {
    gameMonths: N,
    intervalMonths: { min: toMonths(config.news.intervalSec.min), max: toMonths(config.news.intervalSec.max) },
    showMonths: toMonths(config.news.showSec),
    eventMinMonths: toMonths(config.news.eventMinSec),
  });

  // ---- 画面の部品 ----
  const sound = soundButton();
  const elapsed = h('span', { className: 'elapsed' });
  const progressFill = h('div', { className: 'progress-fill' });
  const assetValue = h('p', { className: 'asset-value' });
  const assetStock = h('span', { className: 'asset-stock' });
  const assetSep = h('span', { text: t('play.holdingSep') });
  const assetCash = h('span', { className: 'asset-cash' });
  const assetState = h('p', { className: 'asset-state' }, [assetStock, assetSep, assetCash]);
  const canvas = h('canvas', { className: 'chart-canvas' });
  const overlay = h('div', { className: 'chart-overlay', attrs: { 'aria-live': 'assertive' } });
  const notice = h('p', { className: 'order-notice', text: t('play.orderedThisMonth') });
  const hint = h('p', { className: 'hint-bubble', text: t('play.hint') });
  const newsSource = h('span', { className: 'news-source' });
  const newsHeadline = h('span', { className: 'news-headline' });
  const newsBox = h('div', { className: 'news', attrs: { 'aria-live': 'polite' } }, [newsSource, newsHeadline]);

  const tradeButton = (type: TradeType) => {
    const el = h('button', {
      className: `btn trade-btn trade-${type}`,
      attrs: { type: 'button' },
      text: t(type === 'buy' ? 'play.buy' : 'play.sell'),
    });
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onPress(type, el);
    });
    // キーボード操作（Enter・Space）でも押せるようにする
    el.addEventListener('click', (e) => {
      if ((e as PointerEvent).pointerType === '' || e.detail === 0) onPress(type, el);
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    return el;
  };
  const buy = tradeButton('buy');
  const sell = tradeButton('sell');

  const el = h('section', { className: 'screen screen-play' }, [
    h('div', { className: 'play-top' }, [
      h('div', { className: 'top-bar play-bar' }, [elapsed, pauseButton(() => pause('pause')), sound.el]),
      h('div', { className: 'progress' }, [progressFill]),
      h('p', { className: 'asset-label', text: t('play.assetLabel') }),
      assetValue,
      assetState,
    ]),
    h('div', { className: 'chart-area' }, [canvas, h('span', { className: 'chart-label', text: t('play.indexName') }), overlay, hint]),
    newsBox,
    notice,
    h('div', { className: 'trade-row' }, [buy, sell]),
  ]);

  const chart = new CandleChart(canvas, {
    up: config.colors.up,
    down: config.colors.down,
    line: config.colors.principal,
    text: '#1a1f2b',
    buyLabel: t('play.buy'),
    sellLabel: t('play.sell'),
  });

  // ---- 操作 ----
  const interactive = () => phase === 'playing' && !paused;

  function onPress(type: TradeType, btn: HTMLElement): void {
    if (!interactive()) return;
    if (placeOrder(session, type)) {
      sfx.click();
      render();
      return;
    }
    // 押せないボタン：左右に小さく揺れる。音は鳴らさない
    if (reducedMotion()) return;
    btn.classList.remove('shake');
    void btn.offsetWidth;
    btn.classList.add('shake');
  }

  /** 約定：資産額が一瞬光る・ポン・振動 */
  function onSettled(): void {
    sfx.settle();
    vibrate(10);
    assetValue.classList.remove('flash');
    void assetValue.offsetWidth;
    assetValue.classList.add('flash');
  }

  function pause(kind: Extract<ModalName, 'pause' | 'portrait'>): void {
    if (phase === 'ending') return;
    paused = true;
    if (kind === 'portrait') {
      app.closeAllModals();
      app.openModal('portrait');
    } else if (!document.querySelector('dialog[open]')) {
      app.openModal('pause');
    }
  }

  function resume(): void {
    if (!paused) return;
    paused = false;
    if (phase === 'playing') {
      phase = 'resuming';
      phaseElapsed = 0;
    }
  }

  const landscapeLocked = () => isTouch() && landscapeQuery().matches;

  // ---- 1コマごとの処理 ----
  function frame(dt: number): void {
    if (!paused) {
      phaseElapsed += dt;
      if (phase === 'hint' && phaseElapsed >= config.timing.hintMs) {
        settings.hintSeen = true;
        phase = 'countdown';
        phaseElapsed = 0;
      } else if (phase === 'countdown' && phaseElapsed >= stepMs * 4) {
        phase = 'playing';
        phaseElapsed = 0;
      } else if (phase === 'resuming' && phaseElapsed >= config.timing.resumeMs) {
        phase = 'playing';
        phaseElapsed = 0;
      } else if (phase === 'playing') {
        clock.advance(dt);
        if (isFinished(session)) {
          phase = 'ending';
          phaseElapsed = 0;
          sfx.ending();
        }
      } else if (phase === 'ending' && phaseElapsed >= config.timing.endingMs) {
        // 結果画面へは1回だけ移る
        ticker.stop();
        setLastPlay({ session, result: sessionResult(session, currency.minorUnit, titleData, config.judge) });
        app.go('result');
        return;
      }
    }
    render();
  }

  let lastAssetText = '';
  function render(): void {
    const m = Math.min(session.month, N - 1);
    const current = pre + m;
    const progress = phase === 'countdown' || phase === 'hint' ? null : isFinished(session) ? 1 : clock.progress;

    // チャート
    const marks: ChartMark[] = session.trades.map((tr) => ({ index: pre + tr.month, type: tr.type }));
    if (session.pending) marks.push({ index: current, type: session.pending });
    const visible = window.innerWidth < config.narrowWidthPx ? config.visibleCandlesNarrow : config.visibleCandles;
    chart.draw({
      candles: session.market.candles,
      preMonths: pre,
      current,
      progress,
      mode: settings.chart,
      marks,
      buyPrice: avgPrice(session.portfolio),
      visible,
    });

    // 経過と進み具合
    elapsed.textContent = t('play.elapsed', { year: Math.floor(m / 12) + 1, month: (m % 12) + 1 });
    progressFill.style.width = `${(Math.min(session.month + (progress ?? 0), N) / N) * 100}%`;

    // 資産：株を持っていれば表示中の値段で動かす（月末に終値と一致する）
    const price = progress === null ? session.closes[0]! : partialCandle(session.market.candles[current]!, progress).price;
    const p = session.portfolio;
    const value = p.cash + p.shares * price;
    const assetText = formatMoney(value);
    if (assetText !== lastAssetText) {
      assetValue.textContent = assetText;
      lastAssetText = assetText;
    }
    // 持っているものを両方出す：「株 ◯万円（+◯%）／現金 ◯万円」。増減率は平均の買値と比べる
    const avg = avgPrice(p);
    const stockText = avg === null ? '' : t('play.stock', { amount: formatMoney(p.shares * price), rate: formatRate(price / avg - 1) });
    const cashText = p.cash > 0 || avg === null ? t('play.cash', { amount: formatMoney(p.cash) }) : '';
    if (assetStock.textContent !== stockText) assetStock.textContent = stockText;
    if (assetCash.textContent !== cashText) assetCash.textContent = cashText;
    assetSep.hidden = stockText === '' || cashText === '';
    assetStock.dataset.sign = avg === null ? '' : price > avg ? 'up' : price < avg ? 'down' : '';

    // 重ねて出す文字（カウントダウン・再開・終了）
    let text = '';
    if (phase === 'countdown') {
      const step = Math.floor(phaseElapsed / stepMs);
      text = step < 3 ? String(3 - step) : t('play.countdownGo');
    } else if (phase === 'resuming') text = t('play.resuming');
    else if (phase === 'ending') text = t('play.ended', gameVars());
    if (overlay.textContent !== text) overlay.textContent = text;
    overlay.hidden = text === '';
    hint.hidden = phase !== 'hint';

    // ボタン
    const on = interactive();
    for (const [btn, type] of [
      [buy, 'buy'],
      [sell, 'sell'],
    ] as const) {
      const ordering = session.pending === type;
      // 株を持っていて買い足せるときは「買増」
      const label = type === 'sell' ? 'play.sell' : session.portfolio.shares > 0 ? 'play.buyMore' : 'play.buy';
      btn.textContent = ordering ? t('play.ordering') : t(label);
      btn.classList.toggle('is-ordering', ordering);
      btn.classList.toggle('is-off', !ordering && !(on && canOrder(session, type)));
      btn.setAttribute('aria-disabled', String(!(on && canOrder(session, type))));
    }
    notice.classList.toggle('is-visible', session.pending !== null);

    // ニュース（チャートの下に1本。切り替えはフェード）
    const item = progress === null ? null : newsAt(news, session.month + progress);
    if (item !== shownNews) {
      shownNews = item;
      if (item) {
        const base = item.kind === 'random' ? (`news.random.${item.id}` as const) : (`news.event.${item.id}` as const);
        newsSource.textContent = t(`${base}.source` as Parameters<typeof t>[0]);
        newsHeadline.textContent = t(`${base}.headline` as Parameters<typeof t>[0]);
      }
      newsBox.classList.toggle('is-visible', item !== null);
    }
  }
  let shownNews: NewsItem | null = null;

  // ---- 一時停止になる場面（自動では再開しない） ----
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') pause('pause');
  };
  const onPageHide = () => pause('pause');
  const onPopState = () => {
    pause('pause');
    ensureHistoryEntry();
  };
  const lq = landscapeQuery();
  const onOrientation = () => {
    if (!isTouch()) return;
    if (lq.matches) pause('portrait');
    else if (paused) {
      // 縦に戻したら M5 を消して M1（一時停止）を出す
      app.closeAllModals();
      app.openModal('pause');
    }
  };
  const offModalClosed = app.onModalClosed((last) => {
    if (landscapeLocked()) {
      app.openModal('portrait');
      return;
    }
    if (last === 'portrait') app.openModal('pause');
    else resume();
  });

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('popstate', onPopState);
  lq.addEventListener('change', onOrientation);
  ensureHistoryEntry();

  const ticker = new Ticker(frame);
  render();
  ticker.start();
  if (landscapeLocked()) pause('portrait');

  return {
    el,
    unmount() {
      ticker.stop();
      chart.dispose();
      sound.dispose();
      offModalClosed();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('popstate', onPopState);
      lq.removeEventListener('change', onOrientation);
    },
  };
};
