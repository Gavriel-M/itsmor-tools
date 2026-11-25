import { describe, expect, it } from "vitest";
import { displayP3ToSrgb } from "../../src/engine/colour";

const convert = (...rgba: number[]) => {
  const pixels = Uint8ClampedArray.from(rgba);
  displayP3ToSrgb(pixels);
  return [...pixels];
};

describe("displayP3ToSrgb", () => {
  it.each([0, 1, 64, 128, 200, 255])("keeps grey %i grey", (v) => {
    expect(convert(v, v, v, 255)).toEqual([v, v, v, 255]);
  });

  it("maps the P3 coordinates of sRGB's primaries back to the primaries", () => {
    const red = convert(234, 51, 35, 255);
    const green = convert(117, 251, 76, 255);
    const distance = (a: number[], b: number[]) =>
      Math.max(...b.map((v, i) => Math.abs(a[i] - v)));
    expect(distance(red, [255, 0, 0, 255])).toBeLessThanOrEqual(3);
    expect(distance(green, [0, 255, 0, 255])).toBeLessThanOrEqual(3);
  });

  it("clips P3 red, which is outside sRGB, to sRGB red", () => {
    expect(convert(255, 0, 0, 255)).toEqual([255, 0, 0, 255]);
  });

  it("leaves alpha untouched and converts every pixel", () => {
    expect(convert(128, 128, 128, 7, 234, 51, 35, 0)).toEqual([
      128,
      128,
      128,
      7,
      ...convert(234, 51, 35, 0),
    ]);
  });
});
