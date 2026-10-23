// BAKA-016 積立投資を超えろ！ 価格モデルと資産計算の参照実装
// 設計書 04_価格モデルと計算仕様.md と同じ内容。実装時はこのファイルを TypeScript に移してよい。

export const CONFIG = {
  gameMonths: 240,          // 20年
  preMonths: 24,            // 開始前に見せる助走（売買不可）
  initialCash: 1_000_000,   // 初期資金
  monthMs: 1000 / 3,        // 1か月の長さ（ミリ秒）。20年×12か月×1/3秒＝80秒（暫定。ここを変えるだけで速さが変わる）
  // 手数料・税金：なし（オーナー決定 2026-10-23）
  startPrice: 10_000,       // 架空指数の開始値（ポイント）
  subSteps: 20,             // 1か月内の細かい刻み（高値・安値の生成用）
};

export const SCENARIOS = {
  steady:   { label: '右肩上がり',   weight: 35 },
  crash:    { label: '暴落と回復',   weight: 35 },
  volatile: { label: '乱高下',       weight: 22 },
  decline:  { label: '長期下落',     weight: 8  },
};

// ---- 乱数（シード固定） ----
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeNormal(rng) {
  let spare = null;
  return function () {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = 0, v = 0;
    while (u === 0) u = rng();
    v = rng();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
}
const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1)); // lo〜hi（両端含む）

function pickScenario(rng) {
  const keys = Object.keys(SCENARIOS);
  const total = keys.reduce((s, k) => s + SCENARIOS[k].weight, 0);
  let x = rng() * total;
  for (const k of keys) { x -= SCENARIOS[k].weight; if (x < 0) return k; }
  return keys[keys.length - 1];
}

// ---- シナリオごとの「月ごとの年率リターンと変動の大きさ」 ----
// 戻り値: gm（ゲーム内の月 0〜239）→ { mu: 年率の傾き, sigma: 年率の変動, extra: その月に加える対数リターン }
// 「調整（一時的な下落）」をはさむ：−12〜−22%を1〜3か月で下げ、そのあと2〜6か月で戻す（V字）。
// 狼狽売り・順張りが「売った直後に戻る」を経験するための仕掛け。
function addCorrections(plan, rng, events, fromMonth, toMonth, perYear) {
  let m = fromMonth;
  while (m < toMonth) {
    // 平均 1/perYear 年に1回（指数分布で間隔を決める）
    m += Math.max(6, Math.round((-Math.log(1 - rng()) * 12) / perYear));
    if (m >= toMonth) break;
    const depth = Math.log(1 - (0.12 + rng() * 0.10));
    const down = randInt(rng, 1, 3), up = randInt(rng, 2, 6);
    if (m + down + up >= toMonth) break;
    for (let i = 0; i < down; i++) plan[m + i].extra += depth / down;
    for (let i = 0; i < up; i++) plan[m + down + i].extra += (-depth * 0.95) / up;
    events.push({ month: m, kind: 'correction' });
    m += down + up;
  }
}

