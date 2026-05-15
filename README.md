# 金属材料カウンター PWA

金属棒材・板材の数量を画像から自動計数するPWAアプリです。

## バージョン管理

### version.js を編集するだけでOK

```js
window.APP_VERSION = {
  version: '1.1.0',       // ← バージョン番号
  build: '20260601',       // ← ビルド日
  releaseDate: '2026-06-01',
  history: [
    { version: '1.1.0', date: '2026-06-01', notes: '管理番号手入力機能を追加' },
    { version: '1.0.0', date: '2026-05-15', notes: '初回リリース' }
  ]
};
```

バージョンを変更したら sw.js の CACHE_NAME も更新してください:
```js
const CACHE_NAME = 'metal-counter-v3'; // v2→v3 のようにインクリメント
```

### GitHub Pages でのデプロイ手順

```bash
git add .
git commit -m "v1.1.0: 管理番号手入力機能追加"
git push origin main
```

GitHub Pages は push 後 数分で反映されます。

## 画面構成

- **計測タブ**: 棒材/板材の計測、全体/分割撮影比較、管理番号入力・保存
- **記録タブ**: 保存した計測記録の一覧、検索、CSV出力
- **設定タブ**: APIキー管理、バージョン情報・更新履歴、データ削除

## 動作環境

| 環境 | 対応ブラウザ | PWA追加 |
|------|------------|---------|
| PC (Windows/Mac) | Chrome, Edge, Firefox, Safari | Chrome/Edge でインストール可能 |
| iPhone (iOS 14+) | Safari 推奨 | Safari の共有→ホーム画面に追加 |
| Android (5.0+) | Chrome 推奨 | Chromeメニュー→アプリをインストール |

## セットアップ

1. GitHub Pages または Netlify/Vercel で HTTPS 公開
2. アプリを開き、設定タブから Anthropic API キーを登録
3. 携帯電話でホーム画面に追加

## ファイル構成

```
metal-counter-pwa/
├── index.html              メイン画面
├── app.js                  アプリロジック
├── version.js              ★ バージョン管理（ここだけ編集）
├── manifest.json           PWA設定
├── sw.js                   Service Worker
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon-maskable-512.png
│   └── apple-touch-icon.png
└── README.md
```
