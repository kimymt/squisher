import { validateImage } from "./image-input";
/** Generate a bounded thumbnail after validating the source header. */
/** Longest-side px for the row thumbnail (56pt slot @ 2x DPR). */
const THUMB_LONG_SIDE = 112;
const THUMB_QUALITY = 0.7;

const toBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));

export const generateThumbnail = async (file: File): Promise<Blob | null> => {
  let bitmap: ImageBitmap | undefined;
  let canvas: HTMLCanvasElement | undefined;
  try {
    const dims = await validateImage(file);
    const scale = Math.min(1, THUMB_LONG_SIDE / Math.max(dims.width, dims.height));
    bitmap = await createImageBitmap(file, {
      resizeWidth: Math.max(1, Math.round(dims.width * scale)),
      resizeQuality: "medium",
    });
    canvas = document.createElement("canvas");
    const finalScale = Math.min(1, THUMB_LONG_SIDE / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * finalScale));
    canvas.height = Math.max(1, Math.round(bitmap.height * finalScale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await toBlob(canvas, "image/jpeg", THUMB_QUALITY);
  } catch {
    return null;
  } finally {
    bitmap?.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
};
