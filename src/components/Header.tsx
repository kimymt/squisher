import { preset, files } from "../store/signals";
import { PRESETS, PRESET_ORDER, type Preset } from "../lib/presets";
import { handleFiles, changePreset } from "../app";
import { PlusGlyph } from "./PlusGlyph";

export const Header = () => {
  const hasFiles = files.value.length > 0;

  return (
    <header class="product-header">
      <div class="product-header-top">
        <h1 class="product-title">Squisher</h1>
        {hasFiles && (
          <label class="add-more-btn" aria-label="写真を追加">
            <input
              type="file"
              accept="image/*"
              multiple
              class="hidden-input"
              onChange={(e) => {
                const target = e.currentTarget as HTMLInputElement;
                if (target.files && target.files.length > 0) {
                  void handleFiles(target.files);
                  target.value = "";
                }
              }}
            />
            <span class="add-more-icon">
              <PlusGlyph size={20} />
            </span>
          </label>
        )}
      </div>
      <div class="segmented" role="radiogroup" aria-label="品質">
        {PRESET_ORDER.map((key: Preset) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={preset.value === key}
            class={preset.value === key ? "seg-item active" : "seg-item"}
            onClick={() => void changePreset(key)}
          >
            {PRESETS[key].label}
          </button>
        ))}
      </div>
    </header>
  );
};
