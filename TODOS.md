# TODOs

Squisher の deferred なフォロー作業。

## Design polish(`/design-review` 2026-05-13 で deferred)

優先度低。視覚的な「あと一歩」の整理。

- [ ] **F-008 polish**: デスクトップでカード(`.app`)を viewport の vertical center に配置。現状は `margin: 32px auto` で top-aligned、画面下半分が空く。`align-items: center; min-height: 100dvh` を `body` 側にする or `@media (min-width: 768px)` 内で `margin-top: max(32px, calc((100dvh - card-height) / 2))` のような handling
- [ ] **F-014**: タイポスケール 14/16px が抜け(12/13/15/17/28 と飛んでいる)。`.btn` 15/16 とラベル系 13/14 を整理し直すと階層がより読める
- [ ] **F-015**: `.badge-reduction` を 12px → 13px / weight 700 に。数値の主役感を上げる
- [ ] **F-017**: `formatBytes` が `FileRow.tsx` と `SaveBar.tsx` で重複。`src/lib/format.ts` に抽出
- [ ] **F-018**: `.arrow` クラスが CSS 未定義(dead code or 定義追加)
- [ ] **F-019**: `.segmented` と `.format-toggle` が 8 割同じ CSS。modifier 化 `.segmented` / `.segmented--mini`
- [ ] **F-020**: `<div class="save-bar">` を `<footer role="contentinfo">` に変更、landmark a11y
- [ ] **F-021**: `.empty-icon` の `accent-soft`(0.08 緑)+ `accent`(緑)コントラストが弱め(desktop 大画面で薄く見える)
- [ ] **F-005 残り**: `components.css` の scale 外 magic number(3, 6, 10, 14, 18, 36 等)を整理 or token 化

## Deferred(third-party)

- Cloudflare bot detection の `/cdn-cgi/content?id=...` 隠れリンク(default blue `#0000EE`)— プロダクト制御外、CF 設定で `Bot Fight Mode` を off にすれば消える可能性

## Phase 6 候補(将来)

- Web Worker への画像処理移行(現状 main thread)
- 動画圧縮(MVP スコープ外)
- iCloud / Files アプリ連携(現状は input + share のみ)
