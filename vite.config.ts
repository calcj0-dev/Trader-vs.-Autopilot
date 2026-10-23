import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// バージョンは package.json の1か所で持ち、ビルド時に埋め込む（設計書 6.7）
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

export default defineConfig({
  // どこに置いても動くよう相対パスにする（設計書 6.3）
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
