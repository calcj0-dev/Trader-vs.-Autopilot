// 時間の進め方（設計書 8.1）。ゲームの時間は経過時間で進める（端末の速さで変わらないように）

/** 長く止まった後に一気に進まないよう、1コマの経過はこれで打ち切る */
export const MAX_FRAME_MS = 100;

/**
 * 月の時計。advance(dt) で経過時間を足し、1か月分たまるごとに onMonth を呼ぶ。
 * 描画のための「今月の進み具合」は progress で取る（0〜1）
 */
export class MonthClock {
  private acc = 0;

  constructor(
    private readonly monthMs: number,
    private readonly onMonth: () => boolean,
  ) {}

  /** dt ミリ秒進める。onMonth が false を返したら（終わったら）止める */
  advance(dt: number): void {
    this.acc += Math.min(Math.max(dt, 0), MAX_FRAME_MS);
    while (this.acc >= this.monthMs) {
      this.acc -= this.monthMs;
      if (!this.onMonth()) {
        this.acc = 0;
        return;
      }
    }
  }

  get progress(): number {
    return this.acc / this.monthMs;
  }
}

/** requestAnimationFrame の回し役。止めている間も描画だけは続けられるよう dt を渡す */
export class Ticker {
  private raf = 0;
  private last = 0;
  private running = false;

  constructor(private readonly onFrame: (dt: number) => void) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - this.last, MAX_FRAME_MS);
      this.last = now;
      this.onFrame(dt);
      // onFrame の中で stop() された（画面が切り替わった）ら、次のコマを予約しない
      if (this.running) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}
