import { describe, expect, it } from "vitest";
import {
  createScheduler,
  poolLimits,
  reservation,
  type PoolWorker,
} from "../../src/engine/scheduler";

const MB = 1024 * 1024;

interface FakeWorker extends PoolWorker<string, string> {
  id: number;
  terminated: boolean;
}

function pool(limits: { concurrency: number; budget: number }) {
  const workers: FakeWorker[] = [];
  const pending = new Map<
    string,
    { worker: FakeWorker; resolve(v: string): void; reject(e: Error): void }
  >();
  const scheduler = createScheduler<string, string>({
    ...limits,
    createWorker: () => {
      const worker: FakeWorker = {
        id: workers.length + 1,
        terminated: false,
        convert: (task) =>
          new Promise((resolve, reject) =>
            pending.set(task, { worker, resolve, reject })
          ),
        terminate: () => {
          worker.terminated = true;
        },
      };
      workers.push(worker);
      return worker;
    },
  });
  const settle = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };
  return {
    scheduler,
    workers,
    running: () => [...pending.keys()],
    workerOf: (task: string) => pending.get(task)!.worker,
    finish: async (task: string) => {
      pending.get(task)!.resolve(`${task} done`);
      pending.delete(task);
      await settle();
    },
    fail: async (task: string) => {
      pending.get(task)!.reject(new Error("worker crashed"));
      pending.delete(task);
      await settle();
    },
    settle,
  };
}

describe("poolLimits", () => {
  it("uses one core fewer than the machine has, at most four", () => {
    expect(
      poolLimits({ hardwareConcurrency: 10, touchPrimary: false })
    ).toEqual({ concurrency: 4, budget: 1024 * MB });
    expect(
      poolLimits({
        hardwareConcurrency: 3,
        deviceMemory: 8,
        touchPrimary: false,
      })
    ).toEqual({ concurrency: 2, budget: 1024 * MB });
  });

  it("allows two jobs and 256 MB on touch-primary devices", () => {
    expect(poolLimits({ hardwareConcurrency: 8, touchPrimary: true })).toEqual({
      concurrency: 2,
      budget: 256 * MB,
    });
  });

  it("allows two jobs and 256 MB with 4 GB of memory or less", () => {
    expect(
      poolLimits({
        hardwareConcurrency: 8,
        deviceMemory: 4,
        touchPrimary: false,
      })
    ).toEqual({ concurrency: 2, budget: 256 * MB });
  });

  it("always allows one job", () => {
    expect(
      poolLimits({ hardwareConcurrency: 1, touchPrimary: false }).concurrency
    ).toBe(1);
  });
});

describe("reservation", () => {
  it("is decoded pixels plus resize and encode buffers", () => {
    expect(reservation(4032, 3024)).toBe(4032 * 3024 * 4 * 2.5);
  });
});

describe("createScheduler", () => {
  it("runs up to the concurrency limit and queues the rest", async () => {
    const p = pool({ concurrency: 2, budget: 100 });
    const results = ["a", "b", "c"].map(
      (task) => p.scheduler.submit(task, 1).result
    );
    expect(p.running()).toEqual(["a", "b"]);
    await p.finish("a");
    expect(p.running()).toEqual(["b", "c"]);
    await p.finish("b");
    await p.finish("c");
    expect(await Promise.all(results)).toEqual(["a done", "b done", "c done"]);
  });

  it("reuses idle workers", async () => {
    const p = pool({ concurrency: 2, budget: 100 });
    p.scheduler.submit("a", 1);
    await p.finish("a");
    p.scheduler.submit("b", 1);
    expect(p.workers).toHaveLength(1);
  });

  it("waits until the reservation fits the budget", async () => {
    const p = pool({ concurrency: 4, budget: 100 });
    p.scheduler.submit("a", 60);
    p.scheduler.submit("b", 60);
    p.scheduler.submit("c", 10);
    expect(p.running()).toEqual(["a"]);
    await p.finish("a");
    expect(p.running()).toEqual(["b", "c"]);
  });

  it("runs a job larger than the whole budget alone", async () => {
    const p = pool({ concurrency: 4, budget: 100 });
    p.scheduler.submit("small", 10);
    p.scheduler.submit("huge", 500);
    p.scheduler.submit("after", 10);
    expect(p.running()).toEqual(["small"]);
    await p.finish("small");
    expect(p.running()).toEqual(["huge"]);
    await p.finish("huge");
    expect(p.running()).toEqual(["after"]);
  });

  it("cancels a queued job without starting it", async () => {
    const p = pool({ concurrency: 1, budget: 100 });
    p.scheduler.submit("a", 1);
    const b = p.scheduler.submit("b", 1);
    b.cancel();
    await expect(b.result).rejects.toMatchObject({ code: "cancelled" });
    await p.finish("a");
    expect(p.running()).toEqual([]);
  });

  it("cancels a running job by terminating its worker, then replaces it", async () => {
    const p = pool({ concurrency: 1, budget: 100 });
    const a = p.scheduler.submit("a", 1);
    const b = p.scheduler.submit("b", 1);
    const first = p.workerOf("a");
    a.cancel();
    await expect(a.result).rejects.toMatchObject({ code: "cancelled" });
    expect(first.terminated).toBe(true);
    expect(p.workerOf("b")).not.toBe(first);
    await p.finish("b");
    expect(await b.result).toBe("b done");
  });

  it("ignores a result that arrives after cancellation", async () => {
    const p = pool({ concurrency: 1, budget: 100 });
    const a = p.scheduler.submit("a", 1);
    a.cancel();
    await p.finish("a");
    await expect(a.result).rejects.toMatchObject({ code: "cancelled" });
  });

  it("fails one job without failing the batch, and replaces the worker", async () => {
    const p = pool({ concurrency: 1, budget: 100 });
    const a = p.scheduler.submit("a", 1);
    const b = p.scheduler.submit("b", 1);
    const first = p.workerOf("a");
    await p.fail("a");
    await expect(a.result).rejects.toThrow("worker crashed");
    expect(first.terminated).toBe(true);
    await p.finish("b");
    expect(await b.result).toBe("b done");
  });

  it("terminates every worker and rejects every job on dispose", async () => {
    const p = pool({ concurrency: 1, budget: 100 });
    p.scheduler.submit("idle", 1);
    await p.finish("idle");
    const running = p.scheduler.submit("running", 1);
    const queued = p.scheduler.submit("queued", 1);
    p.scheduler.dispose();
    await expect(running.result).rejects.toMatchObject({ code: "cancelled" });
    await expect(queued.result).rejects.toMatchObject({ code: "cancelled" });
    await expect(p.scheduler.submit("late", 1).result).rejects.toMatchObject({
      code: "cancelled",
    });
    expect(p.workers.every((w) => w.terminated)).toBe(true);
    expect(p.running()).toEqual(["running"]);
  });
});