function buildScenarioPlan(key, rng) {
  const N = CONFIG.gameMonths;
  const plan = [];
  const events = []; // ニュースの「本物」イベント用 { month, kind }
  if (key === 'steady') {
    for (let m = 0; m < N; m++) plan.push({ mu: 0.065, sigma: 0.14, extra: 0 });
    addCorrections(plan, rng, events, 6, N, 0.35);
  } else if (key === 'crash') {
    const start = randInt(rng, 36, 168);     // 4年目〜15年目に暴落開始
    const dur = randInt(rng, 5, 9);          // 5〜9か月かけて
    const drop = Math.log(0.58);             // 合計で約−42%
    const bounceAt = Math.floor(dur / 2);    // 途中で一度だけ戻る（だましの反発）
    const rebound = Math.log(1.22);          // 底から3か月で約+22%（戻りは速い）
    const rec = randInt(rng, 18, 36);        // 残りは18〜36か月かけて回復
    const recGain = Math.log(1 / 0.58) * 0.9 - rebound;
    for (let m = 0; m < N; m++) plan.push({ mu: 0.065, sigma: 0.14, extra: 0 });
    for (let i = 0; i < dur; i++) {
      const p = plan[start + i];
      p.mu = 0; p.sigma = 0.22;
      p.extra = i === bounceAt ? Math.log(1.08) : (drop - Math.log(1.08)) / (dur - 1);
    }
    for (let i = 0; i < 3; i++) Object.assign(plan[start + dur + i], { mu: 0.065, sigma: 0.20, extra: rebound / 3 });
    for (let i = 3; i < 3 + rec; i++) Object.assign(plan[start + dur + i], { mu: 0.065, sigma: 0.16, extra: recGain / rec });
    addCorrections(plan, rng, events, 6, start - 6, 0.3);
    addCorrections(plan, rng, events, start + dur + 3 + rec + 6, N, 0.3);
    // ニュース用の出来事。ちょうどの月に出すと攻略法になるので、わざとずらす
    events.push({ month: start + 2, kind: 'crash_news' });                          // 急落の速報：下げ始めて3か月目（すでに約−15%）
    events.push({ month: start + bounceAt, kind: 'crash_bounce' });                 // だましの反発
    events.push({ month: start + dur - 1 - randInt(rng, 1, 3), kind: 'crash_gloom' }); // 悲観ムード：底の1〜3か月前
    events.push({ month: start + dur - 1, kind: 'crash_bottom' });                  // 本当の底（ニュースは出さない。判定用）
  } else if (key === 'volatile') {
    // 上げ相場と下げ相場が不規則に入れ替わる。長さが毎回ばらばらなので、形から先を読みにくい
    let m = 0, up = rng() < 0.55;
    while (m < N) {
      const len = randInt(rng, 3, 15);
      for (let i = 0; i < len && m < N; i++, m++) plan.push({ mu: up ? 0.27 : -0.17, sigma: 0.24, extra: 0 });
      up = !up;
    }
  } else if (key === 'decline') {
    const rally = randInt(rng, 60, 150);     // 途中で一度だけ戻り（だまし）
    for (let m = 0; m < N; m++) {
      const inRally = m >= rally && m < rally + 12;
      plan.push({ mu: inRally ? 0.15 : -0.03, sigma: 0.18, extra: 0 });
    }
    events.push({ month: rally, kind: 'decline_rally' });
  }
  return { plan, events };
}

// ---- 相場の生成 ----
// 戻り値: { seed, scenario, candles: [{o,h,l,c}] (preMonths+gameMonths 本), events }
// candles[CONFIG.preMonths + gm] がゲーム内の月 gm のローソク足
export function generateMarket(seed) {
  const rng = mulberry32(seed);
  const normal = makeNormal(rng);
  const scenario = pickScenario(rng);
  const { plan, events } = buildScenarioPlan(scenario, rng);
  const pre = Array.from({ length: CONFIG.preMonths }, () => ({ mu: 0.05, sigma: 0.15, extra: 0 }));
  const all = pre.concat(plan);

  const candles = [];
  let logP = Math.log(CONFIG.startPrice);
  const n = CONFIG.subSteps;
  for (const { mu, sigma, extra } of all) {
    // 月のリターン（対数）
    const target = (mu - 0.5 * sigma * sigma) / 12 + (sigma / Math.sqrt(12)) * normal() + extra;
    // 月内の細かい動き（ブラウン橋）：終値がちょうど target になるよう補正
    const subSd = sigma / Math.sqrt(12 * n);
    const path = [0];
    for (let i = 1; i <= n; i++) path.push(path[i - 1] + subSd * normal());
    const endGap = target - path[n];
    let hi = -Infinity, lo = Infinity;
    for (let i = 0; i <= n; i++) {
      const v = path[i] + (i / n) * endGap;
      if (v > hi) hi = v;
      if (v < lo) lo = v;
    }
    const o = Math.exp(logP);
    const c = Math.exp(logP + target);
    candles.push({ o, h: Math.exp(logP + hi), l: Math.exp(logP + lo), c });
    logP += target;
  }
  return { seed: seed >>> 0, scenario, candles, events };
}

export const gameCloses = (market) => market.candles.slice(CONFIG.preMonths).map((k) => k.c);

