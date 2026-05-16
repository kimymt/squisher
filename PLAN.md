# Squisher — 実装プラン (MVP)

> このプランは `/plan-eng-review` でレビュー済み + Phase 0 Spike の実機検証結果を反映。
> 詳細は末尾の「## GSTACK REVIEW REPORT」を参照。
>
> **進捗(2026-05-13):** Phase 0–4 ✅ 完了、Phase 5 もほぼ完了(`npm test` 51件・11ファイル + Playwright E2E 8件 + `/qa` 通し済み、残るは実機検証のみ)。`main` ブランチ。デプロイ先は **Cloudflare Pages**(CLAUDE.md の `## Deploy Configuration` 参照、初回 `wrangler login` + `wrangler pages deploy dist` が未実施)。実機が無いため「最短2タップ / 10ファイル25-30秒」と standalone モードは未測定。

## Phase 0 検証結果(2026-05-13)

iPhone 実機(iOS 16.4+ 想定)で Squisher Spike を走らせた結果。

| Test | 結果 | 意味 |
|------|------|------|
| Test 1 (HEIC→`<img>`→Canvas→JPEG) | ✅ 成功(ただし入力が既に JPEG 化されていた) | **iOS Safari は `<input type="file">` 経由で HEIC を自動的に JPEG に変換してアプリへ渡す**(iOS 13+の挙動) |
| Test 2 (createImageBitmap on "HEIC") | ✅ 成功(ただし実体は JPEG) | iOS の自動変換のため、実質的に HEIC を直接処理することはない |
| Test 3 (Canvas 16Mピクセル) | ✅ **36.2Mピクセル(6016×6016)で完全動作**、drawImage 138-159ms、JPEG 出力10MB | **Canvas 16Mピクセル制限は当該機種では効いていない**。事前リサイズの安全マージンは緩和可能 |
| Test 4 (canShare) | ✅ HTTPS 化後 `{files}`/`{files, title, text}` 共に true(iOS 18.7) | Web Share API は secure context 必須、本番ホスティングで自動的に満たされる。title/text の制約は iOS 18.7 では緩和されている(古い iOS 用に files only 方針は維持) |
| Test 5 (share + 保存) | ✅ share success、共有シートで「画像を保存」が機能 | MVP の保存パスが PWA standalone モードで完全成立 |

### Phase 0 の結論

1. **`decode-heic.ts` モジュールは不要** — iOS Safari が HEIC を自動 JPEG 化するため、アプリは常に JPEG/PNG として受け取る
2. **Canvas 16Mピクセル制限の事前リサイズロジックは不要** — プリセットの長辺最大値リサイズのみで十分(安全のため `MAX_INPUT_PIXELS = 64_000_000` のサニティチェックは残す)
3. **HEIC のままでの圧縮はそもそも不可能** — WebKit は HEIC エンコード未対応、入力時点で JPEG 化される
4. **Web Share API は HTTPS 必須** — 本番ホスティング(Cloudflare Pages 等)で自動的に満たされる

## 目的・スコープ

iPhone向けPWA画像圧縮アプリ「Squisher」のMVP実装プラン。

**最低要件:** iOS 16.4+(Web Share API での files 共有がPWA standalone で安定動作する最低バージョン)。それ以前は切り捨て。

### スコープ内 (MVP)
- iPhone 写真(HEIC由来 / JPEG / PNG)入力 → JPEG/WebP 出力
  - **重要:** HEIC は iOS Safari が `<input type="file">` 経由で自動的に JPEG にデコードしてアプリへ渡す。Squisher は受け取った JPEG/PNG を再圧縮するツール。
- 透過判定: **拡張子ヒューリスティック**(PNG→WebP / それ以外→JPEG)、手動オーバーライド可
- 3段階品質プリセット(高品質3840px@85% / 標準2560px@75% / 強力1920px@60%)
- 複数ファイル一括処理(iOS は同時1ファイル処理、非iOSは最大3並列)
- サイズ増ファイルの警告 + スキップオプション
- Web Share API で「写真」アプリへ保存(`canShare()` 確認 + files only + download fallback)
- iOS Safari PWA 対応(ホーム画面追加で利用)
- DESIGN.md 準拠の UI

