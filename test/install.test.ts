import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { shouldOfferInstall, dismissInstallBanner } from '../src/lib/install';

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1';
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const setUA = (ua: string): void => {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
};
const setStandalone = (v: boolean): void => {
  Object.defineProperty(navigator, 'standalone', { value: v, configurable: true });
};

beforeEach(() => {
  localStorage.clear();
  setUA(DESKTOP_UA);
});

afterEach(() => {
  if (Object.prototype.hasOwnProperty.call(navigator, 'standalone')) {
    delete (navigator as Navigator & { standalone?: boolean }).standalone;
  }
});

describe('shouldOfferInstall', () => {
  it('is false on a desktop browser', () => {
    expect(shouldOfferInstall()).toBe(false);
  });

  it('is true on iOS Safari that is not installed and not dismissed', () => {
    setUA(IPHONE_UA);
    expect(shouldOfferInstall()).toBe(true);
  });

  it('is false once the app is running standalone (already on the home screen)', () => {
    setUA(IPHONE_UA);
    setStandalone(true);
    expect(shouldOfferInstall()).toBe(false);
  });

  it('is false after the user dismisses the banner', () => {
    setUA(IPHONE_UA);
    dismissInstallBanner();
    expect(localStorage.getItem('squisher.installBannerDismissed')).toBe('1');
    expect(shouldOfferInstall()).toBe(false);
  });
});

describe('dismissInstallBanner', () => {
  it('swallows errors when storage writes fail (private mode)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(() => dismissInstallBanner()).not.toThrow();
    spy.mockRestore();
  });
});
