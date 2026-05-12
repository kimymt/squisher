import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/preact';
import { Header } from '../src/components/Header';
import { files, preset } from '../src/store/signals';
import { PRESETS } from '../src/lib/presets';
import type { FileItem } from '../src/lib/types';

const dummyItem = (id: string): FileItem => ({
  id,
  file: new File([new Uint8Array(10)], `${id}.jpg`, { type: 'image/jpeg' }),
  outputFormat: 'jpeg',
  status: 'pending',
});

beforeEach(() => {
  files.value = [];
  preset.value = 'standard';
});
afterEach(cleanup);

describe('<Header>', () => {
  it('renders the title and a radiogroup of the three quality presets', () => {
    render(<Header />);
    expect(screen.getByRole('heading', { name: 'Squisher' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: '品質' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: PRESETS.high.label })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: PRESETS.standard.label })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: PRESETS.max.label })).toBeInTheDocument();
  });

  it('marks the active preset; selecting another updates preset.value + aria-checked', () => {
    render(<Header />);
    const standard = screen.getByRole('radio', { name: PRESETS.standard.label });
    const max = screen.getByRole('radio', { name: PRESETS.max.label });
    expect(standard).toHaveAttribute('aria-checked', 'true');
    expect(max).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(max);

    expect(preset.value).toBe('max');
    expect(screen.getByRole('radio', { name: PRESETS.max.label })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: PRESETS.standard.label })).toHaveAttribute('aria-checked', 'false');
  });

  it('shows the add-more (+) control only once files are present', () => {
    const { container, rerender } = render(<Header />);
    expect(container.querySelector('.add-more-btn')).toBeNull();

    files.value = [dummyItem('a')];
    rerender(<Header />);
    expect(container.querySelector('.add-more-btn')).not.toBeNull();
  });
});