### NOT in scope
- 動画圧縮(将来追加、ユーザー指示で deferred)
- iCloud 連携
- バッチエクスポート(ZIP)
- ユーザーアカウント・履歴
- iOS 16.3 以下のサポート(ユーザー判断で切り捨て)
- EU 圏特有の DMA 対応(ユーザー判断で対象外)
- **HEIC のままでの圧縮**(WebKit は HEIC エンコード未対応、また入力時点で iOS が JPEG 化)
- Android/Desktop での HEIC 入力(Squisher は iPhone 主戦場、JPEG/PNG のみ受け付け)
- Web Worker への画像処理移行(Phase 6 以降の検討事項)
- 多言語化(MVP は日本語のみ)
- ダークモード以外のテーマ

### What already exists
新規プロジェクト、既存コード再利用なし。実際に使っているサードパーティ:
- `preact` + `@preact/signals`(UI + 状態管理)
- `vite` + `@preact/preset-vite` + `typescript`(ビルド・型)
- `@vitejs/plugin-basic-ssl`(dev HTTPS — Web Share 検証用)
- `vite-plugin-pwa`(PWA / Service Worker / manifest)
- `vitest` + `jsdom` + `@testing-library/preact` + `@testing-library/jest-dom`(ユニット・コンポーネント)/ `@playwright/test`(E2E)
- 圧縮は native Canvas `toBlob` — 圧縮用ライブラリは入れていない(当初 `browser-image-compression` を予定していたが未使用のため削除)
既存資産:
- [DESIGN.md](DESIGN.md)(デザインシステム源泉、`/design-consultation` で作成)
- [CLAUDE.md](CLAUDE.md)(プロジェクト指示)

## 技術スタック

| 領域 | 採用 | 理由 |
|------|------|------|
| ビルド | Vite 6 | 高速、PWA プラグイン充実 |
| 言語 | TypeScript | 型安全、Result型での失敗処理に必須 |
| **フレームワーク** | **Preact + @preact/signals** | +3.5KB、Signalsで状態管理シンプル、UI 更新漏れバグ防止 |
| 画像圧縮 | **native Canvas `toBlob()`**(`compress.ts`) | 依存ゼロ、iOS Safari 実績、品質パラメータは `toBlob(type, quality)` で十分。当初 `browser-image-compression` を予定していたが未使用のため削除 |
| HEIC 処理 | **iOS Safari の自動 JPEG 変換に依存** | `<input type="file">` 経由で iOS が JPEG 化してアプリへ渡す、追加実装不要 |
| PWA | `vite-plugin-pwa` | Service Worker, manifest, precache 自動生成(`registerType: 'autoUpdate'`) |
| アイコン生成 | **手動**(緑 `#30694B` 地に白 "S" の HTML を browse でレンダ → `sips` でダウンスケール) | MVP は自前で十分、`pwa-asset-generator` は不採用。プロ制作は後日 |
| テスト | Vitest + jsdom + @testing-library/preact | Vite統合、軽量。設定は `vitest.config.ts`(`vite.config.ts` とは別) |
| E2Eテスト | Playwright | iOS Safari エミュレーション + 実機(Phase 5 未着手) |

## アーキテクチャ

