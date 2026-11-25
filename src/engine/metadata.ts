import exifr from "exifr";
import { ascii, view } from "./bytes";
import type { InputFormat } from "./formats";
import { describeMetadata, type InputMetadata, type Tags } from "./report";

const PARSE_OPTIONS = {
  tiff: true,
  exif: true,
  gps: true,
  icc: true,
  ihdr: false,
  translateValues: false,
};

export async function readMetadata(
  bytes: Uint8Array,
  format: InputFormat
): Promise<InputMetadata> {
  const source = format === "webp" ? webpExif(bytes) : bytes;
  if (!source || format === "gif" || format === "bmp") {
    return describeMetadata(undefined);
  }
  const tags: Tags | undefined = await exifr
    .parse(source, PARSE_OPTIONS)
    .catch(() => undefined);
  return describeMetadata(tags);
}

export function webpExif(bytes: Uint8Array): Uint8Array | null {
  const data = view(bytes);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const size = data.getUint32(offset + 4, true);
    if (ascii(bytes, offset, 4) === "EXIF") {
      const payload = bytes.subarray(offset + 8, offset + 8 + size);
      return ascii(payload, 0, 6) === "Exif\0\0"
        ? payload.subarray(6)
        : payload;
    }
    offset += 8 + size + (size % 2);
  }
  return null;
}
