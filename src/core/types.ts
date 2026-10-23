// core/ で使う型（設計書 7.1）。core/ は画面・時間・DOM・JSON に依存しない

export type ScenarioKey = 'steady' | 'crash' | 'volatile' | 'decline';

export type Candle = { o: number; h: number; l: number; c: number };

export type EventKind =
  | 'crash_news'
  | 'crash_bounce'
  | 'crash_gloom'
  | 'crash_bottom'
  | 'correction'
  | 'decline_rally';

/** month はゲームの月（0 始まり） */
export type MarketEvent = { month: number; kind: EventKind };

export type Market = {
  seed: number;
  scenario: ScenarioKey;
  /** 助走 preMonths 本＋ゲーム gameMonths 本 */
  candles: Candle[];
  events: MarketEvent[];
};

export type TradeType = 'buy' | 'sell';

/** プレイヤーの入力（その月の終値で約定する注文） */
export type Order = { month: number; type: TradeType };

/** 約定した売買 */
export type Trade = { month: number; type: TradeType; price: number };

export type Outcome = 'big_win' | 'win' | 'draw' | 'lose';

export type Range = { min: number; max: number };

/** data/scenarios.json の形 */
export type ScenarioData = {
  startPrice: number;
  subSteps: number;
  pre: { mu: number; sigma: number };
  scenarios: {
    steady: { weight: number; mu: number; sigma: number; correctionsPerYear: number };
    crash: {
      weight: number;
      mu: number;
      sigma: number;
      correctionsPerYear: number;
      crashStart: Range;
      crashLength: Range;
      crashMu: number;
      crashSigma: number;
      crashTotal: number;
      bounce: number;
      rebound: number;
      reboundMonths: number;
      reboundSigma: number;
      recoveryMonths: Range;
      recoveryRatio: number;
      recoverySigma: number;
      newsDelay: number;
      gloomBeforeBottom: Range;
    };
    volatile: { weight: number; upMu: number; downMu: number; sigma: number; segment: Range; firstUpProb: number };
    decline: { weight: number; mu: number; sigma: number; rallyStart: Range; rallyMonths: number; rallyMu: number };
  };
  correction: {
    startMonth: number;
    minGap: number;
    depthMin: number;
    depthSpan: number;
    down: Range;
    up: Range;
    recoverRatio: number;
    crashMargin: number;
  };
};

/** 相場を作るのに必要な値（data.ts が JSON から組み立てて渡す） */
export type MarketParams = {
  gameMonths: number;
  preMonths: number;
  data: ScenarioData;
};
