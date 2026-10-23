// 結果の3本線（設計書 5.8）：あなた（赤・太、売買の印）、積立（緑）、一括放置（灰・点線）。背景にローソク足を薄く

import type { Candle, Trade } from '../../core/types';

export type CompareData = {
  you: number[];
  tsumitate: number[];
  lump: number[];
  trades: Trade[];
  /** ゲーム期間のローソク足（背景に薄く描く。縦軸は別に合わせる） */
  candles: Candle[];
};

export type CompareStyle = {
  you: string;
  tsumitate: string;
  lump: string;
  up: string;
  down: string;
  grid: string;
};

/**
 * 描く。t（0〜1）は左から何割まで描くか（演出用）。
 * 大きさは canvas の表示サイズに合わせ、devicePixelRatio（最大2）倍で描く
 */
export function drawCompare(canvas: HTMLCanvasElement, d: CompareData, s: CompareStyle, t = 1): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { width: W, height: H } = canvas.getBoundingClientRect();
  if (canvas.width !== Math.round(W * dpr)) canvas.width = Math.round(W * dpr);
  if (canvas.height !== Math.round(H * dpr)) canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  drawCompareOn(ctx, W, H, d, s, t);
}

/** 結果画像（1200×630）でも同じ図を描けるよう、描く先と大きさを受け取る版 */
export function drawCompareOn(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  d: CompareData,
  s: CompareStyle,
  t = 1,
  pad = { top: 12, right: 10, bottom: 12, left: 10 },
): void {
  const n = d.you.length;
  if (n < 2) return;
  const upto = Math.max(1, Math.floor((n - 1) * Math.min(Math.max(t, 0), 1)));
  const xOf = (i: number) => pad.left + (i / (n - 1)) * (W - pad.left - pad.right);

  // 背景のローソク足（独自の縦軸）
  let cLo = Infinity;
  let cHi = -Infinity;
  for (const k of d.candles) {
    cLo = Math.min(cLo, k.l);
    cHi = Math.max(cHi, k.h);
  }
  const cy = (v: number) => pad.top + (1 - (v - cLo) / (cHi - cLo)) * (H - pad.top - pad.bottom);
  const bw = Math.max(1, ((W - pad.left - pad.right) / n) * 0.6);
  ctx.globalAlpha = 0.14;
  d.candles.forEach((k, i) => {
    if (i > upto) return;
    ctx.fillStyle = k.c >= k.o ? s.up : s.down;
    const top = cy(Math.max(k.o, k.c));
    ctx.fillRect(xOf(i) - bw / 2, top, bw, Math.max(1, cy(Math.min(k.o, k.c)) - top));
  });
  ctx.globalAlpha = 1;

  // 3本線の縦軸
  let lo = Infinity;
  let hi = -Infinity;
  for (const arr of [d.you, d.tsumitate, d.lump]) for (const v of arr) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const span = hi - lo || hi * 0.1 || 1;
  lo -= span * 0.06;
  hi += span * 0.06;
  const yOf = (v: number) => pad.top + (1 - (v - lo) / (hi - lo)) * (H - pad.top - pad.bottom);

  const line = (arr: number[], color: string, width: number, dash: number[] = []) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash);
    ctx.beginPath();
    for (let i = 0; i <= upto; i++) (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, xOf(i), yOf(arr[i]!));
    ctx.stroke();
    ctx.restore();
  };
  line(d.lump, s.lump, 2, [5, 4]);
  line(d.tsumitate, s.tsumitate, 2);
  line(d.you, s.you, 3);

  // あなたの線に売買の印
  for (const tr of d.trades) {
    if (tr.month > upto) continue;
    const x = xOf(tr.month);
    const y = yOf(d.you[tr.month]!);
    const z = 5;
    ctx.fillStyle = tr.type === 'buy' ? s.up : s.down;
    ctx.beginPath();
    if (tr.type === 'buy') {
      ctx.moveTo(x, y + 4);
      ctx.lineTo(x - z, y + 4 + z * 1.4);
      ctx.lineTo(x + z, y + 4 + z * 1.4);
    } else {
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x - z, y - 4 - z * 1.4);
      ctx.lineTo(x + z, y - 4 - z * 1.4);
    }
    ctx.closePath();
    ctx.fill();
  }
}
