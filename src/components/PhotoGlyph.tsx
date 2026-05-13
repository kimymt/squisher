interface Props {
  size?: number;
}

export const PhotoGlyph = ({ size = 28 }: Props) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="6" width="18" height="14" rx="2" />
    <path d="M3 16l4-4 5 4 3-3 6 6" />
    <circle cx="8" cy="11" r="1.5" />
  </svg>
);
