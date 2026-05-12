// Regression: ISSUE-001 — changing the quality preset did not re-compress
// already-processed files (the segmented control only affected future uploads).
// Found by /qa on 2026-05-13
// Report: .gstack/qa-reports/qa-report-localhost-2026-05-13.md
import { describe, it, expect, beforeEach, vi } from 'vitest';

// jsdom has no canvas / createImageBitmap, and this regression is purely about
// whether changePreset re-runs the encode. Stand in: output size encodes the
// "quality" — high -> 80 bytes, standard -> 50, max -> 20.
vi.mock('../src/lib/compress', () => ({
  compressImage: vi.fn(
    async (_file: File, opts: { preset: 'high' | 'standard' | 'max' }) => {
      const sizeFor = { high: 80, standard: 50, max: 20 } as const;
      return {
        ok: true as const,
        value: {
          blob: new Blob([new Uint8Array(sizeFor[opts.preset])]),
          width: 10,
          height: 10,
          larger: false,
          thumbBlob: null,
        },
      };
    }
  ),
}));

import { handleFiles, changePreset } from '../src/app';
import { files, preset } from '../src/store/signals';

const fileList = (...names: string[]): FileList =>
  names.map(
    (n) => new File([new Uint8Array(1000)], n, { type: 'image/jpeg' })
  ) as unknown as FileList;

beforeEach(() => {
  files.value = [];
  preset.value = 'standard';
});

describe('Regression ISSUE-001 — quality preset re-compresses completed files', () => {
  it('re-encodes every completed file when the preset changes', async () => {
    await handleFiles(fileList('a.jpg', 'b.jpg'));
    expect(files.value.map((f) => f.result?.blob.size)).toEqual([50, 50]);

    await changePreset('max');
    expect(preset.value).toBe('max');
    expect(files.value.map((f) => f.result?.blob.size)).toEqual([20, 20]);

    await changePreset('high');
    expect(files.value.map((f) => f.result?.blob.size)).toEqual([80, 80]);
  });

  it('does nothing when the preset is unchanged', async () => {
    await handleFiles(fileList('a.jpg'));
    const before = files.value[0].result;
    await changePreset('standard');
    expect(files.value[0].result).toBe(before);
  });
});
