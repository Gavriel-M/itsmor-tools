import { wrap } from "comlink";
import type { CanvasCapabilities } from "./capabilities";
import type { ProbedDecodeFormat } from "./formats";
import type { Outcome, Task } from "./pipeline";
import type { PoolWorker } from "./scheduler";
import type { WorkerApi } from "./worker";

export interface EngineWorker extends PoolWorker<Task, Outcome> {
  probeCanvas(): Promise<CanvasCapabilities>;
  probeDecode(format: ProbedDecodeFormat): Promise<boolean>;
}

export function spawnWorker(): EngineWorker {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });
  const remote = wrap<WorkerApi>(worker);
  return {
    convert: (task) => remote.convert(task),
    probeCanvas: () => remote.probeCanvas(),
    probeDecode: (format) => remote.probeDecode(format),
    terminate: () => worker.terminate(),
  };
}
