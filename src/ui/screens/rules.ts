// S2 ルール説明（設計書 5.6）

import { t } from '../../i18n';
import { settings } from '../../settings';
import type { ScreenFactory } from '../app';
import { button, h } from '../dom';
import { gameVars } from '../parts';

export const rulesScreen: ScreenFactory = (app) => {
  const v = gameVars();
  const skip = h('input', { attrs: { type: 'checkbox', id: 'rules-skip' } });
  skip.checked = settings.rulesSeen;

  const item = (no: string, lines: HTMLElement[]) =>
    h('li', { className: 'rule' }, [h('span', { className: 'rule-no', text: no }), h('div', {}, lines)]);

  const candle = (cls: string, label: string) =>
    h('span', { className: 'candle-sample' }, [h('span', { className: `candle-box ${cls}` }), h('span', { text: label })]);

  const el = h('section', { className: 'screen screen-rules' }, [
    h('h2', { className: 'heading', text: t('rules.heading') }),
    h('ol', { className: 'rule-list' }, [
      item('①', [h('p', { text: t('rules.line1', v) })]),
      item('②', [h('p', { text: t('rules.line2') }), h('p', { className: 'note', text: t('rules.line2note') })]),
      item('③', [h('p', { text: t('rules.line3', v) }), h('p', { text: t('rules.line3b', v) })]),
    ]),
    h('div', { className: 'candle-legend' }, [candle('up', t('rules.candleUp')), candle('down', t('rules.candleDown'))]),
    h('p', { className: 'note', text: t('rules.note') }),
    button(
      t('rules.start'),
      () => {
        settings.rulesSeen = skip.checked;
        app.go('play');
      },
      'btn btn-primary btn-start',
    ),
    h('label', { className: 'check', attrs: { for: 'rules-skip' } }, [skip, h('span', { text: t('rules.skipNext') })]),
  ]);
  return { el };
};
