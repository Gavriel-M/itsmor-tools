import type { OutputFormat } from "../formats";
import type { Decoder, EncoderId } from "./registry";

export type Decode = (file: Blob) => Promise<ImageBitmap>;
export type CanvasEncode = (
  canvas: OffscreenCanvas,
  target: OutputFormat,
  quality: number
) => Promise<Blob>;
export type PixelEncode = (pixels: ImageData, quality: number) => Promise<Blob>;

export const DECODE: Record<Decoder["id"], () => Promise<Decode>> = {
  native: () => import("./native").then((m) => m.decodeNative),
};

export const CANVAS_ENCODE: Record<
  EncoderId<"native">,
  () => Promise<CanvasEncode>
> = {
  canvas: () => import("./native").then((m) => m.encodeNative),
};

export const PIXEL_ENCODE: Record<
  EncoderId<"wasm">,
  () => Promise<PixelEncode>
> = {
  mozjpeg: () => import("./mozjpeg").then((m) => m.encodeMozjpeg),
};
