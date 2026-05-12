import { describe, it, expect, beforeEach } from 'vitest';
import {
  files,
  skipLarger,
  saveError,
  showInstallBanner,
  totalOriginalSize,
  totalCompressedSize,
  saveableFiles,
  canSave,
  nextId,
  updateFile,
  addFiles,
} from '../src/store/signals';
import type { FileItem } from '../src/lib/types';

const bytes = (n: number): Uint8Array => new Uint8Array(n);

/** Build a completed FileItem whose original is `orig` bytes and output is `out` bytes. */
const completed = (id: string, orig: number, out: number): FileItem => ({
  id,
  file: new File([bytes(orig)], `${id}.jpg`, { type: 'image/jpeg' }),
  outputFormat: 'jpeg',
  status: 'completed',
  result: { blob: new Blob([bytes(out)]), width: 10, height: 10, larger: out > orig },
});

beforeEach(() => {
  files.value = [];
  skipLarger.value = true;
  saveError.value = null;
  showInstallBanner.value = false;
});

describe('nextId', () => {
  it('hands out unique f-prefixed ids', () => {
    const a = nextId();
    const b = nextId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^f\d+$/);
    expect(b).toMatch(/^f\d+$/);
  });
});

describe('addFiles / updateFile', () => {
  it('appends files and clears any standing save error', () => {
    saveError.value = '前回の保存に失敗';
    addFiles([completed('a', 100, 40)]);
    addFiles([completed('b', 200, 80)]);
    expect(files.value.map((f) => f.id)).toEqual(['a', 'b']);
    expect(saveError.value).toBeNull();
  });

  it('patches only the matching item', () => {
    addFiles([completed('a', 100, 40), completed('b', 200, 80)]);
    updateFile('b', { status: 'error', error: 'boom', result: undefined });
    expect(files.value[0].status).toBe('completed');
    expect(files.value[1].status).toBe('error');
    expect(files.value[1].error).toBe('boom');
    expect(files.value[1].result).toBeUndefined();
  });
});

describe('totals', () => {
  it('sums original sizes across all files', () => {
    addFiles([completed('a', 100, 40), completed('b', 200, 50)]);
    expect(totalOriginalSize.value).toBe(300);
  });

  it('counts the compressed size for shrunk files', () => {
    addFiles([completed('a', 100, 40), completed('b', 200, 50)]);
    expect(totalCompressedSize.value).toBe(90);
  });

  it('counts the original (not the bloated re-encode) when skipLarger is on and a file grew', () => {
    addFiles([completed('small', 100, 40), completed('grew', 100, 180)]);
    expect(totalCompressedSize.value).toBe(40 + 100);
  });

  it('counts the larger blob when skipLarger is off', () => {
    skipLarger.value = false;
    addFiles([completed('small', 100, 40), completed('grew', 100, 180)]);
    expect(totalCompressedSize.value).toBe(40 + 180);
  });

  it('ignores files that are not completed', () => {
    addFiles([completed('a', 100, 40)]);
    updateFile('a', { status: 'processing', result: undefined });
    expect(totalCompressedSize.value).toBe(0);
  });
});

describe('saveableFiles / canSave', () => {
  it('excludes grew-files while skipLarger is on, includes them when off', () => {
    addFiles([completed('small', 100, 40), completed('grew', 100, 180)]);
    expect(saveableFiles.value.map((f) => f.id)).toEqual(['small']);
    expect(canSave.value).toBe(true);

    skipLarger.value = false;
    expect(saveableFiles.value.map((f) => f.id)).toEqual(['small', 'grew']);
  });

  it('canSave is false when every file grew and skipLarger is on', () => {
    addFiles([completed('grew1', 100, 150), completed('grew2', 100, 200)]);
    expect(saveableFiles.value).toHaveLength(0);
    expect(canSave.value).toBe(false);
  });

  it('excludes errored / in-progress files', () => {
    addFiles([completed('a', 100, 40), completed('b', 100, 40)]);
    updateFile('b', { status: 'error', result: undefined });
    expect(saveableFiles.value.map((f) => f.id)).toEqual(['a']);
  });
});
