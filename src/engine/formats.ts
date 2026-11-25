export const INPUT_FORMATS = [
  "jpeg",
  "png",
  "webp",
  "avif",
  "heic",
  "gif",
  "bmp",
] as const;
export type InputFormat = (typeof INPUT_FORMATS)[number];

export const OUTPUT_FORMATS = ["jpeg", "png", "webp"] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export const PROBED_DECODE_FORMATS = ["heic", "avif"] as const;
export type ProbedDecodeFormat = (typeof PROBED_DECODE_FORMATS)[number];

export const MIME_TYPES: Record<InputFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  heic: "image/heic",
  gif: "image/gif",
  bmp: "image/bmp",
};

export const EXTENSIONS: Record<OutputFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

export const HAS_ALPHA: Record<OutputFormat, boolean> = {
  jpeg: false,
  png: true,
  webp: true,
};

export function isProbedDecodeFormat(
  format: InputFormat
): format is ProbedDecodeFormat {
  return (PROBED_DECODE_FORMATS as readonly InputFormat[]).includes(format);
}
