import { ConvertError } from "../errors";
import { MIME_TYPES, type OutputFormat } from "../formats";

export async function decodeNative(file: Blob) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ConvertError("corrupt");
  }
}

export async function encodeNative(
  canvas: OffscreenCanvas,
  target: OutputFormat,
  quality: number
) {
  const type = MIME_TYPES[target];
  const blob = await canvas.convertToBlob({ type, quality });
  if (blob.type !== type) throw new ConvertError("encode-unsupported");
  return blob;
}
