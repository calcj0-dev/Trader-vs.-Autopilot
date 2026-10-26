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

/**
 * 画像を保存する。スマホは共有シート（「画像を保存」「写真に追加」がある）を開く。
 * iPhone は blob: のURLから画像を保存できないため、新しいタブには出さない。
 * 共有シートが使えなければダウンロード。どれもだめなら M4 の画像を長押しで保存してもらう
 */
export async function saveImage(blob: Blob): Promise<void> {
  if (matchMedia('(pointer: coarse)').matches && canShareImage(blob)) {
    try {
      await navigator.share({ files: [imageFile(blob)] });
      return;
    } catch (e) {
      // 利用者が閉じたときは何もしない。それ以外はダウンロードを試す
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = IMAGE_FILE_NAME;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** 長押しで保存できるよう、画像を data: のURLにする（blob: のURLは iPhone で保存できない） */
export function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
