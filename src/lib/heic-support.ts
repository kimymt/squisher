/**
 * Can this browser ingest HEIC files?
 *
 * - iOS / iPadOS Safari: yes — the system decodes HEIC to JPEG inside the
 *   `<input type="file">` picker, so a `.heic` file the user picks arrives
 *   in our handler as a JPEG (Phase 0 verified, iOS 13+ behaviour).
 * - macOS Safari: img can render HEIC, but `createImageBitmap(heicBlob)`
 *   fails, so our compress pipeline rejects it.
 * - Chrome / Firefox / Edge on any platform: no HEIC support, fails.
 *
 * We treat iOS / iPadOS as "supported", everything else as "not supported"
 * so the UI can warn before the user wastes a long upload.
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
