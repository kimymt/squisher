import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

test('PNG fallback disables WebP and requires explicit JPEG conversion', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      original.call(this, callback, type === 'image/webp' ? 'image/png' : type, quality);
    };
  });
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles(fixture('sample.png'));
  const row = page.locator('.file-row');
  await expect(row).toContainText('透明部分は保持されません');
  await expect(row.getByRole('radio', { name: 'WebP', exact: true })).toBeDisabled();
  await expect(row).toHaveAttribute('aria-label', '失敗');
  await row.getByRole('radio', { name: 'JPEG', exact: true }).click();
  await expect(row).toHaveAttribute('aria-label', '完了');
  await expect(row.getByRole('radio', { name: 'JPEG', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(row.getByRole('radio', { name: 'WebP', exact: true })).toBeDisabled();
});

test('JPEG remains usable when WebP is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      if (type === 'image/webp') { callback(null); return; }
      original.call(this, callback, type, quality);
    };
  });
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles(fixture('sample.jpg'));
  const row = page.locator('.file-row');
  await expect(row).toHaveAttribute('aria-label', '完了');
  await expect(row.getByRole('radio', { name: 'WebP', exact: true })).toBeDisabled();
  await expect(row).toContainText('このブラウザではWebP形式に変換できません');
});