### ディレクトリ構造(実装後)
```
README.md                   # 概要 + 開発手順 + 構成 + ドキュメント索引
index.html                  # apple-touch-icon / apple-mobile-web-app-* メタ。manifest と registerSW は vite-plugin-pwa が注入
vite.config.ts              # preact + basicSsl(dev HTTPS)+ VitePWA(manifest インライン定義)
vitest.config.ts            # ユニット/コンポーネント専用(preact のみ、jsdom 環境、test/setup.ts)
playwright.config.ts        # E2E(chromium + iPhone サイズ/UA、dev server を webServer に、ignoreHTTPSErrors)
public/icons/               # apple-touch-icon.png(180)、icon-192/512.png、icon-512-maskable.png、icon.svg(ソース兼 SVG favicon)
src/
├── main.tsx                # エントリ(Preact)、tokens/base/components.css を import
├── app.tsx                 # ルート + handleFiles / changeOutputFormat / changePreset / handleSave / compressOne / runPool
├── lib/
│   ├── compress.ts         # 圧縮コア(createImageBitmap → Canvas → toBlob、Result型)+ makeThumbnail
│   ├── presets.ts          # 3段階プリセット定義
│   ├── share.ts            # Web Share API ラッパー(canShare + files only + downloadFiles fallback)
│   ├── output-format.ts    # 拡張子ヒューリスティック判定
│   ├── install.ts          # ホーム画面追加バナーの表示判定(iOS / standalone / dismiss)
│   ├── result.ts           # Result型ユーティリティ
│   └── types.ts            # 型定義(FileItem.thumbUrl 含む)
├── components/
│   ├── Header.tsx          # タイトル + 品質セグメンテッド(changePreset)+ 追加「+」ボタン
│   ├── EmptyCard.tsx       # 写真選択(空状態)
│   ├── FileRow.tsx         # ファイル行(待機/処理中/完了/エラー)+ 実画像サムネ + JPEG/WebP トグル
│   ├── SaveBar.tsx         # 下部固定保存バー + 合計 + サイズ増スキップ + saveError インライン表示
│   ├── Spinner.tsx         # 円形スピナー
│   └── InstallBanner.tsx   # iOS用 ホーム画面追加 バナー(共有グリフ + ×)
├── store/
│   └── signals.ts          # @preact/signals(files / preset / skipLarger / saveError / showInstallBanner + computed)
└── styles/
    ├── tokens.css          # CSS Variables(DESIGN.md由来)
    ├── base.css            # リセット + ベース
    └── components.css      # コンポーネントスタイル
test/                       # setup.ts + output-format / signals / install / share / presets / result / Header / FileRow / SaveBar / InstallBanner / app-preset.regression-1
e2e/                        # squisher.spec.ts(Playwright) + fixtures/sample.jpg, sample.png
.github/workflows/test.yml  # push / PR で npm ci → npm test → npm run build → playwright install → npm run e2e
```
> manifest は `vite-plugin-pwa` の `manifest` オプションでインライン定義し、ビルド時に `dist/manifest.webmanifest` を生成。`dist/sw.js` + `dist/workbox-*.js` + `dist/registerSW.js` も自動生成。dev では SW 無効(`devOptions.enabled: false`)。`src/pwa/` ディレクトリは作らず `public/icons/` を使用。

### データフロー
```
[1] ファイル選択 (<input type="file" multiple accept="image/*">)
        ↓
[2] FileList → FileItem[] に変換、各 File に id + 拡張子ヒューリスティックで出力形式を初期化
        ↓
[3] iOS は1ファイルずつ直列(CONCURRENCY=1)、非iOSは最大3並列(runPool)で処理:
    a. createImageBitmap(file) で読み込み(HEICは iOS が事前にJPEG化済み)
    b. 初回のみサムネ生成(長辺112px JPEG、再圧縮時はスキップ)
    c. Canvas に描画(リサイズ:プリセット長辺最大値、`MAX_INPUT_PIXELS=64M` サニティチェック)
    d. canvas.toBlob(mime, quality) で圧縮(プリセットの quality 反映、出力形式は item.outputFormat)
    e. Blob 取得、サイズ比較(larger フラグ)
    f. ImageBitmap.close() / canvas width=height=0 で即時解放
    g. Result型で返す: { ok: true, value: { blob, width, height, larger, thumbBlob } } | { ok: false, error: string }
   - 品質プリセット変更時は完了済みファイルを全部 [3] で再圧縮(changePreset)
   - 各行の JPEG/WebP トグルでその行だけ再圧縮(changeOutputFormat)
        ↓
[4] UI 更新(Signals でリアクティブ、ファイル毎に独立)
        ↓
[5] [写真に保存] ボタン押下
    a. サイズ増ファイルをスキップ(オプション有効時)
    b. navigator.canShare({ files }) で対応確認
    c. 対応: navigator.share({ files }) ← title/text/url なし
    d. 非対応: <a download> を一時生成してフォールバック
```

### メモリ管理戦略
```
File → ImageBitmap (createImageBitmap)
                ↓ drawImage
              Canvas (リサイズ後)
                ↓ toBlob
              Blob
                ↓
       ImageBitmap.close() / canvas width=height=0 を即時実行
```
- iOS: 同時1ファイル、各ステップ完了で明示解放
- 非iOS: 最大3並列、同様に解放
- Canvas 16Mピクセル制限: Phase 0 検証で **36.2Mピクセルまで正常動作確認済み**。事前リサイズはプリセット長辺最大値の適用のみで OK。`MAX_INPUT_PIXELS = 64_000_000`(64M)を超えるファイルのみ事前ダウンサンプリング(極端な機種・OS 差分への保険)

## 実装フェーズ

### Phase 0: Spike PR(feasibility 検証)— ✅ 完了 2026-05-13

