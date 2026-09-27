import { handleFiles } from "../app";
import { PhotoGlyph } from "./PhotoGlyph";
import { supportsHeicInput } from "../lib/heic-support";

/* 対応範囲の案内。iOSでも入力経路によってJPEG/HEICが渡されるため、
   実際の形式・寸法・デコード成否はファイルごとに検証する。 */
const hintText = supportsHeicInput()
  ? "HEIC, JPEG, PNG に対応"
  : "JPEG, PNG に対応(HEIC は iPhone Safari のみ)";

export const EmptyCard = () => (
  <label class="empty-card">
    <input
      type="file"
      accept="image/*"
      multiple
      class="hidden-input"
      onChange={(e) => {
        const target = e.currentTarget as HTMLInputElement;
        if (target.files && target.files.length > 0) {
          void handleFiles(target.files);
        }
      }}
    />
    <div class="empty-icon">
      <PhotoGlyph size={28} />
    </div>
    <div class="empty-label">写真を選択</div>
    <div class="empty-hint">{hintText}</div>
  </label>
);
