// T-17 文言の直書きがない：src/ の .ts に日本語の文字列がない（コメントは除く）
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = new URL('../src/', import.meta.url);
const JAPANESE = /[　-ヿ㐀-鿿＀-￯]/;

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return tsFiles(p);
    return p.endsWith('.ts') ? [p] : [];
  });
}

/** コメントを取り除く（文字列の中の // は URL などで使わない前提。URL は JSON に置く） */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('T-17 文言の直書きがない', () => {
  it('src/ の .ts に日本語の文字列がない', () => {
    const dir = decodeURIComponent(SRC.pathname).replace(/^\/([A-Za-z]:)/, '$1');
    const files = tsFiles(dir);
    expect(files.length).toBeGreaterThan(5);
    const found: string[] = [];
    for (const f of files) {
      stripComments(readFileSync(f, 'utf-8'))
        .split('\n')
        .forEach((line, i) => {
          if (JAPANESE.test(line)) found.push(`${f}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(found).toEqual([]);
  });
});
