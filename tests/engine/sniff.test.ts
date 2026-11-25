import { describe, expect, it } from "vitest";
import { sniffFormat } from "../../src/engine/sniff";
import { fixture, sample } from "./fixture";

function ftyp(major: string, ...compatible: string[]) {
  const brands = [major, "\0\0\0\0", ...compatible].join("");
  const box = `\0\0\0${String.fromCharCode(8 + brands.length)}ftyp${brands}`;
  return Uint8Array.from(box, (c) => c.charCodeAt(0));
}

describe("sniffFormat", () => {
  it.each([
    ["metadata.jpg", "jpeg"],
    ["alpha.png", "png"],
    ["metadata.webp", "webp"],
    ["animated.gif", "gif"],
    ["plain.bmp", "bmp"],
    ["plain.heic", "heic"],
  ])("reads %s as %s", (name, format) => {
    expect(sniffFormat(fixture(name))).toBe(format);
  });

  it("reads a HEIC named .jpg as HEIC", () => {
    expect(sniffFormat(fixture("mislabelled.jpg"))).toBe("heic");
  });

  it("reads an AVIF", () => {
    expect(sniffFormat(sample("sample.avif"))).toBe("avif");
  });

  it.each(["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"])(
    "reads major brand %s as HEIC",
    (brand) => {
      expect(sniffFormat(ftyp(brand))).toBe("heic");
    }
  );

  it.each(["avif", "avis"])("reads major brand %s as AVIF", (brand) => {
    expect(sniffFormat(ftyp(brand))).toBe("avif");
  });

  it("reads a generic HEIF brand with an AVIF compatible brand as AVIF", () => {
    expect(sniffFormat(ftyp("mif1", "miaf", "avif"))).toBe("avif");
  });

  it("reads an unknown major brand by its compatible brands", () => {
    expect(sniffFormat(ftyp("xxxx", "heic"))).toBe("heic");
    expect(sniffFormat(ftyp("isom", "mp41"))).toBeNull();
  });

  it("does not take a RIFF that is not WebP", () => {
    expect(
      sniffFormat(
        Uint8Array.from("RIFF\0\0\0\0WAVEfmt ", (c) => c.charCodeAt(0))
      )
    ).toBeNull();
  });

  it.each([
    ["empty", new Uint8Array()],
    ["text", Uint8Array.from("hello world!", (c) => c.charCodeAt(0))],
    ["a lone JPEG marker", Uint8Array.of(0xff, 0xd8)],
  ])("returns null for %s", (_, bytes) => {
    expect(sniffFormat(bytes)).toBeNull();
  });
});
