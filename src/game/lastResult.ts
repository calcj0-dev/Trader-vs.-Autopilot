// 直前のプレイの結果。結果画面（#12）が読む

import type { Session, SessionResult } from './session';

export type LastPlay = {
  session: Session;
  result: SessionResult;
  /** 遊んだ速さ（1年の秒数。計測用） */
  speed: number;
  /** finish を送ったか（同じ結果を2回数えない） */
  reported?: boolean;
};

let last: LastPlay | null = null;

export function setLastPlay(p: LastPlay): void {
  last = p;
}

export function getLastPlay(): LastPlay | null {
  return last;
}
