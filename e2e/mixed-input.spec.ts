import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

test('mixed input recovers from unsupported encoding and HEIC decode failure without parallel decodes', async ({ page }) => {
  await page.addInitScript(() => {
    const originalEncode = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      originalEncode.call(this, callback, type === 'image/webp' ? 'image/png' : type, quality);
    };
    const originalDecode = window.createImageBitmap;
    let active = 0;
    const state = { maxActive: 0, heicAttempts: 0 };
    Object.assign(window, { batchState: state });
    window.createImageBitmap = (async (...args: Parameters<typeof originalDecode>) => {
      active++;
      state.maxActive = Math.max(state.maxActive, active);
      try {
        await new Promise(resolve => setTimeout(resolve, 20));
        if (args[0] instanceof File && args[0].name.endsWith('.heic')) {
          state.heicAttempts++;
          throw new DOMException('Controlled codec failure', 'InvalidStateError');
        }
        return await originalDecode(...args);
      } finally { active--; }
    }) as typeof originalDecode;
  });
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles([
    fixture('sample.png'), fixture('sample.heic'), fixture('sample.jpg'),
  ]);
  const rows = page.locator('.file-row');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toHaveAttribute('aria-label', '失敗');
  await expect(rows.nth(1)).toContainText('画像を読み込めませんでした');
  await expect(rows.nth(2)).toHaveAttribute('aria-label', '完了');
  await expect(page.getByRole('button', { name: '写真に保存(1)', exact: true })).toBeEnabled();
  await rows.nth(0).getByRole('radio', { name: 'JPEG', exact: true }).click();
  await expect(page.locator('.file-row.completed')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '写真に保存(2)', exact: true })).toBeEnabled();
  const state = await page.evaluate(() => (window as unknown as { batchState: { maxActive: number; heicAttempts: number } }).batchState);
  expect(state).toEqual({ maxActive: 1, heicAttempts: 1 });
});

test('48MP JPEG follows the existing resize path', async ({ page }) => {
  await page.goto('/');
  // Synthetic raster: checks desktop browser admission/resize, not iOS memory
  // use, photographic detail, HDR, or HEIC codec support.
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 8064; canvas.height = 6048;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#407090'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/jpeg'));
    canvas.width = canvas.height = 0;
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic-48mp.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(bytes) });
  await expect(page.locator('.file-row.completed')).toHaveCount(1);
  const dimensions = await page.evaluate(async () => {
    const { files } = await import('/src/store/signals.ts');
    const result = files.value[0].result;
    return { width: result?.width, height: result?.height };
  });
  // Native decode-time resize may round the inferred short side by 1px.
  expect(dimensions.width).toBe(2560);
  expect(Math.abs(dimensions.height! - 1920)).toBeLessThanOrEqual(1);
  expect(Math.max(dimensions.width!, dimensions.height!)).toBeLessThanOrEqual(2560);
});
