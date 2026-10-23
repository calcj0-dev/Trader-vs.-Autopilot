// S3 プレイ（設計書 5.7）。#5 では配置だけ。時間の進行は #6、チャートは #7、売買は #8 で作る

import { formatMoney, getCurrency } from '../../currency';
import { t } from '../../i18n';
import type { ScreenFactory } from '../app';
import { button, h } from '../dom';
import { pauseButton, soundButton } from '../parts';

export const playScreen: ScreenFactory = (app) => {
  const sound = soundButton();
  const buy = button(t('play.buy'), () => {}, 'btn trade-btn trade-buy');
  const sell = button(t('play.sell'), () => {}, 'btn trade-btn trade-sell');
  buy.disabled = true;
  sell.disabled = true;

  const el = h('section', { className: 'screen screen-play' }, [
    h('div', { className: 'play-top' }, [
      h('div', { className: 'top-bar play-bar' }, [
        h('span', { className: 'elapsed', text: t('play.elapsed', { year: 1, month: 1 }) }),
        pauseButton(() => app.openModal('pause')),
        sound.el,
      ]),
      h('div', { className: 'progress' }, [h('div', { className: 'progress-fill' })]),
      h('p', { className: 'asset-label', text: t('play.assetLabel') }),
      h('p', { className: 'asset-value', text: formatMoney(getCurrency().initialCash) }),
      h('p', { className: 'asset-state', text: t('play.cash') }),
    ]),
    h('div', { className: 'chart-area' }, [h('span', { className: 'chart-label', text: t('play.indexName') })]),
    h('div', { className: 'news', attrs: { 'aria-live': 'polite' } }),
    h('div', { className: 'trade-row' }, [buy, sell]),
    // 結果画面への行き来を確かめるための仮のボタン（#6 で外す）
    button(t('play.tempToResult'), () => app.go('result'), 'link temp-link'),
  ]);
  return { el, unmount: sound.dispose };
};
