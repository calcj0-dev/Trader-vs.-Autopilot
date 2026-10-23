// 重ね表示 M1〜M6（設計書 5.9）。#5 では器と、いま作れる中身（設定・設定値・プライバシー）まで

import { config } from '../data';
import { t } from '../i18n';
import { settings, type ChartMode } from '../settings';
import type { ModalFactory, ModalName } from './app';
import { button, externalLink, h, linkButton } from './dom';
import { gameVars } from './parts';

const panel = (heading: string, body: (HTMLElement | null)[], footer: HTMLElement[]) =>
  h('div', { className: 'modal-panel' }, [
    h('h2', { className: 'heading', text: heading }),
    h('div', { className: 'modal-body' }, body),
    h('div', { className: 'modal-actions' }, footer),
  ]);

/** 2択の切り替え（オン／オフ、ローソク足／折れ線） */
function toggle<V extends string>(
  name: string,
  label: string,
  options: { value: V; text: string }[],
  current: V,
  onChange: (v: V) => void,
): HTMLElement {
  return h('fieldset', { className: 'toggle' }, [
    h('legend', { text: label }),
    ...options.map((o) => {
      const input = h('input', { attrs: { type: 'radio', name, value: o.value } });
      input.checked = o.value === current;
      input.addEventListener('change', () => input.checked && onChange(o.value));
      return h('label', { className: 'toggle-option' }, [input, h('span', { text: o.text })]);
    }),
  ]);
}

const pause: ModalFactory = (app) =>
  panel(
    t('pause.heading'),
    [],
    [
      button(t('pause.resume'), () => app.closeModal(), 'btn btn-primary'),
      linkButton(t('pause.restart'), () => app.go('play')),
      linkButton(t('pause.settings'), () => app.openModal('settings')),
    ],
  );

const settingsModal: ModalFactory = (app) =>
  panel(
    t('settings.heading'),
    [
      toggle(
        'sound',
        t('settings.sound'),
        [
          { value: 'on', text: t('settings.on') },
          { value: 'off', text: t('settings.off') },
        ],
        settings.sound ? 'on' : 'off',
        (v) => {
          settings.sound = v === 'on';
        },
      ),
      toggle<ChartMode>(
        'chart',
        t('settings.chart'),
        [
          { value: 'candle', text: t('settings.candle') },
          { value: 'line', text: t('settings.line') },
        ],
        settings.chart,
        (v) => {
          settings.chart = v;
        },
      ),
    ],
    [button(t('common.close'), () => app.closeModal())],
  );

const params: ModalFactory = (app) => {
  const v = gameVars();
  const lines = [
    t('params.initialCash', v),
    t('params.period', v),
    t('params.trade'),
    t('params.fee'),
    t('params.tsumitate', v),
    t('params.lump', v),
  ];
  return panel(
    t('params.heading'),
    [
      h('ul', { className: 'params-list' }, lines.map((s) => h('li', { text: s }))),
      h('p', { className: 'note', text: t('params.note1') }),
      h('p', { className: 'note', text: t('params.note2') }),
    ],
    [button(t('common.close'), () => app.closeModal())],
  );
};

const image: ModalFactory = (app) =>
  panel(t('image.heading'), [h('p', { className: 'note', text: t('common.preparing') })], [
    button(t('common.close'), () => app.closeModal()),
  ]);

const portrait: ModalFactory = () =>
  h('div', { className: 'modal-panel portrait' }, [h('p', { className: 'portrait-message', text: t('portrait.message') })]);

const privacy: ModalFactory = (app) =>
  panel(
    t('privacy.heading'),
    [
      ...(['privacy.p1', 'privacy.p2', 'privacy.p3', 'privacy.p4', 'privacy.p5'] as const).map((k) => h('p', { text: t(k) })),
      h('p', {}, [externalLink(t('privacy.googlePolicy'), config.links.googlePrivacy)]),
      h('p', {}, [externalLink(t('privacy.optout'), config.links.gaOptout)]),
    ],
    [button(t('common.close'), () => app.closeModal())],
  );

export const modals: Record<ModalName, ModalFactory> = {
  pause,
  settings: settingsModal,
  params,
  image,
  portrait,
  privacy,
};
