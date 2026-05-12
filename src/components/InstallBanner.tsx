import { showInstallBanner } from "../store/signals";
import { dismissInstallBanner } from "../lib/install";

/** iOS-style share glyph: an upward arrow rising out of an open box. */
const ShareGlyph = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
    <path
      d="M12 15V4m0 0L8.5 7.5M12 4l3.5 3.5"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M8 10H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);

const dismiss = (): void => {
  dismissInstallBanner();
  showInstallBanner.value = false;
};

export const InstallBanner = () => {
  if (!showInstallBanner.value) return null;
  return (
    <div class="install-banner" role="note">
      <div class="install-banner-body">
        <div class="install-banner-title">ホーム画面に追加できます</div>
        <div class="install-banner-text">
          Safari の
          <span class="install-banner-glyph">
            <ShareGlyph />
          </span>
          共有ボタン →「ホーム画面に追加」で、アプリのように使えます。
        </div>
      </div>
      <button
        type="button"
        class="install-banner-close"
        aria-label="閉じる"
        onClick={dismiss}
      >
        ×
      </button>
    </div>
  );
};
