import {
  canSave,
  saveableFiles,
  totalCompressedSize,
  totalOriginalSize,
  skipLarger,
  saveError,
} from "../store/signals";
import { handleSave } from "../app";
import { formatBytes } from "../lib/format";

export const SaveBar = () => (
  <footer class="save-bar" role="contentinfo" aria-label="保存">
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
    {saveError.value && <div class="save-error" role="alert">{saveError.value}</div>}
    <button
      type="button"
      class="btn btn-primary btn-full"
      disabled={!canSave.value}
      onClick={() => void handleSave()}
    >
      写真に保存({saveableFiles.value.length})
    </button>
  </footer>
);
