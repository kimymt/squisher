import { describe, it, expect, beforeEach } from 'vitest';
import {
  files,
  skipLarger,
  saveError,
  showInstallBanner,
  sharedIds,
  totalOriginalSize,
  totalCompressedSize,
  saveableFiles,
  canSave,
  allShared,
  nextId,
  updateFile,
  addFiles,
  markShared,
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
  sharedIds.value = new Set();
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

  it('excludes files whose ids are in sharedIds (streaming share)', () => {
    addFiles([completed('a', 100, 40), completed('b', 100, 40), completed('c', 100, 40)]);
    expect(saveableFiles.value.map((f) => f.id)).toEqual(['a', 'b', 'c']);
    markShared(['a', 'c']);
    expect(saveableFiles.value.map((f) => f.id)).toEqual(['b']);
    expect(canSave.value).toBe(true);
  });

  it('canSave becomes false when every saveable file has been marked shared', () => {
    addFiles([completed('a', 100, 40), completed('b', 100, 40)]);
    markShared(['a', 'b']);
    expect(saveableFiles.value).toHaveLength(0);
    expect(canSave.value).toBe(false);
  });
});

describe('markShared / sharedIds', () => {
  it('is a no-op on an empty array (no signal update, no allocation)', () => {
    const before = sharedIds.value;
    markShared([]);
    expect(sharedIds.value).toBe(before);
  });

  it('adds a single id to sharedIds via new Set re-assignment', () => {
    const before = sharedIds.value;
    markShared(['a']);
    expect(sharedIds.value.has('a')).toBe(true);
    expect(sharedIds.value).not.toBe(before); // reference changed = signal reactivity triggered
  });

  it('adds multiple ids, deduplicating via Set semantics', () => {
    markShared(['a', 'b']);
    markShared(['b', 'c']); // 'b' is duplicate
    expect([...sharedIds.value].sort()).toEqual(['a', 'b', 'c']);
  });

  it('triggers saveableFiles re-computation after markShared() is called', () => {
    addFiles([completed('a', 100, 40)]);
    expect(saveableFiles.value).toHaveLength(1);
    markShared(['a']);
    expect(saveableFiles.value).toHaveLength(0); // reactive update
  });

  it('REGRESSION: .add() does NOT trigger reactivity — must use markShared() instead', () => {
    // This test pins down the @preact/signals + Set gotcha.
    // Mutating the Set in place keeps reference equality, so computed values
    // do not see the change. The fix is to always use markShared() which
    // assigns a brand-new Set.
    addFiles([completed('a', 100, 40)]);
    expect(saveableFiles.value).toHaveLength(1);

    // Anti-pattern: direct mutation. Reactivity will NOT fire.
    sharedIds.value.add('a');
    expect(sharedIds.value.has('a')).toBe(true); // Set state did change
    expect(saveableFiles.value).toHaveLength(1); // but the computed is STALE

    // Correct pattern: markShared() reassigns the signal.
    // We pass an empty array first to verify it's a no-op...
    markShared([]);
    expect(saveableFiles.value).toHaveLength(1); // still stale

    // ...then we trigger reactivity by re-assigning. Even passing 'a' again
    // (already in the Set) re-allocates the Set and the computed re-runs,
    // finally seeing the shared state.
    markShared(['a']);
    expect(saveableFiles.value).toHaveLength(0);
  });
});

describe('allShared', () => {
  it('is false when sharedIds is empty', () => {
    addFiles([completed('a', 100, 40)]);
    expect(allShared.value).toBe(false);
  });

  it('is false when files is empty', () => {
    expect(allShared.value).toBe(false);
  });

  it('is true when every saveable file has been shared', () => {
    addFiles([completed('a', 100, 40), completed('b', 100, 40)]);
    markShared(['a', 'b']);
    expect(allShared.value).toBe(true);
  });

  it('treats grew + skipLarger files as already accounted for (not a blocker)', () => {
    addFiles([completed('a', 100, 40), completed('grew', 100, 200)]);
    markShared(['a']);
    // 'grew' is skipped by skipLarger=true, so allShared should be true.
    expect(allShared.value).toBe(true);
  });

  it('treats errored files as accounted for (errors do not block "all shared")', () => {
    addFiles([completed('a', 100, 40), completed('bad', 100, 40)]);
    updateFile('bad', { status: 'error', result: undefined });
    markShared(['a']);
    expect(allShared.value).toBe(true);
  });

  it('is false when a file is still processing', () => {
    addFiles([completed('a', 100, 40), completed('b', 100, 40)]);
    updateFile('b', { status: 'processing', result: undefined });
    markShared(['a']);
    expect(allShared.value).toBe(false);
  });
});
