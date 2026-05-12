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
import type { FileItem } from "./lib/types";

const resetFiles = (): void => {
  files.value = [];
};

export const handleFiles = async (fileList: FileList): Promise<void> => {
  const items: FileItem[] = Array.from(fileList).map((file) => ({
    id: nextId(),
    file,
    outputFormat: detectOutputFormat(file),
    status: "pending",
  }));

  addFiles(items);

  for (const item of items) {
    updateFile(item.id, { status: "processing" });

    const result = await compressImage(item.file, {
      preset: preset.value,
      outputFormat: item.outputFormat,
    });

    if (result.ok) {
      updateFile(item.id, { status: "completed", result: result.value });
    } else {
      updateFile(item.id, { status: "error", error: result.error });
    }
  }
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
