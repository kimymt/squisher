import { describe, it, expect } from 'vitest';
import { PRESETS, PRESET_ORDER } from '../src/lib/presets';

describe('PRESETS / PRESET_ORDER', () => {
  it('lists the three presets in high → standard → max order', () => {
    expect(PRESET_ORDER).toEqual(['high', 'standard', 'max']);
  });

  it('every preset has a non-empty label, a quality in (0, 1], and a positive maxDimension', () => {
    for (const key of PRESET_ORDER) {
      const p = PRESETS[key];
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.quality).toBeGreaterThan(0);
      expect(p.quality).toBeLessThanOrEqual(1);
      expect(p.maxDimension).toBeGreaterThan(0);
    }
  });

  it('quality and maxDimension do not increase as compression gets stronger', () => {
    const [high, standard, max] = PRESET_ORDER.map((k) => PRESETS[k]);
    expect(high.quality).toBeGreaterThan(standard.quality);
    expect(standard.quality).toBeGreaterThan(max.quality);
    expect(high.maxDimension).toBeGreaterThanOrEqual(standard.maxDimension);
    expect(standard.maxDimension).toBeGreaterThanOrEqual(max.maxDimension);
  });
});
