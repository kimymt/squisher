import { describe, it, expect, afterEach, vi } from 'vitest';
import { isShareSupported, shareFiles, downloadFile } from '../src/lib/share';

type CanShare = (data: { files: File[] }) => boolean;
type Share = (data: { files: File[] }) => Promise<void>;

const setShareApi = (canShare: CanShare, share: Share): void => {
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShare });
  Object.defineProperty(navigator, 'share', { configurable: true, value: share });
};

const file = () => new File([new Uint8Array(10)], 'x.jpg', { type: 'image/jpeg' });

afterEach(() => {
  delete (navigator as Navigator & { canShare?: unknown }).canShare;
  delete (navigator as Navigator & { share?: unknown }).share;
  vi.restoreAllMocks();
});

describe('isShareSupported', () => {
  it('is false when the Web Share API is absent', () => {
    expect(isShareSupported()).toBe(false);
  });

  it('is true when both navigator.canShare and navigator.share are functions', () => {
    setShareApi(() => true, async () => {});
    expect(isShareSupported()).toBe(true);
  });
});

describe('shareFiles', () => {
  it('returns "unsupported" when the API is missing', async () => {
    expect((await shareFiles([file()])).outcome).toBe('unsupported');
  });

  it('returns "unsupported" when canShare({files}) is false', async () => {
    setShareApi(() => false, async () => {});
    expect((await shareFiles([file()])).outcome).toBe('unsupported');
  });

  it('returns "shared" when navigator.share resolves, and shares files only (no title/text/url)', async () => {
    const share = vi.fn<Share>(async () => {});
    setShareApi(() => true, share);
    const files = [file()];
    expect((await shareFiles(files)).outcome).toBe('shared');
    expect(share).toHaveBeenCalledWith({ files });
  });

  it('returns "cancelled" on AbortError', async () => {
    setShareApi(() => true, async () => {
      throw new DOMException('user cancelled', 'AbortError');
    });
    expect((await shareFiles([file()])).outcome).toBe('cancelled');
  });

  it('returns "failed" with the message on any other error', async () => {
    setShareApi(() => true, async () => {
      throw new Error('boom');
    });
    const r = await shareFiles([file()]);
    expect(r.outcome).toBe('failed');
    expect(r.error).toBe('boom');
  });
});

describe('downloadFile', () => {
  it('appends a clicked <a download> then removes it from the DOM', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadFile(new File([new Uint8Array(4)], 'photo-squished.jpg', { type: 'image/jpeg' }));
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
