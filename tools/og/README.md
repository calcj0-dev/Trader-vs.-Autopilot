# OGP 画像とアイコンの作り方

`public/og.png`（1200×630）、`public/icon-192.png`・`icon-512.png`・`apple-touch-icon.png` は、ここの `og.html` と `public/favicon.svg` から作る。
文言（「80秒で遊べる」など）を変えたら作り直す。

```
npm i --no-save playwright-core   # Chrome がインストールされている前提
node tools/og/render_assets.mjs tools/og/og.html public/favicon.svg public
```
