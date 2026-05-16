import { test as base, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const JPG = join(FIXTURES, 'sample.jpg'); // 1200x900 JPEG, ~104 KB
const PNG = join(FIXTURES, 'sample.png'); // 480x360 PNG, ~187 KB

// Attach console/page-error listeners before any navigation so a noisy bug
// fails the test instead of going unnoticed.
const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));
    await use(errors);
  },
});

const fileInput = (page: Page) => page.locator('input[type=file]').first();

/** Upload `paths` and wait until every row finishes (completed or errored). */
async function uploadAndSettle(page: Page, ...paths: string[]) {
  await fileInput(page).setInputFiles(paths);
  await expect(page.locator('.file-row.completed, .file-row.errored')).toHaveCount(
    paths.length,
    { timeout: 20_000 }
  );
}

test('golden path — select, compress, save (download fallback)', async ({ page, consoleErrors }) => {
  await page.goto('/');
  await expect(page.locator('.empty-card')).toBeVisible();
  await uploadAndSettle(page, JPG);

  // compression happened: a reduction badge and a "X → Y" byte transition
  await expect(page.locator('.badge-reduction')).toHaveText(/[+-]\d+%/);
  const sizes = (await page.locator('.file-sizes').textContent()) ?? '';
  expect(sizes).toMatch(/\d[\d.]*\s*(B|KB|MB)\s*→\s*\d[\d.]*\s*(B|KB|MB)/);

  // no Web Share API in chromium → save triggers a download named *-squished.jpg
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /写真に保存/ }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('sample-squished.jpg');

  // list resets after a successful save
  await expect(page.locator('.empty-card')).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test('multiple files — both compress and are counted for saving', async ({ page, consoleErrors }) => {
  await page.goto('/');
  await uploadAndSettle(page, JPG, PNG);
  await expect(page.locator('.file-row.completed')).toHaveCount(2);
  await expect(page.locator('.badge-reduction')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /写真に保存/ })).toHaveText('写真に保存(2)');
  expect(consoleErrors).toEqual([]);
});

test('extension heuristic — PNG routes to WebP, JPEG routes to JPEG', async ({ page, consoleErrors }) => {
  await page.goto('/');
  await uploadAndSettle(page, PNG, JPG); // upload order = row order
  const pngRow = page.locator('.file-row').nth(0);
  const jpgRow = page.locator('.file-row').nth(1);
  await expect(pngRow.locator('.file-name')).toHaveText('sample.png');
  await expect(pngRow.getByRole('radio', { name: 'WebP' })).toHaveAttribute('aria-checked', 'true');
  await expect(jpgRow.locator('.file-name')).toHaveText('sample.jpg');
  await expect(jpgRow.getByRole('radio', { name: 'JPEG' })).toHaveAttribute('aria-checked', 'true');
  expect(consoleErrors).toEqual([]);
});

test('changing the quality preset re-compresses the file', async ({ page, consoleErrors }) => {
  await page.goto('/');
  await uploadAndSettle(page, JPG);
  const atStandard = await page.locator('.file-sizes').textContent();

  await page.getByRole('radio', { name: '強力圧縮' }).click();
  await expect(page.getByRole('radio', { name: '強力圧縮' })).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => page.locator('.file-sizes').textContent(), { timeout: 10_000 }).not.toBe(atStandard);
  const atMax = await page.locator('.file-sizes').textContent();

  await page.getByRole('radio', { name: '高品質' }).click();
  await expect(page.getByRole('radio', { name: '高品質' })).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => page.locator('.file-sizes').textContent(), { timeout: 10_000 }).not.toBe(atMax);

  await expect(page.locator('.badge-reduction')).toHaveText(/[+-]\d+%/);
  expect(consoleErrors).toEqual([]);
});

test('per-row JPEG↔WebP toggle re-compresses just that row', async ({ page, consoleErrors }) => {
  await page.goto('/');
  await uploadAndSettle(page, JPG);
  const before = await page.locator('.file-sizes').textContent();
  await expect(page.getByRole('radio', { name: 'JPEG' })).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('radio', { name: 'WebP' }).click();
  await expect(page.getByRole('radio', { name: 'WebP' })).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => page.locator('.file-sizes').textContent(), { timeout: 10_000 }).not.toBe(before);
  await expect(page.locator('.badge-reduction')).toHaveText(/[+-]\d+%/);
  expect(consoleErrors).toEqual([]);
});

test('size-increase skip toggle defaults on and is toggleable', async ({ page, consoleErrors }) => {
  await page.goto('/');
  await uploadAndSettle(page, JPG);
  const cb = page.getByRole('checkbox');
  await expect(cb).toBeChecked();
  await expect(page.getByRole('button', { name: /写真に保存/ })).toHaveText('写真に保存(1)');
  await cb.uncheck();
  await expect(cb).not.toBeChecked();
  await cb.check();
  await expect(cb).toBeChecked();
  expect(consoleErrors).toEqual([]);
});

test('cancelling the share keeps the list; sharing again clears it', async ({ page, consoleErrors }) => {
  await page.addInitScript(() => {
    let calls = 0;
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: () => {
        calls += 1;
        return calls === 1
          ? Promise.reject(new DOMException('user cancelled', 'AbortError'))
          : Promise.resolve();
      },
    });
  });
  await page.goto('/');
  await uploadAndSettle(page, JPG);

  await page.getByRole('button', { name: /写真に保存/ }).click();
  await expect(page.locator('.file-row')).toHaveCount(1); // cancel keeps the list
  await expect(page.locator('.save-error')).toHaveCount(0); // no error notice on cancel

  await page.getByRole('button', { name: /写真に保存/ }).click();
  await expect(page.locator('.empty-card')).toBeVisible(); // share success clears it
  expect(consoleErrors).toEqual([]);
});

test('Tier 2: thumbnails appear independently of the compress queue', async ({ page, consoleErrors }) => {
  // generateThumbnail fires in parallel with the compress queue; the row's
  // .file-thumb img is set as soon as the 112px decode finishes, well before
  // the full compress lands. Verify with a tight timeout that thumbs don't
  // wait on compress completion.
  await page.goto('/');
  await fileInput(page).setInputFiles([JPG, PNG]);

  // Tight timeout: thumb generation is ~10-30 ms per file via the native
  // resizeWidth downscaler, far faster than the full compress.
  await expect(page.locator('.file-thumb:not(.file-thumb-placeholder)')).toHaveCount(2, {
    timeout: 1000,
  });

  // Compress still settles cleanly afterwards.
  await expect(page.locator('.file-row.completed')).toHaveCount(2, { timeout: 10_000 });
  expect(consoleErrors).toEqual([]);
});

test('install banner appears after the first compression (iPhone UA) and dismissal persists', async ({ page, consoleErrors }) => {
  await page.goto('/');
  await expect(page.locator('.install-banner')).toHaveCount(0);

  await uploadAndSettle(page, JPG);
  await expect(page.locator('.install-banner')).toBeVisible();
  await expect(page.getByText('ホーム画面に追加できます')).toBeVisible();

  await page.getByRole('button', { name: '閉じる' }).click();
  await expect(page.locator('.install-banner')).toHaveCount(0);

  await page.reload();
  await uploadAndSettle(page, JPG);
  await expect(page.locator('.install-banner')).toHaveCount(0); // stays dismissed across reloads
  expect(consoleErrors).toEqual([]);
});
