// 回し役（Ticker）：コマの中で止めたら、次のコマを予約しない
// （以前は止めた直後に次のコマを予約してしまい、結果画面が毎コマ作り直されて表示されなかった）
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Ticker } from '../src/game/loop';

afterEach(() => vi.unstubAllGlobals());

function fakeFrames() {
  const queue = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    queue.set(++id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (h: number) => queue.delete(h));
  let now = 0;
  return {
    /** 予約されているコマを1つずつ n 回まで進める */
    run(n: number) {
      for (let i = 0; i < n && queue.size > 0; i++) {
        const [h, cb] = queue.entries().next().value!;
        queue.delete(h);
        now += 16;
        cb(now);
      }
    },
    get pending() {
      return queue.size;
    },
  };
}

describe('Ticker', () => {
  it('コマの中で stop() したら、それ以上呼ばれない', () => {
    const f = fakeFrames();
    let calls = 0;
    const ticker = new Ticker(() => {
      calls++;
      if (calls === 3) ticker.stop();
    });
    ticker.start();
    f.run(10);
    expect(calls).toBe(3);
    expect(f.pending).toBe(0);
  });

  it('外から stop() しても止まる。もう一度 start() できる', () => {
    const f = fakeFrames();
    let calls = 0;
    const ticker = new Ticker(() => calls++);
    ticker.start();
    f.run(2);
    ticker.stop();
    f.run(5);
    expect(calls).toBe(2);
    ticker.start();
    f.run(2);
    expect(calls).toBe(4);
  });
});
