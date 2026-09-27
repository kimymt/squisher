import { ok, err, type Result } from "./result";
import { PRESETS, type Preset } from "./presets";
import type { CompressResult, OutputFormat } from "./types";
import { mimeFor } from "./output-format";

import { validateImage } from "./image-input";

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

export const resizeHintFor = (
  dims: { width: number; height: number } | null,
  maxDimension: number
): ImageBitmapOptions | undefined => {
  if (!dims) return undefined;
  if (Math.max(dims.width, dims.height) <= maxDimension) return undefined;
  return dims.height > dims.width
    ? { resizeHeight: maxDimension, resizeQuality: "high" }
    : { resizeWidth: maxDimension, resizeQuality: "high" };
};

export const compressImage = async (
  file: File,
  opts: CompressOptions
): Promise<Result<CompressResult>> => {
  const start = performance.now();
  let bitmap: ImageBitmap | undefined;
  let canvas: HTMLCanvasElement | undefined;

  const preset = PRESETS[opts.preset];

  try {
    const sourceDims = await validateImage(file);
    try {
      bitmap = await createImageBitmap(
        file,
        resizeHintFor(sourceDims, preset.maxDimension)
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
    if (blob.type !== mimeFor(opts.outputFormat))
      return err("このブラウザでは指定した形式に変換できません。別の出力形式を選択してください。");

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
  } catch (error) {
    return err(error instanceof Error ? error.message : "画像を読み込めませんでした");
  } finally {
    bitmap?.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
};
