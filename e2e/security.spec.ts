import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

let server: Server;
let origin: string;
test.beforeAll(async () => {
  const assets = new Map<string, Buffer>();
  const collect = (dir: string, prefix = '') => {
    for (const entry of readdirSync(dir, {withFileTypes:true})) {
      const url = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) collect(join(dir, entry.name), url);
      else assets.set(url, readFileSync(join(dir, entry.name)));
    }
  };
  collect('dist');
  const headers = Object.fromEntries(readFileSync('dist/_headers','utf8').split('\n')
    .filter(line => line.startsWith('  ')).map(line => {
      const index = line.indexOf(':');
      return [line.slice(0,index).trim(),line.slice(index+1).trim()];
    }));
  server = createServer((request,response) => {
    const path = new URL(request.url!, 'http://localhost').pathname;
    const file = path === '/' ? '/index.html' : path;
    const body = assets.get(file);
    const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : file.endsWith('.webmanifest') ? 'application/manifest+json' : file.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
    response.writeHead(body ? 200 : 404, {...headers,'Content-Type':type});
    response.end(body);
  });
  await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
  const address = server.address() as {port:number};
  origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

test('production CSP permits compression, thumbnails and offline PWA', async ({page, context}) => {
  const violations: string[] = [];
  page.on('console', msg => { if (/violates.*Content Security Policy/i.test(msg.text())) violations.push(msg.text()); });
  await page.goto(origin);
  await page.locator('input[type=file]').first().setInputFiles('e2e/fixtures/sample.jpg');
  await expect(page.locator('.file-row.completed')).toHaveCount(1);
  await expect(page.locator('img.file-thumb')).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.locator('.empty-card')).toBeVisible();
  } finally { await context.setOffline(false); }
  expect(violations).toEqual([]);
});

test('oversized pixel count is rejected before browser decode', async ({page}) => {
  await page.addInitScript(() => {
    (window as unknown as {decodes:number}).decodes = 0;
    const original = window.createImageBitmap;
    window.createImageBitmap = ((...args: Parameters<typeof original>) => {
      (window as unknown as {decodes:number}).decodes++;
      return original(...args);
    }) as typeof original;
  });
  await page.goto(origin);
  const header = Buffer.alloc(33);
  Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]).copy(header);
  header.writeUInt32BE(10000,16); header.writeUInt32BE(10000,20);
  await page.locator('input[type=file]').first().setInputFiles({name:'large.png',mimeType:'image/png',buffer:header});
  await expect(page.locator('.file-error')).toContainText('5000万');
  expect(await page.evaluate(() => (window as unknown as {decodes:number}).decodes)).toBe(0);
});
