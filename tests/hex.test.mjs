import { describe, expect, it } from "vitest";
import { findHexLiterals } from "../tools/hex.mjs";

const literals = (text) => findHexLiterals(text).map((m) => m.literal);

describe("findHexLiterals", () => {
  it.each(["#abc", "#abcd", "#a9543b", "#A9543BFF"])("finds %s", (hex) => {
    expect(literals(`color: ${hex};`)).toEqual([hex]);
  });

  it("finds a literal inside a JS string and a Tailwind arbitrary value", () => {
    expect(
      literals(`const c = "#f2f0e6"; <p className="text-[#004e98]" />`)
    ).toEqual(["#f2f0e6", "#004e98"]);
  });

  it.each(["#abcde", "#abcdefa", "#abcdefabc"])(
    "ignores %s, which is not a colour length",
    (text) => {
      expect(literals(text)).toEqual([]);
    }
  );

  it("ignores numeric character references", () => {
    expect(literals("&#039; &#8212;")).toEqual([]);
  });

  it("ignores hex digits that follow a word character", () => {
    expect(literals("issue#123 a#bcd")).toEqual([]);
  });

  it("ignores fragments that are not hex", () => {
    expect(literals(`<a href="#main">`)).toEqual([]);
  });

  it("reports the line and column of every match", () => {
    expect(findHexLiterals("a\n  b: #fff; c: #000;")).toEqual([
      { line: 2, column: 6, literal: "#fff" },
      { line: 2, column: 15, literal: "#000" },
    ]);
  });
});
