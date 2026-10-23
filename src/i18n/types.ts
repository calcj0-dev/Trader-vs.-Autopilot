// 文言のキーの型（設計書 10.1）。全言語の JSON はこのキーをすべて持つ。
// 足りない JSON は data.ts の satisfies でビルドエラーになる（T-19）

export const MESSAGE_KEYS = [
  'common.disclaimer',
  'common.preparing',
  'common.close',
  'common.soundOn',
  'common.soundOff',

  'title.main',
  'title.sub',
  'title.lead',
  'title.start',
  'title.rules',
  'title.params',
  'title.settings',
  'title.credit',
  'title.privacy',

  'rules.heading',
  'rules.line1',
  'rules.line2',
  'rules.line2note',
  'rules.line3',
  'rules.line3b',
  'rules.candleUp',
  'rules.candleDown',
  'rules.note',
  'rules.start',
  'rules.skipNext',

  'play.elapsed',
  'play.assetLabel',
  'play.cash',
  'play.stock',
  'play.indexName',
  'play.buy',
  'play.sell',
  'play.pause',
  'play.tempToResult',

  'result.heading',
  'result.share',
  'result.retry',
  'result.caution',
  'result.params',
  'result.settings',
  'result.privacy',
  'result.backToTitle',

  'pause.heading',
  'pause.resume',
  'pause.restart',
  'pause.settings',

  'settings.heading',
  'settings.sound',
  'settings.on',
  'settings.off',
  'settings.chart',
  'settings.candle',
  'settings.line',

  'params.heading',
  'params.initialCash',
  'params.period',
  'params.trade',
  'params.fee',
  'params.tsumitate',
  'params.lump',
  'params.note1',
  'params.note2',

  'image.heading',

  'portrait.message',

  'privacy.heading',
  'privacy.p1',
  'privacy.p2',
  'privacy.p3',
  'privacy.p4',
  'privacy.p5',
  'privacy.googlePolicy',
  'privacy.optout',
] as const;

export type MessageKey = (typeof MESSAGE_KEYS)[number];

export type Messages = Record<MessageKey, string>;

export type Locale = 'ja';
