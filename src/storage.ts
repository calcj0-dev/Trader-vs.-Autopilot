// 端末への保存（設計書 7.15）。保存できない環境（プライベートブラウズなど）では初期値で動く

const PREFIX = 'baka016.';

export type StorageKey = 'sound' | 'chart' | 'rulesSeen' | 'hintSeen';

export function load(key: StorageKey, fallback: string): string {
  try {
    return globalThis.localStorage?.getItem(PREFIX + key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function save(key: StorageKey, value: string): void {
  try {
    globalThis.localStorage?.setItem(PREFIX + key, value);
  } catch {
    // 保存できなくても遊べるようにする
  }
}
