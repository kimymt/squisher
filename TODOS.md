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

`master` 11 commits + bugfix v1/v2 で本番反映済み。

## Deferred(third-party)

- Cloudflare bot detection の `/cdn-cgi/content?id=...` 隠れリンク(default blue `#0000EE`)— プロダクト制御外、CF 設定で `Bot Fight Mode` を off にすれば消える可能性

## Phase 6 候補(将来)

- Web Worker への画像処理移行(現状 main thread)
- 動画圧縮(MVP スコープ外)
- iCloud / Files アプリ連携(現状は input + share のみ)
