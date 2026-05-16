/**
 * 入力ファイルの size に応じて圧縮の並列数を動的に決める。
 *
 * iOS Safari は per-tab heap が ~200-380 MB に制限される。12 MP photo を
 * 2 並列で処理しても peak ~140 MB に収まるが、48 MP ProRAW (~15 MB JPEG)
 * を 2 並列にすると ~390 MB を超えて OOM の危険がある。
 *
 * File header から正確な pixel 数は decode 前には知れないので、
 * **file.size を proxy** にする(iPhone JPEG の圧縮率は概ね一定で、
 * 8 MB 超えなら 24 MP 級以上と推定できる)。
 *
 * Acceptance threshold (要実機校正):
 *   - 12 MP iPhone JPEG: ~3 MB → 2 並列
 *   - 48 MP iPhone ProRAW JPEG: ~15 MB → 1 並列に縮退
 */
const LARGE_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

const isIOS = (userAgent: string): boolean => /iP(hone|ad|od)/i.test(userAgent);

export interface ConcurrencyInput {
  file: { size: number };
}

/**
 * Pure detection — exposed for unit tests. Production callers use
 * `computeConcurrency()` which reads the live navigator.
 */
export const computeConcurrencyFor = (
  files: ConcurrencyInput[],
  userAgent: string
): number => {
  if (!isIOS(userAgent)) return 3; // non-iOS は heap 余裕、現状維持
  if (files.length === 0) return 1; // 空配列は安全側
  const hasLargeFile = files.some((f) => f.file.size > LARGE_FILE_BYTES);
  return hasLargeFile ? 1 : 2;
};

export const computeConcurrency = (files: ConcurrencyInput[]): number => {
  if (typeof navigator === "undefined") return 1;
  return computeConcurrencyFor(files, navigator.userAgent);
};
