// プレイ中のローソク足・折れ線（設計書 4.7・5.7）。Canvas 1枚に毎コマ全部描き直す

import type { Candle, TradeType } from '../../core/types';
import type { ChartMode } from '../../settings';

export type ChartMark = { index: number; type: TradeType };

export type ChartFrame = {
  candles: Candle[];
  /** 助走の本数（これより前は薄く描く） */
  preMonths: number;
  /** いま伸びているローソク足の番号（candles の添字）。これより後は描かない */
  current: number;
  /** 今月の進み具合 0〜1。null なら今月の足はまだ描かない（カウントダウン中） */
  progress: number | null;
  mode: ChartMode;
  marks: ChartMark[];
  buyPrice: number | null;
  visible: number;
};

export type ChartStyle = {
  up: string;
  down: string;
  line: string;
  text: string;
  buyLabel: string;
  sellLabel: string;
};

/** 今月の足の、進み具合 p（0〜1）での形と値段（設計書 4.7） */
export function partialCandle(k: Candle, p: number): { candle: Candle; price: number } {
  const pts = k.c >= k.o ? [k.o, k.l, k.h, k.c] : [k.o, k.h, k.l, k.c];
  const t = Math.min(Math.max(p, 0), 1) * 3;
  const seg = Math.min(Math.floor(t), 2);
  const price = pts[seg]! + (pts[seg + 1]! - pts[seg]!) * (t - seg);
  const reached = pts.slice(0, seg + 1).concat(price);
  return { candle: { o: k.o, c: price, h: Math.max(...reached), l: Math.min(...reached) }, price };
}

const PAD_TOP = 28;
const PAD_BOTTOM = 26;
/** 縦軸は毎コマ目標へこの割合ずつ近づける（急に縮むと見づらいため） */
const SCALE_EASE = 0.2;

export class CandleChart {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private scale: { min: number; max: number } | null = null;
  private readonly observer: ResizeObserver;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly style: ChartStyle,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
  }

  dispose(): void {
    this.observer.disconnect();
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw(f: ChartFrame): void {
    const { ctx, width: W, height: H } = this;
    ctx.clearRect(0, 0, W, H);
    if (W === 0 || H === 0) return;

    const slot = W / f.visible;
    const slide = f.progress ?? 0;
    const xOf = (i: number) => W - slot / 2 - slot * (f.current + slide - i);

    // 描く足（今月の足は進み具合に合わせて作る）
    const items: { i: number; k: Candle }[] = [];
    const first = Math.max(0, Math.floor(f.current - f.visible - 1));
    for (let i = first; i <= f.current && i < f.candles.length; i++) {
      if (i === f.current) {
        if (f.progress === null) continue;
        const pc = partialCandle(f.candles[i]!, f.progress);
        items.push({ i, k: pc.candle });
      } else {
        items.push({ i, k: f.candles[i]! });
      }
    }
    const shown = items.filter(({ i }) => xOf(i) > -slot && xOf(i) < W + slot);
    if (shown.length === 0) return;

    // 縦軸：表示中の安値〜高値に合わせて伸縮
    let lo = Infinity;
    let hi = -Infinity;
    for (const { k } of shown) {
      lo = Math.min(lo, k.l);
      hi = Math.max(hi, k.h);
    }
    if (f.buyPrice !== null) {
      lo = Math.min(lo, f.buyPrice);
      hi = Math.max(hi, f.buyPrice);
    }
    const pad = (hi - lo) * 0.08 || hi * 0.01;
    const target = { min: lo - pad, max: hi + pad };
    if (!this.scale) this.scale = target;
    else {
      this.scale.min += (target.min - this.scale.min) * SCALE_EASE;
      this.scale.max += (target.max - this.scale.max) * SCALE_EASE;
    }
    const { min, max } = this.scale;
    const yOf = (v: number) => PAD_TOP + (1 - (v - min) / (max - min)) * (H - PAD_TOP - PAD_BOTTOM);

    // 買値の点線
    if (f.buyPrice !== null) {
      ctx.save();
      ctx.strokeStyle = this.style.text;
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      const y = Math.round(yOf(f.buyPrice)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.restore();
    }

    if (f.mode === 'line') this.drawLine(shown, xOf, yOf, f.preMonths);
    else this.drawCandles(shown, xOf, yOf, slot, f.preMonths);

    // 売買の印：買は足の下に▲、売は上に▼
    const byIndex = new Map(shown.map((s) => [s.i, s.k]));
    for (const m of f.marks) {
      const k = byIndex.get(m.index);
      if (!k) continue;
      this.drawMark(m.type, xOf(m.index), m.type === 'buy' ? yOf(k.l) + 6 : yOf(k.h) - 6);
    }
  }

  private drawCandles(
    items: { i: number; k: Candle }[],
    xOf: (i: number) => number,
    yOf: (v: number) => number,
    slot: number,
    preMonths: number,
  ): void {
    const { ctx } = this;
    const bodyW = Math.max(2, slot * 0.6);
    for (const { i, k } of items) {
      const color = k.c >= k.o ? this.style.up : this.style.down;
      const x = xOf(i);
      ctx.globalAlpha = i < preMonths ? 0.4 : 1;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, yOf(k.h));
      ctx.lineTo(Math.round(x) + 0.5, yOf(k.l));
      ctx.stroke();
      const top = yOf(Math.max(k.o, k.c));
      const bottom = yOf(Math.min(k.o, k.c));
      ctx.fillRect(x - bodyW / 2, top, bodyW, Math.max(1, bottom - top));
    }
    ctx.globalAlpha = 1;
  }

  private drawLine(
    items: { i: number; k: Candle }[],
    xOf: (i: number) => number,
    yOf: (v: number) => number,
    preMonths: number,
  ): void {
    const { ctx } = this;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = this.style.text;
    // 助走は薄く、ゲーム期間は濃く
    for (const [alpha, part] of [
      [0.35, items.filter(({ i }) => i < preMonths + 1)],
      [1, items.filter(({ i }) => i >= preMonths)],
    ] as const) {
      if (part.length < 2) continue;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      part.forEach(({ i, k }, n) => (n === 0 ? ctx.moveTo(xOf(i), yOf(k.c)) : ctx.lineTo(xOf(i), yOf(k.c))));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawMark(type: TradeType, x: number, y: number): void {
    const { ctx } = this;
    const color = type === 'buy' ? this.style.up : this.style.down;
    const s = 6;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (type === 'buy') {
      ctx.moveTo(x, y);
      ctx.lineTo(x - s, y + s * 1.4);
      ctx.lineTo(x + s, y + s * 1.4);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x - s, y - s * 1.4);
      ctx.lineTo(x + s, y - s * 1.4);
    }
    ctx.closePath();
    ctx.fill();
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = type === 'buy' ? 'top' : 'bottom';
    ctx.fillText(type === 'buy' ? this.style.buyLabel : this.style.sellLabel, x, type === 'buy' ? y + s * 1.4 + 2 : y - s * 1.4 - 2);
  }
}
