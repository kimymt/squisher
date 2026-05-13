import { Header } from "./components/Header";
import { EmptyCard } from "./components/EmptyCard";
import { FileRow } from "./components/FileRow";
import { SaveBar } from "./components/SaveBar";
import { InstallBanner } from "./components/InstallBanner";
import {
  files,
  preset,
  addFiles,
  nextId,
  updateFile,
  saveableFiles,
  saveError,
  showInstallBanner,
} from "./store/signals";
import { compressImage } from "./lib/compress";
import { detectOutputFormat, mimeFor, extFor } from "./lib/output-format";
import { shareFiles, downloadFiles, isShareSupported } from "./lib/share";
import { shouldOfferInstall } from "./lib/install";
import { supportsHeicInput, isHeicFile } from "./lib/heic-support";
import type { Preset } from "./lib/presets";
import type { FileItem, OutputFormat } from "./lib/types";

/** iOS keeps a single decode/encode in flight (memory); other platforms run a small pool. */
const CONCURRENCY = /iP(hone|ad|od)/i.test(navigator.userAgent) ? 1 : 3;

const resetFiles = (): void => {
  for (const f of files.value) {
    if (f.thumbUrl) URL.revokeObjectURL(f.thumbUrl);
  }
  files.value = [];
};

const compressOne = async (id: string): Promise<void> => {
  const item = files.value.find((f) => f.id === id);
  if (!item) return;

  updateFile(id, { status: "processing", error: undefined });

  const result = await compressImage(item.file, {
    preset: preset.value,
    outputFormat: item.outputFormat,
    thumbnail: !item.thumbUrl,
  });

  if (result.ok) {
    const { thumbBlob, ...compressResult } = result.value;
    const patch: Partial<FileItem> = { status: "completed", result: compressResult };
    if (thumbBlob) patch.thumbUrl = URL.createObjectURL(thumbBlob);
    updateFile(id, patch);
    // First successful compression on iOS Safari: offer "Add to Home Screen".
    if (!showInstallBanner.value && shouldOfferInstall()) {
      showInstallBanner.value = true;
    }
  } else {
    updateFile(id, { status: "error", error: result.error, result: undefined });
  }
};

/** Run `worker` over `ids` with at most `limit` in flight at once. */
const runPool = async (
  ids: string[],
  worker: (id: string) => Promise<void>,
  limit: number
): Promise<void> => {
  const queue = [...ids];
  const lanes = Array.from(
    { length: Math.min(limit, queue.length) },
    async () => {
      for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
        await worker(next);
      }
    }
  );
  await Promise.all(lanes);
};

/**
 * iOS / iPadOS Safari decodes HEIC to JPEG inside the file picker, so we
 * never see HEIC there. On every other browser, HEIC reaches us as a
 * `.heic` blob and `createImageBitmap` fails with a generic error. Flag
 * those files up front so the user gets a useful message instead of
 * "画像を読み込めませんでした" with no explanation.
 */
const heicSupported = supportsHeicInput();
const HEIC_NOT_SUPPORTED_MESSAGE =
  "このブラウザは HEIC に対応していません。iPhone の Safari でお試しください。";

export const handleFiles = async (fileList: FileList): Promise<void> => {
  const items: FileItem[] = Array.from(fileList).map((file) => {
    const heicBlocked = !heicSupported && isHeicFile(file);
    return {
      id: nextId(),
      file,
      outputFormat: detectOutputFormat(file),
      status: heicBlocked ? "error" : "pending",
      ...(heicBlocked ? { error: HEIC_NOT_SUPPORTED_MESSAGE } : {}),
    };
  });

  addFiles(items);

  const pendingIds = items
    .filter((i) => i.status === "pending")
    .map((i) => i.id);
  if (pendingIds.length > 0) {
    await runPool(pendingIds, compressOne, CONCURRENCY);
  }
};

export const changeOutputFormat = async (
  id: string,
  format: OutputFormat
): Promise<void> => {
  const item = files.value.find((f) => f.id === id);
  if (!item || item.outputFormat === format) return;
  updateFile(id, { outputFormat: format });
  await compressOne(id);
};

export const changePreset = async (next: Preset): Promise<void> => {
  if (preset.value === next) return;
  preset.value = next;
  // Re-compress everything that already finished so the on-screen numbers
  // reflect the new quality. (compressOne reads preset.value at call time.)
  const ids = files.value
    .filter((f) => f.status === "completed")
    .map((f) => f.id);
  await runPool(ids, compressOne, CONCURRENCY);
};

/** `IMG_1234.jpeg` → `IMG_1234-squished.jpg`; re-saving stays idempotent. */
const outputFileName = (item: FileItem): string => {
  const baseName = item.file.name
    .replace(/\.[^/.]+$/, "")
    .replace(/-squished$/i, "");
  return `${baseName}-squished.${extFor(item.outputFormat)}`;
};

export const handleSave = async (): Promise<void> => {
  saveError.value = null;
  const items = saveableFiles.value;
  if (items.length === 0) return;

  const outFiles = items.map(
    (item) =>
      new File([item.result!.blob], outputFileName(item), {
        type: mimeFor(item.outputFormat),
      })
  );

  // No Web Share API (desktop browsers): direct download is reliable here.
  if (!isShareSupported()) {
    await downloadFiles(outFiles);
    resetFiles();
    return;
  }

  const result = await shareFiles(outFiles);
  if (result.outcome === "shared") {
    resetFiles();
    return;
  }
  if (result.outcome === "cancelled") {
    // ユーザーがキャンセル: リストを維持して再共有できるようにする
    return;
  }

  // failed / unsupported-mid-flow: fall back to download, keep the list so the
  // user can retry the share sheet. On iOS the download fallback is unreliable,
  // so surface a notice rather than silently resetting.
  saveError.value =
    result.outcome === "unsupported"
      ? "この端末では共有できませんでした。ダウンロードを試みます。"
      : `共有に失敗しました（${result.error ?? "不明なエラー"}）。ダウンロードを試みます。`;
  await downloadFiles(outFiles);
};

export const App = () => (
  <div class="app">
    <Header />
    <InstallBanner />
    {files.value.length === 0 ? (
      <EmptyCard />
    ) : (
      <>
        <div class="file-list">
          {files.value.map((item) => (
            <FileRow key={item.id} item={item} />
          ))}
        </div>
        <SaveBar />
      </>
    )}
  </div>
);
