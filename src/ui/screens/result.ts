// S4 結果（設計書 5.8）。勝敗・積立との差・称号・3本線・3つの金額・種明かし・注意書き・もう一回
// シェア・結果画像・TAMERU・フォロー（設計書 5.8.2・7.12）

import { markRetry, sellsBucket, track } from '../../analytics';
import { sfx } from '../../audio';
import { config, marketParams, titleData } from '../../data';
import { formatMoney, formatRate, getCurrency } from '../../currency';
import type { Outcome } from '../../core/types';
import { getLastPlay, setLastPlay, type LastPlay } from '../../game/lastResult';
import { closeMonth, isFinished, newSession, placeOrder, sessionResult } from '../../game/session';
import { t } from '../../i18n';
import type { ScreenFactory } from '../app';
import { compareData, compareStyle, drawCompare } from '../chart/compare';
import { button, externalLink, h, linkButton } from '../dom';
import { postText } from '../../share/postText';
import { resultImage } from '../../share/resultImage';
import { canShareImage, openXIntent, shareWithImage } from '../../share/share';
import { gameVars, soundButton } from '../parts';
import { ensureHistoryEntry } from './play';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 開発用：結果画面を直接開いたときは、計算例1（相場番号7・毎月買い、60で売り、84から再び毎月買う）の結果を出す */
function demoPlay(): LastPlay {
  const c = getCurrency();
  const s = newSession(7, marketParams(), c.monthlyIncome);
  while (!isFinished(s)) {
    if (s.month === 60) placeOrder(s, 'sell');
    else if (s.month < 60 || s.month >= 84) placeOrder(s, 'buy');
    closeMonth(s);
  }
  // 開発用の結果は計測しない
  return { session: s, result: sessionResult(s, c.minorUnit, titleData, config.judge), speed: config.defaultYearSeconds, reported: true };
}

const OUTCOME_SOUND: Record<Outcome, () => void> = {
  historic: sfx.bigWin,
  rout: sfx.bigWin,
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
  const o = result.judgement.outcome;
  if (!play.reported) {
    play.reported = true;
    track('finish', { scenario: result.scenario, outcome: o, sells: sellsBucket(result.sells), speed: play.speed });
  }

  const sound = soundButton();
  const thumb = h('img', { className: 'image-thumb-img', attrs: { alt: '' } });
  const canvas = h('canvas', { className: 'compare-canvas' });
  const effects = h('div', { className: 'result-effects', attrs: { 'aria-hidden': 'true' } });

  const row = (label: string, amount: number, cls: string) =>
    h('div', { className: `final-row ${cls}` }, [
      h('span', { className: 'final-label', text: label }),
      h('span', { className: 'final-amount', text: formatMoney(amount) }),
    ]);

  const outcomeEl = h('p', { className: `outcome outcome-${o} reveal`, text: t(`result.outcome.${o}`) });
  const diffEl = h('p', { className: 'outcome-diff reveal', text: t('result.diff', { diff: formatRate(result.judgement.diff) }) });
  const honorEl = h('p', { className: 'honor reveal', text: t('result.honor', { title: t(`honor.${result.title}`) }) });
  const finalsEl = h('div', { className: 'finals reveal' }, [
    row(t('result.you'), result.final, 'you'),
    row(t('result.tsumitate'), result.tsumitate.final, 'tsumitate'),
    row(t('result.principal'), result.principal[result.principal.length - 1] ?? 0, 'principal'),
  ]);
  const actionsEl = h('div', { className: 'main-actions reveal' }, [
    button(t('result.share'), () => onShare(), 'btn btn-secondary'),
    button(
      t('result.retry'),
      () => {
        track('retry', {});
        markRetry();
        app.go('play');
      },
      'btn btn-primary',
    ),
  ]);

  const el = h('section', { className: 'screen screen-result' }, [
    h('div', { className: 'top-bar result-bar' }, [h('h2', { className: 'heading', text: t('result.heading', gameVars()) }), sound.el]),
    h('div', { className: 'result-head' }, [outcomeEl, diffEl, honorEl, effects]),
    h('div', { className: 'compare-box' }, [canvas]),
    finalsEl,
    actionsEl,
    h('div', { className: 'result-detail' }, [
      h('p', { text: t('result.summary', { sells: result.sells, reveal: t(`scenario.${result.scenario}.reveal`) }) }),
      h('p', { className: 'note', text: t('result.caution') }),
    ]),
    h('button', { className: 'image-thumb', attrs: { type: 'button', 'aria-label': t('result.imagePreview') }, on: { click: () => app.openModal('image') } }, [
      h('span', { className: 'image-thumb-label', text: t('result.imagePreview') }),
      thumb,
    ]),
    h('div', { className: 'tameru-box' }, [
      h('p', { className: 'tameru-heading', text: t('result.tameruHeading') }),
      h('p', { className: 'tameru-body', text: t('result.tameruBody') }),
      h('a', {
        className: 'btn btn-primary tameru-btn',
        text: t('result.tameruButton'),
        attrs: { href: config.links.tameru, target: '_blank', rel: 'noopener' },
        on: { click: () => track('main_app_click', { target: 'tameru' }) },
      }),
    ]),
    (() => {
      const a = externalLink(t('result.follow'), config.links.follow);
      a.addEventListener('click', () => track('main_app_click', { target: 'follow' }));
      return a;
    })(),
    h('nav', { className: 'link-row' }, [
      linkButton(t('result.params'), () => app.openModal('params')),
      linkButton(t('result.settings'), () => app.openModal('settings')),
      linkButton(t('result.privacy'), () => app.openModal('privacy')),
    ]),
  ]);

  // ---- 結果画像とシェア（画像は先に作っておき、押したときにすぐ共有できるようにする） ----
  let imageBlob: Blob | null = null;
  let thumbUrl = '';
  void resultImage(play).then((b) => {
    imageBlob = b;
    if (b) {
      thumbUrl = URL.createObjectURL(b);
      thumb.src = thumbUrl;
    }
  });
  const text = postText(result);
  function onShare(): void {
    if (imageBlob && canShareImage(imageBlob)) {
      track('share_click', { method: 'web_share' });
      void shareWithImage(text, imageBlob);
    } else {
      track('share_click', { method: 'x_intent' });
      openXIntent(text);
    }
  }

  // ---- 出し方（設計書 5.8.1）：3本線を1.2秒で描く → 勝敗と音 → 残りを0.2秒ずつ ----
  const data = compareData(play);
  const reveals: HTMLElement[] = [outcomeEl, diffEl, honorEl, finalsEl, actionsEl];
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
    if (o === 'historic' || o === 'rout') {
      // 歴史的勝利は紙吹雪を多めに
      const colors = [config.colors.up, config.colors.down, config.colors.gold, config.colors.tsumitate];
      for (let i = 0; i < (o === 'historic' ? 72 : 36); i++) {
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
      if (thumbUrl) URL.revokeObjectURL(thumbUrl);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('resize', onResize);
    },
  };
};
