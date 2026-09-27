import { compressImage } from '../src/lib/compress';
import { validateImage } from '../src/lib/image-input';
import { PRESETS, type Preset } from '../src/lib/presets';
import { mimeFor, extFor } from '../src/lib/output-format';
import type { OutputFormat } from '../src/lib/types';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const input = $<HTMLInputElement>('file');
const preview = $<HTMLImageElement>('preview');
const controls = ['current', 'bitmap', 'element'];
const records: unknown[] = [];
let selected: File | undefined;
let output: File | undefined;
let previewUrl: string | undefined;
let busy = false;
const timeoutMs = 30_000;
const log = (record: unknown) => {
  records.push(record);
  $('report').textContent = JSON.stringify(records, null, 2);
};
const resetOutput = () => {
  output = undefined;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = undefined;
  preview.removeAttribute('src');
  preview.hidden = true;
  $<HTMLButtonElement>('share').disabled = true;
};
const lock = (value: boolean) => {
  busy = value;
  input.disabled = value;
  for (const id of ['route', 'preset', 'format', 'device'])
    ($<HTMLInputElement>(id)).disabled = value;
  for (const id of controls) $<HTMLButtonElement>(id).disabled = value || !selected;
  $<HTMLButtonElement>('share').disabled = value || !output;
};

// Bounded signature inspection, not a HEIF parser or dimension validator.
const signature = async (file: File) => {
  const b = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const str = (i: number, n: number) => String.fromCharCode(...b.slice(i, i + n));
  if (b[0] === 255 && b[1] === 216) return { kind: 'JPEG' };
  if (str(0, 8) === '\x89PNG\r\n\x1a\n') return { kind: 'PNG' };
  if (str(0, 4) === 'RIFF' && str(8, 4) === 'WEBP') return { kind: 'WebP' };
  if (b.length >= 16 && str(4, 4) === 'ftyp') {
    const size = new DataView(b.buffer).getUint32(0);
    if (size < 16 || size > b.length || size % 4) return { kind: 'ISO-BMFF (unparsed ftyp)' };
    const brands = [str(8, 4)];
    for (let p = 16; p + 4 <= size; p += 4) brands.push(str(p, 4));
    return { kind: brands.some(x => ['heic', 'heix', 'hevc', 'hevx'].includes(x)) ? 'HEIC-family' : 'ISO-BMFF', brands };
  }
  return { kind: 'unknown' };
};

input.addEventListener('change', async () => {
  resetOutput();
  selected = input.files?.[0];
  lock(true);
  try {
    if (!selected) return;
    if (selected.size > 100 * 1024 * 1024) {
      selected = undefined;
      log({ error: '検証対象は100MiB以下の写真に限定します。' });
      return;
    }
    log({ event: 'input', route: $<HTMLSelectElement>('route').value,
      device: $<HTMLInputElement>('device').value,
      standalone: matchMedia('(display-mode: standalone)').matches,
      mime: selected.type, extension: /\.(heic|heif|jpg|jpeg|png|webp|avif)$/i.exec(selected.name)?.[1].toLowerCase() ?? 'unknown',
      bytes: selected.size, signature: await signature(selected) });
  } catch { log({ error: '入力情報を読み取れませんでした。' }); }
  finally { lock(false); }
});

// Timed-out bitmap decodes can still finish. Release their late result.
const bitmapSource = (file: File): Promise<ImageBitmap> => new Promise((resolve, reject) => {
  let expired = false;
  const timer = setTimeout(() => { expired = true; reject(new Error('bitmap timeout')); }, timeoutMs);
  Promise.resolve().then(() => createImageBitmap(file)).then(bitmap => {
    clearTimeout(timer);
    if (expired) bitmap.close(); else resolve(bitmap);
  }, error => { clearTimeout(timer); reject(error); });
});

