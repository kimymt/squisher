interface Props {
  size?: number;
}

export const CheckGlyph = ({ size = 14 }: Props) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12l5 5 9-11" />
  </svg>
);

export const WarningGlyph = ({ size = 14 }: Props) => (
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
    <path d="M12 3.5l9.5 17H2.5L12 3.5z" />
    <path d="M12 10v5" />
    <circle cx="12" cy="18" r="0.75" fill="currentColor" stroke="none" />
  </svg>
);
