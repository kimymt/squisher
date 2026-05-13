/**
 * Render a byte count as a human-readable string.
 * B / KB / MB only — Squisher never reaches GB inputs in practice.
 */
export const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};
