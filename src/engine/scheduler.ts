import { ConvertError } from "./errors";

const MB = 1024 * 1024;

export interface PoolLimits {
  concurrency: number;
  budget: number;
}

export interface Environment {
  hardwareConcurrency: number;
  deviceMemory?: number;
  touchPrimary: boolean;
}

export function poolLimits({
  hardwareConcurrency,
  deviceMemory,
  touchPrimary,
}: Environment): PoolLimits {
  const constrained =
    touchPrimary || (deviceMemory !== undefined && deviceMemory <= 4);
  return {
    concurrency: Math.max(
      1,
      Math.min(hardwareConcurrency - 1, constrained ? 2 : 4)
    ),
    budget: constrained ? 256 * MB : 1024 * MB,
  };
}

export function reservation(width: number, height: number) {
  return width * height * 4 * 2.5;
}

export interface PoolWorker<T, R> {
  convert(task: T): Promise<R>;
  terminate(): void;
}

export interface Submission<R> {
  result: Promise<R>;
  cancel(): void;
}

export interface Scheduler<T, R> {
  submit(task: T, reservation: number): Submission<R>;
  dispose(): void;
}

interface Entry<T, R> {
  task: T;
  reservation: number;
  resolve(result: R): void;
  reject(error: unknown): void;
  worker?: PoolWorker<T, R>;
}

export function createScheduler<T, R>({
  concurrency,
  budget,
  createWorker,
}: PoolLimits & { createWorker: () => PoolWorker<T, R> }): Scheduler<T, R> {
  const queue: Entry<T, R>[] = [];
  const running = new Set<Entry<T, R>>();
  const idle: PoolWorker<T, R>[] = [];
  let reserved = 0;
  let disposed = false;

  const pump = () => {
    while (!disposed && queue.length && running.size < concurrency) {
      const next = queue[0];
      if (running.size && reserved + next.reservation > budget) return;
      queue.shift();
      start(next);
    }
  };

  const release = (entry: Entry<T, R>) => {
    if (!running.delete(entry)) return false;
    reserved -= entry.reservation;
    return true;
  };

  const start = (entry: Entry<T, R>) => {
    const worker = idle.pop() ?? createWorker();
    entry.worker = worker;
    running.add(entry);
    reserved += entry.reservation;
    worker.convert(entry.task).then(
      (result) => {
        if (!release(entry)) return;
        idle.push(worker);
        entry.resolve(result);
        pump();
      },
      (error: unknown) => {
        if (!release(entry)) return;
        worker.terminate();
        entry.reject(error);
        pump();
      }
    );
  };

  const cancel = (entry: Entry<T, R>) => {
    const queued = queue.indexOf(entry);
    if (queued !== -1) {
      queue.splice(queued, 1);
    } else if (release(entry)) {
      entry.worker?.terminate();
    } else {
      return;
    }
    entry.reject(new ConvertError("cancelled"));
    pump();
  };

  return {
    submit(task, reservation) {
      if (disposed) {
        return {
          result: Promise.reject(new ConvertError("cancelled")),
          cancel: () => {},
        };
      }
      let entry!: Entry<T, R>;
      const result = new Promise<R>((resolve, reject) => {
        entry = { task, reservation, resolve, reject };
      });
      queue.push(entry);
      pump();
      return { result, cancel: () => cancel(entry) };
    },
    dispose() {
      disposed = true;
      for (const entry of [...queue, ...running]) cancel(entry);
      for (const worker of idle.splice(0)) worker.terminate();
    },
  };
}
