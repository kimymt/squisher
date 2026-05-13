import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/preact';

const changeOutputFormat = vi.fn();
vi.mock('../src/app', () => ({
  changeOutputFormat: (...args: unknown[]) => changeOutputFormat(...args),
}));

import { FileRow } from '../src/components/FileRow';
import type { FileItem, CompressResult } from '../src/lib/types';

const result = (out: number, larger = false): CompressResult => ({
  blob: new Blob([new Uint8Array(out)]),
  width: 10,
  height: 10,
  larger,
});

const item = (over: Partial<FileItem> = {}): FileItem => ({
  id: 'f1',
  file: new File([new Uint8Array(100_000)], 'IMG_1234.jpg', { type: 'image/jpeg' }),
  outputFormat: 'jpeg',
  status: 'completed',
  result: result(40_000),
  ...over,
});

beforeEach(() => changeOutputFormat.mockClear());
afterEach(cleanup);

describe('<FileRow>', () => {
  it('shows the filename, the size transition, and the reduction badge for a completed file', () => {
    const { container } = render(<FileRow item={item()} />);
    expect(screen.getByText('IMG_1234.jpg')).toBeInTheDocument();
    const sizes = container.querySelector('.file-sizes')?.textContent ?? '';
    expect(sizes).toContain('97.7 KB'); // 100000 bytes
    expect(sizes).toContain('39.1 KB'); // 40000 bytes
    expect(screen.getByText('-60%')).toBeInTheDocument();
    expect(screen.getByText('-60%')).not.toHaveClass('warning');
  });

  it('shows a + warning badge when the result grew', () => {
    render(<FileRow item={item({ result: result(150_000, true) })} />);
    const badge = screen.getByText('+50%');
    expect(badge).toBeInTheDocument();
    expect(badge.closest('.badge-reduction')).toHaveClass('warning');
  });

  it('renders the input-image thumbnail when present, a gradient placeholder otherwise', () => {
    const { container, rerender } = render(<FileRow item={item({ thumbUrl: 'blob:fake-thumb' })} />);
    const img = container.querySelector('img.file-thumb');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'blob:fake-thumb');
    expect(container.querySelector('.file-thumb-placeholder')).toBeNull();

    rerender(<FileRow item={item({ thumbUrl: undefined })} />);
    expect(container.querySelector('img.file-thumb')).toBeNull();
    expect(container.querySelector('.file-thumb-placeholder')).toBeInTheDocument();
  });

  it('shows "…" + spinner while processing, "エラー" + the message when errored', () => {
    const { container, rerender } = render(<FileRow item={item({ status: 'processing', result: undefined })} />);
    expect(container.querySelector('.file-sizes')?.textContent ?? '').toContain('…');
    expect(container.querySelector('.spinner')).toBeInTheDocument();

    rerender(<FileRow item={item({ status: 'error', result: undefined, error: '画像を読み込めませんでした' })} />);
    expect(container.querySelector('.file-sizes')?.textContent ?? '').toContain('エラー');
    expect(screen.getByText('画像を読み込めませんでした')).toBeInTheDocument();
    expect(container.querySelector('.spinner')).toBeNull();
  });

  it('marks the current output format and disables the toggle while busy', () => {
    const { rerender } = render(<FileRow item={item({ outputFormat: 'webp' })} />);
    expect(screen.getByRole('radio', { name: 'WebP' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'JPEG' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'JPEG' })).not.toBeDisabled();

    rerender(<FileRow item={item({ status: 'processing', result: undefined })} />);
    expect(screen.getByRole('radio', { name: 'JPEG' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'WebP' })).toBeDisabled();
  });

  it('clicking a format button calls changeOutputFormat(id, fmt)', () => {
    render(<FileRow item={item({ id: 'f9', outputFormat: 'jpeg' })} />);
    fireEvent.click(screen.getByRole('radio', { name: 'WebP' }));
    expect(changeOutputFormat).toHaveBeenCalledWith('f9', 'webp');
  });
});
