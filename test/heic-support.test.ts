import { describe, it, expect } from "vitest";
import * as HS from "../src/lib/heic-support";

// DEBUG: confirm what's actually exported
// eslint-disable-next-line no-console
console.log("HS exports:", Object.keys(HS));

const { isHeicFile, supportsHeicInputFor } = HS;

describe("isHeicFile", () => {
  it("detects .heic by extension", () => {
    expect(isHeicFile(new File([""], "IMG_001.heic", { type: "" }))).toBe(true);
  });

  it("detects .heif by extension", () => {
    expect(isHeicFile(new File([""], "photo.heif", { type: "" }))).toBe(true);
  });

  it("detects uppercase .HEIC", () => {
    expect(isHeicFile(new File([""], "IMG.HEIC", { type: "" }))).toBe(true);
  });

  it("detects image/heic MIME even without the extension", () => {
    expect(isHeicFile(new File([""], "x.bin", { type: "image/heic" }))).toBe(true);
  });

  it("detects image/heif MIME", () => {
    expect(isHeicFile(new File([""], "x.bin", { type: "image/heif" }))).toBe(true);
  });

  it("returns false for JPEG", () => {
    expect(isHeicFile(new File([""], "IMG.jpg", { type: "image/jpeg" }))).toBe(false);
  });

  it("returns false for PNG", () => {
    expect(isHeicFile(new File([""], "IMG.png", { type: "image/png" }))).toBe(false);
  });
});

describe("supportsHeicInputFor (pure)", () => {
  const IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1";
  const MAC =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15";
  const CHROME_LINUX =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  it("returns true for iPhone Safari", () => {
    expect(supportsHeicInputFor(IPHONE, 5)).toBe(true);
  });

  it("returns true for iPad on iPadOS 13+ (Mac UA + multi-touch)", () => {
    expect(supportsHeicInputFor(MAC, 5)).toBe(true);
  });

  it("returns false for macOS Safari (Mac UA, no multi-touch)", () => {
    expect(supportsHeicInputFor(MAC, 0)).toBe(false);
  });

  it("returns false for Chrome on Linux", () => {
    expect(supportsHeicInputFor(CHROME_LINUX, 0)).toBe(false);
  });

  it("returns true for iPad UA literal", () => {
    expect(
      supportsHeicInputFor(
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        5
      )
    ).toBe(true);
  });
});
