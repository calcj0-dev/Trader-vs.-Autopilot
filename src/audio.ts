// 効果音（設計書 3.8）。素材ファイルは使わず Web Audio で合成する。
// iOS は利用者が触ったときに AudioContext を作り直す・再開する必要がある

import { settings } from './settings';

let ctx: AudioContext | null = null;

/** 最初のタッチ・クリックで呼ぶ。以後は鳴らせるようになる */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

type Tone = {
  freq: number;
  /** 終わりの周波数（音の高さを動かすとき） */
  to?: number;
  type?: OscillatorType;
  /** 開始までの遅れ（秒） */
  at?: number;
  dur: number;
  gain?: number;
};

function play(tones: Tone[]): void {
  if (!settings.sound || !ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  for (const tone of tones) {
    const t0 = now + (tone.at ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = tone.type ?? 'sine';
    osc.frequency.setValueAtTime(tone.freq, t0);
    if (tone.to) osc.frequency.exponentialRampToValueAtTime(tone.to, t0 + tone.dur);
    const peak = tone.gain ?? 0.15;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + tone.dur + 0.02);
  }
}

export const sfx = {
  /** 「買」「売」を押した：カチッ */
  click: () => play([{ freq: 1800, type: 'square', dur: 0.03, gain: 0.05 }]),
  /** 約定：ポン */
  settle: () => play([{ freq: 660, to: 990, dur: 0.12, gain: 0.16 }]),
  /** 終了：ジャーン */
  ending: () =>
    play([
      { freq: 523.25, type: 'triangle', dur: 1.1, gain: 0.12 },
      { freq: 659.25, type: 'triangle', dur: 1.1, gain: 0.1 },
      { freq: 783.99, type: 'triangle', dur: 1.1, gain: 0.1 },
    ]),
  bigWin: () =>
    play([
      { freq: 523.25, dur: 0.14, gain: 0.14 },
      { freq: 659.25, dur: 0.14, at: 0.12, gain: 0.14 },
      { freq: 783.99, dur: 0.14, at: 0.24, gain: 0.14 },
      { freq: 1046.5, dur: 0.5, at: 0.36, gain: 0.16 },
    ]),
  win: () =>
    play([
      { freq: 659.25, dur: 0.14, gain: 0.14 },
      { freq: 987.77, dur: 0.4, at: 0.13, gain: 0.14 },
    ]),
  draw: () => play([{ freq: 587.33, dur: 0.3, gain: 0.12 }]),
  lose: () =>
    play([
      { freq: 392, to: 330, type: 'triangle', dur: 0.25, gain: 0.12 },
      { freq: 330, to: 262, type: 'triangle', dur: 0.45, at: 0.22, gain: 0.12 },
    ]),
};

/** 約定時の振動（対応している端末だけ。iOS では何もしない） */
export function vibrate(ms = 10): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // 対応していなくても遊べる
  }
}
