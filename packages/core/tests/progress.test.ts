import { describe, expect, it, vi } from "vitest";
import {
  createProgressThrottle,
  createProgressTracker,
} from "../src/progress.js";

describe("createProgressTracker", () => {
  it("computes percent for a single file", () => {
    const tracker = createProgressTracker();
    const progress = tracker.update("file-1", 50, 200);
    expect(progress).toEqual({
      fileId: "file-1",
      loadedBytes: 50,
      percent: 25,
      totalBytes: 200,
    });
  });

  it("treats a zero-byte total as 0 percent instead of dividing by zero", () => {
    const tracker = createProgressTracker();
    const progress = tracker.update("file-1", 0, 0);
    expect(progress.percent).toBe(0);
  });

  it("aggregates multiple concurrent files into a correct global snapshot", () => {
    const tracker = createProgressTracker();
    tracker.update("file-1", 50, 100);
    tracker.update("file-2", 30, 100);
    tracker.update("file-3", 100, 100);

    const global = tracker.getGlobal();
    expect(global.loadedBytes).toBe(180);
    expect(global.totalBytes).toBe(300);
    expect(global.percent).toBeCloseTo(60);
    expect(global.files).toHaveLength(3);
  });

  it("stays correct as concurrent chunk updates interleave across files", () => {
    const tracker = createProgressTracker();
    tracker.update("file-1", 10, 100);
    tracker.update("file-2", 20, 200);
    tracker.update("file-1", 40, 100);
    tracker.update("file-2", 60, 200);
    tracker.update("file-1", 100, 100);

    const global = tracker.getGlobal();
    expect(global.loadedBytes).toBe(100 + 60);
    expect(global.totalBytes).toBe(300);
  });

  it("removes a file from the global aggregate", () => {
    const tracker = createProgressTracker();
    tracker.update("file-1", 50, 100);
    tracker.update("file-2", 50, 100);
    tracker.remove("file-1");

    expect(tracker.getFile("file-1")).toBeUndefined();
    expect(tracker.getGlobal().loadedBytes).toBe(50);
    expect(tracker.getGlobal().files).toHaveLength(1);
  });
});

describe("createProgressThrottle", () => {
  it("emits immediately on the leading edge", () => {
    const onEmit = vi.fn();
    const throttled = createProgressThrottle(1000, onEmit);
    throttled({
      files: [],
      loadedBytes: 1,
      percent: 1,
      totalBytes: 100,
    });
    expect(onEmit).toHaveBeenCalledTimes(1);
  });

  it("coalesces bursts within the interval and flushes the latest value on the trailing edge", () => {
    vi.useFakeTimers();
    const onEmit = vi.fn();
    const throttled = createProgressThrottle(1000, onEmit);

    throttled({
      files: [],
      loadedBytes: 1,
      percent: 1,
      totalBytes: 100,
    });
    throttled({
      files: [],
      loadedBytes: 2,
      percent: 2,
      totalBytes: 100,
    });
    throttled({
      files: [],
      loadedBytes: 3,
      percent: 3,
      totalBytes: 100,
    });
    expect(onEmit).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(onEmit).toHaveBeenCalledTimes(2);
    expect(onEmit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        loadedBytes: 3,
      }),
    );

    vi.useRealTimers();
  });
});
