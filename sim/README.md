# sim：価格モデルと計算の参照実装

## 毎月10万円の形（v1.4・Q15。今のルール）
- `monthly.mjs` … 資産の計算（毎月10万円を受け取る・買い足し）、積立、元本、勝敗（歴史的勝利・圧勝・勝利・引き分け・負け）、称号の判定。相場の作り方は `model.mjs` をそのまま使う。**実装（`src/core/`）と食い違う場合はこちらが正**
- `monthly_simulate.mjs` … 遊び方ごとの勝敗の分かれ方と、称号の出る割合を試算する
- `monthly_result_10000.md` … 10,000相場での試算結果（設計書 4.10・3.7 の表の元）

```
node monthly_simulate.mjs 10000
```

## 相場の作り方（今も使う）
- `model.mjs` … 相場の生成（シナリオ・ローソク足）。04_価格モデルと計算仕様.md と同じ内容で、食い違う場合はこちらが正

## 100万円スタートのとき（v1.3 まで。参考として残す）
- `model.mjs` の資産の計算・勝敗・称号の部分（`simulatePlayer`・`simulateTsumitate`・`simulateLumpSum`・`judge`・`pickTitle`）
- `simulate.mjs` … 戦略別・シナリオ別の勝利／大勝利の割合を試算する
- `result_20000.md` … 20,000相場での試算結果
- `titles_check.mjs` / `titles_20000.md` … 称号の出る割合の試算

実行（Node.js 18以降）：
```
node simulate.mjs 20000
```
