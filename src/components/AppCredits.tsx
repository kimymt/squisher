import { GitHubGlyph } from "./GitHubGlyph";

/**
 * Document-level credits footer.
 *
 * Shown only in the empty state (no files picked yet) — the iOS "About"
 * pattern where version/source info lives below the primary affordance,
 * never competing with active work. Once files are loaded the SaveBar
 * takes over as the bottom UI and the credits step aside.
 */

const REPO_URL = "https://github.com/kimymt/squisher";

export const AppCredits = () => (
  <footer class="app-credits" role="contentinfo">
    <div class="app-credits-version">
      Squisher <span class="mono">v{__APP_VERSION__}</span>
    </div>
    <a
      class="app-credits-link"
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="GitHub リポジトリ kimymt/squisher を開く"
    >
      <GitHubGlyph size={20} />
    </a>
  </footer>
);
