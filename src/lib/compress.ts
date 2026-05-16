import { ok, err, type Result } from "./result";
import { PRESETS, type Preset } from "./presets";
import type { CompressResult, OutputFormat } from "./types";
import { mimeFor } from "./output-format";

/**
 * Sanity cap on raw file size. file.size is the cheapest proxy that
 * protects against pathological input before any decode allocation —
 * a 100 MB JPEG is far above anything iPhone photos produce.
 */
const MAX_INPUT_BYTES = 100 * 1024 * 1024; // 100 MB

/**
 * Below this size, source dimensions are almost certainly
 * <= preset.maxDimension on the long side (a 2560×1920 photo at
 * JPEG quality 0.75 encodes to ~700 KB - 1 MB; smaller files are
 * almost always sub-maxDimension). Skip the header probe to avoid
 * wasted ~1-5 ms per file when no resize-during-decode is possible.
 */
const PROBE_SKIP_BYTES = 500 * 1024; // 500 KB

export interface CompressOptions {
  preset: Preset;
  outputFormat: OutputFormat;
}

const toBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));

/**
 * Read JPEG/PNG header to learn source dimensions before deciding whether
 * to ask the decoder for a downscaled bitmap. Image() parses just enough
 * to populate naturalWidth/Height (~1-5 ms per file on Safari) without
 * touching pixel data. Without this probe, `createImageBitmap(file,
 * { resizeWidth })` would unconditionally apply the resize — UPSCALING
 * small sources and bloating the encoded output.
 */
const probeDimensions = (
  file: File
): Promise<{ width: number; height: number } | null> => {
  const url = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
};

export const compressImage = async (
  file: File,
  opts: CompressOptions
): Promise<Result<CompressResult>> => {
  const start = performance.now();
  let bitmap: ImageBitmap | undefined;
  let canvas: HTMLCanvasElement | undefined;

  if (file.size > MAX_INPUT_BYTES) {
    return err(
      `ファイルが大きすぎます (${(file.size / 1024 / 1024).toFixed(1)} MB)`
    );
  }

  const preset = PRESETS[opts.preset];

  try {
    // Probe header for source dimensions only when the file is large
    // enough that source could plausibly exceed preset.maxDimension.
    // For small files, skip the probe entirely — default decode will
    // produce a native-size bitmap and the canvas-side scale (which
    // ends up as scale=1) handles the rest without upscaling.
    const sourceDims =
      file.size > PROBE_SKIP_BYTES ? await probeDimensions(file) : null;
    if (file.size > PROBE_SKIP_BYTES && !sourceDims) {
      return err("画像を読み込めませんでした");
    }

    const needsResize =
      sourceDims !== null &&
      Math.max(sourceDims.width, sourceDims.height) > preset.maxDimension;

    // Tier 3: resize during decode for sources that need downscaling.
    // The browser uses its native downscaler (Safari has hw-accelerated
    // paths for JPEG; some impls do DCT-domain 1/2 1/4 1/8 downscale at
    // decode time, skipping the full-res pixel pass entirely). For small
    // sources we pass no resize hint and the decoder returns the native
    // bitmap unchanged — drawImage below copies 1:1.
    try {
      bitmap = await createImageBitmap(
        file,
        needsResize
          ? { resizeWidth: preset.maxDimension, resizeQuality: "high" }
          : undefined
      );
    } catch {
      return err("画像を読み込めませんでした");
    }

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