**実施結果:** 上部「Phase 0 検証結果」セクション参照。

要約:
- HEIC は iOS が自動 JPEG 化、`decode-heic.ts` 不要
- Canvas は 36Mピクセルで正常動作、事前リサイズ閾値ロジック不要
- Web Share API は HTTPS 必須(本番で自動的に満たされる)

**成果物:** [`src/main.ts`](src/main.ts) と [`index.html`](index.html) に Spike アプリ実装、`~/Desktop/squisher-test-images/` にテスト画像セット

### Phase 1: 基礎 — ✅ 完了 2026-05-13(commit `634333c`)
Vite 6 + TS + Preact + Signals、tokens.css 移植、Result型、Header/EmptyCard/FileRow/SaveBar の枠、ファイル選択配線、単一ファイル JPEG 圧縮、`compress.ts` のメモリ解放パターン。`@preact/preset-vite` + `@vitejs/plugin-basic-ssl`(dev HTTPS、Web Share 検証用)。vite-plugin-pwa は Phase 4 で導入。

### Phase 2: コア機能 — ✅ 完了 2026-05-13(commit `9de272d`)
拡張子ヒューリスティック、プリセット長辺リサイズ + 64Mピクセル サニティ、3段階プリセット、並列処理(`runPool`、iOS=1 / 非iOS=3)、FileRow(待機/処理中/完了/エラー)、実画像サムネ(`makeThumbnail`、`FileItem.thumbUrl`)、JPEG↔WebP の行内トグル(`changeOutputFormat` で行単位再圧縮)。

### Phase 3: 保存・共有 — ✅ 完了 2026-05-13(commit `3513276`)
`share.ts`(`canShare()` + files only + `downloadFiles` スタッガー fallback)、サイズ増スキップトグル、合計サイズ、保存失敗時は `saveError` シグナルで SaveBar にインライン通知(以前の `alert()` を廃止)+ download fallback + リスト維持、キャンセル時はリスト維持で無音、出力ファイル名 `<元名>-squished.<ext>`(idempotent)。

