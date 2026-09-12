import { describe, expect, it } from "vitest";
import { UploadValidationError } from "../src/errors.js";
import { createScheduler } from "../src/scheduler.js";

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return {
    promise,
    resolve,
  };
}

describe("createScheduler", () => {
  it("rejects a non-positive-integer concurrency", () => {
    expect(() =>
      createScheduler({
        concurrency: 0,
      }),
    ).toThrow(UploadValidationError);
    expect(() =>
      createScheduler({
        concurrency: 1.5,
      }),
    ).toThrow(UploadValidationError);
    expect(() =>
      createScheduler({
        concurrency: -1,
      }),
    ).toThrow(UploadValidationError);
  });

  it("never runs more tasks concurrently than the configured limit", async () => {
    const scheduler = createScheduler({
      concurrency: 2,
    });
    let active = 0;
    let maxActive = 0;
    const gateA = deferred<void>();
    const gateB = deferred<void>();
    const gateC = deferred<void>();
    const gateD = deferred<void>();
    const gates = [
      gateA,
      gateB,
      gateC,
      gateD,
    ];

    const runs = gates.map((gate, index) =>
      scheduler.schedule(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await gate.promise;
        active -= 1;
        return index;
      }),
    );

    expect(scheduler.active).toBe(2);
    expect(scheduler.pending).toBe(2);

    gateA.resolve();
    gateB.resolve();
    await Promise.resolve();
    await Promise.resolve();

    gateC.resolve();
    gateD.resolve();

    const results = await Promise.all(runs);
    expect(results).toEqual([
      0,
      1,
      2,
      3,
    ]);
    expect(maxActive).toBeLessThanOrEqual(2);
    expect(scheduler.active).toBe(0);
    expect(scheduler.pending).toBe(0);
  });

  it("propagates a rejected task without blocking the remaining slots", async () => {
    const scheduler = createScheduler({
      concurrency: 1,
    });
    const failure = scheduler.schedule(async () => {
      throw new Error("boom");
    });
    const success = scheduler.schedule(async () => "ok");

    await expect(failure).rejects.toThrow("boom");
    await expect(success).resolves.toBe("ok");
  });

  it("drains more tasks immediately after raising concurrency", async () => {
    const scheduler = createScheduler({
      concurrency: 1,
    });
    const gate = deferred<void>();
    let secondStarted = false;

    scheduler.schedule(async () => {
      await gate.promise;
    });
    scheduler.schedule(async () => {
      secondStarted = true;
    });

    expect(secondStarted).toBe(false);
    expect(scheduler.concurrency).toBe(1);
    scheduler.setConcurrency(2);
    expect(scheduler.concurrency).toBe(2);
    await Promise.resolve();
    expect(secondStarted).toBe(true);
    gate.resolve();
  });
});
