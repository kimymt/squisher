import { Header } from "./components/Header";
import { EmptyCard } from "./components/EmptyCard";
import { FileRow } from "./components/FileRow";
import { SaveBar } from "./components/SaveBar";
import { InstallBanner } from "./components/InstallBanner";
import { AppCredits } from "./components/AppCredits";
import {
  files,
  preset,
  addFiles,
  nextId,
  updateFile,
  saveableFiles,
  saveError,
  showInstallBanner,
  markShared,
} from "./store/signals";
import { compressImage } from "./lib/compress";
import { scheduleImage, MAX_FILES, MAX_TOTAL_BYTES } from "./lib/image-input";
import { generateThumbnail } from "./lib/thumbnail";
import { detectOutputFormat, mimeFor, extFor } from "./lib/output-format";
import { shareFiles, downloadFiles, isShareSupported } from "./lib/share";
import { shouldOfferInstall } from "./lib/install";
import { supportsHeicInput, isHeicFile } from "./lib/heic-support";
import type { Preset } from "./lib/presets";
import type { FileItem, OutputFormat } from "./lib/types";

const compressOne = (id: string): Promise<void> => scheduleImage(async () => {
  const item = files.value.find((f) => f.id === id);
  if (!item) return;

  updateFile(id, { status: "processing", error: undefined });

  const result = await compressImage(item.file, {
    preset: preset.value,
    outputFormat: item.outputFormat,
  });

  if (result.ok) {
    updateFile(id, { status: "completed", result: result.value });
    if (!item.thumbUrl) {
      const blob = await generateThumbnail(item.file);
      if (blob) updateFile(id, { thumbUrl: URL.createObjectURL(blob) });
    }
    // First successful compression on iOS Safari: offer "Add to Home Screen".
    if (!showInstallBanner.value && shouldOfferInstall()) {
      showInstallBanner.value = true;
    }
  } else {
    updateFile(id, { status: "error", error: result.error, result: undefined });
  }
});

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
  if (files.value.length + fileList.length > MAX_FILES ||
      files.value.reduce((sum, item) => sum + item.file.size, 0) +
      Array.from(fileList).reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) {
    saveError.value = "一度に扱える写真は50枚・合計200MBまでです。選択枚数を減らすか、結果を保存してページを再読み込みしてください。";
    return;
  }
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

  const pendingItems = items.filter((i) => i.status === "pending");
  await Promise.all(pendingItems.map((item) => compressOne(item.id)));
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
  const completed = files.value.filter((f) => f.status === "completed");
  const ids = completed.map((f) => f.id);
  await Promise.all(ids.map(compressOne));
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

  // Snapshot the ids being shared NOW. If files complete during the share
  // dialog, saveableFiles will grow — but we only mark the original set as
  // shared. Without this snapshot, share resolve would race with compression
  // completion and double-count new files as "saved" without ever sharing them.
  const sharedIdSnapshot = items.map((item) => item.id);

  const outFiles = items.map(
    (item) =>
      new File([item.result!.blob], outputFileName(item), {
        type: mimeFor(item.outputFormat),
      })
  );

  // No Web Share API (desktop browsers): direct download is reliable here.
  if (!isShareSupported()) {
    await downloadFiles(outFiles);
    markShared(sharedIdSnapshot);
    return;
  }

  const result = await shareFiles(outFiles);
  if (result.outcome === "shared") {
    markShared(sharedIdSnapshot);
    return;
  }
  if (result.outcome === "cancelled") {
    // ユーザーがキャンセル: snapshot は破棄。リストは維持されたまま、
    // 同じファイルを再度押せば再共有できる。
    return;
  }

  // failed / unsupported-mid-flow: fall back to download, mark as shared
  // (the user did receive the files via download even though share failed).
  // Show an inline notice — on iOS the download fallback is unreliable, so the
  // user should know what happened.
  saveError.value =
    result.outcome === "unsupported"
      ? "この端末では共有できませんでした。ダウンロードを試みます。"
      : `共有に失敗しました（${result.error ?? "不明なエラー"}）。ダウンロードを試みます。`;
  await downloadFiles(outFiles);
  markShared(sharedIdSnapshot);
};

export const App = () => (
  <div class="app">
    <Header />
    <InstallBanner />
    {files.value.length === 0 && saveError.value && <div class="save-error" role="alert">{saveError.value}</div>}
    {files.value.length === 0 ? (
      <>
        <EmptyCard />
        <AppCredits />
      </>
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
