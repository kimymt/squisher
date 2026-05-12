import type { FileItem, OutputFormat } from "../lib/types";
import { changeOutputFormat } from "../app";
import { Spinner } from "./Spinner";

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

const FORMAT_ORDER: OutputFormat[] = ["jpeg", "webp"];
const FORMAT_LABELS: Record<OutputFormat, string> = {
  jpeg: "JPEG",
  webp: "WebP",
};

interface Props {
  item: FileItem;
}

export const FileRow = ({ item }: Props) => {
  const completed = item.status === "completed";
  const errored = item.status === "error";
  const busy = item.status === "pending" || item.status === "processing";
  const reduction = item.result
    ? Math.round((1 - item.result.blob.size / item.file.size) * 100)
    : null;
  const larger = item.result?.larger ?? false;

  return (
    <div class={`file-row ${completed ? "completed" : ""} ${errored ? "errored" : ""}`}>
      {item.thumbUrl ? (
        <img class="file-thumb" src={item.thumbUrl} alt="" />
      ) : (
        <div class="file-thumb file-thumb-placeholder" aria-hidden="true" />
      )}
      <div class="file-info">
        <div class="file-name">{item.file.name}</div>
        <div class="file-sizes mono">
          {formatBytes(item.file.size)}
          <span class="arrow"> → </span>
          {busy
            ? "…"
            : item.result
              ? formatBytes(item.result.blob.size)
              : errored
                ? "エラー"
                : "—"}
        </div>
        {item.error && <div class="file-error">{item.error}</div>}
        <div class="format-toggle" role="radiogroup" aria-label="出力形式">
          {FORMAT_ORDER.map((fmt) => (
            <button
              key={fmt}
              type="button"
              role="radio"
              aria-checked={item.outputFormat === fmt}
              class={item.outputFormat === fmt ? "fmt-item active" : "fmt-item"}
              disabled={busy}
              onClick={() => void changeOutputFormat(item.id, fmt)}
            >
              {FORMAT_LABELS[fmt]}
            </button>
          ))}
        </div>
      </div>
      {busy && <Spinner />}
      {reduction !== null && (
        <span class={`badge-reduction ${larger ? "warning" : ""}`}>
          {larger ? `+${Math.abs(reduction)}% ⚠` : `-${reduction}%`}
        </span>
      )}
    </div>
  );
};
