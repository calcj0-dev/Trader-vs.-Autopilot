// ニュースの予定表（設計書 3.6・7.7）。プレイ開始時に月単位で作る。
// 乱数は相場とは別（seed ^ 0x5bd1e995）。相場の出来事の月は変えず、ニュースを出す月だけを決める

import { mulberry32, type Rng } from './rng';
import type { EventKind, MarketEvent, Range } from './types';

export type NewsData = {
  /** ランダムのニュースの ID */
  random: string[];
  /** 出来事と、出すニュース（A〜E）の対応。ここにない出来事（crash_bottom）は出さない */
  events: Partial<Record<EventKind, string>>;
  /** この順番を必ず守るニュース（A→B→C） */
  chain: string[];
};

export type NewsItem = {
  kind: 'random' | 'event';
  /** random なら news.json の ID、event なら A〜E */
  id: string;
  /** 出し始める時刻（ゲームの月。小数あり） */
  start: number;
  /** 消す時刻（次のニュースが割り込んだらそこで消す） */
  end: number;
};

export type NewsOptions = {
  gameMonths: number;
  /** ランダムのニュースの間隔（前のニュースが消えてから。月） */
  intervalMonths: Range;
  /** 1つのニュースを出す長さ（月） */
  showMonths: number;
  /** 出来事のニュースを最低この長さは出す（月）。次の出来事のニュースはそのあとに送る（Q14） */
  eventMinMonths: number;
};

/**
 * 出来事ニュースを出す月を決める（Q1）：1か月に1つまで。chain（A→B→C）の順を守り、
 * 重なった・順番が逆になったときは後のものを次の空いている月に送る
 */
export function placeEventNews(events: MarketEvent[], data: NewsData, gameMonths: number): { month: number; id: string }[] {
  const wanted = events
    .map((e) => ({ month: e.month, id: data.events[e.kind] }))
    .filter((e): e is { month: number; id: string } => e.id !== undefined);
  const rank = (id: string) => data.chain.indexOf(id);
  const chain = wanted.filter((e) => rank(e.id) >= 0).sort((a, b) => rank(a.id) - rank(b.id));
  const others = wanted.filter((e) => rank(e.id) < 0).sort((a, b) => a.month - b.month);

  const used = new Set<number>();
  const placed: { month: number; id: string }[] = [];
  const take = (from: number, id: string) => {
    let m = from;
    while (used.has(m)) m++;
    if (m >= gameMonths) return null;
    used.add(m);
    placed.push({ month: m, id });
    return m;
  };
  let prev = -1;
  for (const e of chain) {
    const m = take(Math.max(e.month, prev + 1), e.id);
    if (m !== null) prev = m;
  }
  for (const e of others) take(e.month, e.id);
  return placed.sort((a, b) => a.month - b.month);
}

/**
 * 予定表を作る。ランダムのニュースは前のニュースが消えてから intervalMonths ごとに、使っていないものから1つ。
 * 出来事のニュースは、その月の始めに割り込む。ランダムの間隔はそこから数え直す。
 * 出来事のニュースが続くときは、前の出来事のニュースを eventMinMonths は出してから次を出す（Q14）
 */
export function buildNewsSchedule(seed: number, events: MarketEvent[], data: NewsData, opts: NewsOptions): NewsItem[] {
  const rng: Rng = mulberry32((seed ^ 0x5bd1e995) >>> 0);
  const pending = placeEventNews(events, data, opts.gameMonths);
  const unused = [...data.random];
  const items: Omit<NewsItem, 'end'>[] = [];
  const { min, max } = opts.intervalMonths;

  let cursor = 0;
  let ev = 0;
  let lastEvent = -Infinity;
  for (;;) {
    const next = pending[ev];
    const nextStart = next ? Math.max(next.month, lastEvent + opts.eventMinMonths) : Infinity;
    if (next && nextStart >= opts.gameMonths) {
      // 送った結果、期間の外になった出来事のニュースは出さない
      ev++;
      continue;
    }
    const candidate = unused.length > 0 ? cursor + min + rng() * (max - min) : Infinity;
    // ランダムを出すと出来事に重なるなら、出来事を先に出す
    if (next && nextStart < candidate + opts.showMonths) {
      items.push({ kind: 'event', id: next.id, start: nextStart });
      cursor = nextStart + opts.showMonths;
      lastEvent = nextStart;
      ev++;
    } else if (candidate < opts.gameMonths) {
      const id = unused.splice(Math.floor(rng() * unused.length), 1)[0]!;
      items.push({ kind: 'random', id, start: candidate });
      cursor = candidate + opts.showMonths;
    } else {
      break;
    }
  }
  return items.map((it, i) => ({
    ...it,
    end: Math.min(it.start + opts.showMonths, items[i + 1]?.start ?? Infinity, opts.gameMonths),
  }));
}

/** 時刻 t（ゲームの月）に出ているニュース */
export function newsAt(items: NewsItem[], t: number): NewsItem | null {
  for (const it of items) {
    if (it.start > t) break;
    if (t < it.end) return it;
  }
  return null;
}
