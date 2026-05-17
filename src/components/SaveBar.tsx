import {
  canSave,
  saveableFiles,
  totalCompressedSize,
  totalOriginalSize,
  skipLarger,
  saveError,
  processingCount,
  allShared,
} from "../store/signals";
import { handleSave } from "../app";
import { formatBytesPair } from "../lib/format";

/**
 * SaveBar state matrix (driven by saveableFiles / processingCount / allShared):
 *
 *   Saveable | Processing | Shared    | Button             | Caption
 *   ---------|------------|-----------|--------------------|----------------------
 *   0        | 0          | 0         | (n/a — EmptyCard shown instead)
 *   0        | N          | 0         | disabled "(0)"     | "N 件処理中"
 *   M (>0)   | N (>0)     | any       | enable "(M)"       | "他 N 件処理中"
 *   N        | 0          | 0         | enable "(N)"       | (none)
 *   M (>0)   | 0          | K (>0)    | enable "(M)"       | (none)
 *   0        | 0          | N (all)   | disabled "全て保存済み" | (none)
 */
const buttonLabel = (): string => {
  if (allShared.value) return "全て保存済み";
  return `写真に保存(${saveableFiles.value.length})`;
};

const caption = (): string | null => {
  if (allShared.value) return null;
  const proc = processingCount.value;
  if (proc === 0) return null;
  return saveableFiles.value.length > 0 ? `他 ${proc} 件処理中` : `${proc} 件処理中`;
};

export const SaveBar = () => {
  const captionText = caption();
  const buttonDisabled = allShared.value || !canSave.value;

  return (
    <footer class="save-bar" aria-label="保存">
      <div class="toolbar-options">
        <span class="totals mono" aria-label="合計サイズ">
          {formatBytesPair(totalOriginalSize.value, totalCompressedSize.value)}
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
        disabled={buttonDisabled}
        aria-disabled={buttonDisabled}
        onClick={() => void handleSave()}
      >
        {buttonLabel()}
      </button>
      {captionText && (
        <div class="save-caption" aria-live="polite">
          {captionText}
        </div>
      )}
    </footer>
  );
};
