import {
  MIME_TYPES,
  OUTPUT_FORMATS,
  type InputFormat,
  type OutputFormat,
  type ProbedDecodeFormat,
} from "./formats";
import avifSample from "./samples/sample.avif?inline";
import heicSample from "./samples/sample.heic?inline";

export interface Capabilities {
  encode: Record<OutputFormat, boolean>;
  maxPixels: number;
  decode: Partial<Record<InputFormat, boolean>>;
}

export type CanvasCapabilities = Omit<Capabilities, "decode">;

const CANVAS_SIDES = [10_000, 7_072, 5_000, 4_096, 2_048];

const SAMPLES: Record<ProbedDecodeFormat, string> = {
  heic: heicSample,
  avif: avifSample,
};

export async function probeCanvas(): Promise<CanvasCapabilities> {
  return { encode: await probeEncoders(), maxPixels: probeMaxPixels() };
}

export async function probeDecode(format: ProbedDecodeFormat) {
  const dataUrl = SAMPLES[format];
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  try {
    (await createImageBitmap(new Blob([bytes]))).close();
    return true;
  } catch {
    return false;
  }
}

async function probeEncoders() {
  const canvas = new OffscreenCanvas(1, 1);
  canvas.getContext("2d")?.fillRect(0, 0, 1, 1);
  const results = await Promise.all(
    OUTPUT_FORMATS.map(async (format) => {
      const type = MIME_TYPES[format];
      const blob = await canvas.convertToBlob({ type }).catch(() => null);
      return [format, blob?.type === type] as const;
    })
  );
  return Object.fromEntries(results) as Record<OutputFormat, boolean>;
}

function probeMaxPixels() {
  const side = CANVAS_SIDES.find(canvasWorks);
  return side ? side * side : 0;
}

function canvasWorks(side: number) {
  let canvas: OffscreenCanvas | undefined;
  try {
    canvas = new OffscreenCanvas(side, side);
    const context = canvas.getContext("2d");
    if (!context) return false;
    context.fillRect(side - 1, side - 1, 1, 1);
    return context.getImageData(side - 1, side - 1, 1, 1).data[3] === 255;
  } catch {
    return false;
  } finally {
    if (canvas) canvas.width = canvas.height = 1;
  }
}
