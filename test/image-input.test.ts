import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { readDimensions, validateImage, scheduleImage, MAX_INPUT_BYTES } from '../src/lib/image-input';
import { compressImage } from '../src/lib/compress';
import { generateThumbnail } from '../src/lib/thumbnail';

const png = (w: number, h: number) => {
  const bytes = new Uint8Array(33);
  bytes.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16,w); view.setUint32(20,h);
  return bytes;
};
const input = (bytes: Uint8Array, size = bytes.length) => ({
  size, slice: () => ({ arrayBuffer: async () => bytes.buffer }),
}) as unknown as File;

describe('image admission before decode', () => {
  it('reads real JPEG and PNG fixtures', () => {
    for (const name of ['sample.jpg','sample.png']) {
      const dims = readDimensions(readFileSync(`e2e/fixtures/${name}`));
      expect(dims.width).toBeGreaterThan(0);
      expect(dims.height).toBeGreaterThan(0);
    }
  });
  it('rejects a tiny PNG header that requests 100 million pixels', () => {
    expect(() => readDimensions(png(10000,10000))).toThrow('5000万');
    expect(readDimensions(png(10000,5000))).toEqual({width:10000,height:5000});
    expect(() => readDimensions(png(16385,1))).toThrow('5000万');
    expect(() => readDimensions(png(0,1))).toThrow('ヘッダー');
  });
  it('validates extended WebP against its actual frame and rejects animation', () => {
    const bytes = new Uint8Array(60);
    bytes.set(new TextEncoder().encode('RIFF'), 0);
    bytes.set(new TextEncoder().encode('WEBPVP8X'), 8);
    bytes[16] = 10;
    bytes[24] = 9; bytes[27] = 19;
    bytes.set(new TextEncoder().encode('VP8 '), 30);
    bytes.set([0x9d,0x01,0x2a], 41);
    bytes[44] = 10; bytes[46] = 20;
    expect(readDimensions(bytes)).toEqual({width:10,height:20});
    bytes[44] = 11;
    expect(() => readDimensions(bytes)).toThrow('安全');
    bytes[20] = 2;
    expect(() => readDimensions(bytes)).toThrow('アニメーション');
  });
  it('rejects unsupported and truncated inputs', () => {
    for (const bytes of [new Uint8Array(), new Uint8Array([255,216,255,192,255,255]), new TextEncoder().encode('<svg></svg>')])
      expect(() => readDimensions(bytes)).toThrow();
  });
  it('blocks oversized files before even reading their headers', async () => {
    const file = input(png(10,10), MAX_INPUT_BYTES + 1);
    const slice = vi.spyOn(file,'slice');
    await expect(validateImage(file)).rejects.toThrow('100MB');
    expect(slice).not.toHaveBeenCalled();
  });
  it('blocks both thumbnail and full decode for dangerous small inputs', async () => {
    const decode = vi.fn();
    vi.stubGlobal('createImageBitmap',decode);
    try {
      const file = input(png(10000,10000));
      expect(await generateThumbnail(file)).toBeNull();
      expect((await compressImage(file, {preset:'standard',outputFormat:'jpeg'})).ok).toBe(false);
      expect(decode).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
  it('serializes independent callers and recovers after failed work', async () => {
    let release!: () => void;
    const events: string[] = [];
    const first = scheduleImage(async () => {
      events.push('first');
      await new Promise<void>(r => { release = r; });
      throw new Error('decode failed');
    });
    const failure = expect(first).rejects.toThrow('decode failed');
    const second = scheduleImage(async () => { events.push('second'); });
    await Promise.resolve();
    expect(events).toEqual(['first']);
    release();
    await failure; await second;
    expect(events).toEqual(['first','second']);
  });
});
