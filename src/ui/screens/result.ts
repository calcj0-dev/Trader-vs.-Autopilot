// S4 結果（設計書 5.8）。勝敗・称号・3本線・3者の金額・種明かし・注意書き・もう一回
// シェア・結果画像・TAMERU・フォロー（#13・#14）は M7 で入れる

import { sfx } from '../../audio';
import { config, marketParams, titleData } from '../../data';
import { formatMoney, getCurrency } from '../../currency';
import type { Outcome } from '../../core/types';
import { getLastPlay, setLastPlay, type LastPlay } from '../../game/lastResult';
import { closeMonth, isFinished, newSession, placeOrder, sessionResult } from '../../game/session';
import { t } from '../../i18n';
import type { ScreenFactory } from '../app';
import { drawCompare, type CompareData } from '../chart/compare';
import { button, h, linkButton } from '../dom';
import { gameVars, soundButton } from '../parts';
import { ensureHistoryEntry } from './play';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 開発用：結果画面を直接開いたときは、計算例（相場番号7・0買／60売／84買）の結果を出す */
function demoPlay(): LastPlay {
  const c = getCurrency();
  const s = newSession(7, marketParams(), c.initialCash);
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
  return { session: s, result: sessionResult(s, c.minorUnit, titleData) };
}

export const compareStyle = {
  you: config.colors.up,
  tsumitate: config.colors.tsumitate,
  lump: config.colors.lump,
  up: config.colors.up,
  down: config.colors.down,
  grid: '#e3e7ed',
};

export function compareData(p: LastPlay): CompareData {
  const { session, result } = p;
  return {
    you: result.history,
    tsumitate: result.tsumitate.history,
    lump: result.lump.history,
    trades: result.trades,
    candles: session.market.candles.slice(session.preMonths),
  };
}

const OUTCOME_SOUND: Record<Outcome, () => void> = {
  big_win: sfx.bigWin,
  win: sfx.win,
  draw: sfx.draw,
  lose: sfx.lose,
};

export const resultScreen: ScreenFactory = (app) => {
  let play = getLastPlay();
  if (!play && import.meta.env.DEV) {
    play = demoPlay();
    setLastPlay(play);
  }
  if (!play) {
    // 結果がない（再読み込みなど）ときはタイトルへ
    queueMicrotask(() => app.go('title'));
    return { el: h('section', { className: 'screen' }) };
  }
  const { result } = play;
  const c = getCurrency();
  const round = (x: number) => Math.round(x / c.minorUnit);
  const o = result.judgement.outcome;

  const sound = soundButton();
  const canvas = h('canvas', { className: 'compare-canvas' });
  const effects = h('div', { className: 'result-effects', attrs: { 'aria-hidden': 'true' } });

  const row = (label: string, amount: number, beaten: boolean, cls: string) =>
    h('div', { className: `final-row ${cls}` }, [
      h('span', { className: 'final-label', text: label }),
      h('span', { className: 'final-amount', text: formatMoney(amount) }),
      h('span', { className: 'final-check', text: beaten ? '✓' : '', attrs: beaten ? { 'aria-label': t('result.beaten') } : {} }),
    ]);

  const outcomeEl = h('p', { className: `outcome outcome-${o} reveal`, text: t(`result.outcome.${o}`) });
  const lumpEl = result.judgement.isLumpHolder ? h('p', { className: 'lump-holder reveal', text: t('result.lumpHolder') }) : null;
  const honorEl = h('p', { className: 'honor reveal', text: t('result.honor', { title: t(`honor.${result.title}`) }) });
  const finalsEl = h('div', { className: 'finals reveal' }, [
    row(t('result.you'), result.final, false, 'you'),
    row(t('result.tsumitate'), result.tsumitate.final, round(result.final) > round(result.tsumitate.final), 'tsumitate'),
    row(t('result.lump'), result.lump.final, round(result.final) > round(result.lump.final), 'lump'),
  ]);
  const actionsEl = h('div', { className: 'main-actions reveal' }, [
    button(t('result.share'), () => {}, 'btn btn-secondary'),
    button(t('result.retry'), () => app.go('play'), 'btn btn-primary'),
  ]);

  const el = h('section', { className: 'screen screen-result' }, [
    h('div', { className: 'top-bar result-bar' }, [h('h2', { className: 'heading', text: t('result.heading', gameVars()) }), sound.el]),
    h('div', { className: 'result-head' }, [outcomeEl, lumpEl, honorEl, effects]),
    h('div', { className: 'compare-box' }, [canvas]),
    finalsEl,
    actionsEl,
    h('div', { className: 'result-detail' }, [
      h('p', { text: t('result.summary', { trades: result.trades.length, reveal: t(`scenario.${result.scenario}.reveal`) }) }),
      h('p', { className: 'note', text: t('result.caution') }),
    ]),
    h('nav', { className: 'link-row' }, [
      linkButton(t('result.params'), () => app.openModal('params')),
      linkButton(t('result.settings'), () => app.openModal('settings')),
      linkButton(t('result.privacy'), () => app.openModal('privacy')),
    ]),
  ]);

  // ---- 出し方（設計書 5.8.1）：3本線を1.2秒で描く → 勝敗と音 → 残りを0.2秒ずつ ----
  const data = compareData(play);
  const reveals: HTMLElement[] = [outcomeEl, lumpEl, honorEl, finalsEl, actionsEl].filter((x) => x !== null);
  const timers: number[] = [];
  let raf = 0;
  let done = false;

  const showAll = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    drawCompare(canvas, data, compareStyle, 1);
    reveals.forEach((r) => r.classList.add('is-shown'));
  };

  const celebrate = () => {
    OUTCOME_SOUND[o]();
    if (reducedMotion()) return;
    if (o === 'big_win') {
      const colors = [config.colors.up, config.colors.down, config.colors.gold, config.colors.tsumitate];
      for (let i = 0; i < 36; i++) {
        const piece = h('span', { className: 'confetti' });
        piece.style.left = `${Math.random() * 100}%`;
        piece.style.background = colors[i % colors.length]!;
        piece.style.animationDelay = `${Math.random() * 0.4}s`;
        piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 80}px`);
        effects.append(piece);
      }
    } else if (o === 'win') {
      for (let i = 0; i < 6; i++) {
        const star = h('span', { className: 'star' });
        star.style.setProperty('--angle', `${i * 60}deg`);
        effects.append(star);
      }
    }
  };

  const start = () => {
    if (reducedMotion()) {
      showAll();
      OUTCOME_SOUND[o]();
      return;
    }
    const t0 = performance.now();
    const dur = config.timing.resultLineMs;
    const step = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      drawCompare(canvas, data, compareStyle, p);
      if (p < 1) {
        raf = requestAnimationFrame(step);
        return;
      }
      celebrate();
      reveals.forEach((r, i) => timers.push(window.setTimeout(() => r.classList.add('is-shown'), i * 200)));
      timers.push(window.setTimeout(() => (done = true), reveals.length * 200));
    };
    raf = requestAnimationFrame(step);
  };

  // 演出中に画面をタップすると最後まで飛ばす
  el.addEventListener('pointerdown', showAll);
  const onResize = () => done && drawCompare(canvas, data, compareStyle, 1);
  window.addEventListener('resize', onResize);
  requestAnimationFrame(start);

  // ブラウザの「戻る」でタイトルへ（設計書 5.3）
  const onPopState = () => app.go('title');
  ensureHistoryEntry();
  window.addEventListener('popstate', onPopState);

  return {
    el,
    unmount() {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      sound.dispose();
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('resize', onResize);
    },
  };
};
