// 通貨の設定の型（設計書 10.2）。値は data/currency/<通貨>.json に書く

export type MoneyFormat = {
  /** この数で割ってから表示する（円の「万円」なら 10000） */
  divisor: number;
  /** 小数の桁数（四捨五入） */
  decimals: number;
  prefix: string;
  suffix: string;
  /** 3桁ごとに区切るか */
  grouping: boolean;
};

/**
 * asset：資産額（「5,123.4万円」）／ whole：文中の金額（「10万円」）／ plain：細かい金額（「4,167円」）
 */
export type MoneyFormatKind = 'asset' | 'whole' | 'plain';

export type CurrencyConfig = {
  code: string;
  /** 毎月受け取る額（設計書 3.2） */
  monthlyIncome: number;
  /** 勝敗の比較で丸める単位（円は 1） */
  minorUnit: number;
  formats: Record<MoneyFormatKind, MoneyFormat>;
};
