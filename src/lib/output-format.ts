import type { OutputFormat } from "./types";

export const detectOutputFormat = (file: File): OutputFormat => {
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "webp";
  return "jpeg";
};

export const mimeFor = (format: OutputFormat): string =>
  format === "jpeg" ? "image/jpeg" : "image/webp";

export const extFor = (format: OutputFormat): string =>
  format === "jpeg" ? "jpg" : "webp";
