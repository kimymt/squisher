import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const jpg = fileURLToPath(new URL('./fixtures/sample.jpg', import.meta.url));

test('development probe compares all three paths and exports no file name', async ({ page }) => {
  await page.goto('/tools/ios27.html');
  await page.locator('#file').setInputFiles(jpg);
  await expect(page.locator('#report')).toContainText('JPEG');
  for (const path of ['current', 'bitmap', 'element']) {
    await page.locator(`#${path}`).click();
    await expect(page.locator('#preview')).toBeVisible();
    await expect(page.locator('#current')).toBeEnabled();
    await expect(page.locator('#report')).toContainText(`"path": "${path}"`);
  }
  const report = await page.locator('#report').innerText();
  const records = JSON.parse(report);
  expect(records.filter((r: { event: string }) => r.event === 'result')).toHaveLength(3);
  expect(records.filter((r: { event: string }) => r.event === 'failure')).toHaveLength(0);
  expect(report).not.toContain('sample.jpg');
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#export').click();
  expect((await downloadEvent).suggestedFilename()).toBe('ios27-probe.json');
});

test('corrupt input settles and permits another image', async ({ page }) => {
  await page.goto('/tools/ios27.html');
  await page.locator('#file').setInputFiles({ name: 'private.heic', mimeType: 'image/heic', buffer: Buffer.from('broken') });
  for (const path of ['current', 'bitmap', 'element']) {
    await page.locator(`#${path}`).click();
    await expect(page.locator('#current')).toBeEnabled();
    await expect(page.locator('#share')).toBeDisabled();
  }
  const records = JSON.parse(await page.locator('#report').innerText());
  expect(records.filter((r: { event: string }) => r.event === 'failure')).toHaveLength(3);
  await page.locator('#file').setInputFiles(jpg);
  await page.locator('#element').click();
  await expect(page.locator('#preview')).toBeVisible();
});

test('wrong encoder MIME cannot be shared', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      original.call(this, callback, 'image/png');
    };
  });
  await page.goto('/tools/ios27.html');
  await page.locator('#file').setInputFiles(jpg);
  await page.locator('#element').click();
  await expect(page.locator('#report')).toContainText('指定形式と実形式が異なる');
  await expect(page.locator('#share')).toBeDisabled();
});
