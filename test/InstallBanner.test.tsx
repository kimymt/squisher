import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/preact';
import { InstallBanner } from '../src/components/InstallBanner';
import { showInstallBanner } from '../src/store/signals';

beforeEach(() => {
  localStorage.clear();
  showInstallBanner.value = false;
});
afterEach(() => {
  cleanup();
  showInstallBanner.value = false;
});

describe('<InstallBanner>', () => {
  it('renders nothing while not flagged to show', () => {
    const { container } = render(<InstallBanner />);
    expect(container.querySelector('.install-banner')).toBeNull();
  });

  it('renders the Add-to-Home-Screen hint and a close button when flagged', () => {
    showInstallBanner.value = true;
    render(<InstallBanner />);
    expect(screen.getByText('ホーム画面に追加できます')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '閉じる' })).toBeInTheDocument();
  });

  it('dismissing hides it, clears the signal, and persists the choice in localStorage', () => {
    showInstallBanner.value = true;
    const { container } = render(<InstallBanner />);

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    expect(showInstallBanner.value).toBe(false);
    expect(container.querySelector('.install-banner')).toBeNull();
    expect(localStorage.getItem('squisher.installBannerDismissed')).toBe('1');
  });
});
