import { describe, expect, it } from "vitest";
import { readDimensions } from "../../src/engine/dimensions";
import { inspect } from "../../src/engine/inspect";
import { fixture, sample } from "./fixture";

const blob = (bytes: Uint8Array) => new Blob([bytes.slice()]);

describe("inspect", () => {
  it.each([
    ["metadata.jpg", "jpeg", 2400, 1600],
    ["orientation-6.jpg", "jpeg", 480, 320],
    ["display-p3.jpg", "jpeg", 384, 288],
    ["alpha.png", "png", 320, 240],
    ["metadata.webp", "webp", 320, 240],
    ["animated.gif", "gif", 320, 240],
    ["plain.bmp", "bmp", 160, 120],
    ["plain.heic", "heic", 320, 240],
    ["mislabelled.jpg", "heic", 320, 240],
    ["corrupt.jpg", "jpeg", 480, 320],
  ])("reads %s as %s, %i × %i", async (name, format, width, height) => {
    expect(await inspect(blob(fixture(name)))).toEqual({
      format,
      width,
      height,
    });
  });

  it("reads an AVIF's dimensions", async () => {
    expect(await inspect(blob(sample("sample.avif")))).toEqual({
      format: "avif",
      width: 16,
      height: 16,
    });
  });

  it("rejects bytes that are no image format", async () => {
    await expect(inspect(new Blob(["not an image"]))).rejects.toMatchObject({
      code: "unsupported-input",
    });
  });

  it("rejects a JPEG whose header is cut off", async () => {
    const truncated = fixture("metadata.jpg").slice(0, 100);
    await expect(inspect(blob(truncated))).rejects.toMatchObject({
      code: "corrupt",
    });
  });

  it("reads past a header larger than the first slice", async () => {
    const jpeg = fixture("orientation-6.jpg");
    const segment = new Uint8Array(2 + 65_002);
    segment.set([0xff, 0xe9, 65_002 >> 8, 65_002 & 0xff]);
    const segments = Array.from({ length: 5 }, () => segment);
    const file = new Blob([jpeg.slice(0, 2), ...segments, jpeg.slice(2)]);
    expect(await inspect(file)).toMatchObject({ width: 480, height: 320 });
  });
});

describe("readDimensions", () => {
  it("reads a VP8L WebP", () => {
    const bytes = new Uint8Array(30);
    bytes.set(Uint8Array.from("RIFF\0\0\0\0WEBPVP8L", (c) => c.charCodeAt(0)));
    const bits = (640 - 1) | ((480 - 1) << 14);
    new DataView(bytes.buffer).setUint32(21, bits, true);
    expect(readDimensions(bytes, "webp")).toEqual({ width: 640, height: 480 });
  });

  it("reads a top-down BMP", () => {
    const bytes = new Uint8Array(30);
    const data = new DataView(bytes.buffer);
    data.setUint32(14, 40, true);
    data.setInt32(18, 64, true);
    data.setInt32(22, -32, true);
    expect(readDimensions(bytes, "bmp")).toEqual({ width: 64, height: 32 });
  });

  it("returns null for zero dimensions", () => {
    expect(readDimensions(new Uint8Array(30), "gif")).toBeNull();
  });
});
