import type { FileItem } from "../lib/types";
import { Spinner } from "./Spinner";

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

interface Props {
  item: FileItem;
}

export const FileRow = ({ item }: Props) => {
  const completed = item.status === "completed";
  const errored = item.status === "error";
  const reduction = item.result
    ? Math.round((1 - item.result.blob.size / item.file.size) * 100)
    : null;
  const larger = item.result?.larger ?? false;

  return (
    <div class={`file-row ${completed ? "completed" : ""} ${errored ? "errored" : ""}`}>
      <div class="file-thumb" aria-hidden="true" />
      <div class="file-info">
        <div class="file-name">{item.file.name}</div>
        <div class="file-sizes mono">
          {formatBytes(item.file.size)}
          <span class="arrow"> → </span>
          {item.status === "processing"
            ? "…"
            : item.result
              ? formatBytes(item.result.blob.size)
              : errored
                ? "エラー"
                : "—"}
        </div>
        {item.error && <div class="file-error">{item.error}</div>}
      </div>
      {item.status === "processing" && <Spinner />}
      {reduction !== null && (
        <span class={`badge-reduction ${larger ? "warning" : ""}`}>
          {larger ? `+${Math.abs(reduction)}% ⚠` : `-${reduction}%`}
        </span>
      )}
    </div>
  );
};
