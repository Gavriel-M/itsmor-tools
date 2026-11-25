import { ascii, view } from "./bytes";
import type { InputFormat } from "./formats";

export interface Dimensions {
  width: number;
  height: number;
}

const READERS: Record<InputFormat, (bytes: Uint8Array) => Dimensions | null> = {
  jpeg: jpegDimensions,
  png: (bytes) => ({
    width: view(bytes).getUint32(16),
    height: view(bytes).getUint32(20),
  }),
  gif: (bytes) => ({
    width: view(bytes).getUint16(6, true),
    height: view(bytes).getUint16(8, true),
  }),
  bmp: bmpDimensions,
  webp: webpDimensions,
  heic: heifDimensions,
  avif: heifDimensions,
};

export function readDimensions(
  bytes: Uint8Array,
  format: InputFormat
): Dimensions | null {
  try {
    const dimensions = READERS[format](bytes);
    return dimensions && dimensions.width > 0 && dimensions.height > 0
      ? dimensions
      : null;
  } catch {
    return null;
  }
}

const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function jpegDimensions(bytes: Uint8Array): Dimensions | null {
  const data = view(bytes);
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (SOF_MARKERS.has(marker)) {
      return {
        height: data.getUint16(offset + 5),
        width: data.getUint16(offset + 7),
      };
    }
    offset += 2 + data.getUint16(offset + 2);
  }
  return null;
}

function bmpDimensions(bytes: Uint8Array): Dimensions {
  const data = view(bytes);
  if (data.getUint32(14, true) === 12) {
    return {
      width: data.getUint16(18, true),
      height: data.getUint16(20, true),
    };
  }
  return {
    width: Math.abs(data.getInt32(18, true)),
    height: Math.abs(data.getInt32(22, true)),
  };
}

function webpDimensions(bytes: Uint8Array): Dimensions | null {
  const data = view(bytes);
  switch (ascii(bytes, 12, 4)) {
    case "VP8 ":
      return {
        width: data.getUint16(26, true) & 0x3fff,
        height: data.getUint16(28, true) & 0x3fff,
      };
    case "VP8L": {
      const bits = data.getUint32(21, true);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    case "VP8X":
      return {
        width: (data.getUint32(24, true) & 0xffffff) + 1,
        height: (data.getUint32(27, true) & 0xffffff) + 1,
      };
    default:
      return null;
  }
}

const HEIF_CONTAINERS: Record<string, number> = { meta: 4, iprp: 0, ipco: 0 };

function heifDimensions(bytes: Uint8Array): Dimensions | null {
  let largest: Dimensions | null = null;
  const walk = (start: number, end: number) => {
    const data = view(bytes);
    let offset = start;
    while (offset + 8 <= end) {
      const size = data.getUint32(offset);
      const type = ascii(bytes, offset + 4, 4);
      const boxEnd = size === 0 ? end : offset + size;
      if (size !== 0 && size < 8) return;
      if (type in HEIF_CONTAINERS) {
        walk(offset + 8 + HEIF_CONTAINERS[type], Math.min(boxEnd, end));
      } else if (type === "ispe") {
        const width = data.getUint32(offset + 12);
        const height = data.getUint32(offset + 16);
        if (!largest || width * height > largest.width * largest.height) {
          largest = { width, height };
        }
      }
      offset = boxEnd;
    }
  };
  walk(0, bytes.length);
  return largest;
}
