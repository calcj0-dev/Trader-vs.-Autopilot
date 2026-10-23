// 毎月10万円の形の試算：遊び方ごとの勝敗の分かれ方と、称号の出る割合
// 実行：node monthly_simulate.mjs 10000
import { generateMarket, gameCloses, mulberry32, simulatePlayer, simulateTsumitate, judge, pickTitle } from './monthly.mjs';

const RUNS = Number(process.argv[2] || 10000);

// 遊び方：判断には「前の月までの終値」だけを使い、その月の終値で約定する
const ma = (c, m, k) => { let s = 0; for (let i = m - k; i < m; i++) s += c[Math.max(i, 0)]; return s / k; };
function run(closes, decide) {
  const acts = [];
  let holding = false;
  for (let m = 0; m < closes.length; m++) {
    const a = decide(m, closes, holding);
    if (a) { acts.push({ month: m, type: a }); if (a === 'buy') holding = true; if (a === 'sell') holding = false; }
  }
  return acts;
}
const strategies = {
  '何もしない（現金のまま）': () => () => null,
  '毎月買う（＝積立と同じ）': () => () => 'buy',
  '3か月ごとにまとめて買う': () => (m) => (m % 3 === 2 ? 'buy' : null),
  'こまめに買い足す（毎月の半分くらい）': (rng) => () => (rng() < 0.5 ? 'buy' : null),
  'ランダムに約20回押す': (rng) => (m, c, h) => (rng() < 20 / 240 ? (h && rng() < 0.5 ? 'sell' : 'buy') : null),
  'ランダムに約60回押す': (rng) => (m, c, h) => (rng() < 60 / 240 ? (h && rng() < 0.5 ? 'sell' : 'buy') : null),
  '人らしい（2〜4か月に1回買い足し、たまに売る）': (rng) => {
    let next = 1 + Math.floor(rng() * 3);
    return (m, c, h) => { if (m < next) return null; next = m + 2 + Math.floor(rng() * 3); return h && rng() < 0.12 ? 'sell' : 'buy'; };
  },
  '下がったら買う（12か月平均より下の月だけ）': () => (m, c) => (m > 0 && c[m - 1] < ma(c, m, 12) ? 'buy' : null),
  '順張り（6か月平均の上なら買い、下なら売る）': () => (m, c, h) => (m === 0 ? 'buy' : c[m - 1] >= ma(c, m, 6) ? 'buy' : h ? 'sell' : null),
};
const OUTCOMES = ['historic', 'rout', 'win', 'draw', 'lose'];
const LABEL = { historic: '歴史的勝利', rout: '圧勝', win: '勝利', draw: '引き分け', lose: '負け' };
const TITLE_NAMES = {
  cash_lover: '現金を愛でる会・会長', one_button: 'ボタンを1回しか押していない人', from_future: '未来から来た人（たぶん偶然）',
  quit_job: '明日から仕事を辞めそうな人', beats_tsumitate: '積立には勝てる男（女）', tired_fingers: '指が疲れた勝者',
  practically_tsumitate: '実質、積立', bottom_sommelier: '底値ソムリエ', chart_talker: 'チャートと会話できる（と思っている）人',
  blame_market: '相場のせいにしていい人', proved_tsumitate: '20年かけて積立の凄さを証明した人',
};
// 称号の割合は、人が遊びそうな5つの遊び方を同じ数ずつ混ぜて数える
const TITLE_MIX = ['ランダムに約20回押す', 'ランダムに約60回押す', '人らしい（2〜4か月に1回買い足し、たまに売る）', 'こまめに買い足す（毎月の半分くらい）', '順張り（6か月平均の上なら買い、下なら売る）'];

const stats = Object.fromEntries(Object.keys(strategies).map((k) => [k, { n: 0, ratio: 0, presses: 0, ...Object.fromEntries(OUTCOMES.map((o) => [o, 0])) }]));
const titles = {};
let titleN = 0;
let tsSum = 0;
const seedRng = mulberry32(20261023);
for (let i = 0; i < RUNS; i++) {
  const seed = Math.floor(seedRng() * 2 ** 32);
  const mk = generateMarket(seed);
  const c = gameCloses(mk);
  const ts = simulateTsumitate(c);
  tsSum += ts.final;
  const rng = mulberry32(seed ^ 0x9e3779b9);
  for (const [name, make] of Object.entries(strategies)) {
    const p = simulatePlayer(c, run(c, make(rng)));
    const j = judge(p, ts);
    const s = stats[name];
    s.n++; s[j.outcome]++; s.ratio += p.final / ts.final; s.presses += p.trades;
    if (name === TITLE_MIX[i % TITLE_MIX.length]) {
      const id = pickTitle(c, mk.scenario, p, j);
      titles[id] = (titles[id] ?? 0) + 1; titleN++;
    }
  }
}
const pct = (a, b) => ((100 * a) / b).toFixed(1) + '%';
console.log(`試行回数: ${RUNS}（毎月10万円・20年。積立の最終資産の平均 ${(tsSum / RUNS / 10000).toFixed(0)}万円、元本 2400万円）\n`);
console.log('## 遊び方ごとの勝敗');
console.log('| 遊び方 | ' + OUTCOMES.map((o) => LABEL[o]).join(' | ') + ' | 勝利以上 | 最終資産（積立＝100） | 平均の押した回数 |');
console.log('| --- |' + ' --- |'.repeat(OUTCOMES.length + 3));
for (const [name, s] of Object.entries(stats)) {
  const winUp = s.historic + s.rout + s.win;
  console.log(`| ${name} | ` + OUTCOMES.map((o) => pct(s[o], s.n)).join(' | ') + ` | ${pct(winUp, s.n)} | ${((100 * s.ratio) / s.n).toFixed(0)} | ${(s.presses / s.n).toFixed(0)} |`);
}
console.log('\n## 称号の出る割合（' + TITLE_MIX.join('・') + ' を同じ数ずつ）');
console.log('| 称号 | 割合 |\n| --- | --- |');
for (const [id, name] of Object.entries(TITLE_NAMES)) console.log(`| ${name} | ${pct(titles[id] ?? 0, titleN)} |`);
