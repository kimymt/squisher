export type ShareOutcome = "shared" | "cancelled" | "unsupported" | "failed";

export interface ShareResult {
  outcome: ShareOutcome;
  error?: string;
}

export const isShareSupported = (): boolean =>
  typeof navigator.canShare === "function" &&
  typeof navigator.share === "function";

export const shareFiles = async (files: File[]): Promise<ShareResult> => {
  if (!isShareSupported()) {
    return { outcome: "unsupported", error: "このブラウザは共有に対応していません" };
  }
  if (!navigator.canShare({ files })) {
    return { outcome: "unsupported", error: "これらのファイルは共有できません" };
  }
  try {
    await navigator.share({ files });
    return { outcome: "shared" };
  } catch (e) {
    if ((e as DOMException).name === "AbortError") {
      return { outcome: "cancelled" };
    }
    return { outcome: "failed", error: (e as Error).message || "共有に失敗しました" };
  }
};

export const downloadFile = (file: File): void => {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Trigger downloads one at a time with a small gap — browsers throttle bursts. */
export const downloadFiles = async (files: File[]): Promise<void> => {
  for (let i = 0; i < files.length; i++) {
    downloadFile(files[i]);
    if (i < files.length - 1) await delay(250);
  }
};
