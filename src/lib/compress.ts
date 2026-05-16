import { ok, err, type Result } from "./result";
import { PRESETS, type Preset } from "./presets";
import type { CompressResult, OutputFormat } from "./types";
import { mimeFor } from "./output-format";

const MAX_INPUT_PIXELS = 64_000_000;
/** Longest-side px for the row thumbnail (56pt slot @ 2x DPR). */
const THUMB_LONG_SIDE = 112;

export interface CompressOptions {
  preset: Preset;
  outputFormat: OutputFormat;
  /** Generate a small thumbnail from the source image (skip on re-compress). */
  thumbnail?: boolean;
}

export interface CompressOutput extends CompressResult {
  /** Present only when `thumbnail` was requested and generation succeeded. */
  thumbBlob: Blob | null;
}

const toBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));

const makeThumbnail = async (bitmap: ImageBitmap): Promise<Blob | null> => {
  const longSide = Math.max(bitmap.width, bitmap.height);
  const scale = longSide > THUMB_LONG_SIDE ? THUMB_LONG_SIDE / longSide : 1;
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    return await toBlob(canvas, "image/jpeg", 0.7);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
};

export const compressImage = async (
  file: File,
  opts: CompressOptions
): Promise<Result<CompressOutput>> => {
  const start = performance.now();
  let bitmap: ImageBitmap | undefined;
  let canvas: HTMLCanvasElement | undefined;

  try {
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      return err("画像を読み込めませんでした");
    }

    const inputPixels = bitmap.width * bitmap.height;
    if (inputPixels > MAX_INPUT_PIXELS) {
      return err(
        `画像が大きすぎます (${(inputPixels / 1_000_000).toFixed(1)}Mピクセル)`
      );
    }

    const thumbBlob = opts.thumbnail ? await makeThumbnail(bitmap) : null;

    const preset = PRESETS[opts.preset];
    const longSide = Math.max(bitmap.width, bitmap.height);
    const scale =
      longSide > preset.maxDimension ? preset.maxDimension / longSide : 1;
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return err("Canvas 2D コンテキストを取得できませんでした");

    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await toBlob(canvas, mimeFor(opts.outputFormat), preset.quality);
    if (!blob) return err("圧縮に失敗しました");

    const durationMs = performance.now() - start;
    // Dev-mode only: surfaces timing on the console so QA can eyeball it
    // without instrumentation. Production build (`import.meta.env.PROD`) skips.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug(
        `[compress] ${file.name} ${file.size}B -> ${blob.size}B in ${durationMs.toFixed(0)}ms`
      );
    }

    return ok({
      blob,
      width: w,
      height: h,
      larger: blob.size > file.size,
      thumbBlob,
      durationMs,
    });
  } finally {
    bitmap?.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
};
