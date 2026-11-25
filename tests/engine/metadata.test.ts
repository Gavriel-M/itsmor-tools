import { describe, expect, it } from "vitest";
import { readMetadata, webpExif } from "../../src/engine/metadata";
import { describeMetadata } from "../../src/engine/report";
import { fixture } from "./fixture";

const ALL_ABSENT = {
  location: "absent",
  camera: "absent",
  lens: "absent",
  dateTaken: "absent",
  software: "absent",
};

describe("readMetadata", () => {
  it("reports every field a JPEG carries as removed", async () => {
    expect(await readMetadata(fixture("metadata.jpg"), "jpeg")).toEqual({
      report: {
        location: "removed",
        camera: "removed",
        lens: "removed",
        dateTaken: "removed",
        software: "removed",
      },
      colourProfile: null,
      orientation: null,
    });
  });

  it("reads EXIF out of a WebP's EXIF chunk", async () => {
    expect(
      (await readMetadata(fixture("metadata.webp"), "webp")).report
    ).toEqual({ ...ALL_ABSENT, location: "removed", camera: "removed" });
  });

  it("reports orientation without counting it as removed metadata", async () => {
    expect(await readMetadata(fixture("orientation-6.jpg"), "jpeg")).toEqual({
      report: ALL_ABSENT,
      colourProfile: null,
      orientation: 6,
    });
  });

  it("reads the colour profile's name", async () => {
    const metadata = await readMetadata(fixture("display-p3.jpg"), "jpeg");
    expect(metadata.colourProfile).toBe("Display P3");
    expect(metadata.report).toEqual(ALL_ABSENT);
  });

  it.each([
    ["alpha.png", "png"],
    ["animated.gif", "gif"],
    ["plain.bmp", "bmp"],
    ["plain.heic", "heic"],
    ["corrupt.jpg", "jpeg"],
  ] as const)("reports %s as carrying nothing", async (name, format) => {
    expect((await readMetadata(fixture(name), format)).report).toEqual(
      ALL_ABSENT
    );
  });

  it("reports nothing for bytes exifr cannot parse", async () => {
    expect((await readMetadata(new Uint8Array(64), "jpeg")).report).toEqual(
      ALL_ABSENT
    );
  });
});

describe("describeMetadata", () => {
  it("counts a field present through any of its tags", () => {
    expect(
      describeMetadata({ GPSLatitude: [32, 0, 0], Model: "X", CreateDate: 1 })
        .report
    ).toEqual({
      ...ALL_ABSENT,
      location: "removed",
      camera: "removed",
      dateTaken: "removed",
    });
  });

  it("ignores empty values", () => {
    expect(describeMetadata({ Make: "", Software: null }).report).toEqual(
      ALL_ABSENT
    );
  });
});

describe("webpExif", () => {
  it("returns null for a WebP without an EXIF chunk", () => {
    const bytes = Uint8Array.from("RIFF\x0c\0\0\0WEBPVP8 \0\0\0\0", (c) =>
      c.charCodeAt(0)
    );
    expect(webpExif(bytes)).toBeNull();
  });

  it("strips an Exif prefix from the chunk", () => {
    const tiff = "II*\0";
    const chunk = `EXIF\x0a\0\0\0Exif\0\0${tiff}`;
    const bytes = Uint8Array.from(`RIFF\0\0\0\0WEBP${chunk}`, (c) =>
      c.charCodeAt(0)
    );
    expect(String.fromCharCode(...webpExif(bytes)!)).toBe(tiff);
  });
});
