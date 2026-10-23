// S3 プレイ（設計書 5.7・8章）。カウントダウン → 進行 → 終了の演出 → 結果画面
// ニュース（#9）・効果音と演出（#10）・初回の吹き出し（#11）はまだ入れていない

import { config, marketParams, monthMs } from '../../data';
import { formatMoney, getCurrency } from '../../currency';
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

type Phase = 'countdown' | 'playing' | 'resuming' | 'ending';

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

function formatRate(rate: number): string {
  const sign = rate > 0 ? '+' : rate < 0 ? '−' : '';
  return `${sign}${Math.abs(rate * 100).toFixed(1)}%`;
}

export const playScreen: ScreenFactory = (app: App) => {
  const currency = getCurrency();
  const session = newSession(pickSeed(), marketParams(), currency.initialCash);
  const N = session.closes.length;
  const pre = session.preMonths;
  const stepMs = config.timing.countdownStepMs;

  let phase: Phase = 'countdown';
  let paused = false;
  let phaseElapsed = 0;

  const clock = new MonthClock(monthMs(config), () => {
    closeMonth(session);
    return !isFinished(session);
  });

  // ---- 画面の部品 ----
  const sound = soundButton();
  const elapsed = h('span', { className: 'elapsed' });
  const progressFill = h('div', { className: 'progress-fill' });
  const assetValue = h('p', { className: 'asset-value' });
  const assetState = h('p', { className: 'asset-state' });
  const canvas = h('canvas', { className: 'chart-canvas' });
  const overlay = h('div', { className: 'chart-overlay', attrs: { 'aria-live': 'assertive' } });
  const notice = h('p', { className: 'order-notice', text: t('play.orderedThisMonth') });

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
    h('div', { className: 'chart-area' }, [canvas, h('span', { className: 'chart-label', text: t('play.indexName') }), overlay]),
    h('div', { className: 'news', attrs: { 'aria-live': 'polite' } }),
    notice,
    h('div', { className: 'trade-row' }, [buy, sell]),
  ]);

  const chart = new CandleChart(canvas, {
    up: config.colors.up,
    down: config.colors.down,
    line: config.colors.lump,
    text: '#1a1f2b',
    buyLabel: t('play.buy'),
    sellLabel: t('play.sell'),
  });

  // ---- 操作 ----
  const interactive = () => phase === 'playing' && !paused;

  function onPress(type: TradeType, btn: HTMLElement): void {
    if (!interactive()) return;
    if (placeOrder(session, type)) {
      render();
      return;
    }
    // 押せないボタン：左右に小さく揺れる。音は鳴らさない
    if (reducedMotion()) return;
    btn.classList.remove('shake');
    void btn.offsetWidth;
    btn.classList.add('shake');
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
      if (phase === 'countdown' && phaseElapsed >= stepMs * 4) {
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
        }
      } else if (phase === 'ending' && phaseElapsed >= config.timing.endingMs) {
        setLastPlay({ session, result: sessionResult(session, currency.minorUnit) });
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
    const progress = phase === 'countdown' ? null : isFinished(session) ? 1 : clock.progress;

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
      buyPrice: session.portfolio.buyPrice,
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
    if (p.buyPrice !== null) {
      const rate = price / p.buyPrice - 1;
      assetState.textContent = t('play.stock', { rate: formatRate(rate) });
      assetState.dataset.sign = rate > 0 ? 'up' : rate < 0 ? 'down' : '';
    } else {
      assetState.textContent = t('play.cash');
      assetState.dataset.sign = '';
    }

    // 重ねて出す文字（カウントダウン・再開・終了）
    let text = '';
    if (phase === 'countdown') {
      const step = Math.floor(phaseElapsed / stepMs);
      text = step < 3 ? String(3 - step) : t('play.countdownGo');
    } else if (phase === 'resuming') text = t('play.resuming');
    else if (phase === 'ending') text = t('play.ended', gameVars());
    if (overlay.textContent !== text) overlay.textContent = text;
    overlay.hidden = text === '';

    // ボタン
    const on = interactive();
    for (const [btn, type] of [
      [buy, 'buy'],
      [sell, 'sell'],
    ] as const) {
      const ordering = session.pending === type;
      btn.textContent = ordering ? t('play.ordering') : t(type === 'buy' ? 'play.buy' : 'play.sell');
      btn.classList.toggle('is-ordering', ordering);
      btn.classList.toggle('is-off', !ordering && !(on && canOrder(session, type)));
      btn.setAttribute('aria-disabled', String(!(on && canOrder(session, type))));
    }
    notice.classList.toggle('is-visible', session.pending !== null);
  }

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
