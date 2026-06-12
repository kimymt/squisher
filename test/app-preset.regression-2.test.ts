// Regression: changing the quality preset while a file was still processing
// left that file compressed at the OLD preset. changePreset() only re-queues
// files that are already "completed", so an in-flight file finished with a
// stale result and was never re-encoded — the UI claimed the new preset while
// the row's numbers were from the old one. compressOne now re-reads the live
// preset after each encode and re-runs until they match.
// Found by repository code review on 2026-06-12.
import { describe, it, expect, beforeEach, vi } from 'vitest';

type PresetKey = 'high' | 'standard' | 'max';
const sizeFor: Record<PresetKey, number> = { high: 80, standard: 50, max: 20 };

// Controllable mock: each compressImage call parks here until the test
// resolves it, so we can flip the preset signal mid-encode.
interface PendingEncode {
  preset: PresetKey;
  resolve: () => void;
}
const pending: PendingEncode[] = [];

vi.mock('../src/lib/compress', () => ({
  compressImage: vi.fn(
    (_file: File, opts: { preset: PresetKey }) =>
      new Promise((res) => {
        pending.push({
          preset: opts.preset,
          resolve: () =>
            res({
              ok: true as const,
              value: {
                blob: new Blob([new Uint8Array(sizeFor[opts.preset])]),
                width: 10,
                height: 10,
                larger: false,
              },
            }),
        });
      })
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
  pending.length = 0;
});

describe('Regression — preset change during processing re-encodes in-flight files', () => {
  it('re-runs an in-flight encode when the preset changes mid-compress', async () => {
    const done = handleFiles(fileList('a.jpg'));

    await vi.waitFor(() => expect(pending).toHaveLength(1));
    expect(pending[0].preset).toBe('standard');
    expect(files.value[0].status).toBe('processing');

    // Preset flips while the encode is in flight. The file is not yet
    // "completed", so changePreset itself re-queues nothing for it.
    const changed = changePreset('max');

    pending[0].resolve();

    // compressOne must notice the stale preset and start a second encode.
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    expect(pending[1].preset).toBe('max');
    pending[1].resolve();

    await Promise.all([done, changed]);
    expect(files.value[0].status).toBe('completed');
    expect(files.value[0].result?.blob.size).toBe(sizeFor.max);
  });

  it('encodes exactly once when the preset does not change mid-flight', async () => {
    const done = handleFiles(fileList('a.jpg'));

    await vi.waitFor(() => expect(pending).toHaveLength(1));
    pending[0].resolve();
    await done;

    expect(pending).toHaveLength(1);
    expect(files.value[0].status).toBe('completed');
    expect(files.value[0].result?.blob.size).toBe(sizeFor.standard);
  });
});
