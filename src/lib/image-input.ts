import { readHeicDimensions } from './heic-input';
/** Bounds apply before either the thumbnail or full image decoder runs. */
export const MAX_INPUT_BYTES = 100 * 1024 * 1024;
export const MAX_FILES = 50;
export const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
const MAX_PIXELS = 50_000_000;
const MAX_SIDE = 16384;
const HEADER_BYTES = 1024 * 1024;
export interface Dimensions { width: number; height: number }

export const readDimensions = (bytes: Uint8Array): Dimensions => {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number, length: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + length));
  let width = 0, height = 0;
  if (bytes.length >= 24 && text(0, 8) === '\x89PNG\r\n\x1a\n' && v.getUint32(8) === 13 && text(12, 4) === 'IHDR') {
    width = v.getUint32(16); height = v.getUint32(20);
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let p = 2;
    while (p + 3 < bytes.length) {
      if (bytes[p++] !== 0xff) break;
      while (bytes[p] === 0xff) p++;
      const marker = bytes[p++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (p + 2 > bytes.length) break;
      const length = v.getUint16(p);
      if (length < 2 || p + length > bytes.length) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && length >= 8) {
        height = v.getUint16(p + 3); width = v.getUint16(p + 5); break;
      }
      p += length;
    }
  } else if (bytes.length >= 30 && text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP') {
    const kind = text(12, 4);
    if (kind === 'VP8X') {
      width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
      // Reject animation, and validate the actual frame as well as the canvas.
      if (bytes[20] & 2) throw new Error('アニメーションWebPには対応していません。');
      let p = 30;
      let frame: Dimensions | undefined;
      while (p + 8 <= bytes.length) {
        const kind = text(p, 4);
        if (kind === 'VP8 ' || kind === 'VP8L') {
          const header = new Uint8Array(42);
          header.set(bytes.slice(0, 12));
          header.set(bytes.slice(p, p + 30), 12);
          frame = readDimensions(header);
          break;
        }
        p += 8 + v.getUint32(p + 4, true) + (v.getUint32(p + 4, true) % 2);
      }
      if (!frame || frame.width !== width || frame.height !== height)
        throw new Error('WebPの画像寸法を安全に確認できません。');
    } else if (kind === 'VP8 ' && text(23, 3) === '\x9d\x01\x2a') {
      width = v.getUint16(26, true) & 0x3fff; height = v.getUint16(28, true) & 0x3fff;
    } else if (kind === 'VP8L' && bytes[20] === 0x2f) {
      const bits = v.getUint32(21, true);
      width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1;
    }
  }
  if (!width || !height) throw new Error('画像形式またはヘッダーを読み取れません。JPEG・PNG・WebP を選択してください。');
  if (width > MAX_SIDE || height > MAX_SIDE || width * height > MAX_PIXELS)
    throw new Error('画像が大きすぎます。5000万画素以下・各辺16384px以下の画像を選択してください。');
  return { width, height };
};

const checked = new WeakMap<File, Promise<Dimensions>>();
export const validateImage = (file: File): Promise<Dimensions> => {
  let result = checked.get(file);
  if (!result) {
    result = (async () => {
      if (file.size > MAX_INPUT_BYTES) throw new Error('ファイルが大きすぎます。1枚100MB以下の画像を選択してください。');
      const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      if (signature.length >= 8 && String.fromCharCode(...signature.subarray(4, 8)) === 'ftyp')
        return readHeicDimensions(file);
      return readDimensions(new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer()));
    })();
    checked.set(file, result);
  }
  return result;
};

/** One shared decoder lane, including separate file selections and preset changes. */
let tail: Promise<unknown> = Promise.resolve();
export const scheduleImage = <T>(work: () => Promise<T>): Promise<T> => {
  const result = tail.then(work);
  tail = result.catch(() => undefined);
  return result;
};
