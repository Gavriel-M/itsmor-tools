import { describe, expect, it } from "vitest";
import { server } from "vitest/browser";
import {
  canEncodeNatively,
  convert,
  fixture,
  meanAbsoluteError,
  metadataIn,
  pixelAt,
  pixels,
  withoutIccProfile,
} from "./helpers";

const INPUTS = [
  ["metadata.jpg", 2400, 1600],
  ["orientation-6.jpg", 320, 480],
  ["display-p3.jpg", 384, 288],
  ["alpha.png", 320, 240],
  ["metadata.webp", 320, 240],
  ["animated.gif", 320, 240],
  ["plain.bmp", 160, 120],
] as const;

const TARGETS = [
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
] as const;

const MATRIX = INPUTS.flatMap((input) =>
  TARGETS.map((target) => [...input, ...target] as const)
);

describe("every input to every output", () => {
  it.each(MATRIX)("%s to %s", async (name, width, height, target, type) => {
    const conversion = convert(name, { target });
    if (target === "webp" && !(await canEncodeNatively(type))) {
      await expect(conversion).rejects.toMatchObject({
        code: "encode-unsupported",
      });
      return;
    }
    const result = await conversion;
    expect(result.output.type).toBe(type);
    expect([result.width, result.height]).toEqual([width, height]);
    const decoded = await pixels(result.output);
    expect([decoded.width, decoded.height]).toEqual([width, height]);
    expect(await metadataIn(result.output)).toBeUndefined();
  });
});

describe("the metadata report", () => {
  it("credits removal of everything a JPEG carried", async () => {
    const { metadata } = await convert("metadata.jpg");
    expect(metadata.report).toEqual({
      location: "removed",
      camera: "removed",
      lens: "removed",
      dateTaken: "removed",
      software: "removed",
    });
  });

  it("says absent for what was never there", async () => {
    const { metadata } = await convert("metadata.webp", { target: "png" });
    expect(metadata.report).toEqual({
      location: "removed",
      camera: "removed",
      lens: "absent",
      dateTaken: "absent",
      software: "absent",
    });
  });

  it("reports orientation and the colour profile, not as removed fields", async () => {
    const rotated = await convert("orientation-6.jpg");
    expect(rotated.metadata.orientation).toBe(6);
    expect(Object.values(rotated.metadata.report)).not.toContain("removed");
    const p3 = await convert("display-p3.jpg");
    expect(p3.metadata.colourProfile).toBe("Display P3");
  });
});

describe("pixels", () => {
  it("applies EXIF orientation to the pixels", async () => {
    const { output } = await convert("orientation-6.jpg", { target: "png" });
    const image = await pixels(output);
    const [r, g, b] = pixelAt(image, image.width - 20, 20);
    expect(r).toBeGreaterThan(200);
    expect(g + b).toBeLessThan(60);
    expect(pixelAt(image, 20, 20).slice(0, 3)).toEqual([128, 128, 128]);
  });

  it("fits maxDimension, keeping the aspect ratio", async () => {
    const result = await convert("metadata.jpg", { maxDimension: 1000 });
    expect([result.width, result.height]).toEqual([1000, 667]);
    const decoded = await pixels(result.output);
    expect([decoded.width, decoded.height]).toEqual([1000, 667]);
  });

  it("flattens transparency onto white for JPEG", async () => {
    const { output } = await convert("alpha.png", { target: "jpeg" });
    const [r, g, b] = pixelAt(await pixels(output), 280, 120);
    expect(Math.min(r, g, b)).toBeGreaterThan(250);
  });

  it("keeps transparency for PNG", async () => {
    const { output } = await convert("alpha.png", { target: "png" });
    expect(pixelAt(await pixels(output), 280, 120)[3]).toBe(0);
  });

  it("converts a Display P3 JPEG to sRGB, matching ColorSync", async () => {
    const reference = await pixels(await fixture("display-p3.srgb.png"));
    const { output } = await convert("display-p3.jpg", { quality: 0.92 });
    expect(meanAbsoluteError(await pixels(output), reference)).toBeLessThan(3);

    const unconverted = await pixels(
      await withoutIccProfile(await fixture("display-p3.jpg"))
    );
    expect(meanAbsoluteError(unconverted, reference)).toBeGreaterThan(3);
  });

  it("reports the path it took", async () => {
    const jpeg = await convert("alpha.png", { target: "jpeg" });
    expect(jpeg.path).toEqual({ decode: "native", encode: "wasm" });
    const png = await convert("alpha.png", { target: "png" });
    expect(png.path).toEqual({ decode: "native", encode: "native" });
    expect(png.ms).toBeGreaterThan(0);
  });
});

describe("HEIC", () => {
  const nativeHeic =
    server.browser === "webkit" && server.platform === "darwin";

  it.each(["plain.heic", "mislabelled.jpg"])(
    nativeHeic
      ? "decodes %s natively"
      : "fails %s with the error phase 5 replaces",
    async (name) => {
      const conversion = convert(name);
      if (!nativeHeic) {
        await expect(conversion).rejects.toMatchObject({
          code: "decode-unsupported",
        });
        return;
      }
      const result = await conversion;
      expect([result.width, result.height]).toEqual([320, 240]);
      expect(await metadataIn(result.output)).toBeUndefined();
    }
  );
});
