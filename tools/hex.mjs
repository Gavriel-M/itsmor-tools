const HEX = /(?<![&\w])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi;

export function findHexLiterals(text) {
  return text.split("\n").flatMap((line, i) =>
    [...line.matchAll(HEX)].map((match) => ({
      line: i + 1,
      column: match.index + 1,
      literal: match[0],
    }))
  );
}