const elementSource = (file: File): Promise<{ image: HTMLImageElement; release: () => void }> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    const release = () => {
      image.onload = image.onerror = null;
      image.removeAttribute('src');
      URL.revokeObjectURL(url);
    };
    const timer = setTimeout(() => { release(); reject(new Error('image timeout')); }, timeoutMs);
    image.onload = () => { clearTimeout(timer); image.onload = image.onerror = null; resolve({ image, release }); };
    image.onerror = () => { clearTimeout(timer); release(); reject(new Error('image decode failed')); };
    image.src = url;
  });

const encode = (canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('encode timeout')), timeoutMs);
    try {
      canvas.toBlob(blob => {
        clearTimeout(timer);
        if (blob) resolve(blob); else reject(new Error('null blob'));
      }, mime, quality);
    } catch (error) { clearTimeout(timer); reject(error); }
  });

async function run(path: string) {
  if (busy || !selected) return;
  const file = selected;
  const preset = $<HTMLSelectElement>('preset').value as Preset;
  const format = $<HTMLSelectElement>('format').value as OutputFormat;
  const start = performance.now();
  let release: (() => void) | undefined;
  let canvas: HTMLCanvasElement | undefined;
  resetOutput();
  lock(true);
  try {
    let blob: Blob, width: number, height: number;
    if (path === 'current') {
      const dims = await validateImage(file);
      log({ event: 'validation', dimensions: dims });
      const result = await compressImage(file, { preset, outputFormat: format });
      if (!result.ok) throw new Error(result.error);
      ({ blob, width, height } = result.value);
    } else {
      let source: CanvasImageSource;
      let w: number, h: number;
      if (path === 'bitmap') {
        const bitmap = await bitmapSource(file);
        source = bitmap; w = bitmap.width; h = bitmap.height;
        release = () => bitmap.close();
      } else {
        const decoded = await elementSource(file);
        source = decoded.image; w = decoded.image.naturalWidth; h = decoded.image.naturalHeight;
        release = decoded.release;
      }
      log({ event: 'decoded', path, width: w, height: h, ms: Math.round(performance.now() - start) });
      if (!w || !h || w * h > 50_000_000 || w > 16384 || h > 16384)
        throw new Error('描画対象の寸法上限を超えています（デコード後の判定）。');
      const scale = Math.min(1, PRESETS[preset].maxDimension / Math.max(w, h));
      width = Math.max(1, Math.round(w * scale)); height = Math.max(1, Math.round(h * scale));
      canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('no canvas context');
      context.drawImage(source, 0, 0, width, height);
      release(); release = undefined;
      blob = await encode(canvas, mimeFor(format), PRESETS[preset].quality);
    }
    log({ event: 'result', path, preset, requestedMime: mimeFor(format), actualMime: blob.type,
      bytes: blob.size, inputBytes: file.size, width, height,
      ms: Math.round(performance.now() - start), signature: await signature(new File([blob], 'result')) });
    if (blob.type !== mimeFor(format)) throw new Error('指定形式と実形式が異なるため共有しません。');
    output = new File([blob], `probe.${extFor(format)}`, { type: blob.type });
    previewUrl = URL.createObjectURL(blob); preview.src = previewUrl; preview.hidden = false;
  } catch (error) {
    log({ event: 'failure', path, error: error instanceof Error ? error.message : 'unknown', ms: Math.round(performance.now() - start) });
  } finally {
    release?.();
    if (canvas) canvas.width = canvas.height = 0;
    lock(false);
  }
}
for (const path of controls) $(path).addEventListener('click', () => void run(path));
$('share').addEventListener('click', async () => {
  if (!output || busy) return;
  try {
    if (!navigator.canShare?.({ files: [output] })) throw new Error('file share unsupported');
    await navigator.share({ files: [output] });
    log({ event: 'share', outcome: 'API resolved; 写真への保存は目視確認が必要' });
  } catch (error) { log({ event: 'share', outcome: error instanceof Error ? error.name : 'failed' }); }
});
$('export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'ios27-probe.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener('pagehide', resetOutput);
