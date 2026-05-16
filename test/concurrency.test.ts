import { describe, it, expect } from "vitest";
import { computeConcurrencyFor } from "../src/lib/concurrency";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15";
const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const small = { file: { size: 3 * 1024 * 1024 } }; // 3 MB, 12 MP iPhone JPEG 相当
const large = { file: { size: 10 * 1024 * 1024 } }; // 10 MB, 36+ MP 相当

describe("computeConcurrencyFor (pure)", () => {
  describe("iOS", () => {
    it("returns 2 for small iPhone files only", () => {
      expect(computeConcurrencyFor([small, small, small], IPHONE)).toBe(2);
    });

    it("returns 1 if any file > 8 MB (mixed)", () => {
      expect(computeConcurrencyFor([small, large, small], IPHONE)).toBe(1);
    });

    it("returns 1 for all-large iPhone files", () => {
      expect(computeConcurrencyFor([large, large], IPHONE)).toBe(1);
    });

    it("returns 1 for empty array on iOS (safe default)", () => {
      expect(computeConcurrencyFor([], IPHONE)).toBe(1);
    });

    it("treats file.size = 8 MB exactly as small (boundary at strict >)", () => {
      const exact = { file: { size: 8 * 1024 * 1024 } };
      expect(computeConcurrencyFor([exact], IPHONE)).toBe(2);
    });

    it("treats file.size = 8 MB + 1 byte as large", () => {
      const justOver = { file: { size: 8 * 1024 * 1024 + 1 } };
      expect(computeConcurrencyFor([justOver], IPHONE)).toBe(1);
    });

    it("returns 2 for iPad UA with small files", () => {
      expect(computeConcurrencyFor([small], IPAD)).toBe(2);
    });

    it("returns 1 for iPad UA with large file", () => {
      expect(computeConcurrencyFor([large], IPAD)).toBe(1);
    });
  });

  describe("non-iOS", () => {
    it("returns 3 for Chrome regardless of file size", () => {
      expect(computeConcurrencyFor([large, large, large], CHROME)).toBe(3);
    });

    it("returns 3 for Mac desktop UA (no iOS literal in UA)", () => {
      // NB: iPadOS 13+ reports Mac UA. We treat that as desktop here for
      // throughput: iPad has more memory than iPhone, so 3 in flight is fine.
      // This matches the original `CONCURRENCY` constant's behaviour.
      expect(computeConcurrencyFor([small], MAC)).toBe(3);
    });

    it("returns 3 for empty array on non-iOS (matches old desktop default)", () => {
      expect(computeConcurrencyFor([], CHROME)).toBe(3);
    });
  });
});
