// T-19 言語ファイルの過不足：キーが足りない言語 JSON は型エラーになる。
// このファイルは型チェック（npm run typecheck / build）で確かめる。
// 下の @ts-expect-error が「エラーが出なかった」場合は、型チェックそのものが失敗する

import type { Messages } from '../src/i18n/types';
import missing from './fixtures/ja-missing-key.json';

// @ts-expect-error キーが足りない JSON は Messages を満たさない
export const broken = missing satisfies Messages;
