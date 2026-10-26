// 利用者の設定（効果音・チャートの表示・速さ・ルールの省略）。端末に保存する

import { config } from './data';
import { load, save } from './storage';

export type ChartMode = 'candle' | 'line';

type Listener = () => void;
const listeners = new Set<Listener>();

export const settings = {
  get sound(): boolean {
    return load('sound', 'on') === 'on';
  },
  set sound(v: boolean) {
    save('sound', v ? 'on' : 'off');
    notify();
  },
  get chart(): ChartMode {
    return load('chart', 'candle') === 'line' ? 'line' : 'candle';
  },
  set chart(v: ChartMode) {
    save('chart', v);
    notify();
  },
  /** 速さ（1年の秒数）。選択肢にない値が保存されていたら最初の設定に戻す */
  get speed(): number {
    const v = Number(load('speed', String(config.defaultYearSeconds)));
    return config.yearSecondsOptions.includes(v) ? v : config.defaultYearSeconds;
  },
  set speed(v: number) {
    save('speed', String(v));
    notify();
  },
  get rulesSeen(): boolean {
    return load('rulesSeen', '0') === '1';
  },
  set rulesSeen(v: boolean) {
    save('rulesSeen', v ? '1' : '0');
  },
  /** 「右端のローソク足が今月です」の吹き出しを出したか */
  get hintSeen(): boolean {
    return load('hintSeen', '0') === '1';
  },
  set hintSeen(v: boolean) {
    save('hintSeen', v ? '1' : '0');
  },
};

/** 設定が変わったら呼ばれる（音のボタンの見た目を合わせるため）。戻り値で解除 */
export function onSettingsChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  for (const fn of listeners) fn();
}
