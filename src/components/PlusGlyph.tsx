interface Props {
  size?: number;
}

export const PlusGlyph = ({ size = 20 }: Props) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path d="M12 6v12M6 12h12" />
  </svg>
);
