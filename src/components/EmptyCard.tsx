import { handleFiles } from "../app";
import { PhotoGlyph } from "./PhotoGlyph";

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
    <div class="empty-hint">HEIC, JPEG, PNG に対応</div>
  </label>
);
