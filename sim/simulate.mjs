// 戦略別・シナリオ別に、勝利（積立超え）・大勝利（一括放置も超え）の割合を試算する
import { CONFIG, SCENARIOS, generateMarket, gameCloses, simulatePlayer, simulateTsumitate, simulateLumpSum, judge, mulberry32 } from './model.mjs';

const RUNS = Number(process.argv[2] || 20000);

// 戦略：closes を見て actions を返す。判断には「前の月までの終値」だけを使い、その月の終値で約定する
const strategies = {
  '何もしない（現金のまま）': () => [],
  '最初に買って放置': () => [{ month: 0, type: 'buy' }],
  'ランダム売買（約10回）': (c, rng) => randomTrader(c, rng, 10),
  'ランダム売買（約30回）': (c, rng) => randomTrader(c, rng, 30),
  'ランダム売買（約60回）': (c, rng) => randomTrader(c, rng, 60),
  '順張り（6か月平均の上で買い・下で売り）': (c) => trend(c, 6),
  '狼狽売り（高値から−20%で売り、底から+15%で買い直し）': (c) => panic(c),
  '逆張り（12か月平均の−5%で買い、+10%で売り）': (c) => meanRev(c),
  '下がるのを待って買う（最初から−10%で買い、来なければ5年目）': (c) => waitDip(c),
  'ニュースで売買（急落・下落のニュースで売り、悲観ニュースか6か月後に買い）': (c, rng, ev) => newsTrader(c, ev),
};

function newsTrader(c, ev) {
  const sellOn = new Set(ev.filter((e) => e.kind === 'crash_news' || e.kind === 'correction').map((e) => e.month));
  const buyOn = new Set(ev.filter((e) => e.kind === 'crash_gloom').map((e) => e.month));
  const a = [{ month: 0, type: 'buy' }]; let holding = true, soldAt = -1;
  for (let m = 1; m < c.length; m++) {
    // ニュースはその月の途中で出る → その月の終値で約定
    if (holding && sellOn.has(m)) { a.push({ month: m, type: 'sell' }); holding = false; soldAt = m; }
    else if (!holding && (buyOn.has(m) || m - soldAt >= 6)) { a.push({ month: m, type: 'buy' }); holding = true; }
  }
  return a;
}

function randomTrader(c, rng, n) {
  const p = n / c.length; const a = []; let holding = false;
  for (let m = 0; m < c.length; m++) if (rng() < p) { a.push({ month: m, type: holding ? 'sell' : 'buy' }); holding = !holding; }
  return a;
}
function ma(c, m, k) { let s = 0; for (let i = m - k; i < m; i++) s += c[Math.max(i, 0)]; return s / k; }
function trend(c, k) {
  const a = [{ month: 0, type: 'buy' }]; let holding = true;
  for (let m = 1; m < c.length; m++) {
    const prev = c[m - 1], avg = ma(c, m, k);
    if (holding && prev < avg) { a.push({ month: m, type: 'sell' }); holding = false; }
    else if (!holding && prev > avg) { a.push({ month: m, type: 'buy' }); holding = true; }
  }
  return a;
}
function panic(c) {
  const a = [{ month: 0, type: 'buy' }]; let holding = true, peak = c[0], trough = Infinity;
  for (let m = 1; m < c.length; m++) {
    const prev = c[m - 1];
    if (holding) { peak = Math.max(peak, prev); if (prev < peak * 0.8) { a.push({ month: m, type: 'sell' }); holding = false; trough = prev; } }
    else { trough = Math.min(trough, prev); if (prev > trough * 1.15) { a.push({ month: m, type: 'buy' }); holding = true; peak = prev; } }
  }
  return a;
}
function meanRev(c) {
  const a = []; let holding = false;
  for (let m = 12; m < c.length; m++) {
    const prev = c[m - 1], avg = ma(c, m, 12);
    if (!holding && prev < avg * 0.95) { a.push({ month: m, type: 'buy' }); holding = true; }
    else if (holding && prev > avg * 1.10) { a.push({ month: m, type: 'sell' }); holding = false; }
  }
  return a;
}
function waitDip(c) {
  for (let m = 1; m < 60; m++) if (c[m - 1] < c[0] * 0.9) return [{ month: m, type: 'buy' }];
  return [{ month: 60, type: 'buy' }];
}

