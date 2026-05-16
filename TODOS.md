# TODOs

Squisher の deferred なフォロー作業。

## Done(2026-05-13、F-005 完全達成 / post-restore session)

`/context-restore` で前 checkpoint を引き継ぎ、components.css の scale 外 magic number(2/3/6/10/13/14/18/22/28/36/56)を方針通り処理:

**新規 token(tokens.css)6 件:**
- 型スケール(DESIGN.md §Typography 準拠): `--text-2xs: 12px`, `--text-xs: 13px`, `--text-sm: 14px`, `--text-title: 28px`
- sub-spacing(rail/baseline 用、4px scale とは別概念で明示): `--space-3xs: 2px`
- コンポーネントサイズ: `--size-thumb: 56px`(empty-icon + file-thumb 共用)

**components.css 置換 ~25 箇所:**
- font-size 13/14/12/28 → token
- 構造的 2px → `--space-3xs`、4px ストライプ → `--space-2xs`、56px サムネ → `--size-thumb`

**意図コメント追加 ~8 箇所(one-off literal):**
- 36px add-more-btn(< HIG 44 の secondary affordance)
- 3px segmented outer padding(rail nesting)
- 10/12 seg-item inner padding(iOS native 値)
- 0.5px sub-pixel hairline(retina 専用)
- -4px / 2px glyph baseline correction
- 32px install-banner-close(secondary)
- switch geometry 44/26/22/2/18(HIG 派生、互いに連動)
- 16px / 13px 22px btn(Body + iOS form-zoom 防止 + ≥44 hit height)
- Spinner 20/2px/0.8s(DESIGN.md §Indicators ロック)
- 6px format-toggle(iOS half-step、4 too tight / 8 too loose)

`npm test` 63 件 pass、`npm run build` clean(CSS 9.58 KB gzip 2.63 KB)。

## Done(2026-05-13、第2回 `/design-review`)

第1回 `/design-review` の deferred polish 全 9 件 + bugfix を完了:
- F-008 polish(desktop card の vertical center)
- F-014 typo 16px 導入
- F-015 badge 13/700
- F-017 `lib/format.ts` 抽出
- F-018 `.arrow` クラス定義
- F-019 `.segmented` / `.format-toggle` CSS セレクタ集約
- F-020 SaveBar `<footer role="contentinfo">`
- F-021 `--accent-soft` 0.08 → 0.12
- F-005 残: components.css の scale 内 magic number を全 token 化

`main` 11 commits + bugfix v1/v2 で本番反映済み。

## Deferred(third-party)

- Cloudflare bot detection の `/cdn-cgi/content?id=...` 隠れリンク(default blue `#0000EE`)— プロダクト制御外、CF 設定で `Bot Fight Mode` を off にすれば消える可能性

## Phase 6 — 圧縮スループット改善(2026-05-16)

### ✅ Done — Tier 1 PR1: main-thread dynamic concurrency(PR #6 merged)
- `src/lib/concurrency.ts`、iOS で file.size > 8 MB なら 1、それ以外 2、非 iOS 3
- 実機 QA で UI 凍結「許容可」判定 → Tier 1 PR2(Worker)は不要に確定

### ✅ Done — Tier 2: eager thumbnails(PR #7 merged)
- `src/lib/thumbnail.ts`、選択直後に全 thumb を `createImageBitmap(file, { resizeWidth: 112 })` で並列生成
- compress.ts から thumb 生成ロジックを除去、関心の分離

### 🟡 進行中 — Tier 3: `createImageBitmap` の resize オプションで decode 高速化
- `createImageBitmap(file, { resizeWidth: preset.maxDimension, resizeQuality: 'high' })` で 1 段 pixel pass へ
- 期待: per file ~10-15% 短縮(12 MP standard で ~580ms → ~500ms)、特に 48 MP source で大幅短縮

### 既存の Phase 6 候補(他)
- 動画圧縮(MVP スコープ外)
- iCloud / Files アプリ連携(現状は input + share のみ)

### 不採用となった候補
- **Tier 1 PR2(Worker + OffscreenCanvas)**: PR1 の実機検証で UI 凍結許容可 → 不要、将来 50 MP+ 標準化 or 100+ 枚バッチが要件になったら再検討
- **Tier 4(preset 全 3 種を初回並行生成)**: 必要性が薄い、スキップ
- **Tier 5(モジュール preload + critical CSS)**: 初回起動のみ ~50ms 改善、PWA 化後は無感、スキップ
- **Tier 6(File オブジェクトを完了時に pre-build)**: Save タップで ~10ms 削るが体感不可、スキップ
