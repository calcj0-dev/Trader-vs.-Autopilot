// シェア（設計書 7.12.2）。スマホは Web Share（画像つき）、それ以外は X の投稿画面

import { config, shareUrl } from '../data';

export const IMAGE_FILE_NAME = 'tsumitate-result.png';

export function imageFile(blob: Blob): File {
  return new File([blob], IMAGE_FILE_NAME, { type: 'image/png' });
}

/** 画像つきで Web Share できる端末か */
export function canShareImage(blob: Blob | null): boolean {
  if (!blob || typeof navigator.canShare !== 'function' || typeof navigator.share !== 'function') return false;
  try {
    return navigator.canShare({ files: [imageFile(blob)] });
  } catch {
    return false;
  }
}

/** X の投稿画面を新しいタブで開く（画像は付かない） */
export function openXIntent(text: string): void {
  // 空白は + ではなく %20 にする（X の投稿画面で確実に空白として扱われるように）
  const q = `text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl())}`;
  window.open(`${config.links.xIntent}?${q}`, '_blank', 'noopener');
}

/** Web Share（画像＋投稿文＋URL）。共有先は利用者が選ぶ。中止したときは false */
export async function shareWithImage(text: string, blob: Blob): Promise<boolean> {
  try {
    await navigator.share({ files: [imageFile(blob)], text: `${text} ${shareUrl()}` });
    return true;
  } catch {
    return false;
  }
}

/** 画像を保存する。ダウンロードできない端末は、新しいタブに画像を出して長押しで保存してもらう */
export function saveImage(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = IMAGE_FILE_NAME;
  const supportsDownload = 'download' in a && !/iPhone|iPad|iPod/.test(navigator.userAgent);
  if (supportsDownload) {
    document.body.append(a);
    a.click();
    a.remove();
  } else {
    window.open(url, '_blank', 'noopener');
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
