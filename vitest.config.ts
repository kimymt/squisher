import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Mirror the build-time define from vite.config.ts so component tests can
// reference __APP_VERSION__ without going through the Vite production
// transform.
const pkg = JSON.parse(
  readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), 'package.json'),
    'utf-8'
  )
) as { version: string };

export default defineConfig({
  plugins: [preact()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
