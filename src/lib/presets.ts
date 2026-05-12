export type Preset = "high" | "standard" | "max";

export interface PresetConfig {
  maxDimension: number;
  quality: number;
  label: string;
}

export const PRESETS: Record<Preset, PresetConfig> = {
  high: { maxDimension: 3840, quality: 0.85, label: "高品質" },
  standard: { maxDimension: 2560, quality: 0.75, label: "標準" },
  max: { maxDimension: 1920, quality: 0.6, label: "強力圧縮" },
};

export const PRESET_ORDER: Preset[] = ["high", "standard", "max"];
