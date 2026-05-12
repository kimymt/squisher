# Squisher

iPhone向けPWA画像圧縮アプリ。iPhone 写真(HEIC由来 JPEG / 直接 JPEG / PNG) → JPEG/WebP、完全ローカル処理(サーバーなし)、3段階品質、複数ファイル一括処理、Web Share API で「写真」に保存。

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
