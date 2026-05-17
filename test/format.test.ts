import { describe, it, expect } from "vitest";
import { formatBytes, formatBytesPair } from "../src/lib/format";

describe("formatBytes", () => {
  it("renders < 1 KB as raw bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1)).toBe("1 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("renders KB range with 1 decimal", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(10_000)).toBe("9.8 KB");
  });

  it("renders MB range with 2 decimals", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.00 MB");
    expect(formatBytes(46_465_433)).toBe("44.31 MB");
    expect(formatBytes(23_426_113)).toBe("22.34 MB");
  });
});

describe("formatBytesPair", () => {
  it("dedupes the unit when both sides share it (MB → MB)", () => {
    // The headline case: SaveBar totals on iPhone Air. Without dedup the
    // string was "44.31 MB → 22.34 MB" which pushed the toggle to a 2nd row.
    expect(formatBytesPair(46_465_433, 23_426_113)).toBe("44.31 → 22.34 MB");
  });

  it("dedupes when both are KB", () => {
    expect(formatBytesPair(2048, 1024)).toBe("2.0 → 1.0 KB");
  });

  it("dedupes when both are B", () => {
    expect(formatBytesPair(100, 50)).toBe("100 → 50 B");
  });

  it("keeps both units when they differ (MB → KB)", () => {
    expect(formatBytesPair(1_500_000, 1024)).toBe("1.43 MB → 1.0 KB");
  });

  it("keeps both units when compressed shrank into a smaller unit (MB → B)", () => {
    expect(formatBytesPair(1_500_000, 500)).toBe("1.43 MB → 500 B");
  });

  it("handles 0 + 0 cleanly (both B, deduped)", () => {
    expect(formatBytesPair(0, 0)).toBe("0 → 0 B");
  });

  it("handles 0 → MB asymmetry (different units, no dedup)", () => {
    expect(formatBytesPair(0, 1_500_000)).toBe("0 B → 1.43 MB");
  });
});
