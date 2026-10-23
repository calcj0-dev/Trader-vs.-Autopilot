// 相場の生成（設計書 4.3〜4.6・4.11）。参照実装 sim/model.mjs の generateMarket と同じ結果になる。
// 乱数を使う順番を変えないこと（変えると同じ相場番号で違う相場になる）

import { makeNormal, mulberry32, randInt, type Rng } from './rng';
import type { Candle, MarketEvent, Market, MarketParams, ScenarioData, ScenarioKey } from './types';

/** 割合を引く順番。乱数の使い方の一部なので、データではなくここで固定する */
export const SCENARIO_ORDER: readonly ScenarioKey[] = ['steady', 'crash', 'volatile', 'decline'];

/** シナリオの「何か月目」は240か月を基準に書いてある */
const BASE_MONTHS = 240;
/** これより短い期間は対象外（設計書 4.11） */
export const MIN_GAME_MONTHS = 60;

type PlanMonth = { mu: number; sigma: number; extra: number };

function pickScenario(rng: Rng, data: ScenarioData): ScenarioKey {
  const total = SCENARIO_ORDER.reduce((s, k) => s + data.scenarios[k].weight, 0);
  let x = rng() * total;
  for (const k of SCENARIO_ORDER) {
    x -= data.scenarios[k].weight;
    if (x < 0) return k;
  }
  return SCENARIO_ORDER[SCENARIO_ORDER.length - 1]!;
}

/**
 * 調整（一時的な下落と戻り）を fromMonth〜toMonth に入れる。
 * 平均 1/perYear 年に1回（指数分布で間隔を決める）。−12〜−22%を1〜3か月で下げ、その95%を2〜6か月で戻す
 */
function addCorrections(
  plan: PlanMonth[],
  rng: Rng,
  events: MarketEvent[],
  data: ScenarioData,
  fromMonth: number,
  toMonth: number,
  perYear: number,
): void {
  const c = data.correction;
  let m = fromMonth;
  while (m < toMonth) {
    m += Math.max(c.minGap, Math.round((-Math.log(1 - rng()) * 12) / perYear));
    if (m >= toMonth) break;
    const depth = Math.log(1 - (c.depthMin + rng() * c.depthSpan));
    const down = randInt(rng, c.down.min, c.down.max);
    const up = randInt(rng, c.up.min, c.up.max);
    if (m + down + up >= toMonth) break;
    for (let i = 0; i < down; i++) plan[m + i]!.extra += depth / down;
    for (let i = 0; i < up; i++) plan[m + down + i]!.extra += (-depth * c.recoverRatio) / up;
    events.push({ month: m, kind: 'correction' });
    m += down + up;
  }
}

