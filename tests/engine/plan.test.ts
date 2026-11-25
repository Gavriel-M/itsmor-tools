import { describe, expect, it } from "vitest";
import type { Capabilities } from "../../src/engine/capabilities";
import {
  choosePath,
  fitWithin,
  outputNames,
  planJob,
} from "../../src/engine/plan";

const DESKTOP: Capabilities = {
  encode: { jpeg: true, png: true, webp: true },
  maxPixels: 100_000_000,
  decode: { heic: false, avif: true },
};

const SAFARI: Capabilities = {
  encode: { jpeg: true, png: true, webp: false },
  maxPixels: 4096 * 4096,
  decode: { heic: true, avif: true },
};

describe("fitWithin", () => {
  it("fits the longest edge and keeps the aspect ratio", () => {
    expect(fitWithin(4032, 3024, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3024, 4032, 2048)).toEqual({ width: 1536, height: 2048 });
  });

  it("never upscales", () => {
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });

  it("leaves the size alone without a maximum", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(800, 600, 0)).toEqual({ width: 800, height: 600 });
  });

  it("rounds to whole pixels and never goes below one", () => {
    expect(fitWithin(1000, 333, 100)).toEqual({ width: 100, height: 33 });
    expect(fitWithin(10_000, 1, 100)).toEqual({ width: 100, height: 1 });
  });
});

describe("outputNames", () => {
  it("swaps the extension for the target's", () => {
    expect(outputNames(["IMG_1234.HEIC"], "jpeg")).toEqual(["IMG_1234.jpg"]);
    expect(outputNames(["scan.final.png"], "webp")).toEqual([
      "scan.final.webp",
    ]);
  });

  it("adds an extension to a name without one", () => {
    expect(outputNames(["photo", ".hidden"], "png")).toEqual([
      "photo.png",
      ".hidden.png",
    ]);
  });

  it("numbers collisions within a batch, ignoring case", () => {
    expect(
      outputNames(
        ["IMG_1234.HEIC", "IMG_1234.jpg", "img_1234.png", "IMG_1234 (2).heic"],
        "jpeg"
      )
    ).toEqual([
      "IMG_1234.jpg",
      "IMG_1234 (2).jpg",
      "img_1234 (3).jpg",
      "IMG_1234 (2) (2).jpg",
    ]);
  });
});

describe("choosePath", () => {
  it("decodes natively and encodes JPEG with mozjpeg", () => {
    expect(
      choosePath({ format: "png", target: "jpeg", pixels: 1e6 }, DESKTOP)
    ).toEqual({ decode: "native", encode: "wasm" });
  });

  it("encodes PNG and WebP natively where the engine can", () => {
    expect(
      choosePath({ format: "jpeg", target: "webp", pixels: 1e6 }, DESKTOP)
    ).toEqual({ decode: "native", encode: "native" });
  });

  it("encodes in wasm where the engine cannot", () => {
    expect(
      choosePath({ format: "jpeg", target: "webp", pixels: 1e6 }, SAFARI)
    ).toEqual({ decode: "native", encode: "wasm" });
  });

  it("decodes in wasm where the engine cannot", () => {
    expect(
      choosePath({ format: "heic", target: "png", pixels: 1e6 }, DESKTOP)
    ).toEqual({ decode: "wasm", encode: "native" });
  });

  it("goes wasm end to end above the canvas limit", () => {
    expect(
      choosePath({ format: "heic", target: "png", pixels: 24e6 }, SAFARI)
    ).toEqual({ decode: "wasm", encode: "wasm" });
  });
});

describe("planJob", () => {
  it("plans a path this phase's codecs serve", () => {
    expect(
      planJob({ format: "heic", target: "jpeg", pixels: 12e6 }, SAFARI)
    ).toEqual({ path: { decode: "native", encode: "wasm" } });
  });

  it("names the missing decoder", () => {
    expect(
      planJob({ format: "heic", target: "jpeg", pixels: 12e6 }, DESKTOP)
    ).toEqual({ error: "decode-unsupported" });
  });

  it("names the missing encoder", () => {
    expect(
      planJob({ format: "jpeg", target: "webp", pixels: 1e6 }, SAFARI)
    ).toEqual({ error: "encode-unsupported" });
  });

  it("names the size when the image is over the canvas limit", () => {
    expect(
      planJob({ format: "jpeg", target: "jpeg", pixels: 24e6 }, SAFARI)
    ).toEqual({ error: "too-large" });
  });
});
