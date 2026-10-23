// 直前のプレイの結果。結果画面（#12）が読む

import type { Session, SessionResult } from './session';

export type LastPlay = { session: Session; result: SessionResult };

let last: LastPlay | null = null;

export function setLastPlay(p: LastPlay): void {
  last = p;
}

export function getLastPlay(): LastPlay | null {
  return last;
}