// ---- 資産の計算（手数料・税金なし） ----
// actions: [{ month: gm, type: 'buy'|'sell' }]（その月の終値で約定。1か月に1回まで）
export function simulatePlayer(closes, actions) {
  let cash = CONFIG.initialCash, shares = 0, trades = 0;
  const byMonth = new Map(actions.map((a) => [a.month, a.type]));
  const history = [], log = [];
  for (let m = 0; m < closes.length; m++) {
    const p = closes[m];
    const t = byMonth.get(m);
    if (t === 'buy' && cash > 0) {
      shares = cash / p; cash = 0; trades++;
      log.push({ month: m, type: 'buy', price: p });
    } else if (t === 'sell' && shares > 0) {
      cash = shares * p; shares = 0; trades++;
      log.push({ month: m, type: 'sell', price: p });
    }
    history.push(cash + shares * p);
  }
  return { final: history[history.length - 1], history, trades, log };
}

// 積立：100万円を240回に分け、毎月の終値で買う。売らない。
export function simulateTsumitate(closes) {
  const monthly = CONFIG.initialCash / closes.length;
  let cash = CONFIG.initialCash, shares = 0;
  const history = [];
  for (let m = 0; m < closes.length; m++) {
    shares += monthly / closes[m];
    cash -= monthly;
    history.push(cash + shares * closes[m]);
  }
  return { final: history[history.length - 1], history };
}

// 一括で買って放置：最初の月の終値で全額買い、最後まで持つ。
export function simulateLumpSum(closes) {
  return simulatePlayer(closes, [{ month: 0, type: 'buy' }]);
}

// ---- 勝敗判定（C案＋引き分け） ----
// 比べるのは「円単位に四捨五入した最終資産」（画面の表示と食い違わないように）
export function judge(player, tsumitate, lump, actions) {
  const me = Math.round(player.final), ts = Math.round(tsumitate.final), ls = Math.round(lump.final);
  // 「一括投資派」：買い1回だけで、一度も売らなかった（買った時期は問わない）
  const isLumpHolder = actions.length === 1 && actions[0].type === 'buy';
  let outcome;
  if (me > ts && me > ls) outcome = 'big_win';   // 積立も一括放置も上回る
  else if (me > ts) outcome = 'win';             // 積立を上回る（一括放置と同額・以下）
  else if (me === ts) outcome = 'draw';          // 積立と同額
  else outcome = 'lose';
  return { outcome, isLumpHolder, countsForWinRate: !isLumpHolder };
}

// ---- 称号（オーナー決定 2026-10-23）。上から順に判定し、最初に当てはまったもの ----
export const TITLES = {
  cash_lover:            '現金を愛でる会・会長',
  one_button:            'ボタンを1回しか押していない人',
  from_future:           '未来から来た人（たぶん偶然）',
  quit_job:              '明日から仕事を辞めそうな人',
  beats_tsumitate:       '積立には勝てる男（女）',
  tired_fingers:         '指が疲れた勝者',
  practically_tsumitate: '実質、積立',
  bottom_sommelier:      '底値ソムリエ',
  chart_talker:          'チャートと会話できる（と思っている）人',
  blame_market:          '相場のせいにしていい人',
  proved_tsumitate:      '20年かけて積立の凄さを証明した人',
};

// 底値付近で売った：売った月の終値が、前後24か月（ゲーム期間内）の終値の最安値の1.03倍以下
export function soldNearBottom(closes, log) {
  return log.some((t) => {
    if (t.type !== 'sell') return false;
    const from = Math.max(0, t.month - 24), to = Math.min(closes.length - 1, t.month + 24);
    let min = Infinity;
    for (let i = from; i <= to; i++) min = Math.min(min, closes[i]);
    return closes[t.month] <= min * 1.03;
  });
}

export function pickTitle(closes, scenario, player, result) {
  const n = player.trades, o = result.outcome;
  if (n === 0) return 'cash_lover';
  if (result.isLumpHolder) return 'one_button';
  if (o === 'big_win') return n <= 10 ? 'from_future' : 'quit_job';
  if (o === 'win') return n <= 10 ? 'beats_tsumitate' : 'tired_fingers';
  if (o === 'draw') return 'practically_tsumitate';
  if (soldNearBottom(closes, player.log)) return 'bottom_sommelier';
  if (n >= 30) return 'chart_talker';
  if (scenario === 'decline') return 'blame_market';
  return 'proved_tsumitate';
}
