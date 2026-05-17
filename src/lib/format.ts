/**
 * Render a byte count as a human-readable string.
 * B / KB / MB only — Squisher never reaches GB inputs in practice.
 */
export const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

/**
 * Render a "before → after" pair, deduplicating the unit when both sides
 * share it. Used for the SaveBar totals row — saves ~30-40px which is the
 * difference between fitting on iPhone Air (narrow viewport) and wrapping
 * the toggle to a second line.
 *
 * Examples:
 *   formatBytesPair(46_465_433, 23_426_113) → "44.31 → 22.34 MB"  (same unit, deduped)
 *   formatBytesPair(1_500_000, 500)         → "1.43 MB → 500 B"   (different units, full)
 *   formatBytesPair(100, 50)                → "100 → 50 B"        (same unit B)
 */
export const formatBytesPair = (original: number, compressed: number): string => {
  const o = formatBytes(original);
  const c = formatBytes(compressed);
  const oUnit = o.slice(o.lastIndexOf(" ") + 1);
  const cUnit = c.slice(c.lastIndexOf(" ") + 1);
  if (oUnit === cUnit) {
    const oNum = o.slice(0, o.lastIndexOf(" "));
    return `${oNum} → ${c}`;
  }
  return `${o} → ${c}`;
};
