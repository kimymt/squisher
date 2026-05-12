# Squisher — 実装プラン (MVP)

> このプランは `/plan-eng-review` でレビュー済み + Phase 0 Spike の実機検証結果を反映。
> 詳細は末尾の「## GSTACK REVIEW REPORT」を参照。

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
新規プロジェクト、既存コード再利用なし。利用予定のサードパーティ:
- `browser-image-compression`(圧縮コア)
- `@preact/signals`(状態管理)
- `vite-plugin-pwa`(PWA / Service Worker / manifest)
- `vite` + `typescript`(ビルド・型)
既存資産:
- [DESIGN.md](DESIGN.md)(デザインシステム源泉、`/design-consultation` で作成)
- [CLAUDE.md](CLAUDE.md)(プロジェクト指示)

## 技術スタック

| 領域 | 採用 | 理由 |
|------|------|------|
| ビルド | Vite 5 | 高速、PWA プラグイン充実 |
| 言語 | TypeScript | 型安全、Result型での失敗処理に必須 |
| **フレームワーク** | **Preact + @preact/signals** | +3.5KB、Signalsで状態管理シンプル、UI 更新漏れバグ防止 |
| 画像圧縮 | `browser-image-compression` | Canvas経由、iOS Safari対応実績 |
| HEIC 処理 | **iOS Safari の自動 JPEG 変換に依存** | `<input type="file">` 経由で iOS が JPEG 化してアプリへ渡す、追加実装不要 |
| PWA | `vite-plugin-pwa` | Service Worker, manifest, アセット生成自動化 |
| アイコン生成 | `pwa-asset-generator` | iOS 用 180×180 + 192/512px |
| テスト | Vitest | Vite統合、軽量 |
| E2Eテスト | Playwright | iOS Safari エミュレーション + 実機 |

## アーキテクチャ

### ディレクトリ構造
```
src/
├── main.tsx                # エントリ(Preact)
├── app.tsx                 # ルートコンポーネント
├── lib/
│   ├── compress.ts         # 圧縮コアロジック(Result型)
│   ├── presets.ts          # 3段階プリセット定義
│   ├── share.ts            # Web Share API ラッパー(canShare + fallback)
│   ├── output-format.ts    # 拡張子ヒューリスティック判定
│   ├── result.ts           # Result型ユーティリティ
│   └── types.ts            # 型定義
├── components/
│   ├── Header.tsx          # タイトル + セグメンテッドコントロール
│   ├── EmptyCard.tsx       # 写真選択(空状態)
│   ├── FileRow.tsx         # ファイル行(待機/処理中/完了/エラー/スキップ)
│   ├── SaveBar.tsx         # 下部固定保存バー
│   ├── Spinner.tsx         # 円形スピナー
│   └── InstallBanner.tsx   # iOS用 ホーム画面追加 バナー
├── store/
│   └── signals.ts          # @preact/signals での状態
├── styles/
│   ├── tokens.css          # CSS Variables(DESIGN.md由来)
│   ├── base.css            # リセット + ベース
│   └── components.css      # コンポーネントスタイル
└── pwa/
    ├── manifest.webmanifest
    └── icons/              # 各種サイズ
```

