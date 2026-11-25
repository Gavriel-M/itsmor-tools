import { describe, expect, it } from "vitest";
import { createConverter, ERROR_MESSAGES } from "../../src/engine";
import { spawnWorker, type EngineWorker } from "../../src/engine/remote";
import { convert, fixture } from "./helpers";

describe("failures", () => {
  it("names a corrupt file in plain English", async () => {
    const error = await convert("corrupt.jpg").catch((e: unknown) => e);
    expect(error).toMatchObject({
      code: "corrupt",
      message: ERROR_MESSAGES.corrupt,
    });
  });

  it("refuses a file that is not an image", async () => {
    const converter = createConverter();
    const file = new File(["just text"], "notes.jpg", { type: "image/jpeg" });
    await expect(
      converter.convert({ file, target: "png", quality: 1 }).result
    ).rejects.toMatchObject({
      code: "unsupported-input",
      message: ERROR_MESSAGES["unsupported-input"],
    });
    converter.dispose();
  });
});

describe("cancellation", () => {
  it("terminates the running worker, and the next job gets a fresh one", async () => {
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => (markStarted = resolve));
    const terminated = new Set<EngineWorker>();
    let first: EngineWorker | undefined;
    const createWorker = (): EngineWorker => {
      const worker = spawnWorker();
      const tracked: EngineWorker = {
        ...worker,
        convert: (task) => {
          first ??= tracked;
          markStarted();
          return worker.convert(task);
        },
        terminate: () => {
          terminated.add(tracked);
          worker.terminate();
        },
      };
      return tracked;
    };
    const converter = createConverter({
      createWorker,
      limits: { concurrency: 1, budget: 1024 ** 3 },
    });
    const job = async () => ({
      file: await fixture("metadata.jpg"),
      target: "jpeg" as const,
      quality: 0.9,
    });

    const cancelled = converter.convert(await job());
    await started;
    cancelled.cancel();
    await expect(cancelled.result).rejects.toMatchObject({ code: "cancelled" });
    expect(terminated.has(first!)).toBe(true);

    const next = await converter.convert(await job()).result;
    expect(next.output.type).toBe("image/jpeg");
    converter.dispose();
  });

  it("cancels a job before it reaches a worker", async () => {
    const converter = createConverter();
    const conversion = converter.convert({
      file: await fixture("alpha.png"),
      target: "png",
      quality: 1,
    });
    conversion.cancel();
    await expect(conversion.result).rejects.toMatchObject({
      code: "cancelled",
    });
    converter.dispose();
  });
});
