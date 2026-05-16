import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/preact';
import { AppCredits } from '../src/components/AppCredits';

afterEach(cleanup);

describe('<AppCredits>', () => {
  it('renders the package version (semver-shaped) inside a Squisher label', () => {
    const { container } = render(<AppCredits />);
    expect(container.textContent).toMatch(/Squisher\s+v\d+\.\d+\.\d+/);
  });

  it('exposes the GitHub repo link, opening safely in a new tab', () => {
    render(<AppCredits />);
    // The link is icon-only, so aria-label carries the accessible name.
    const link = screen.getByRole('link', { name: /GitHub/ });
    expect(link).toHaveAttribute('href', 'https://github.com/kimymt/squisher');
    expect(link).toHaveAttribute('target', '_blank');
    // rel=noopener noreferrer matters: target="_blank" without it leaks
    // window.opener and is a known phishing vector.
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('marks itself as the document contentinfo landmark', () => {
    render(<AppCredits />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('uses the GitHub mark SVG as the link affordance, with the SVG itself decorative', () => {
    const { container } = render(<AppCredits />);
    const link = container.querySelector('.app-credits-link');
    expect(link).not.toBeNull();
    const svg = link?.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});
