import { signal, computed } from "@preact/signals";
import type { FileItem } from "../lib/types";
import type { Preset } from "../lib/presets";

export const files = signal<FileItem[]>([]);
export const preset = signal<Preset>("standard");
export const skipLarger = signal<boolean>(true);
/** Non-null while the last save attempt is showing an error/notice in the SaveBar. */
export const saveError = signal<string | null>(null);

export const totalOriginalSize = computed(() =>
  files.value.reduce((sum, f) => sum + f.file.size, 0)
);

export const totalCompressedSize = computed(() =>
  files.value.reduce((sum, f) => {
    if (f.status !== "completed" || !f.result) return sum;
    if (skipLarger.value && f.result.larger) return sum + f.file.size;
    return sum + f.result.blob.size;
  }, 0)
);

export const saveableFiles = computed(() =>
  files.value.filter(
    (f) =>
      f.status === "completed" &&
      f.result &&
      !(skipLarger.value && f.result.larger)
  )
);

export const canSave = computed(() => saveableFiles.value.length > 0);

let idCounter = 0;
export const nextId = (): string => `f${++idCounter}`;

export const updateFile = (id: string, patch: Partial<FileItem>): void => {
  files.value = files.value.map((f) => (f.id === id ? { ...f, ...patch } : f));
};

export const addFiles = (newFiles: FileItem[]): void => {
  files.value = [...files.value, ...newFiles];
  saveError.value = null;
};
