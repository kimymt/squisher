# TODOs

Squisher の deferred なフォロー作業。

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
- F-005 完全達成: 残る scale 外 magic number(2/3/6/10/13/14/18/22/28/36/56)も「意図的」なものとコメント明記、もしくは新 token 化(過剰整理にならない範囲で)