### データフロー
```
[1] ファイル選択 (<input type="file" multiple accept="image/*">)
        ↓
[2] FileList → FileItem[] に変換、各 File に id + 拡張子ヒューリスティックで出力形式を初期化
        ↓
[3] iOS は1ファイルずつ直列、非iOSは最大3並列で処理:
    a. createImageBitmap(file) で読み込み(HEICは iOS が事前にJPEG化済み)
    b. Canvas に描画(リサイズ:プリセット長辺最大値、`MAX_INPUT_PIXELS=64M` サニティチェック)
    c. browser-image-compression で圧縮(品質パラメータ反映)
    d. Blob 取得、サイズ比較
    e. ImageBitmap.close() で即時解放
    f. Result型で返す: { ok: true, blob, w, h, larger: boolean } | { ok: false, error: ErrorKind }
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

### Phase 1: 基礎(2-3日)
1. Vite + TS + vite-plugin-pwa 初期化、Preact + Signals セットアップ
2. DESIGN.md 由来の CSS Variables 移植(tokens.css)
3. Result型ユーティリティ(`lib/result.ts`)
4. 基本 HTML 構造(Header + EmptyCard + SaveBar の枠)
5. ファイル選択 input 配線
6. 単一ファイル JPEG 圧縮(動作確認用)
7. メモリ解放パターンを `compress.ts` に組み込み

### Phase 2: コア機能(2-3日)
1. 拡張子ヒューリスティック(`output-format.ts`)
2. リサイズロジック(プリセット長辺最大 + 64Mピクセル サニティ)
3. 3段階プリセット
4. 並列処理(iOS同時1、非iOS同時3)
5. FileRow UI(待機/処理中/完了/エラー/サイズ増/スキップ)
6. 手動オーバーライド(JPEG ↔ WebP)

### Phase 3: 保存・共有(1-2日)
1. `share.ts` 実装(`canShare()` + files only + `<a download>` fallback)
2. 「サイズ増スキップ」トグル
3. 合計サイズ表示
4. 共有失敗時のフォールバック動作確認

### Phase 4: PWA仕上げ(1-2日)
1. Service Worker(アプリ本体オフライン化、画像処理は対象外)
2. Manifest(name "Squisher", display: standalone, theme-color #30694B)
3. iOS Safari 用アイコン生成(180×180、splashScreen)
4. **InstallBanner**: Safari ブラウザモード時のみ表示、手順スクショ付き

### Phase 5: テスト・実機検証(2-3日)
1. Vitest 単体テスト(全 GAP を埋める Complete coverage 方針)
2. Playwright での E2E テスト(golden path + 7 user flows)
3. iPhone 実機で動作確認(全プリセット、複数ファイル、共有シート、ホーム画面追加)
4. ダークモード切替、visibilityChange 中の挙動

## テスト方針

### Coverage 方針: Complete(全 GAP を埋める)
PLAN-stage review で確認した 19+ items の GAPS をすべてカバー。AI支援下で追加コスト小さい(各テスト数分)。

### Test Plan
- **Unit (Vitest)**:
  - `compress.ts`: happy(JPEG/HEIC/PNG透過/PNG非透過) + edge(巨大/破損/空/サイズ増)
  - `decode-heic.ts`: HEIC/JPEG/PNG happy + 非画像/巨大/破損 reject
  - `output-format.ts`: 拡張子マッピング全パターン + 手動オーバーライド優先
  - `share.ts`: canShare→share happy + canShare false→fallback + iOS互換(title無し呼び)
  - `presets.ts`: 各プリセット値検証
  - `result.ts`: 型ユーティリティ

- **E2E (Playwright)**:
  - 起動 → 選択 → 圧縮 → 保存(golden path)
  - 複数ファイル一括
  - 透過判定の自動振り分け
  - プリセット切替で再圧縮
  - 手動オーバーライド
  - サイズ増スキップトグル
  - 共有キャンセル → 再共有

- **Error states**:
  - 非iOS Safari 警告表示
  - ファイル大きすぎ表示
  - 破損ファイル表示
  - 保存失敗時の fallback 誘導
  - 全失敗時の UI

- **Interaction edges**:
  - 圧縮中に追加ファイル選択
  - visibilityChange 中の挙動
  - ダークモード切替時の UI

- **手動 (iPhone 実機)**:
  - iCloud から HEIC 選択 → 圧縮 → 「写真」保存(最短2タップ達成確認)
  - 10ファイル一括処理が 25-30秒以内
  - ホーム画面追加後の standalone モード動作

- **CI (GitHub Actions)**:
  - 型チェック + Vitest
  - Playwright(iOS Safari エミュレーション、ヘッドレス)

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

## 開かれた質問(MVP 着手前に解消すべき)

1. ~~Vanilla TS vs Preact~~ → **Preact + Signals に確定**
2. オフライン対応の深さ — アプリ本体のみ(画像履歴はキャッシュしない、MVP 範囲外)
3. アイコン制作 — 自前 SVG(`#30694B` 苔緑 + 白文字 "S")で MVP、後日プロフェッショナル制作も視野
4. ホスティング — Cloudflare Pages を推奨(HTTPS 必須、PWA 配信実績、無料 tier 十分)

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
