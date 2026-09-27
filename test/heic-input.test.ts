import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import { readHeicDimensions } from '../src/lib/heic-input';
import { validateImage } from '../src/lib/image-input';
import { compressImage } from '../src/lib/compress';
import { generateThumbnail } from '../src/lib/thumbnail';

// Re-encoded from our sample.jpg with macOS sips; no user photo metadata.
const fixture = () => new Uint8Array(readFileSync('e2e/fixtures/sample.heic'));
const file = (bytes: Uint8Array): File => ({
  size: bytes.length,
  slice: (a = 0, z = bytes.length) => ({ arrayBuffer: async () => bytes.slice(a, z).buffer }),
}) as unknown as File;
// Mutation locations belong to this checked-in fixture, not parser logic.
const locate = (bytes: Uint8Array, type: string) => {
  const encoded = new TextEncoder().encode(type);
  const result: number[] = [];
  for (let i = 0; i <= bytes.length - 4; i++)
    if (encoded.every((v, j) => bytes[i + j] === v)) result.push(i);
  return result;
};
const put = (bytes: Uint8Array, pos: number, n: number, value: number) => {
  const v = new DataView(bytes.buffer);
  if (n === 4) v.setUint32(pos, value); else v.setUint16(pos, value);
};

describe('bounded HEIC admission', () => {
  it('selects the primary grid instead of the first 512px tile', async () => {
    await expect(readHeicDimensions(file(fixture()))).resolves.toEqual({ width: 1200, height: 900 });
    await expect(validateImage(file(fixture()))).resolves.toEqual({ width: 1200, height: 900 });
  });
  it('applies primary irot to resize geometry', async () => {
    const b = fixture(); b[locate(b, 'irot')[0] + 4] = 1;
    await expect(readHeicDimensions(file(b))).resolves.toEqual({ width: 900, height: 1200 });
  });
  it('resolves a coded primary image by item ID', async () => {
    const b = fixture(); put(b, locate(b, 'pitm')[0] + 8, 2, 1);
    await expect(readHeicDimensions(file(b))).resolves.toEqual({ width: 512, height: 512 });
  });
  it('uses admitted HEIC in the existing pipeline and rejects encoder MIME fallback', async () => {
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 1200, height: 900, close }));
    const canvas = document.createElement('canvas');
    const create = vi.spyOn(document, 'createElement').mockReturnValue(canvas);
    vi.spyOn(canvas, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    let mime = 'image/jpeg';
    vi.spyOn(canvas, 'toBlob').mockImplementation(cb => cb(new Blob(['encoded'], { type: mime })));
    try {
      const f = file(fixture());
      const result = await compressImage(f, { preset: 'standard', outputFormat: 'jpeg' });
      expect(result).toMatchObject({ ok: true, value: { width: 1200, height: 900 } });
      mime = 'image/png';
      const fallback = await compressImage(f, { preset: 'standard', outputFormat: 'webp' });
      expect(fallback).toMatchObject({ ok: false });
      expect(close).toHaveBeenCalledTimes(2);
      expect(canvas.width).toBe(0);
    } finally { create.mockRestore(); vi.restoreAllMocks(); vi.unstubAllGlobals(); }
  });
  it('rejects huge primary and tile dimensions before either decoder', async () => {
    for (const index of [0, 1]) {
      const b = fixture(), p = locate(b, 'ispe')[index];
      put(b, p + 8, 4, 10000); put(b, p + 12, 4, 10000);
      const decode = vi.fn(); vi.stubGlobal('createImageBitmap', decode);
      try {
        const f = file(b);
        await expect(validateImage(f)).rejects.toThrow('5000万');
        expect((await compressImage(f, { preset: 'standard', outputFormat: 'jpeg' })).ok).toBe(false);
        expect(await generateThumbnail(f)).toBeNull();
        expect(decode).not.toHaveBeenCalled();
      } finally { vi.unstubAllGlobals(); }
    }
  });
  it('rejects tile ispe that disagrees with the HEVC SPS', async () => {
    const b = fixture(); put(b, locate(b, 'ispe')[0] + 8, 4, 256);
    await expect(readHeicDimensions(file(b))).rejects.toThrow('安全');
  });
  it('rejects grid payload dimensions that disagree with ispe', async () => {
    const b = fixture(); put(b, locate(b, 'idat')[0] + 8, 2, 1500);
    await expect(readHeicDimensions(file(b))).rejects.toThrow('安全');
  });
  it('rejects missing primary items, bad associations and duplicate tile references', async () => {
    const mutations = [
      (b: Uint8Array) => put(b, locate(b, 'pitm')[0] + 8, 2, 999),
      (b: Uint8Array) => { b[locate(b, 'ipma')[0] + 15] = 127; },
      (b: Uint8Array) => put(b, locate(b, 'dimg')[0] + 10, 2, 1),
      (b: Uint8Array) => put(b, locate(b, 'dimg')[0] + 8, 2, 7), // grid self-reference
    ];
    for (const mutate of mutations) {
      const b = fixture(); mutate(b);
      await expect(readHeicDimensions(file(b))).rejects.toThrow();
    }
  });
  it('rejects unsupported derived images and unknown transformative properties', async () => {
    for (const [from, to] of [['grid', 'tmap'], ['irot', 'clap']]) {
      const b = fixture(); b.set(new TextEncoder().encode(to), locate(b, from)[0]);
      await expect(readHeicDimensions(file(b))).rejects.toThrow('安全');
    }
  });
  it('rejects truncated input and malformed/oversized boxes', async () => {
    const bytes = fixture();
    for (const end of [0, 4, 35, 100, 700, bytes.length - 1])
      await expect(readHeicDimensions(file(bytes.slice(0, end)))).rejects.toThrow();
    for (const size of [0, 4, 0xffffffff]) {
      const b = fixture(); put(b, locate(b, 'meta')[0] - 4, 4, size);
      await expect(readHeicDimensions(file(b))).rejects.toThrow();
    }
  });
  it('rejects a forged grid tile count and external item references', async () => {
    const grid = fixture(); grid[locate(grid, 'idat')[0] + 6] = 255;
    await expect(readHeicDimensions(file(grid))).rejects.toThrow();
    const external = fixture();
    // iloc fullbox(4), sizes(2), count(2), id(2), method(2), data_reference_index(2)
    put(external, locate(external, 'iloc')[0] + 16, 2, 1);
    await expect(readHeicDimensions(file(external))).rejects.toThrow();
  });
  it('caches validation without retaining a full-file buffer', async () => {
    const f = file(fixture()), slice = vi.spyOn(f, 'slice');
    await validateImage(f); const n = slice.mock.calls.length;
    await validateImage(f); expect(slice).toHaveBeenCalledTimes(n);
    expect(slice.mock.calls.every(([a = 0, b = 0]) => b - a <= 1024 * 1024)).toBe(true);
  });
});

