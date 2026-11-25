import { ascii, startsWith, view } from "./bytes";
import type { InputFormat } from "./formats";

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "heim", "heis"]);
const AVIF_BRANDS = new Set(["avif", "avis"]);
const GENERIC_HEIF_BRANDS = new Set(["mif1", "msf1"]);

export function sniffFormat(bytes: Uint8Array): InputFormat | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "png";
  if (ascii(bytes, 0, 4) === "GIF8") return "gif";
  if (ascii(bytes, 0, 2) === "BM") return "bmp";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "webp";
  }
  if (ascii(bytes, 4, 4) === "ftyp") return sniffHeif(bytes);
  return null;
}

function sniffHeif(bytes: Uint8Array): InputFormat | null {
  const major = ascii(bytes, 8, 4);
  if (AVIF_BRANDS.has(major)) return "avif";
  if (HEIC_BRANDS.has(major)) return "heic";

  const boxEnd = Math.min(view(bytes).getUint32(0), bytes.length);
  const compatible: string[] = [];
  for (let offset = 16; offset + 4 <= boxEnd; offset += 4) {
    compatible.push(ascii(bytes, offset, 4));
  }
  if (compatible.some((brand) => AVIF_BRANDS.has(brand))) return "avif";
  if (
    GENERIC_HEIF_BRANDS.has(major) ||
    compatible.some((b) => HEIC_BRANDS.has(b) || GENERIC_HEIF_BRANDS.has(b))
  ) {
    return "heic";
  }
  return null;
}
