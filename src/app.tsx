import { Header } from "./components/Header";
import { EmptyCard } from "./components/EmptyCard";
import { FileRow } from "./components/FileRow";
import { SaveBar } from "./components/SaveBar";
import {
  files,
  preset,
  addFiles,
  nextId,
  updateFile,
  saveableFiles,
} from "./store/signals";
import { compressImage } from "./lib/compress";
import { detectOutputFormat, mimeFor, extFor } from "./lib/output-format";
import { shareFiles, downloadFile, isShareSupported } from "./lib/share";
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

export const handleFiles = async (fileList: FileList): Promise<void> => {
  const items: FileItem[] = Array.from(fileList).map((file) => ({
    id: nextId(),
    file,
    outputFormat: detectOutputFormat(file),
    status: "pending",
  }));

  addFiles(items);
  await runPool(
    items.map((i) => i.id),
    compressOne,
    CONCURRENCY
  );
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

export const handleSave = async (): Promise<void> => {
  const items = saveableFiles.value;
  if (items.length === 0) return;

  const outFiles = items.map((item) => {
    const result = item.result!;
    const baseName = item.file.name.replace(/\.[^/.]+$/, "");
    const ext = extFor(item.outputFormat);
    return new File([result.blob], `${baseName}-squished.${ext}`, {
      type: mimeFor(item.outputFormat),
    });
  });

  if (isShareSupported()) {
    const result = await shareFiles(outFiles);
    if (result.outcome === "shared") {
      resetFiles();
    } else if (result.outcome === "cancelled") {
      // ユーザーキャンセル: リストを維持して再共有可能に
    } else {
      alert(`保存に失敗しました: ${result.error}\nダウンロードに切り替えます。`);
      outFiles.forEach((f) => downloadFile(f));
      resetFiles();
    }
  } else {
    outFiles.forEach((f) => downloadFile(f));
    resetFiles();
  }
};

export const App = () => (
  <div class="app">
    <Header />
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
