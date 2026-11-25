import { CANVAS_ENCODE, DECODE, PIXEL_ENCODE } from "./codecs/loaders";
import { findDecoder, findEncoder, type Encoder } from "./codecs/registry";
import { ConvertError, errorCode, type ErrorCode } from "./errors";
import { HAS_ALPHA, type InputFormat, type OutputFormat } from "./formats";
import { readMetadata } from "./metadata";
import type { InputMetadata } from "./report";
import { fitWithin, type Path } from "./plan";

export interface Task {
  file: Blob;
  format: InputFormat;
  target: OutputFormat;
  quality: number;
  maxDimension?: number;
  path: Path;
}

export type Outcome =
  | {
      ok: true;
      output: Blob;
      width: number;
      height: number;
      metadata: InputMetadata;
      ms: number;
    }
  | { ok: false; code: ErrorCode };

interface Surface {
  canvas: OffscreenCanvas;
  context: OffscreenCanvasRenderingContext2D;
}

export async function runTask(task: Task): Promise<Outcome> {
  const started = performance.now();
  try {
    const decoder = findDecoder(task.format, task.path.decode);
    const encoder = findEncoder(task.target, task.path.encode);
    if (!decoder || !encoder) throw new ConvertError("failed");

    const [metadata, decode, encode] = await Promise.all([
      task.file
        .arrayBuffer()
        .then((buffer) => readMetadata(new Uint8Array(buffer), task.format)),
      DECODE[decoder.id](),
      loadEncoder(encoder, task),
    ]);
    const surface = render(await decode(task.file), task);
    const output = await encode(surface);
    return {
      ok: true,
      output,
      width: surface.canvas.width,
      height: surface.canvas.height,
      metadata,
      ms: Math.round(performance.now() - started),
    };
  } catch (error) {
    return { ok: false, code: errorCode(error) };
  }
}

function render(bitmap: ImageBitmap, task: Task): Surface {
  try {
    const { width, height } = fitWithin(
      bitmap.width,
      bitmap.height,
      task.maxDimension
    );
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new ConvertError("too-large");
    if (!HAS_ALPHA[task.target]) {
      context.fillStyle = "white";
      context.fillRect(0, 0, width, height);
    }
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    return { canvas, context };
  } finally {
    bitmap.close();
  }
}

async function loadEncoder(
  encoder: Encoder,
  { target, quality }: Task
): Promise<(surface: Surface) => Promise<Blob>> {
  if (encoder.path === "native") {
    const encode = await CANVAS_ENCODE[encoder.id]();
    return ({ canvas }) => encode(canvas, target, quality);
  }
  const encode = await PIXEL_ENCODE[encoder.id]();
  return ({ canvas, context }) =>
    encode(context.getImageData(0, 0, canvas.width, canvas.height), quality);
}