function buildScenarioPlan(
  key: ScenarioKey,
  rng: Rng,
  data: ScenarioData,
  N: number,
): { plan: PlanMonth[]; events: MarketEvent[] } {
  // 位置を表す月だけを期間に合わせて換算する（240か月ではそのまま）
  const scale = (m: number) => Math.round((m * N) / BASE_MONTHS);
  const corr = data.correction;
  const plan: PlanMonth[] = [];
  const events: MarketEvent[] = [];

  if (key === 'steady') {
    const s = data.scenarios.steady;
    for (let m = 0; m < N; m++) plan.push({ mu: s.mu, sigma: s.sigma, extra: 0 });
    addCorrections(plan, rng, events, data, scale(corr.startMonth), N, s.correctionsPerYear);
  } else if (key === 'crash') {
    const s = data.scenarios.crash;
    const start = randInt(rng, scale(s.crashStart.min), scale(s.crashStart.max));
    const dur = randInt(rng, s.crashLength.min, s.crashLength.max);
    const drop = Math.log(s.crashTotal);
    const bounceAt = Math.floor(dur / 2);
    const rebound = Math.log(s.rebound);
    const rec = randInt(rng, s.recoveryMonths.min, s.recoveryMonths.max);
    const recGain = Math.log(1 / s.crashTotal) * s.recoveryRatio - rebound;
    for (let m = 0; m < N; m++) plan.push({ mu: s.mu, sigma: s.sigma, extra: 0 });
    // 短い期間では回復が期間の外に出ることがあるので、期間の終わりで打ち切る（240か月では起きない）
    const at = (m: number) => (m < N ? plan[m] : undefined);
    for (let i = 0; i < dur; i++) {
      const p = at(start + i);
      if (!p) break;
      p.mu = s.crashMu;
      p.sigma = s.crashSigma;
      p.extra = i === bounceAt ? Math.log(s.bounce) : (drop - Math.log(s.bounce)) / (dur - 1);
    }
    for (let i = 0; i < s.reboundMonths; i++) {
      const p = at(start + dur + i);
      if (p) Object.assign(p, { mu: s.mu, sigma: s.reboundSigma, extra: rebound / s.reboundMonths });
    }
    for (let i = s.reboundMonths; i < s.reboundMonths + rec; i++) {
      const p = at(start + dur + i);
      if (p) Object.assign(p, { mu: s.mu, sigma: s.recoverySigma, extra: recGain / rec });
    }
    const margin = scale(corr.crashMargin);
    addCorrections(plan, rng, events, data, scale(corr.startMonth), start - margin, s.correctionsPerYear);
    addCorrections(plan, rng, events, data, start + dur + s.reboundMonths + rec + margin, N, s.correctionsPerYear);
    // ニュース用の出来事。ちょうどの月に出すと攻略法になるので、わざとずらす（設計書 4.5）
    events.push({ month: start + s.newsDelay, kind: 'crash_news' });
    events.push({ month: start + bounceAt, kind: 'crash_bounce' });
    events.push({
      month: start + dur - 1 - randInt(rng, s.gloomBeforeBottom.min, s.gloomBeforeBottom.max),
      kind: 'crash_gloom',
    });
    events.push({ month: start + dur - 1, kind: 'crash_bottom' });
  } else if (key === 'volatile') {
    // 上げ相場と下げ相場が不規則に入れ替わる
    const s = data.scenarios.volatile;
    let m = 0;
    let up = rng() < s.firstUpProb;
    while (m < N) {
      const len = randInt(rng, s.segment.min, s.segment.max);
      for (let i = 0; i < len && m < N; i++, m++) plan.push({ mu: up ? s.upMu : s.downMu, sigma: s.sigma, extra: 0 });
      up = !up;
    }
  } else {
    // 長期下落。途中で一度だけ戻り（だまし）
    const s = data.scenarios.decline;
    const rally = randInt(rng, scale(s.rallyStart.min), scale(s.rallyStart.max));
    for (let m = 0; m < N; m++) {
      const inRally = m >= rally && m < rally + s.rallyMonths;
      plan.push({ mu: inRally ? s.rallyMu : s.mu, sigma: s.sigma, extra: 0 });
    }
    events.push({ month: rally, kind: 'decline_rally' });
  }
  return { plan, events };
}

/** 相場を作る。candles[preMonths + gm] がゲームの月 gm のローソク足 */
export function generateMarket(seed: number, params: MarketParams): Market {
  const { gameMonths: N, preMonths, data } = params;
  if (!Number.isInteger(N) || N < MIN_GAME_MONTHS) {
    throw new Error(`gameMonths must be an integer >= ${MIN_GAME_MONTHS} (got ${N})`);
  }
  const rng = mulberry32(seed);
  const normal = makeNormal(rng);
  const scenario = pickScenario(rng, data);
  const { plan, events } = buildScenarioPlan(scenario, rng, data, N);
  const pre: PlanMonth[] = Array.from({ length: preMonths }, () => ({ mu: data.pre.mu, sigma: data.pre.sigma, extra: 0 }));
  const all = pre.concat(plan);

  const candles: Candle[] = [];
  let logP = Math.log(data.startPrice);
  const n = data.subSteps;
  for (const { mu, sigma, extra } of all) {
    // 月のリターン（対数）
    const target = (mu - 0.5 * sigma * sigma) / 12 + (sigma / Math.sqrt(12)) * normal() + extra;
    // 月内の細かい動き（ブラウン橋）：終値がちょうど target になるよう補正
    const subSd = sigma / Math.sqrt(12 * n);
    const path = [0];
    for (let i = 1; i <= n; i++) path.push(path[i - 1]! + subSd * normal());
    const endGap = target - path[n]!;
    let hi = -Infinity;
    let lo = Infinity;
    for (let i = 0; i <= n; i++) {
      const v = path[i]! + (i / n) * endGap;
      if (v > hi) hi = v;
      if (v < lo) lo = v;
    }
    // 終点の補正は小数の誤差で target をわずかに外すことがあるので、高値・安値が終値を必ず含むようにする。
    // 参照実装との差は 1e-10 程度（T-02 の許容 1e-9 以内）で、乱数の順番は変わらない
    if (hi < target) hi = target;
    if (lo > target) lo = target;
    const o = Math.exp(logP);
    const c = Math.exp(logP + target);
    candles.push({ o, h: Math.exp(logP + hi), l: Math.exp(logP + lo), c });
    logP += target;
  }
  return { seed: seed >>> 0, scenario, candles, events };
}

/** ゲーム期間の終値 */
export function gameCloses(market: Market, preMonths: number): number[] {
  return market.candles.slice(preMonths).map((k) => k.c);
}
