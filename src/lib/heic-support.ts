/**
 * Product admission hint, not a codec capability test.
 * iOS 27 device evidence: Photos supplied JPEG; Files supplied HEIC and
 * createImageBitmap decoded it. Every file still passes header admission;
 * actual codec support is determined by decode success, not this UA hint.
 * Non-iOS HEIC is outside the product's tested support scope.
 */
/**
 * Pure detection — exposed for unit tests. Production callers use
 * `supportsHeicInput()` which reads the live navigator.
 */
export const supportsHeicInputFor = (
  userAgent: string,
  maxTouchPoints: number
): boolean => {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  // iPadOS 13+ reports a Mac UA but reports multi-touch capability — that
  // signature means iPad, not a real Mac.
  if (userAgent.includes("Macintosh") && maxTouchPoints > 1) return true;
  return false;
};

export const supportsHeicInput = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return supportsHeicInputFor(
    navigator.userAgent,
    navigator.maxTouchPoints ?? 0
  );
};

/** True if the file name / MIME suggests HEIC or HEIF. */
export const isHeicFile = (file: File): boolean => {
  const name = file.name.toLowerCase();
  if (name.endsWith(".heic") || name.endsWith(".heif")) return true;
  return file.type === "image/heic" || file.type === "image/heif";
};