const keys = Object.keys(SCENARIOS);
const stats = {}; // stats[strategy][scenario] = {n, win, big, final, trades}
const ref = {};   // ref[scenario] = {n, tsumi, lump, lumpBeatsTsumi}
for (const s of Object.keys(strategies)) { stats[s] = {}; for (const k of [...keys, 'all']) stats[s][k] = { n: 0, win: 0, big: 0, final: 0, trades: 0 }; }
for (const k of [...keys, 'all']) ref[k] = { n: 0, tsumi: 0, lump: 0, lumpBeats: 0, tsumiLoss: 0 };

const seedRng = mulberry32(20261023);
for (let i = 0; i < RUNS; i++) {
  const seed = Math.floor(seedRng() * 2 ** 32);
  const mk = generateMarket(seed);
  const c = gameCloses(mk);
  const ts = simulateTsumitate(c), ls = simulateLumpSum(c);
  for (const k of [mk.scenario, 'all']) {
    const r = ref[k]; r.n++; r.tsumi += ts.final; r.lump += ls.final;
    if (ls.final > ts.final) r.lumpBeats++;
    if (ts.final < CONFIG.initialCash) r.tsumiLoss++;
  }
  const stratRng = mulberry32(seed ^ 0x9e3779b9);
  for (const [name, fn] of Object.entries(strategies)) {
    const acts = fn(c, stratRng, mk.events);
    const p = simulatePlayer(c, acts);
    const j = judge(p, ts, ls, acts);
    for (const k of [mk.scenario, 'all']) {
      const s = stats[name][k]; s.n++;
      if (j.outcome === 'win' || j.outcome === 'big_win') s.win++;
      if (j.outcome === 'big_win') s.big++;
      s.final += p.final; s.trades += p.trades;
    }
  }
}

const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + '%' : '-');
const man = (x) => (x / 10000).toFixed(0) + '万円';
console.log(`試行回数: ${RUNS}`);
console.log('\n## 比較相手（シナリオ別）');
console.log('| シナリオ | 出現 | 積立の平均 | 一括放置の平均 | 一括放置が積立を上回る割合 | 積立が元本割れする割合 |');
console.log('| --- | --- | --- | --- | --- | --- |');
for (const k of [...keys, 'all']) {
  const r = ref[k];
  console.log(`| ${k === 'all' ? '全体' : SCENARIOS[k].label} | ${pct(r.n, RUNS)} | ${man(r.tsumi / r.n)} | ${man(r.lump / r.n)} | ${pct(r.lumpBeats, r.n)} | ${pct(r.tsumiLoss, r.n)} |`);
}
console.log('\n## 戦略別（全体）');
console.log('| 戦略 | 勝利以上（積立超え） | 大勝利（一括放置も超え） | 平均の最終資産 | 平均売買回数 |');
console.log('| --- | --- | --- | --- | --- |');
for (const name of Object.keys(strategies)) {
  const s = stats[name].all;
  console.log(`| ${name} | ${pct(s.win, s.n)} | ${pct(s.big, s.n)} | ${man(s.final / s.n)} | ${(s.trades / s.n).toFixed(1)} |`);
}
console.log('\n## 戦略別・シナリオ別の「勝利以上 / 大勝利」');
console.log('| 戦略 | ' + keys.map((k) => SCENARIOS[k].label).join(' | ') + ' |');
console.log('| --- |' + keys.map(() => ' --- |').join(''));
for (const name of Object.keys(strategies)) {
  console.log(`| ${name} | ` + keys.map((k) => `${pct(stats[name][k].win, stats[name][k].n)} / ${pct(stats[name][k].big, stats[name][k].n)}`).join(' | ') + ' |');
}
