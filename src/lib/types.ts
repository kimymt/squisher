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
}

export interface FileItem {
  id: string;
  file: File;
  outputFormat: OutputFormat;
  status: ProcessingStatus;
  result?: CompressResult;
  error?: string;
}
