// 結果画像 1200×630（設計書 7.12.1）。画面に出さない Canvas に描いて PNG にする

import { config, siteUrl } from '../data';
import { formatMoney } from '../currency';
import type { LastPlay } from '../game/lastResult';
import { t } from '../i18n';
import { compareData, compareStyle, drawCompareOn } from '../ui/chart/compare';

const W = 1200;
const H = 630;
const FONT = 'system-ui, "Hiragino Sans", "Noto Sans JP", sans-serif';
const TEXT = '#1a1f2b';
const SUB = '#6b7385';
const SURFACE = '#f5f7fa';

const OUTCOME_COLOR = {
  big_win: config.colors.gold,
  win: config.colors.up,
  draw: SUB,
  lose: SUB,
} as const;

/** 幅に収まるよう、文字を小さくする（最小 min px） */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, weight: number, min = 18): number {
  let s = size;
  for (; s > min; s -= 2) {
    ctx.font = `${weight} ${s}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) break;
  }
  ctx.font = `${weight} ${s}px ${FONT}`;
  return s;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export async function renderResultImage(play: LastPlay): Promise<Blob | null> {
  try {
    await document.fonts?.ready;
  } catch {
    // フォントの読み込みを待てなくても描く
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { result } = play;
  const o = result.judgement.outcome;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // 左：3本線
  ctx.fillStyle = SURFACE;
  roundRect(ctx, 40, 40, 640, 470, 20);
  ctx.fill();
  ctx.save();
  ctx.translate(40, 40);
  drawCompareOn(ctx, 640, 470, compareData(play), compareStyle, 1, { top: 30, right: 24, bottom: 30, left: 24 });
  ctx.restore();

  // 右：勝敗・一括投資派・称号・3者の金額・売買回数・相場
  const x = 720;
  const right = W - 40;
  const maxW = right - x;
  let y = 60;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = OUTCOME_COLOR[o];
  fitText(ctx, t(`result.outcome.${o}`), maxW, 84, 800);
  ctx.fillText(t(`result.outcome.${o}`), x, y);
  y += 100;

  if (result.judgement.isLumpHolder) {
    ctx.fillStyle = TEXT;
    fitText(ctx, t('result.lumpHolder'), maxW, 24, 500);
    ctx.fillText(t('result.lumpHolder'), x, y);
    y += 38;
  }

  const honor = t('result.honor', { title: t(`honor.${result.title}`) });
  const hs = fitText(ctx, honor, maxW - 32, 26, 700, 16);
  const hw = ctx.measureText(honor).width + 32;
  ctx.fillStyle = config.colors.gold;
  roundRect(ctx, x, y, hw, hs + 18, (hs + 18) / 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(honor, x + 16, y + 9);
  y += hs + 42;

  const rows: [string, number, string][] = [
    [t('result.you'), result.final, config.colors.up],
    [t('result.tsumitate'), result.tsumitate.final, config.colors.tsumitate],
    [t('result.lump'), result.lump.final, config.colors.lump],
  ];
  for (const [label, amount, color] of rows) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y + 16, 26, 5);
    ctx.fillStyle = TEXT;
    ctx.font = `500 26px ${FONT}`;
    ctx.fillText(label, x + 38, y + 4);
    ctx.textAlign = 'right';
    ctx.font = `700 ${label === rows[0]![0] ? 40 : 32}px ${FONT}`;
    ctx.fillText(formatMoney(amount), right, y);
    ctx.textAlign = 'left';
    y += 54;
  }
  y += 6;
  ctx.fillStyle = SUB;
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText(t('image.trades', { trades: result.trades.length }), x, y);
  y += 34;
  fitText(ctx, t('image.scenario', { scenario: t(`scenario.${result.scenario}.name`) }), maxW, 22, 500, 16);
  ctx.fillText(t('image.scenario', { scenario: t(`scenario.${result.scenario}.name`) }), x, y);

  // 下：作品名・URL・免責
  ctx.fillStyle = '#e3e7ed';
  ctx.fillRect(40, 540, W - 80, 1);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = TEXT;
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText(t('image.footerTitle'), 40, 580);
  const titleW = ctx.measureText(t('image.footerTitle')).width;
  ctx.fillStyle = SUB;
  ctx.font = `500 20px ${FONT}`;
  ctx.fillText(siteUrl().replace(/^https?:\/\//, '').replace(/\/$/, ''), 40 + titleW + 20, 582);
  ctx.textAlign = 'right';
  ctx.fillText(t('image.disclaimer'), right, 582);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

const cache = new WeakMap<LastPlay, Promise<Blob | null>>();

/** 1プレイにつき1回だけ作る（結果画面を開いたときに作り始め、シェアのときにすぐ使えるようにする） */
export function resultImage(play: LastPlay): Promise<Blob | null> {
  let p = cache.get(play);
  if (!p) {
    p = renderResultImage(play);
    cache.set(play, p);
  }
  return p;
}
