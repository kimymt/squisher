# Testing — Squisher

100%カバレッジを目指す。テストがあれば速く動ける — 直感を信じて、自信を持って出せる。テストなしの vibe coding はただの yolo coding。テストありなら超能力。

## フレームワーク

- **Vitest** `^4` + **jsdom** — ユニット / コンポーネントテスト（`environment: 'jsdom'`）
- **@testing-library/preact** + **@testing-library/jest-dom** — コンポーネントのレンダリング・操作・DOM マッチャ（`test/setup.ts` で jest-dom 読み込み + jsdom 未実装の `matchMedia` をスタブ）
- **@playwright/test**（chromium）— E2E（実ブラウザでの圧縮・保存・トグル等）

設定: `vitest.config.ts`（`vite.config.ts` とは別ファイル。PWA/SSL プラグインをテスト時に巻き込まないため）、`playwright.config.ts`（chromium + iPhone サイズ/UA、dev server を webServer として使用、`ignoreHTTPSErrors`）。

## 実行

```bash
npm test           # vitest run — ユニット + コンポーネント（CI 用、一度実行して終了）
npm run test:watch # vitest — ウォッチモード
npm run e2e        # playwright test — E2E（dev server を自動起動 or 再利用）
```

## レイヤー

- **ユニットテスト** — `test/*.test.ts`。純粋関数・ストアのロジック（`lib/`, `store/`）。外部依存（DOM クリック、`navigator.share` 等）はモック。
- **コンポーネントテスト** — `test/*.test.tsx`。`@testing-library/preact` で `render` → 操作 → アサート。「描画される」ではなく「何をするか」を検証する。
- **E2E** — `e2e/*.spec.ts`。dev server に対して chromium（iPhone サイズ/UA）で実フロー。`compress.ts` の `createImageBitmap`→Canvas→`toBlob` は実ブラウザでしか動かないのでここで通す。フィクスチャ画像は `e2e/fixtures/`。

現状のテスト（`npm test` 51件・11ファイル + `npm run e2e` 8 spec、全パス）:
- `test/output-format.test.ts` — `detectOutputFormat` / `mimeFor` / `extFor`
- `test/signals.test.ts` — `totalCompressedSize` / `saveableFiles` / `canSave`（`skipLarger × larger` の分岐）、`totalOriginalSize`、`addFiles`（saveError クリア）/ `updateFile` / `nextId`
- `test/install.test.ts` — `shouldOfferInstall`（非iOS / iOS / standalone / dismiss）、`dismissInstallBanner`（storage 失敗時）
- `test/share.test.ts` — `isShareSupported`、`shareFiles`（unsupported / canShare false / shared(files only) / AbortError→cancelled / その他→failed）、`downloadFile`
- `test/presets.test.ts` — プリセットの順序・各値の不変条件
- `test/result.test.ts` — `ok` / `err`
- `test/Header.test.tsx` / `test/FileRow.test.tsx` / `test/SaveBar.test.tsx` / `test/InstallBanner.test.tsx` — 各コンポーネント
- `test/app-preset.regression-1.test.ts` — 回帰: プリセット変更で全ファイル再圧縮（`/qa` ISSUE-001）
- `e2e/squisher.spec.ts` — golden path、複数ファイル、拡張子ヒューリスティック、プリセット再圧縮、行内フォーマットトグル、サイズ増スキップ、共有キャンセル→再共有、InstallBanner（各 spec でコンソール/ページエラー 0 をアサート）

実機が要るもの（端末待ち、テスト未自動化）: HEIC 自動 JPEG 変換、`navigator.share` の実シート、ダウンロードフォールバックの iOS 挙動、standalone モード、ダークモード目視、「最短2タップ / 10ファイル25-30秒」測定。

## 規約

- ファイル名: `test/<対象>.test.ts`（または `.tsx`）。回帰テストは `<対象>.regression-<n>.test.ts`。
- アサーション: `expect(...).toBe(...)` など Vitest 標準。`describe` / `it` / `expect` は `vitest` から明示 import（globals は無効）。
- セットアップ/ティアダウン: 共有モジュール状態（`files` シグナル等）は `beforeEach` でリセット。`navigator` / `localStorage` のオーバーライドは `afterEach` で戻す。
- テストにシークレット・API キーを import しない。
- `expect(x).toBeDefined()` で済ませない。コードが**何をするか**をアサートする。