// Synthetic container only; no device photo, metadata or encoded image content.
function toneMapFile(options: { target?: number; width?: number; primary?: number; external?: number; visibleUri?: boolean } = {}) {
  const join = (...parts: Uint8Array[]) => new Uint8Array(parts.flatMap(p => [...p]));
  const u = (n: number, bytes = 4) => new Uint8Array(Array.from({ length: bytes }, (_, i) => Math.floor(n / 256 ** (bytes - i - 1)) & 255));
  const str = (s: string) => new TextEncoder().encode(s);
  const box = (type: string, ...data: Uint8Array[]) => { const b = join(...data); return join(u(b.length + 8), str(type), b); };
  const full = u(0);
  const original = fixture(), hvcc = locate(original, 'hvcC')[0];
  const codec = original.slice(hvcc - 4, hvcc - 4 + new DataView(original.buffer).getUint32(hvcc - 4));
  const info = (id: number, type: string, hidden = false) => box('infe', u(0x02000000 + Number(hidden)), u(id, 2), u(0, 2), str(type), str('\0'), ...(type === 'uri ' ? [str('urn:test:metadata\0')] : []));
  const assoc = (id: number, indices: number[]) => join(u(id, 2), u(indices.length, 1), new Uint8Array(indices));
  const item = (id: number) => join(u(id, 2), u(1, 2), u(options.external && id === 4 ? 1 : 0, 2), u(1, 2), u(id - 1), u(1));
  return file(join(
    box('ftyp', str('heic'), u(0), str('mif1')),
    box('meta', full,
      box('hdlr', full, u(0), str('pict')),
      box('pitm', full, u(options.primary ?? 1, 2)),
      box('iinf', full, u(4, 2), info(1, 'hvc1'), info(2, 'hvc1'), info(3, 'tmap'), info(4, 'uri ', !options.visibleUri)),
      box('iprp', box('ipco', box('ispe', full, u(512), u(512)), codec, box('ispe', full, u(options.width ?? 512), u(512))),
        box('ipma', full, u(3), assoc(1, [1, 2]), assoc(2, [1, 2]), assoc(3, [3]))),
      box('iref', full, box('dimg', u(3, 2), u(2, 2), u(1, 2), u(options.target ?? 2, 2))),
      box('idat', new Uint8Array(4)),
      box('iloc', u(0x01000000), new Uint8Array([0x44, 0]), u(4, 2), item(1), item(2), item(3), item(4)),
    ),
  ));
}

describe('non-primary tone map admission', () => {
  it('checks base and gain geometry while permitting embedded URI metadata', async () => {
    await expect(readHeicDimensions(toneMapFile())).resolves.toEqual({ width: 512, height: 512 });
  });
  it('rejects self references, duplicate inputs and metadata used as an image', async () => {
    for (const target of [1, 3, 4]) await expect(readHeicDimensions(toneMapFile({ target }))).rejects.toThrow();
  });
  it('rejects inconsistent derived dimensions and a tone-map primary', async () => {
    await expect(readHeicDimensions(toneMapFile({ width: 1024 }))).rejects.toThrow();
    await expect(readHeicDimensions(toneMapFile({ primary: 3 }))).rejects.toThrow();
  });
  it('rejects external data and non-hidden URI items', async () => {
    await expect(readHeicDimensions(toneMapFile({ external: 1 }))).rejects.toThrow();
    await expect(readHeicDimensions(toneMapFile({ visibleUri: true }))).rejects.toThrow();
  });
});
