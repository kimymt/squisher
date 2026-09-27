// Local-only diagnostic: requires the user's existing test image folder.
import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
const root = process.env.SQUISHER_TEST_IMAGES;
const names = ['test-48mp-q40.jpg', 'test-heic-36mpx.heic', 'test-jpeg-small.jpg'];
test.skip(!root || !names.every(n => existsSync(`${root}/${n}`)), 'Local diagnostic images unavailable');

test('local high-resolution images and mixed queue', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/tools/ios27.html');
  const outcomes = [];
  for (const name of names.slice(0, 2)) {
    await page.locator('#file').setInputFiles(`${root}/${name}`);
    for (const preset of ['high', 'standard', 'max']) {
      await page.locator('#preset').selectOption(preset);
      await page.locator('#current').click();
      await expect(page.locator('#current')).toBeEnabled({ timeout: 30000 });
    }
    const records = JSON.parse(await page.locator('#report').innerText());
    expect(records.filter((r: {event: string}) => r.event === 'validation')).toHaveLength(3);
    if (name.endsWith('.jpg')) {
      const results = records.filter((r: {event: string}) => r.event === 'result');
      expect(results).toHaveLength(3);
      expect(results.map((r: {width: number}) => r.width)).toEqual([3840, 2560, 1920]);
      expect(results.every((r: {actualMime: string}) => r.actualMime === 'image/jpeg')).toBe(true);
    }
    outcomes.push({ name, records });
    await page.reload();
  }
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles(names.map(n => `${root}/${n}`));
  await expect(page.locator('.file-row.completed, .file-row.errored')).toHaveCount(3, { timeout: 60000 });
  const rows = await page.locator('.file-row').allTextContents();
  console.log('LOCAL_IMAGE_RESULTS', JSON.stringify({ outcomes, rows }));
  await expect(page.locator('.file-row').filter({ hasText: 'test-48mp-q40.jpg' })).toHaveClass(/completed/);
  await expect(page.locator('.file-row').filter({ hasText: 'test-jpeg-small.jpg' })).toHaveClass(/completed/);
});
