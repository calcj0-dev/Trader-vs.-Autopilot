// 金額の表記（設計書 10.2）。通貨ごとの違いは JSON の formats だけで表し、処理はここに1つだけ書く

import { currencies } from '../data';
import type { CurrencyConfig, MoneyFormat, MoneyFormatKind } from './types';

let current: CurrencyConfig = currencies.JPY;

export function setCurrency(code: keyof typeof currencies): void {
  current = currencies[code];
}

export function getCurrency(): CurrencyConfig {
  return current;
}

/** prefix ＋（金額 ÷ divisor を decimals 桁で四捨五入）＋ suffix */
export function formatWith(amount: number, f: MoneyFormat): string {
  const value = amount / f.divisor;
  const body = value.toLocaleString('en-US', {
    minimumFractionDigits: f.decimals,
    maximumFractionDigits: f.decimals,
    useGrouping: f.grouping,
  });
  return `${f.prefix}${body}${f.suffix}`;
}

/** 割合の表記「+12.3%」「−4.7%」（小数1桁。マイナスは全角の −） */
export function formatRate(rate: number): string {
  const r = Math.round(rate * 1000) / 10;
  const sign = r > 0 ? '+' : r < 0 ? '−' : '';
  return `${sign}${Math.abs(r).toFixed(1)}%`;
}

export function formatMoney(amount: number, kind: MoneyFormatKind = 'asset', c: CurrencyConfig = current): string {
  return formatWith(amount, c.formats[kind]);
}
