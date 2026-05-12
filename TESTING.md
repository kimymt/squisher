# Testing — Squisher

100%カバレッジを目指す。テストがあれば速く動ける — 直感を信じて、自信を持って出せる。テストなしの vibe coding はただの yolo coding。テストありなら超能力。

## フレームワーク

- **Vitest** `^4` — テストランナー（Vite の設定を共有、Preact JSX をそのまま変換）
- **jsdom** — DOM 環境（`environment: 'jsdom'`）
- **@testing-library/preact** — コンポーネントのレンダリング・操作
- **@testing-library/jest-dom** — `toBeInTheDocument()` などの DOM マッチャ（`test/setup.ts` で読み込み）

設定: `vitest.config.ts`（`src` の `vite.config.ts` とは別ファイル。PWA/SSL プラグインを巻き込まないため）。

## 実行

```bash
npm test           # vitest run — 一度実行して終了（CI 用）
npm run test:watch # vitest — ウォッチモード
```

## レイヤー

- **ユニットテスト** — `test/*.test.ts`。純粋関数・ストアのロジック（`lib/`, `store/`）。外部依存（DOM クリック、`navigator.share` 等）はモック。
- **コンポーネントテスト** — `test/*.test.tsx`。`@testing-library/preact` で `render` → 操作 → アサート。「描画される」ではなく「何をするか」を検証する。
- **E2E** — 未着手（Phase 5 で Playwright）。

現状のテスト:
- `test/output-format.test.ts` — `detectOutputFormat` / `mimeFor` / `extFor`
- `test/signals.test.ts` — `totalCompressedSize` / `saveableFiles` / `canSave`（`skipLarger` と `larger` の分岐）、`addFiles` / `updateFile` / `nextId`
- `test/install.test.ts` — `shouldOfferInstall`（iOS / standalone / dismiss の分岐）、`dismissInstallBanner`（storage 失敗時）

## 規約

- ファイル名: `test/<対象>.test.ts`（または `.tsx`）。回帰テストは `<対象>.regression-<n>.test.ts`。
- アサーション: `expect(...).toBe(...)` など Vitest 標準。`describe` / `it` / `expect` は `vitest` から明示 import（globals は無効）。
- セットアップ/ティアダウン: 共有モジュール状態（`files` シグナル等）は `beforeEach` でリセット。`navigator` / `localStorage` のオーバーライドは `afterEach` で戻す。
- テストにシークレット・API キーを import しない。
- `expect(x).toBeDefined()` で済ませない。コードが**何をするか**をアサートする。
