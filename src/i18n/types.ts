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
  'play.countdownGo',
  'play.resuming',
  'play.ended',
  'play.ordering',
  'play.orderedThisMonth',

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

  'news.event.A.source',
  'news.event.A.headline',
  'news.event.B.source',
  'news.event.B.headline',
  'news.event.C.source',
  'news.event.C.headline',
  'news.event.D.source',
  'news.event.D.headline',
  'news.event.E.source',
  'news.event.E.headline',
] as const;

export type MessageKey = (typeof MESSAGE_KEYS)[number];

/** ランダムのニュースは数を言語ごとに変えられるよう、ID（data/news.json）で引く */
export type RandomNewsKey = `news.random.${string}.${'source' | 'headline'}`;

export const RANDOM_NEWS_KEY = /^news\.random\.[^.]+\.(source|headline)$/;

export type Messages = Record<MessageKey, string> & { [K in RandomNewsKey]?: string };

export type Locale = 'ja';
