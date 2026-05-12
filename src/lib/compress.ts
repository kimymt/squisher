import { ok, err, type Result } from "./result";
import { PRESETS, type Preset } from "./presets";
import type { CompressResult, OutputFormat } from "./types";
import { mimeFor } from "./output-format";

const MAX_INPUT_PIXELS = 64_000_000;

export interface CompressOptions {
  preset: Preset;
  outputFormat: OutputFormat;
}

export const compressImage = async (
  file: File,
  opts: CompressOptions
): Promise<Result<CompressResult>> => {
  let bitmap: ImageBitmap | undefined;
  let canvas: HTMLCanvasElement | undefined;

  try {
    try {
      bitmap = await createImageBitmap(file);
    } catch (e) {
      return err(`画像を読み込めませんでした: ${(e as Error).message || "デコード失敗"}`);
    }

    const inputPixels = bitmap.width * bitmap.height;
    if (inputPixels > MAX_INPUT_PIXELS) {
      return err(
        `画像が大きすぎます (${(inputPixels / 1_000_000).toFixed(1)}Mピクセル)`
      );
    }

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

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas!.toBlob(
        (b) => resolve(b),
        mimeFor(opts.outputFormat),
        preset.quality
      );
    });

    if (!blob) return err("圧縮に失敗しました");

    return ok({
      blob,
      width: w,
      height: h,
      larger: blob.size > file.size,
    });
  } finally {
    bitmap?.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
};
