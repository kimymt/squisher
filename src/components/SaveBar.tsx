import {
  canSave,
  saveableFiles,
  totalCompressedSize,
  totalOriginalSize,
  skipLarger,
} from "../store/signals";
import { handleSave } from "../app";

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

export const SaveBar = () => (
  <div class="save-bar">
    <div class="toolbar-options">
      <span class="totals mono">
        合計: {formatBytes(totalOriginalSize.value)} → {formatBytes(totalCompressedSize.value)}
      </span>
      <label class="switch">
        <input
          type="checkbox"
          checked={skipLarger.value}
          onChange={(e) =>
            (skipLarger.value = (e.currentTarget as HTMLInputElement).checked)
          }
        />
        サイズ増は保存スキップ
      </label>
    </div>
    <button
      type="button"
      class="btn btn-primary btn-full"
      disabled={!canSave.value}
      onClick={() => void handleSave()}
    >
      写真に保存({saveableFiles.value.length})
    </button>
  </div>
);
