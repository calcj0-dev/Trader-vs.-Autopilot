// S1 タイトル（設計書 5.5）

import { track } from '../../analytics';
import { config } from '../../data';
import { t } from '../../i18n';
import { settings } from '../../settings';
import type { ScreenFactory } from '../app';
import { button, externalLink, h, linkButton } from '../dom';
import { gameVars, soundButton, versionLabel } from '../parts';

export const titleScreen: ScreenFactory = (app) => {
  const sound = soundButton();
  const el = h('section', { className: 'screen screen-title' }, [
    h('div', { className: 'top-bar' }, [versionLabel(), sound.el]),
    h('div', { className: 'title-deco', attrs: { 'aria-hidden': 'true' } }),
    h('h1', { className: 'title', text: t('title.main') }),
    h('p', { className: 'subtitle', text: t('title.sub', gameVars()) }),
    h('p', { className: 'lead', text: t('title.lead', gameVars()) }),
    button(t('title.start'), () => app.go(settings.rulesSeen ? 'play' : 'rules'), 'btn btn-primary btn-start'),
    h('nav', { className: 'link-row' }, [
      linkButton(t('title.rules'), () => app.go('rules')),
      linkButton(t('title.params'), () => app.openModal('params')),
      linkButton(t('title.settings'), () => app.openModal('settings')),
    ]),
    // 開発者の X のプロフィールへ（新しいタブ。結果画面のフォローと同じ）
    h('p', { className: 'credit' }, [
      (() => {
        const a = externalLink(t('title.credit'), config.links.follow);
        a.addEventListener('click', () => track('main_app_click', { target: 'follow' }));
        return a;
      })(),
    ]),
    linkButton(t('title.privacy'), () => app.openModal('privacy')),
  ]);
  return { el, unmount: sound.dispose };
};
