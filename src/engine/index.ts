import type { Capabilities, CanvasCapabilities } from "./capabilities";
import { ConvertError } from "./errors";
import {
  isProbedDecodeFormat,
  type InputFormat,
  type OutputFormat,
} from "./formats";
import { inspect } from "./inspect";
import type { InputMetadata } from "./report";
import type { Outcome, Task } from "./pipeline";
import { fitWithin, planJob, type Path } from "./plan";
import { spawnWorker, type EngineWorker } from "./remote";
import {
  createScheduler,
  poolLimits,
  reservation,
  type PoolLimits,
} from "./scheduler";

export { ConvertError, ERROR_MESSAGES, type ErrorCode } from "./errors";
export {
  INPUT_FORMATS,
  OUTPUT_FORMATS,
  type InputFormat,
  type OutputFormat,
} from "./formats";
export {
  METADATA_FIELDS,
  type InputMetadata,
  type MetadataField,
  type MetadataReport,
} from "./report";
export { outputNames, type Path } from "./plan";
export type { EngineWorker } from "./remote";
export type { PoolLimits } from "./scheduler";

export interface Job {
  file: Blob;
  target: OutputFormat;
  quality: number;
  maxDimension?: number;
}

export interface JobResult {
  output: Blob;
  width: number;
  height: number;
  metadata: InputMetadata;
  path: Path;
  ms: number;
}

export interface Conversion {
  result: Promise<JobResult>;
  cancel(): void;
}

export interface Converter {
  convert(job: Job): Conversion;
  dispose(): void;
}

export interface ConverterOptions {
  createWorker?: () => EngineWorker;
  limits?: PoolLimits;
}

const STORAGE_KEY = "itsmor-tools:capabilities";

export function createConverter({
  createWorker = spawnWorker,
  limits = poolLimits(environment()),
}: ConverterOptions = {}): Converter {
  const scheduler = createScheduler<Task, Outcome>({ ...limits, createWorker });
  const stored = readCapabilities();
  let canvasProbe: Promise<CanvasCapabilities> | undefined = stored
    ? Promise.resolve(stored)
    : undefined;
  const decodeProbes = new Map<InputFormat, Promise<boolean>>(
    Object.entries(stored?.decode ?? {}).map(([format, supported]) => [
      format as InputFormat,
      Promise.resolve(supported),
    ])
  );

  const withWorker = async <V>(ask: (worker: EngineWorker) => Promise<V>) => {
    const worker = createWorker();
    try {
      return await ask(worker);
    } finally {
      worker.terminate();
    }
  };

  const capabilities = async (format: InputFormat): Promise<Capabilities> => {
    canvasProbe ??= withWorker((worker) => worker.probeCanvas());
    if (isProbedDecodeFormat(format) && !decodeProbes.has(format)) {
      decodeProbes.set(
        format,
        withWorker((worker) => worker.probeDecode(format))
      );
    }
    const decode = Object.fromEntries(
      await Promise.all(
        [...decodeProbes].map(async ([f, probe]) => [f, await probe] as const)
      )
    );
    const { encode, maxPixels } = await canvasProbe;
    const known = { encode, maxPixels, decode };
    session()?.setItem(STORAGE_KEY, JSON.stringify(known));
    return known;
  };

  const run = async (job: Job, signal: AbortSignal): Promise<JobResult> => {
    const input = await inspect(job.file);
    const size = fitWithin(input.width, input.height, job.maxDimension);
    const plan = planJob(
      {
        format: input.format,
        target: job.target,
        pixels: size.width * size.height,
      },
      await capabilities(input.format)
    );
    if ("error" in plan) throw new ConvertError(plan.error);
    if (signal.aborted) throw new ConvertError("cancelled");

    const submission = scheduler.submit(
      { ...job, format: input.format, path: plan.path },
      reservation(input.width, input.height)
    );
    signal.addEventListener("abort", submission.cancel, { once: true });
    const outcome = await submission.result;
    if (!outcome.ok) throw new ConvertError(outcome.code);
    const { output, width, height, metadata, ms } = outcome;
    return { output, width, height, metadata, ms, path: plan.path };
  };

  return {
    convert(job) {
      const controller = new AbortController();
      const cancelled = new Promise<never>((_, reject) =>
        controller.signal.addEventListener(
          "abort",
          () => reject(new ConvertError("cancelled")),
          { once: true }
        )
      );
      const result = run(job, controller.signal).catch((error: unknown) => {
        throw error instanceof ConvertError
          ? error
          : new ConvertError("failed");
      });
      return {
        result: Promise.race([result, cancelled]),
        cancel: () => controller.abort(),
      };
    },
    dispose: () => scheduler.dispose(),
  };
}

function environment() {
  const { hardwareConcurrency, deviceMemory } = navigator as Navigator & {
    deviceMemory?: number;
  };
  return {
    hardwareConcurrency: hardwareConcurrency || 2,
    deviceMemory,
    touchPrimary: matchMedia("(pointer: coarse)").matches,
  };
}

function session() {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

function readCapabilities(): Capabilities | null {
  const raw = session()?.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as Capabilities) : null;
}
