// resizeHintFor() decides the decode-time resize hint for compressImage.
// jsdom has no canvas / createImageBitmap, so the full pipeline is covered
// by E2E; the hint decision is pure and unit-tested here.
//
// Regression: passing `resizeWidth: maxDimension` unconditionally applied the
// long-side cap to the WIDTH, so portrait sources (the common iPhone case)
// decoded a bitmap ~78% larger than needed (3024×4032 → 2560×3413 instead of
// 1920×2560) and got resampled a second time in drawImage.
import { describe, it, expect } from 'vitest';
import { resizeHintFor } from '../src/lib/compress';

const MAX = 2560; // standard preset long-side cap

describe('resizeHintFor', () => {
  it('returns no hint when dimensions are unknown (probe skipped or failed)', () => {
    expect(resizeHintFor(null, MAX)).toBeUndefined();
  });

  it('returns no hint when the source already fits the cap', () => {
    expect(resizeHintFor({ width: 1200, height: 900 }, MAX)).toBeUndefined();
    expect(resizeHintFor({ width: MAX, height: 1920 }, MAX)).toBeUndefined();
  });

  it('caps the WIDTH for landscape sources', () => {
    expect(resizeHintFor({ width: 4032, height: 3024 }, MAX)).toEqual({
      resizeWidth: MAX,
      resizeQuality: 'high',
    });
  });

  it('REGRESSION: caps the HEIGHT (not the width) for portrait sources', () => {
    expect(resizeHintFor({ width: 3024, height: 4032 }, MAX)).toEqual({
      resizeHeight: MAX,
      resizeQuality: 'high',
    });
  });

  it('caps the width for square sources (either side is the long side)', () => {
    expect(resizeHintFor({ width: 4000, height: 4000 }, MAX)).toEqual({
      resizeWidth: MAX,
      resizeQuality: 'high',
    });
  });
});
