# Squisher

iPhone 向け PWA 画像圧縮アプリ。iPhone の写真(HEIC 由来 JPEG / 直接 JPEG / PNG)を JPEG / WebP に再圧縮して「写真」アプリへ保存する。**完全ローカル処理(サーバーなし)**。

- 3 段階品質プリセット(高品質 3840px@85% / 標準 2560px@75% / 強力圧縮 1920px@60%)。プリセットを変えると処理済みのファイルも再圧縮される
- 行ごとに JPEG ↔ WebP を切替(既定: PNG → WebP / それ以外 → JPEG)
- 複数ファイル一括処理(iOS は直列 1、非 iOS は最大 3 並列)
- サイズが増えたファイルは保存からスキップ(トグルで無効化可)
- Web Share API で「写真」へ保存。失敗時はインライン通知 + ダウンロードにフォールバック
- iOS Safari の PWA(ホーム画面に追加。初回圧縮後に追加手順のバナーを表示)

> **HEIC について:** iOS Safari は `<input type="file">` 経由で HEIC を自動的に JPEG にデコードしてアプリへ渡す。よって Squisher は受け取った JPEG / PNG を再圧縮するツールで、HEIC を直接は扱わない(`decode-heic.ts` は不要)。HEIC のままの圧縮は WebKit の制約により不可能。

対象: iOS 16.4+(Web Share API での files 共有が PWA standalone で安定する最低バージョン)。

## 開発

```bash
npm install
npm run dev      # https://localhost:5173/ (自己署名証明書 — 初回は警告を許可)
npm run build    # tsc + vite build → dist/  (Service Worker / manifest / アイコン precache を生成)
npm run preview  # dist/ をローカルプレビュー

npm test         # Vitest — ユニット + コンポーネント
npm run test:watch
npm run e2e       # Playwright — E2E(dev server を自動起動/再利用)
```

実機テスト: `https://<LAN-IP>:5173/` を iPhone の Safari で開く(初回は自己署名証明書の警告を許可)。

## 構成

- `index.html` — apple-touch-icon / `apple-mobile-web-app-*` メタ。`manifest` と `registerSW` は `vite-plugin-pwa` が注入
- `vite.config.ts` — preact + basic-ssl(dev HTTPS)+ VitePWA(manifest をインライン定義)
- `vitest.config.ts` — テスト専用(preact のみ、jsdom、`test/setup.ts`)/ `playwright.config.ts` — chromium + iPhone サイズ・UA
- `public/icons/` — `apple-touch-icon.png`(180)、`icon-192/512.png`、`icon-512-maskable.png`、`icon.svg`
- `src/`
  - `main.tsx` — エントリ / `app.tsx` — ルート + `handleFiles` / `changeOutputFormat` / `changePreset` / `handleSave` / `compressOne` / `runPool`
  - `lib/` — `compress.ts`(`createImageBitmap` → Canvas → `toBlob`、`makeThumbnail`)/ `presets.ts` / `share.ts` / `output-format.ts` / `install.ts` / `result.ts` / `types.ts`
  - `components/` — `Header` / `EmptyCard` / `FileRow` / `SaveBar` / `Spinner` / `InstallBanner`
  - `store/signals.ts` — `@preact/signals`(`files` / `preset` / `skipLarger` / `saveError` / `showInstallBanner` + computed)
  - `styles/` — `tokens.css`(`DESIGN.md` 由来)/ `base.css` / `components.css`
- `test/` — Vitest のユニット・コンポーネント・回帰テスト / `e2e/` — Playwright スペック + フィクスチャ画像
- `.github/workflows/test.yml` — push / PR で `npm ci → npm test → npm run build → npm run e2e`

## ドキュメント

- [`PLAN.md`](PLAN.md) — 実装プランと進捗(Phase 0–5)、Decisions Log、開かれた質問
- [`DESIGN.md`](DESIGN.md) — デザインシステム(タイポ / 色 / スペーシング / モーション / アンチパターン)。**UI を触る前に必ず読む**
- [`TESTING.md`](TESTING.md) — テスト方針・実行方法・現状のテスト一覧
- [`CLAUDE.md`](CLAUDE.md) — このリポジトリで作業するエージェント向けの指示
