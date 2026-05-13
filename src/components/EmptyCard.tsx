import { handleFiles } from "../app";
import { PhotoGlyph } from "./PhotoGlyph";
import { supportsHeicInput } from "../lib/heic-support";

/* HEIC は iPhone/iPad Safari でしか扱えない(WebKit が input 経由で
   自動 JPEG 化する仕様)。それ以外のブラウザでは hint で対応形式を
   絞って表示し、ユーザーの長いアップロード+失敗体験を避ける。 */
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
