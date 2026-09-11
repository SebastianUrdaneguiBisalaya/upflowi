import { describe, expect, it } from "vitest";
import { iterateChunks, planChunks } from "../src/chunking.js";
import { UploadValidationError } from "../src/errors.js";

describe("chunking", () => {
  it("splits a file evenly divisible by chunkSize", () => {
    const plan = planChunks(30, 10);
    expect(plan.partCount).toBe(3);
    expect(plan.ranges).toEqual([
      {
        end: 10,
        partNumber: 1,
        size: 10,
        start: 0,
      },
      {
        end: 20,
        partNumber: 2,
        size: 10,
        start: 10,
      },
      {
        end: 30,
        partNumber: 3,
        size: 10,
        start: 20,
      },
    ]);
  });

  it("gives the last part the remainder when not evenly divisible", () => {
    const plan = planChunks(25, 10);
    expect(plan.partCount).toBe(3);
    expect(plan.ranges[2]).toEqual({
      end: 25,
      partNumber: 3,
      size: 5,
      start: 20,
    });
  });

  it("yields a single empty range for a zero-byte file", () => {
    const plan = planChunks(0, 10);
    expect(plan.partCount).toBe(1);
    expect(plan.ranges[0]).toEqual({
      end: 0,
      partNumber: 1,
      size: 0,
      start: 0,
    });
  });

  it("yields a single full range when the file is smaller than chunkSize", () => {
    const plan = planChunks(4, 10);
    expect(plan.partCount).toBe(1);
    expect(plan.ranges[0]).toEqual({
      end: 4,
      partNumber: 1,
      size: 4,
      start: 0,
    });
  });

  it("rejects a negative or non-integer totalSize", () => {
    expect(() => planChunks(-1, 10)).toThrow(UploadValidationError);
    expect(() => planChunks(1.5, 10)).toThrow(UploadValidationError);
  });

  it("rejects a non-positive or non-integer chunkSize", () => {
    expect(() => planChunks(10, 0)).toThrow(UploadValidationError);
    expect(() => planChunks(10, -5)).toThrow(UploadValidationError);
    expect(() => planChunks(10, 1.5)).toThrow(UploadValidationError);
  });

  it("iterateChunks is lazy: validation still runs, but nothing is computed before the first pull", () => {
    const iterator = iterateChunks(100, 10);
    const first = iterator.next();
    expect(first.done).toBe(false);
    expect(first.value).toEqual({
      end: 10,
      partNumber: 1,
      size: 10,
      start: 0,
    });
  });
});
