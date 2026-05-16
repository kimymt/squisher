import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const JPG_SOURCE = join(FIXTURES, 'sample.jpg'); // 1200x900 JPEG, ~104 KB

/**
 * Perf budget: 10 small JPEG files end-to-end in under 5 s on CI.
 *
 * Intent: catch regressions where dynamic concurrency breaks or where the
 * compress pipeline becomes much slower. NOT a real-device benchmark — see
 * T6 in the Tier 1 plan for the iPhone 14 / iPhone 8 acceptance criteria
 * which need a real device, not chromium emulation.
 *
 * With `computeConcurrency()` returning 2 on the iPhone UA (configured in
 * playwright.config.ts) and 100 KB fixtures, 10 files should finish well
 * under 5 s on a typical CI runner. The budget is intentionally loose
 * (~30x expected duration) to be stable across CI hardware.
 */
const BUDGET_MS = 5000;

const FILE_COUNT = 10;

test('perf budget — 10 files complete under 5 s', async ({ page }) => {
  // Make 10 distinct paths so Playwright treats each as a separate file.
  // The contents are identical; only the names differ. The app's
  // `computeConcurrency()` looks at file.size only, so 10 small files
  // → concurrency = 2 on iOS.
  const tmpDir = fs.mkdtempSync(join(os.tmpdir(), 'squisher-perf-'));
  const source = fs.readFileSync(JPG_SOURCE);
  const paths = Array.from({ length: FILE_COUNT }, (_, i) => {
    const p = join(tmpDir, `perf-${i}.jpg`);
    fs.writeFileSync(p, source);
    return p;
  });

  try {
    await page.goto('/');
    await expect(page.locator('.empty-card')).toBeVisible();

    const start = Date.now();
    await page.locator('input[type=file]').first().setInputFiles(paths);
    await expect(
      page.locator('.file-row.completed, .file-row.errored')
    ).toHaveCount(FILE_COUNT, { timeout: BUDGET_MS + 5000 });
    const wallMs = Date.now() - start;

    // eslint-disable-next-line no-console
    console.log(`[perf-budget] ${FILE_COUNT} files in ${wallMs}ms (budget ${BUDGET_MS}ms)`);

    expect(wallMs).toBeLessThan(BUDGET_MS);
    await expect(page.locator('.file-row.completed')).toHaveCount(FILE_COUNT);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
