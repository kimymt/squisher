const DISMISS_KEY = "squisher.installBannerDismissed";

const isIOS = (): boolean => /iP(hone|ad|od)/i.test(navigator.userAgent);

const isStandalone = (): boolean =>
  // iOS Safari exposes navigator.standalone; the rest use the display-mode query.
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  window.matchMedia("(display-mode: standalone)").matches;

const wasDismissed = (): boolean => {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
};

/** True when the "Add to Home Screen" hint is worth showing: iOS Safari, not already installed, not dismissed. */
export const shouldOfferInstall = (): boolean =>
  isIOS() && !isStandalone() && !wasDismissed();

export const dismissInstallBanner = (): void => {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // private mode / storage disabled — dismissal just won't persist across reloads
  }
};
