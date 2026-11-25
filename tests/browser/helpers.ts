import exifr from "exifr";
import { createConverter, type Job } from "../../src/engine";

const urls = import.meta.glob<string>("../fixtures/*", {
  query: "?url",
  import: "default",
  eager: true,
});

export async function fixture(name: string) {
  const response = await fetch(urls[`../fixtures/${name}`]);
  return new File([await response.blob()], name);
}

export const converter = createConverter();

export async function convert(
  name: string,
  job: Partial<Omit<Job, "file">> = {}
) {
  return converter.convert({
    file: await fixture(name),
    target: "jpeg",
    quality: 0.9,
    ...job,
  }).result;
}

export async function pixels(
  blob: Blob,
  options: ImageBitmapOptions = {}
): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob, options);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d")!;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

export function pixelAt({ data, width }: ImageData, x: number, y: number) {
  const i = (y * width + x) * 4;
  return [...data.subarray(i, i + 4)];
}

export function meanAbsoluteError(a: ImageData, b: ImageData) {
  let total = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    for (let c = 0; c < 3; c++)
      total += Math.abs(a.data[i + c] - b.data[i + c]);
  }
  return total / ((a.data.length / 4) * 3);
}

export async function canEncodeNatively(type: string) {
  const canvas = new OffscreenCanvas(1, 1);
  canvas.getContext("2d");
  const blob = await canvas.convertToBlob({ type });
  return blob.type === type;
}

export async function withoutIccProfile(jpeg: Blob) {
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  const data = new DataView(bytes.buffer);
  const kept: BlobPart[] = [bytes.subarray(0, 2)];
  let offset = 2;
  while (bytes[offset + 1] !== 0xda) {
    const end = offset + 2 + data.getUint16(offset + 2);
    if (bytes[offset + 1] !== 0xe2) kept.push(bytes.subarray(offset, end));
    offset = end;
  }
  kept.push(bytes.subarray(offset));
  return new Blob(kept);
}

const IMAGE_CHUNKS = new Set(["VP8 ", "VP8L", "VP8X", "ALPH", "ICCP"]);
const ENCODER_TAGS = new Set([
  "ColorSpace",
  "ExifImageWidth",
  "ExifImageHeight",
]);

export async function metadataIn(blob: Blob): Promise<unknown> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (blob.type === "image/webp") return webpMetadataChunks(bytes);
  const tags: Record<string, unknown> | undefined = await exifr.parse(bytes, {
    tiff: true,
    exif: true,
    gps: true,
    xmp: true,
    iptc: true,
    icc: false,
    ihdr: false,
  });
  const found = Object.keys(tags ?? {}).filter((tag) => !ENCODER_TAGS.has(tag));
  return found.length ? found : undefined;
}

function webpMetadataChunks(bytes: Uint8Array) {
  const data = new DataView(bytes.buffer);
  const found: string[] = [];
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const name = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const size = data.getUint32(offset + 4, true);
    if (!IMAGE_CHUNKS.has(name)) found.push(name);
    offset += 8 + size + (size % 2);
  }
  return found.length ? found : undefined;
}
