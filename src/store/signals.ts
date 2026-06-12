import { signal, computed } from "@preact/signals";
import type { FileItem } from "../lib/types";
import type { Preset } from "../lib/presets";

export const files = signal<FileItem[]>([]);
export const preset = signal<Preset>("standard");
export const skipLarger = signal<boolean>(true);
/** Non-null while the last save attempt is showing an error/notice in the SaveBar. */
export const saveError = signal<string | null>(null);
/** Whether the "Add to Home Screen" hint is currently visible. */
export const showInstallBanner = signal<boolean>(false);

/**
 * Set of file ids that have already been shared via Web Share / download.
 *
 * IMPORTANT: 必ず `markShared()` 経由で更新する。直接 `sharedIds.value.add(id)`
 * を呼ぶと @preact/signals が変更を検知できず(Object.is で reference 等価)、
 * `saveableFiles` の computed が再計算されない silent bug になる。
 * 必ず `new Set([...sharedIds.value, ...newIds])` で再代入すること。
 */
export const sharedIds = signal<Set<string>>(new Set());

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
      !(skipLarger.value && f.result.larger) &&
      !sharedIds.value.has(f.id)
  )
);

export const canSave = computed(() => saveableFiles.value.length > 0);

/** Files still being processed (pending or processing). Drives the "N 件処理中" caption. */
export const processingCount = computed(
  () =>
    files.value.filter((f) => f.status === "pending" || f.status === "processing")
      .length
);

/** Whether every saveable file has already been shared (= "全て保存済み" state). */
export const allShared = computed(
  () =>
    sharedIds.value.size > 0 &&
    files.value.length > 0 &&
    files.value.every(
      (f) =>
        sharedIds.value.has(f.id) ||
        f.status === "error" ||
        (skipLarger.value && f.result?.larger === true)
    )
);

let idCounter = 0;
export const nextId = (): string => `f${++idCounter}`;

/** Release a row's thumbnail object URL. No-op for rows without one. */
const revokeThumb = (url: string | undefined): void => {
  if (url) URL.revokeObjectURL(url);
};

export const updateFile = (id: string, patch: Partial<FileItem>): void => {
  files.value = files.value.map((f) => {
    if (f.id !== id) return f;
    // Replacing a row's thumbUrl orphans the old object URL — revoke it
    // here so no caller can leak one by overwriting.
    if (patch.thumbUrl !== undefined && f.thumbUrl && f.thumbUrl !== patch.thumbUrl) {
      revokeThumb(f.thumbUrl);
    }
    return { ...f, ...patch };
  });
};

export const addFiles = (newFiles: FileItem[]): void => {
  files.value = [...files.value, ...newFiles];
  saveError.value = null;
};

/**
 * Drop every row and release per-row resources (thumbnail object URLs,
 * and with them the retained result blobs once rows are gone).
 *
 * 将来の「クリア」ボタン(TODOS.md P3)は必ずこれを呼ぶこと —
 * `files.value = []` で直接空にすると thumbUrl が revoke されず、
 * blob がセッション終了まで滞留する。
 */
export const clearFiles = (): void => {
  for (const f of files.value) revokeThumb(f.thumbUrl);
  files.value = [];
  sharedIds.value = new Set();
  saveError.value = null;
};

/**
 * Mark a set of file ids as shared (saved to Photos / downloaded).
 *
 * 必ずこの helper を使って sharedIds を更新する。直接 `.add()` を使うと
 * computed (`saveableFiles`, `canSave`, `allShared`) が再計算されない。
 */
export const markShared = (ids: string[]): void => {
  if (ids.length === 0) return;
  sharedIds.value = new Set([...sharedIds.value, ...ids]);
};