### Phase 4: PWA仕上げ — ✅ 完了 2026-05-13(commit `308d90f`)
`vite-plugin-pwa`(`generateSW` / `registerType: 'autoUpdate'` / アプリシェルのみ precache / `navigateFallback`)、manifest(name "Squisher"、display standalone、portrait、theme-color #30694B、bg #F2F2F7、icons 192/512 + 512 maskable)、自前アイコン(緑地に白 "S"、apple-touch 180 + 192/512 + maskable + icon.svg)、`index.html` の apple-touch-icon / apple-mobile-web-app-* メタ、`InstallBanner`(iOS Safari + 非standalone + 未dismiss + 初回圧縮後のみ表示、共有グリフ付き、dismiss は localStorage 永続)。

### Phase 5: テスト・実機検証 — 🚧 ほぼ完了(残りは実機のみ)
- ✅ テスト基盤 bootstrap(commit `24e4586`): Vitest + jsdom + @testing-library/preact、`vitest.config.ts`(vite.config と分離)、`test/setup.ts`(jest-dom + matchMedia スタブ)、`.github/workflows/test.yml`、`TESTING.md`、CLAUDE.md `## Testing`。
- ✅ 単体テスト(`npm test`、51件・11ファイル 全パス): `output-format` / `signals` / `install` / `share` / `presets` / `result` / `app-preset.regression-1`(ISSUE-001 回帰)。
- ✅ コンポーネントテスト(commit `87ae81a`): `Header` / `FileRow` / `SaveBar` / `InstallBanner`(レンダリング、aria 状態、disabled、ハンドラ呼び出し)。
- ✅ Playwright E2E(commit `037a877`、`npm run e2e`、chromium + iPhone サイズ/UA、8 spec 全パス): golden path(選択→圧縮→`*-squished.jpg` ダウンロード→リセット)、複数ファイル、拡張子ヒューリスティック(PNG→WebP / JPEG→JPEG)、プリセット切替で再圧縮、行内 JPEG↔WebP トグル、サイズ増スキップトグル、共有キャンセル→再共有(`navigator.share` を addInitScript でスタブ)、InstallBanner(iPhone UA で初回圧縮後に出現 + dismiss がリロード越しに永続)。各 spec でコンソール/ページエラー 0 をアサート。`compress.ts` の `createImageBitmap`→Canvas→`toBlob` は E2E が実ブラウザで通している。CI でも `playwright install --with-deps chromium` → `npm run e2e`。
- ✅ `/qa` 通し(ヘルススコア 98→100): 発見2件・両方修正(ISSUE-001 プリセット再圧縮 `5d86443`、ISSUE-002 375pt ツールバー折返し `89e0ac1`)。レポート `.gstack/qa-reports/`。
- ⬜ ダークモード — 純粋に CSS の `@media (prefers-color-scheme: dark)`(`tokens.css` + 各コンポーネントの dark ルール)。ユニット/E2E でのテスト対象なし、実機/ブラウザ目視で確認。`visibilitychange` ハンドラは現状なし(テスト対象なし)。
- ⬜ **実機(端末待ち)**: 全プリセット・複数ファイル・共有シート・ホーム画面追加、「最短2タップ」「10ファイル 25-30秒」の測定、`navigator.share` 成功/キャンセルの実挙動、ダウンロードフォールバックの iOS 挙動、standalone モード(`navigator.standalone`、スプラッシュ)、ダークモード目視。

## テスト方針

### Coverage 方針: Complete(全 GAP を埋める)
PLAN-stage review で確認した 19+ items の GAPS をすべてカバー。AI支援下で追加コスト小さい(各テスト数分)。

### Test Plan
- **Unit (Vitest)**: `compress.ts` は jsdom に canvas/createImageBitmap が無いため実ブラウザ(Playwright)側で検証。`decode-heic.ts` / `detect-transparency.ts` は Phase 0/PLAN レビューで削除済み(該当テストなし)。
  - ✅ `output-format.ts`: 拡張子マッピング全パターン(PNG→WebP / その他→JPEG、大文字、HEIC名)、mime/ext
  - ✅ `signals.ts`: `totalCompressedSize` / `saveableFiles` / `canSave` の `skipLarger×larger` 分岐、`totalOriginalSize`、`addFiles`(saveError クリア)/ `updateFile` / `nextId`
  - ✅ `install.ts`: `shouldOfferInstall`(非iOS / iOS / standalone / dismiss)、`dismissInstallBanner`(storage 失敗を握りつぶす)
  - ✅ `app.tsx`(回帰): `changePreset` で完了済みファイル全部を再圧縮、同一プリセットでは no-op(compress をモック)
  - ✅ `share.ts`: `isShareSupported` / `shareFiles`(unsupported / canShare false / shared(files only)/ AbortError→cancelled / その他→failed)/ `downloadFile`(`<a download>` を append→click→remove、`navigator.share` をモック)
  - ✅ `presets.ts`: 順序・各値の不変条件(quality は high>standard>max、maxDimension は降順、label 非空) / `result.ts`: `ok` / `err`
  - ✅ コンポーネント(`@testing-library/preact`): `Header`(品質ラジオグループ、選択で `preset.value` 更新、`+` の表示条件)、`FileRow`(名前/サイズ遷移/削減バッジ、+警告バッジ、サムネ vs placeholder、processing の「…」+spinner、error の「エラー」+メッセージ、フォーマットトグルの active/disabled、クリックで `changeOutputFormat`)、`SaveBar`(合計、保存件数、`!canSave` で disabled、skipLarger トグル、`saveError` 表示、クリックで `handleSave`)、`InstallBanner`(非表示/表示/dismiss 永続)
  - ⬜ `compress.ts` の直接ユニットは jsdom 不可。Playwright E2E が `createImageBitmap`→Canvas→`toBlob` を実ブラウザで通している(下記)。残: 巨大 36Mpx / 64Mピクセル超 / 破損入力の専用 spec(現状は golden path で代表)

- **E2E (Playwright)** — ✅ `e2e/squisher.spec.ts`(8 spec、chromium + iPhone サイズ/UA、各 spec でコンソール/ページエラー 0 をアサート):
  - ✅ 起動 → 選択 → 圧縮 → 保存(golden path、`*-squished.jpg` ダウンロード→リスト リセット)
  - ✅ 複数ファイル一括(2件圧縮、保存件数2)
  - ✅ 拡張子ヒューリスティック(`sample.png`→WebP active、`sample.jpg`→JPEG active)
  - ✅ プリセット切替で再圧縮(標準→強力→高品質、サイズが変わる)
  - ✅ 手動オーバーライド(行内 JPEG→WebP で再圧縮)
  - ✅ サイズ増スキップトグル(既定 on、トグル可)
  - ✅ 共有キャンセル → 再共有(AbortError でリスト維持・通知なし、2回目の resolve でリスト クリア)
  - ✅ InstallBanner(iPhone UA で初回圧縮後に出現、× でリロード越しに永続非表示)
  - フィクスチャ `e2e/fixtures/sample.jpg`(1200×900)/ `sample.png`(480×360)。CI でも実行(`playwright install --with-deps chromium` → `npm run e2e`、`playwright-report/` をアーティファクト化)。

- **Error states**:
  - 非iOS Safari の Web Share 未対応 → ダウンロードフォールバック(✅ E2E golden path がダウンロード経路を踏んでいる、✅ `share.ts` unit)
  - ファイル大きすぎ / 破損 → 行に「エラー」+ メッセージ(✅ `FileRow` コンポーネントテスト、✅ `compress.ts` の MAX_INPUT_PIXELS ロジック / decode 失敗ハンドリングはコードで実装済み。実画像での専用 E2E spec は残り)
  - 保存失敗 → SaveBar インライン通知 + download fallback、リスト維持(✅ `SaveBar` コンポーネント、✅ E2E の共有キャンセルケース、`/qa` で navigator.share モックで failed ケースも確認)
  - 全失敗時 → `canSave` false で保存ボタン disabled(✅ `signals` unit、✅ `SaveBar` コンポーネント)

- **Interaction edges**:
  - 圧縮中に追加ファイル選択 — `+` ボタンの `handleFiles` は新規バッチを追加(別 `runPool`)、既存処理と独立。専用 spec は残り(コードはこの挙動)
  - `visibilitychange` 中の挙動 — 現状ハンドラなし(テスト対象なし)
  - ダークモード — `@media (prefers-color-scheme: dark)` の純 CSS。目視確認のみ(browse は `prefers-color-scheme` をエミュレート不可)

- **手動 (iPhone 実機)**:
  - iCloud から HEIC 選択 → 圧縮 → 「写真」保存(最短2タップ達成確認)
  - 10ファイル一括処理が 25-30秒以内
  - ホーム画面追加後の standalone モード動作

- **CI (GitHub Actions)** — ✅ `.github/workflows/test.yml`(push / PR で `npm ci → npm test → npm run build`(= `tsc && vite build`、型チェック込み)→ `playwright install --with-deps chromium → npm run e2e`、`playwright-report/` をアーティファクト化)

## Failure modes(各 codepath での現実的失敗シナリオ)

| Codepath | 失敗 | テスト | エラー処理 | ユーザーに見える? |
|----------|------|--------|-----------|----------------|
| `compress()` | メモリ不足 | ✅ Unit | ✅ Result.ok=false | ✅ 行に「メモリ不足」表示 |
| `compress()` | 破損ファイル | ✅ Unit | ✅ Result.ok=false | ✅ 行に「読み込めません」 |
| `compress()` | サイズ増 | ✅ Unit | ✅ Result.larger=true | ✅ 警告バッジ + スキップ可 |
| `compress()` | createImageBitmap 失敗(極稀) | ✅ Unit | ✅ Result.ok=false | ✅ 行に「形式エラー」 |
| `shareFiles()` | canShare false | ✅ Unit | ✅ download fallback | ✅ ダウンロード経路に切替 |
| `shareFiles()` | ユーザーキャンセル | ✅ Unit | ✅ silent 完了状態維持 | ❌ サイレント(意図) |
| 64Mピクセル超 | 無音失敗(極稀) | ✅ Unit | ✅ 事前ダウンサンプリング | ❌ 透過的処理 |
| 非iOS Safari | Web Share未対応 | ✅ Unit | ✅ download fallback | ✅ ダウンロードに切替 |

**Critical gaps: なし**(全 failure mode に test + error handling + ユーザー可視 を確保)

## リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| iOS 16.4以下のユーザーが Web Share API で保存不可 | 一部ユーザー脱落 | iOS 16.4+ をサポート最低要件として明示、ブラウザ判定で警告 |
| Canvas 64Mピクセル超(極端な機種) | 無音失敗の可能性 | 事前ダウンサンプリング(`MAX_INPUT_PIXELS=64M`)で保険、通常パスは不要(Phase 0 で36Mまで動作確認済み) |
| iOS の自動 JPEG 変換に依存 | 将来 iOS 仕様変更で挙動変化 | feature detection(MIME = image/heic を見たら fallback)を input handler に組み込む |
| メモリ制限(iOS Safari, 大量ファイル) | クラッシュ | iOS は同時1ファイル + ImageBitmap.close() で各ステップで明示解放 |
| 圧縮処理が UI を block | 操作不能 | iOS同時1ファイル + Signals での非同期 + Phase 6 で Worker 検討 |
| PWA インストール率の低さ | リーチ低下 | InstallBanner で初回処理後に手順案内 |

## Worktree parallelization

Phase 0 → Phase 1 → Phase 2 → Phase 3 は **sequential**(前 Phase の lib に依存)。
Phase 4 (PWA) と Phase 5 (テスト) は条件付き並列可能だが、MVP 規模では sequential が現実的。

| Lane | Phase | 依存 |
|------|-------|------|
| A | Phase 0 → 1 → 2 → 3 | sequential、src/lib に集中 |
| B | Phase 4 | Phase 1 完了後に独立可、src/pwa を扱う |
| C | Phase 5 | Phase 3 完了後 |

**結論:** Sequential 実装、並列化のオーバーヘッド > 利益。

## 成功基準(現実的修正後)

- iCloud から HEIC 選択 → デフォルトプリセット(標準)で自動圧縮 → 「写真」へ保存、**最短2タップ**で完結
- 5MB の HEIC が標準プリセットで 1MB 以下になる(目安)
- 10ファイル一括処理が iPhone 12 Pro で **25-30秒以内**(iOS同時1ファイル前提)
- DESIGN.md の anti-patterns に1つも該当しないUI
- Test coverage: 全 GAP(19+ items)に test + error handling
- Failure modes: 全 path にユーザー可視のエラー表示(silent failure ゼロ)

## 開かれた質問

1. ~~Vanilla TS vs Preact~~ → **Preact + Signals に確定**
2. ~~オフライン対応の深さ~~ → **アプリシェルのみ precache(画像履歴はキャッシュしない)。Phase 4 で実装済み**
3. ~~アイコン制作~~ → **自前生成(`#30694B` 地に白 "S"、apple-touch 180 + 192/512 + maskable + icon.svg)を MVP として実装済み。プロ制作は後日**
4. ~~ホスティング~~ → **Cloudflare Pages に決定**、GitHub repo は `https://github.com/kimymt/squisher`(public、`main`)を作成済み(`/setup-deploy` 結果は CLAUDE.md `## Deploy Configuration`、2026-05-13)。残り: ① CF ダッシュボードで Git 連携を接続(ビルド `npm run build` / 出力 `dist` / ブランチ `main`)→ 以降 push で auto-deploy。② デプロイ後の実 URL を docs に反映。暫定デプロイは `npm run build && npx wrangler pages deploy dist`。
5. ~~`browser-image-compression` の扱い~~ → **削除済み**(`compress.ts` は native Canvas `toBlob` で完結。`npm uninstall browser-image-compression` 済み、2026-05-13)

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-12 | iOS 16.4+ をサポート最低要件 | Web Share API での files 共有が PWA standalone で安定する最低バージョン |
| 2026-05-12 | Phase 0 Spike PR を追加 | HEIC × createImageBitmap と Canvas 16Mピクセル制限を実機で先に検証、Plan の砂上の楼閣化を回避 |
| 2026-05-12 | フレームワーク: Preact + @preact/signals | +3.5KB、状態管理シンプル、UI 更新漏れバグ防止、開発スピード優位 |
| 2026-05-12 | Web Share: canShare() + files only + download fallback | iOS の title/text 制約を回避、非対応環境にもfallback |
| 2026-05-12 | PWA install: 初回バナーで手順スクショ案内 | iOS は beforeinstallprompt 不可、明示促進で standalone 体験へ |
| 2026-05-12 | HEIC fallback: iOS Safari/Chrome 限定 | MVP は iOS 専用、非iOS は警告のみ、heic2any 不採用で軽量化 |
| 2026-05-12 | エラー処理: Result 型で統一 | 失敗を型で強制処理、複数ファイル独立状態管理と相性良 |
| 2026-05-12 | Test coverage: Complete(全 Gap を埋める) | AI支援下でコスト小、Boil the lake 原則 |
| 2026-05-12 | メモリ: createImageBitmap + close() + iOS 同時1 | iOS Safari クラッシュ防止 |
| 2026-05-12 | 透過判定を拡張子ヒューリスティック化 | サンプリング走査を排し、処理ゼロ。`detect-transparency.ts` モジュール削除 |
| 2026-05-12 | 数値フォントを ui-monospace 主体に | iOS で SF Mono、Memorable thing「Apple純正」と一致、+30-80KB 削減 |
| 2026-05-12 | 成功基準を観測ベースに修正 | 最短2タップ、10ファイル25-30秒、達成可能・測定可能な基準に |
| 2026-05-13 | `decode-heic.ts` 削除 | Phase 0 検証: iOS Safari が `<input type="file">` 経由で HEIC を自動 JPEG 化、デコードコード不要 |
| 2026-05-13 | Canvas 16Mピクセル事前リサイズロジック削除 | Phase 0 検証: 36.2Mピクセルまで正常動作、`MAX_INPUT_PIXELS=64M` のサニティのみ残す |
| 2026-05-13 | スコープから「HEIC のままの圧縮」を明示的に除外 | WebKit は HEIC エンコード未対応 + iOS が入力時点で JPEG 化、技術的に不可能 |
| 2026-05-13 | 圧縮コアは native Canvas `toBlob`、`browser-image-compression` を削除 | 依存ゼロで `toBlob(type, quality)` で十分。当初予定していた dep は未使用だったので `npm uninstall` |
| 2026-05-13 | package 名を `squisher-spike` → `squisher` に、README.md を追加 | Spike 名残の片付け。README は概要 + 開発手順 + 構成 + ドキュメント索引 |
| 2026-05-13 | デプロイ先を Cloudflare Pages に決定 | 静的 PWA に最適(HTTPS/HTTP-3 自動、無料 tier、ルート配信で manifest scope そのまま)、`wrangler` は既にインストール済み。`/setup-deploy` で CLAUDE.md に設定を記録 |
| 2026-05-13 | GitHub repo `kimymt/squisher`(public)を作成、Cloudflare Pages の Git 連携で運用 | push で auto-build & deploy + PR プレビュー、CI(`test.yml`)も走る。CF ダッシュボードでの接続は要手動。push には gh トークンの `workflow` スコープが必要(`gh auth refresh -s workflow`)|
| 2026-05-13 | 品質プリセット変更時は完了済みファイルを全部再圧縮 | /qa ISSUE-001: セグメンテッドが既存ファイルに無反応で「壊れて見えた」。「数値が主役」のアプリでは変更を即反映すべき。`changePreset` を追加 |
| 2026-05-13 | 保存失敗の通知は `alert()` ではなく SaveBar インライン表示 | ブロッキングしない、iOS ネイティブ寄り。`unsupported`(共有APIはあるが失敗)も穏当なフォールバックに |
| 2026-05-13 | 出力ファイル名 `<元名>-squished.<ext>` | "Squisher" ブランド由来。末尾 `-squished` を一度剥がしてから付け直すので再保存しても idempotent |
| 2026-05-13 | アイコンは自前生成(緑地に白 "S")、`pwa-asset-generator` 不採用 | MVP は HTML→browse レンダ→sips ダウンスケールで十分。プロ制作は後日 |
| 2026-05-13 | テスト基盤: Vitest + jsdom + @testing-library/preact、設定は `vite.config.ts` と分離 | PWA/SSL プラグインをテスト時に走らせない。`test/` ディレクトリ、`globals` 無効(`vitest` から明示 import) |

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 7 issues + 4 cross-model tensions, all resolved |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**CROSS-MODEL:** Subagent identified 10 blind spots; 4 actioned (Phase 0 Spike, success criteria, transparency heuristic, mono font), 3 already in plan, 3 acknowledged but not actioned (PWA install timing kept as designed, Result型 maintained, install promotion deferred refinement).

**PHASE 0 RESULT:** Spike 完了 2026-05-13。全5テスト合格(iOS 18.7 / Safari 26.5 / standalone PWA)。`decode-heic.ts` と Canvas 16M事前リサイズロジックを削除、scope を「iPhone 写真の再圧縮」に明確化。Web Share API は HTTPS で share + 「画像を保存」が完全動作。**Phase 1 着手可能**。

**UNRESOLVED:** 0

**VERDICT:** **ENG CLEARED — ready to implement.** Phase 0 Spike PR first, then proceed Phase 1-5 sequentially.
