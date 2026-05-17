import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/preact';

const handleSave = vi.fn();
vi.mock('../src/app', () => ({
  handleSave: (...args: unknown[]) => handleSave(...args),
}));

import { SaveBar } from '../src/components/SaveBar';
import { files, skipLarger, saveError, sharedIds, markShared } from '../src/store/signals';
import type { FileItem } from '../src/lib/types';

const completed = (id: string, orig: number, out: number): FileItem => ({
  id,
  file: new File([new Uint8Array(orig)], `${id}.jpg`, { type: 'image/jpeg' }),
  outputFormat: 'jpeg',
  status: 'completed',
  result: { blob: new Blob([new Uint8Array(out)]), width: 10, height: 10, larger: out > orig },
});

const processing = (id: string): FileItem => ({
  id,
  file: new File([new Uint8Array(100)], `${id}.jpg`, { type: 'image/jpeg' }),
  outputFormat: 'jpeg',
  status: 'processing',
});

beforeEach(() => {
  files.value = [];
  skipLarger.value = true;
  saveError.value = null;
  sharedIds.value = new Set();
  handleSave.mockClear();
});
afterEach(cleanup);

describe('<SaveBar>', () => {
  it('shows zeroed totals and a disabled save button when nothing is saveable', () => {
    render(<SaveBar />);
    // Pair-form: same unit ("B") gets deduped → "0 → 0 B".
    expect(screen.getByLabelText('合計サイズ')).toHaveTextContent('0 → 0 B');
    const btn = screen.getByRole('button', { name: /写真に保存/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('写真に保存(0)');
  });

  it('counts saveable files and sums the totals', () => {
    files.value = [completed('a', 100, 40), completed('b', 200, 50)];
    render(<SaveBar />);
    expect(screen.getByLabelText('合計サイズ')).toHaveTextContent('300 → 90 B');
    const btn = screen.getByRole('button', { name: /写真に保存/ });
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveTextContent('写真に保存(2)');
  });

  it('skipLarger toggle excludes/includes grew files and the total follows', () => {
    files.value = [completed('small', 100, 40), completed('grew', 100, 180)];
    render(<SaveBar />);
    expect(screen.getByRole('button', { name: /写真に保存/ })).toHaveTextContent('写真に保存(1)');
    // grew counted as its original 100 since skipLarger=true → total 140 B
    expect(screen.getByLabelText('合計サイズ')).toHaveTextContent('200 → 140 B');

    fireEvent.click(screen.getByRole('checkbox'));
    expect(skipLarger.value).toBe(false);
    expect(screen.getByRole('button', { name: /写真に保存/ })).toHaveTextContent('写真に保存(2)');
  });

  it('renders the inline save error when set, and clicking save calls handleSave', () => {
    files.value = [completed('a', 100, 40)];
    saveError.value = '共有に失敗しました。ダウンロードを試みます。';
    render(<SaveBar />);
    expect(screen.getByText('共有に失敗しました。ダウンロードを試みます。')).toHaveClass('save-error');

    fireEvent.click(screen.getByRole('button', { name: /写真に保存/ }));
    expect(handleSave).toHaveBeenCalledOnce();
  });
});

describe('<SaveBar> streaming state matrix', () => {
  it('STATE 0/N/0: disabled "写真に保存(0)" + "N 件処理中" caption', () => {
    files.value = [processing('a'), processing('b')];
    render(<SaveBar />);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveTextContent('写真に保存(0)');
    const caption = screen.getByText('2 件処理中');
    expect(caption).toHaveAttribute('aria-live', 'polite');
  });

  it('STATE M/N/0: enable "写真に保存(M)" + "他 N 件処理中" caption', () => {
    files.value = [completed('a', 100, 40), processing('b'), processing('c')];
    render(<SaveBar />);
    const btn = screen.getByRole('button');
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveTextContent('写真に保存(1)');
    expect(screen.getByText('他 2 件処理中')).toHaveAttribute('aria-live', 'polite');
  });

  it('STATE N/0/0: enable "写真に保存(N)" no caption', () => {
    files.value = [completed('a', 100, 40), completed('b', 100, 40)];
    render(<SaveBar />);
    expect(screen.getByRole('button')).toHaveTextContent('写真に保存(2)');
    expect(screen.queryByText(/処理中/)).toBeNull();
  });

  it('STATE M/0/K (mixed: some shared, some still saveable): enable "(M)" no caption', () => {
    files.value = [completed('a', 100, 40), completed('b', 100, 40), completed('c', 100, 40)];
    markShared(['a']); // 'a' already shared, 'b' and 'c' still saveable
    render(<SaveBar />);
    const btn = screen.getByRole('button');
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveTextContent('写真に保存(2)');
    expect(screen.queryByText(/処理中/)).toBeNull();
    expect(screen.queryByText(/全て保存済み/)).toBeNull();
  });

  it('STATE 0/0/N (all shared): disabled "全て保存済み" + aria-disabled, no caption', () => {
    files.value = [completed('a', 100, 40), completed('b', 100, 40)];
    markShared(['a', 'b']);
    render(<SaveBar />);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    expect(btn).toHaveTextContent('全て保存済み');
    expect(screen.queryByText(/処理中/)).toBeNull();
  });
});
