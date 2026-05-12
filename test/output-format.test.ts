import { describe, it, expect } from 'vitest';
import {
  detectOutputFormat,
  mimeFor,
  extFor,
} from '../src/lib/output-format';

const fakeFile = (name: string): File =>
  new File([new Uint8Array([1, 2, 3])], name, { type: 'application/octet-stream' });

describe('detectOutputFormat', () => {
  it('keeps PNG sources as WebP (PNG transparency survives, smaller than re-encoded PNG)', () => {
    expect(detectOutputFormat(fakeFile('shot.png'))).toBe('webp');
    expect(detectOutputFormat(fakeFile('SCREENSHOT.PNG'))).toBe('webp');
  });

  it('routes JPEG and everything else to JPEG', () => {
    expect(detectOutputFormat(fakeFile('IMG_1234.jpg'))).toBe('jpeg');
    expect(detectOutputFormat(fakeFile('IMG_1234.jpeg'))).toBe('jpeg');
    // iOS rewrites HEIC to .jpeg on input, but a literal .heic name still maps to jpeg.
    expect(detectOutputFormat(fakeFile('IMG_1234.heic'))).toBe('jpeg');
    expect(detectOutputFormat(fakeFile('no-extension'))).toBe('jpeg');
  });
});

describe('mimeFor / extFor', () => {
  it('maps jpeg to image/jpeg and the jpg extension', () => {
    expect(mimeFor('jpeg')).toBe('image/jpeg');
    expect(extFor('jpeg')).toBe('jpg');
  });

  it('maps webp to image/webp and the webp extension', () => {
    expect(mimeFor('webp')).toBe('image/webp');
    expect(extFor('webp')).toBe('webp');
  });
});
