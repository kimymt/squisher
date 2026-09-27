import { signal } from '@preact/signals';

// Detect encoding, not decoding or a browser version. Shared by every row.
export const webpSupported = signal<boolean | null>(null);
let pending: Promise<boolean> | undefined;
export function checkWebpEncoding(): Promise<boolean> {
  if (!pending) pending = new Promise<boolean>((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    let settled = false;
    const finish = (supported: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      canvas.width = canvas.height = 0;
      webpSupported.value = supported;
      resolve(supported);
    };
    const timer = setTimeout(() => finish(false), 2000);
    try {
      if (!canvas.getContext('2d')) return finish(false);
      canvas.toBlob(blob => finish(blob?.type === 'image/webp'), 'image/webp', 0.75);
    } catch { finish(false); }
  });
  return pending;
}
