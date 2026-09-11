/** A single file's transfer progress at a point in time. */
export type FileProgress = {
  readonly fileId: string;
  readonly loadedBytes: number;
  readonly totalBytes: number;
  readonly percent: number;
};

/** Aggregated progress across every file currently tracked. */
export type GlobalProgress = {
  readonly loadedBytes: number;
  readonly totalBytes: number;
  readonly percent: number;
  readonly files: readonly FileProgress[];
};

function computePercent(loadedBytes: number, totalBytes: number): number {
  if (totalBytes <= 0) {
    return 0;
  }
  return Math.min(100, (loadedBytes / totalBytes) * 100);
}

/** Tracks per-file progress and aggregates it into a {@link GlobalProgress} snapshot on demand. */
export type ProgressTracker = {
  update(fileId: string, loadedBytes: number, totalBytes: number): FileProgress;
  remove(fileId: string): void;
  getFile(fileId: string): FileProgress | undefined;
  getGlobal(): GlobalProgress;
};

/** Creates an empty {@link ProgressTracker}. */
export function createProgressTracker(): ProgressTracker {
  const files = new Map<string, FileProgress>();

  return {
    getFile(fileId) {
      return files.get(fileId);
    },
    getGlobal() {
      let loadedBytes = 0;
      let totalBytes = 0;
      const snapshot: FileProgress[] = [];
      for (const progress of files.values()) {
        loadedBytes += progress.loadedBytes;
        totalBytes += progress.totalBytes;
        snapshot.push(progress);
      }
      return {
        files: snapshot,
        loadedBytes,
        percent: computePercent(loadedBytes, totalBytes),
        totalBytes,
      };
    },
    remove(fileId) {
      files.delete(fileId);
    },
    update(fileId, loadedBytes, totalBytes) {
      const progress: FileProgress = {
        fileId,
        loadedBytes,
        percent: computePercent(loadedBytes, totalBytes),
        totalBytes,
      };
      files.set(fileId, progress);
      return progress;
    },
  };
}

/**
 * Wraps `onEmit` so it fires at most once per `minIntervalMs`, always flushing the most recent
 * snapshot on the trailing edge so the final progress value is never dropped.
 */
export function createProgressThrottle(
  minIntervalMs: number,
  onEmit: (progress: GlobalProgress) => void,
): (progress: GlobalProgress) => void {
  let lastEmittedAt = 0;
  let pending: GlobalProgress | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function flush(): void {
    timer = undefined;
    lastEmittedAt = Date.now();
    const progress = pending;
    pending = undefined;
    if (progress !== undefined) {
      onEmit(progress);
    }
  }

  return (progress: GlobalProgress) => {
    const now = Date.now();
    const elapsed = now - lastEmittedAt;
    if (elapsed >= minIntervalMs) {
      lastEmittedAt = now;
      onEmit(progress);
      return;
    }
    pending = progress;
    if (timer === undefined) {
      timer = setTimeout(flush, minIntervalMs - elapsed);
    }
  };
}
