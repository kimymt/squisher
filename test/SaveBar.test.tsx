import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/preact';

const handleSave = vi.fn();
vi.mock('../src/app', () => ({
  handleSave: (...args: unknown[]) => handleSave(...args),
}));

import { SaveBar } from '../src/components/SaveBar';
import { files, skipLarger, saveError } from '../src/store/signals';
import type { FileItem } from '../src/lib/types';

const completed = (id: string, orig: number, out: number): FileItem => ({
  id,
  file: new File([new Uint8Array(orig)], `${id}.jpg`, { type: 'image/jpeg' }),
  outputFormat: 'jpeg',
  status: 'completed',
  result: { blob: new Blob([new Uint8Array(out)]), width: 10, height: 10, larger: out > orig },
});

beforeEach(() => {
  files.value = [];
  skipLarger.value = true;
  saveError.value = null;
  handleSave.mockClear();
});
afterEach(cleanup);

describe('<SaveBar>', () => {
  it('shows zeroed totals and a disabled save button when nothing is saveable', () => {
    render(<SaveBar />);
    expect(screen.getByText(/合計:/)).toHaveTextContent('合計: 0 B → 0 B');
    const btn = screen.getByRole('button', { name: /写真に保存/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('写真に保存(0)');
  });

  it('counts saveable files and sums the totals', () => {
    files.value = [completed('a', 100, 40), completed('b', 200, 50)];
    render(<SaveBar />);
    expect(screen.getByText(/合計:/)).toHaveTextContent('合計: 300 B → 90 B');
    const btn = screen.getByRole('button', { name: /写真に保存/ });
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveTextContent('写真に保存(2)');
  });

  it('skipLarger toggle excludes/includes grew files and the total follows', () => {
    files.value = [completed('small', 100, 40), completed('grew', 100, 180)];
    render(<SaveBar />);
    expect(screen.getByRole('button', { name: /写真に保存/ })).toHaveTextContent('写真に保存(1)');
    expect(screen.getByText(/合計:/)).toHaveTextContent('合計: 200 B → 140 B'); // grew counted as its original 100

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
