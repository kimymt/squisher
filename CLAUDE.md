# Squisher

iPhone向けPWA画像圧縮アプリ。iPhone 写真(HEIC由来 JPEG / 直接 JPEG / PNG) → JPEG/WebP、完全ローカル処理(サーバーなし)、3段階品質(変更で全ファイル再圧縮)、行ごとに JPEG/WebP 切替、複数ファイル一括処理(iOS は直列1 / 非iOS は最大3並列)、サイズ増スキップ、Web Share API で「写真」に保存(失敗時はインライン通知 + ダウンロード fallback)、PWA(ホーム画面追加バナー)。

スタック: Vite 6 + TS + Preact + @preact/signals、圧縮は native Canvas `toBlob`(依存ゼロ)、PWA は `vite-plugin-pwa`。実装プランと進捗は `PLAN.md`、概要と開発手順は `README.md`。

**重要:** iOS Safari は `<input type="file">` 経由で HEIC を自動的に JPEG にデコードしてアプリへ渡すため、アプリは HEIC を直接扱わない(`decode-heic.ts` 不要)。HEIC のままの圧縮は WebKit の制約により不可能。

## Design System

Always read `DESIGN.md` before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

主要な制約(`DESIGN.md` 参照、ここは要点):
- **タイポ**: UI全般は `-apple-system, ..., 'SF Pro Display'` 経由でSF Pro。数値だけ `ui-monospace` 経由で SF Mono(iOS/macOS)
- **アクセント色**: `#30694B`(苔緑)。**iOS Blue `#007AFF` は絶対に使わない**
- **線形プログレスバーは使用禁止**(円形スピナーのみ)
- **Before/After比較スライダーは採用しない**(数値の遷移が主役)

## Testing

- 実行: `npm test`（Vitest、ユニット+コンポーネント、`test/`）/ `npm run e2e`（Playwright、`e2e/`、dev server を自動起動）。詳細は `TESTING.md`。
- フレームワーク: Vitest + jsdom + @testing-library/preact（設定 `vitest.config.ts`、`vite.config.ts` とは別）、@playwright/test（chromium、設定 `playwright.config.ts`）。`compress.ts` は jsdom に canvas が無いので E2E が実ブラウザで通す。
- 期待値:
  - 100% カバレッジを目指す — テストが vibe coding を安全にする
  - 新しい関数を書いたら対応するテストも書く
  - バグを直したら回帰テストを書く
  - エラーハンドリングを足したら、そのエラーを発火させるテストを書く
  - 条件分岐（if/else, switch）を足したら、両方の経路をテストする
  - 既存テストを落とすコードはコミットしない

## Deploy Configuration (configured by /setup-deploy)
- Platform: Cloudflare Pages（静的 PWA、`dist/` をホスト）。GitHub repo: `https://github.com/kimymt/squisher`（public、ブランチ `master`）
- Production URL(主軸): `https://squisher.mymt.casa`(カスタムドメイン、Cloudflare Pages 経由)
- Production URL(alias): `https://squisher.pages.dev`(CF 自動付与、こちらも生きている)
- Deploy workflow: Cloudflare Pages の **Git 連携**(`master` への push で CF が `npm run build` → `dist/` を auto-deploy、PR ブランチはプレビュー)。CF ダッシュボードで Git 連携設定済み、`master` push → 30〜90 秒で本番反映。
- Deploy status command: HTTP ヘルスチェック
- Merge method: `master` への push が production。PR を使うなら squash 推奨（CI `.github/workflows/test.yml` が push/PR で走る）。
- Project type: web app（static PWA、ルート `/` のみ。クライアントルーティングなし → SPA fallback の `_redirects` は不要）
- Post-deploy health check: `https://squisher.mymt.casa/` と `https://squisher.pages.dev/` 両方が 200、`/manifest.webmanifest` が 200、`/sw.js` が 200

### Custom deploy hooks
- Pre-merge / pre-deploy: `npm test && npm run build`（任意で `npm run e2e` も — dev server を起動するので少し遅い。CI は全部やる）
- Deploy trigger: `master` への push(Git 連携で auto-deploy)
- Deploy status: production URL を polling（新しいビルドが返るまで）
- Health check: 上記の3 URL（200）

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
