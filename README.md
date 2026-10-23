# 積立投資を超えろ！ ― 100万円・20年トレードチャレンジ（Trader vs. Autopilot）

100万円・20年分の架空の相場を80秒で売買して、積立投資に勝てるかを試すブラウザゲーム（BAKA-016）。

- 設計：[docs/設計書.md](docs/設計書.md)
- 進捗：[docs/ロードマップ.md](docs/ロードマップ.md)
- 参照実装：[sim/](sim/)（価格モデル・計算。実装と食い違う場合はこちらが正）

## 開発
Node.js 24 以降。

```
npm install
npm run dev        # 開発サーバー
npm test           # テスト
npm run build      # 型チェック＋ビルド（dist/）
```

- ゲームのデータは `src/data/` の JSON で持つ（設計書 6.6）
- バージョンは `package.json` の `version` で持ち、タイトル画面の右上に出る（設計書 6.7）

本作はゲームであり投資助言ではありません。相場は架空です。
