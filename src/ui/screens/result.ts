// S4 結果（設計書 5.8）。#5 では配置だけ。中身は #12 で作る

import { t } from '../../i18n';
import type { ScreenFactory } from '../app';
import { button, h, linkButton } from '../dom';
import { gameVars, soundButton } from '../parts';
import { ensureHistoryEntry } from './play';

export const resultScreen: ScreenFactory = (app) => {
  const sound = soundButton();
  const el = h('section', { className: 'screen screen-result' }, [
    h('div', { className: 'top-bar result-bar' }, [h('h2', { className: 'heading', text: t('result.heading', gameVars()) }), sound.el]),
    h('div', { className: 'result-placeholder', text: t('common.preparing') }),
    h('div', { className: 'main-actions' }, [
      button(t('result.share'), () => {}, 'btn btn-secondary'),
      button(t('result.retry'), () => app.go('play'), 'btn btn-primary'),
    ]),
    h('p', { className: 'note', text: t('result.caution') }),
    h('nav', { className: 'link-row' }, [
      linkButton(t('result.params'), () => app.openModal('params')),
      linkButton(t('result.settings'), () => app.openModal('settings')),
      linkButton(t('result.privacy'), () => app.openModal('privacy')),
    ]),
    linkButton(t('result.backToTitle'), () => app.go('title')),
  ]);
  // ブラウザの「戻る」でタイトルへ（設計書 5.3）
  const onPopState = () => app.go('title');
  ensureHistoryEntry();
  window.addEventListener('popstate', onPopState);
  return {
    el,
    unmount() {
      sound.dispose();
      window.removeEventListener('popstate', onPopState);
    },
  };
};
