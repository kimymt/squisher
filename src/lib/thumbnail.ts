/**
 * Fast standalone thumbnail decode for the file-list rail.
 *
 * Tier 2: 全 thumb を選択直後に並列生成し、main thread の圧縮 queue とは
 * 独立してすぐ表示する。`createImageBitmap(file, { resizeWidth })` の
 * native downscaler を使うことで、フル解像度デコードを回避(12 MP ソースから
 * 112px thumb を直接出す)。1 ファイル ~10-30 ms、parallel 化で 10 ファイル
 * でも ~100 ms 程度で全 thumb 表示が完了。
 *
 * 失敗(壊れた画像、非対応形式)は non-fatal: null を返すだけで、圧縮 queue
 * は別経路で動き続ける。
 */

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
    // resizeWidth のみ指定 → 高さは aspect ratio で auto。Safari は decode 段階で
    // downscaler を回すので fast path に入る。orientation 別の最終サイズ:
    //   landscape 4032x3024 → 112x84(両軸とも 112 以下)
    //   portrait 3024x4032 → 112x149(短辺 112、長辺 149)
    // どちらも CSS object-fit: cover が 56pt 枠に切り取って表示する。
    bitmap = await createImageBitmap(file, {
      resizeWidth: THUMB_LONG_SIDE,
      resizeQuality: "medium",
    });
    canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
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
