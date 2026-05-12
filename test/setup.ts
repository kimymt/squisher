import '@testing-library/jest-dom/vitest';

// jsdom does not implement matchMedia — provide a no-match stub so code that
// probes display-mode (e.g. PWA standalone detection) works under test.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
