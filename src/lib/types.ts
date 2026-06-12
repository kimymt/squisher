export type OutputFormat = "jpeg" | "webp";

export type ProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "error"
  | "skipped";

export interface CompressResult {
  blob: Blob;
  width: number;
  height: number;
  larger: boolean;
  /** Wall-clock duration of the compress call in ms. Present in dev mode + e2e. */
  durationMs?: number;
}

export interface FileItem {
  id: string;
  file: File;
  outputFormat: OutputFormat;
  status: ProcessingStatus;
  result?: CompressResult;
  error?: string;
  /**
   * Object URL of the input-image thumbnail. Owned by the store: replacing
   * it via updateFile revokes the old URL, and clearFiles() revokes all of
   * them when rows are dropped. Never overwrite or remove it elsewhere.
   */
  thumbUrl?: string;
}
