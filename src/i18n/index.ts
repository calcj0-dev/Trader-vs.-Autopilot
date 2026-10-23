// 文言の取り出し（設計書 10.1）。言語は起動時に1回だけ決める。公開時は常に ja

import { messagesByLocale } from '../data';
import type { Locale, MessageKey, Messages, RandomNewsKey } from './types';

let locale: Locale = 'ja';
let messages: Messages = messagesByLocale.ja;

export function setLocale(next: Locale): void {
  locale = next;
  messages = messagesByLocale[next];
  if (typeof document !== 'undefined') document.documentElement.lang = next;
}

export function getLocale(): Locale {
  return locale;
}

export type Vars = Record<string, string | number>;

/** {name} の形の差し込みを置き換える。値がない差し込みはそのまま残す */
export function format(template: string, vars: Vars = {}): string {
  return template.replace(/\{(\w+)\}/g, (all, name: string) => (name in vars ? String(vars[name]) : all));
}

export function t(key: MessageKey | RandomNewsKey, vars?: Vars): string {
  return format(messages[key] ?? key, vars);
}
