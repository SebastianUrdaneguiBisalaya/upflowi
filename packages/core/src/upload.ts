import type { ChunkRange } from "./chunking.js";
import { iterateChunks } from "./chunking.js";
import {
  AbortError,
  HttpError,
  toUploadError,
  type UploadError,
  UploadValidationError,
} from "./errors.js";
import {
  createEventEmitter,
  type EventListener,
  type EventUnsubscribe,
  type UploadEventMap,
} from "./events.js";
import { createProgressTracker } from "./progress.js";
import type {
  ProviderPartResult,
  StorageProvider,
  StorageProviderContext,
} from "./provider.js";
import { delay, evaluateRetry, type RetryConfig } from "./retry.js";
import type { Scheduler } from "./scheduler.js";
import { assertTransition, type UploadStatus } from "./state-machine.js";
import type { StoredUploadRecord, UploadStore } from "./store.js";
import type { TransportRequestBody, UploadTransport } from "./transport.js";

/** A provider- and transport-agnostic byte source for a single file. */
export type UploadSource = {
  readonly fileId: string;
  /** Total size in bytes. */
  readonly size: number;
  /** Reads the bytes for one range without requiring the whole file to be held in memory. */
  read(range: ChunkRange): Promise<TransportRequestBody>;
};

/** Per-upload overrides. Anything omitted here falls back to the {@link Uploader}'s configuration. */
export type UploadOptions = {
  /** Used instead of the uploader-level transport when this file is transferred as a single request. */
  transport?: UploadTransport;
  /** Used instead of the uploader-level provider when this file is transferred via multipart. */
  provider?: StorageProvider;
  /** Destination URL for a single-request (non-multipart) transfer. Required when no `provider` applies. */
  url?: string;
  /** Higher values are scheduled before lower ones. Defaults to 0. */
  priority?: number;
  signal?: AbortSignal;
  /** Overrides the uploader-level chunk size for this file's multipart transfer. */
  chunkSize?: number;
  /** Used instead of the uploader-level store to persist/resume multipart progress for this file. */
  store?: UploadStore;
  metadata?: Readonly<Record<string, string>>;
};

/** The outcome of a successfully completed upload. */
export type UploadResult = {
  readonly fileId: string;
  readonly totalBytes: number;
  readonly location?: string;
  readonly etag?: string;
};

/** Dependencies a {@link Uploader} injects into every {@link Upload} it creates. */
export type UploadDependencies = {
  retryConfig: RetryConfig;
  chunkSize: number;
  chunkScheduler: Scheduler;
  transport?: UploadTransport;
  provider?: StorageProvider;
  store?: UploadStore;
};

/** The public per-file handle returned by {@link Uploader.add}. */
export type Upload = {
  readonly fileId: string;
  readonly status: UploadStatus;
  pause(): void;
  resume(): void;
  cancel(): void;
  on<TEvent extends keyof UploadEventMap>(
    event: TEvent,
    listener: EventListener<UploadEventMap[TEvent]>,
  ): EventUnsubscribe;
};

/** {@link Upload} plus the internal `execute` entry point a {@link Uploader} drives through its scheduler. */
export type UploadHandle = Upload & {
  execute(): Promise<UploadResult>;
};

function toError(caught: unknown): Error {
  return caught instanceof Error ? caught : new Error(String(caught));
}

/** Creates a single-file {@link UploadHandle}, wiring `source`/`options` against `dependencies`. */
export function createUpload(
  source: UploadSource,
  options: UploadOptions,
  dependencies: UploadDependencies,
): UploadHandle {
  const transport = options.transport ?? dependencies.transport;
  const provider = options.provider ?? dependencies.provider;
  const chunkSize = options.chunkSize ?? dependencies.chunkSize;
  const store = options.store ?? dependencies.store;
  const retryConfig = dependencies.retryConfig;

  const emitter = createEventEmitter<UploadEventMap>();
  const progress = createProgressTracker();
  const controller = new AbortController();
  const externalSignal = options.signal;

  let status: UploadStatus = "queued";
  let pauseGate: Promise<void> | undefined;
  let releasePauseGate: (() => void) | undefined;

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }

  function setStatus(next: UploadStatus): void {
    assertTransition(status, next, source.fileId);
    status = next;
  }

  function waitIfPaused(): Promise<void> {
    return pauseGate ?? Promise.resolve();
  }

  function assertNotAborted(partNumber?: number): void {
    if (controller.signal.aborted) {
      throw new AbortError(
        undefined,
        partNumber !== undefined
          ? {
              fileId: source.fileId,
              partNumber,
            }
          : {
              fileId: source.fileId,
            },
      );
    }
  }

  async function withRetry<TResult>(
    attempt: (attemptNumber: number) => Promise<TResult>,
  ): Promise<TResult> {
    let attemptNumber = 0;
    for (;;) {
      attemptNumber += 1;
      try {
        return await attempt(attemptNumber);
      } catch (caught) {
        const error = toUploadError(toError(caught));
        const decision = evaluateRetry(retryConfig, error, attemptNumber);
        if (!decision.shouldRetry) {
          throw error;
        }
        emitter.emit("retry", {
          attempt: attemptNumber,
          error,
          fileId: source.fileId,
        });
        await delay(decision.delayMs, controller.signal);
      }
    }
  }

  async function executeSimple(
    activeTransport: UploadTransport,
    url: string,
  ): Promise<UploadResult> {
    const whole: ChunkRange = {
      end: source.size,
      partNumber: 1,
      size: source.size,
      start: 0,
    };
    const body = await source.read(whole);

    const response = await withRetry(async () => {
      await waitIfPaused();
      assertNotAborted();
      return activeTransport.send({
        body,
        method: "PUT",
        onProgress: (event) => {
          const fileProgress = progress.update(
            source.fileId,
            event.loadedBytes,
            event.totalBytes,
          );
          emitter.emit("progress", fileProgress);
        },
        signal: controller.signal,
        url,
      });
    });

    if (response.status < 200 || response.status >= 300) {
      throw new HttpError(
        response.status,
        `Upload request failed with status ${response.status}.`,
        {
          fileId: source.fileId,
        },
      );
    }

    progress.update(source.fileId, source.size, source.size);
    return {
      fileId: source.fileId,
      totalBytes: source.size,
    };
  }

  async function executeMultipart(
    activeProvider: StorageProvider,
    activeTransport: UploadTransport | undefined,
  ): Promise<UploadResult> {
    const context: StorageProviderContext = {
      fileId: source.fileId,
      ...(activeTransport
        ? {
            transport: activeTransport,
          }
        : {}),
      signal: controller.signal,
    };

    const completedParts: ProviderPartResult[] = [];
    let loadedBytes = 0;

    const storedRecord = store ? await store.get(source.fileId) : undefined;
    const uploadIdFromStore = storedRecord?.providerUploadId;
    const resumeState =
      uploadIdFromStore !== undefined
        ? await withRetry(() =>
            activeProvider.resume(source.fileId, uploadIdFromStore, context),
          )
        : undefined;

    let providerUploadId: string;
    if (resumeState) {
      providerUploadId = resumeState.providerUploadId;
      completedParts.push(...resumeState.completedParts);
      loadedBytes = completedParts.reduce(
        (sum, part) => sum + part.sizeBytes,
        0,
      );
    } else {
      providerUploadId = (
        await withRetry(() => activeProvider.create(source.fileId, context))
      ).providerUploadId;
    }

    const completedPartNumbers = new Set(
      completedParts.map((part) => part.partNumber),
    );

    async function persistProgress(): Promise<void> {
      if (!store) {
        return;
      }
      const record: StoredUploadRecord = {
        completedPartNumbers: completedParts.map((part) => part.partNumber),
        fileId: source.fileId,
        providerUploadId,
        status: "uploading",
        totalBytes: source.size,
        updatedAt: Date.now(),
        uploadedBytes: loadedBytes,
      };
      await store.set(source.fileId, record);
    }

    if (completedParts.length > 0) {
      const fileProgress = progress.update(
        source.fileId,
        loadedBytes,
        source.size,
      );
      emitter.emit("progress", fileProgress);
      await persistProgress();
    }

    const chunkTasks: Array<Promise<void>> = [];
    for (const range of iterateChunks(source.size, chunkSize)) {
      if (completedPartNumbers.has(range.partNumber)) {
        continue;
      }
      const task = dependencies.chunkScheduler.schedule(async () => {
        await waitIfPaused();
        assertNotAborted(range.partNumber);
        try {
          const body = await source.read(range);
          const part = await withRetry(() =>
            activeProvider.uploadPart(providerUploadId, range, body, context),
          );
          completedParts.push(part);
          loadedBytes += part.sizeBytes;
          const fileProgress = progress.update(
            source.fileId,
            loadedBytes,
            source.size,
          );
          emitter.emit("progress", fileProgress);
          await persistProgress();
        } catch (caught) {
          // Once a part exhausts its retries, stop scheduling further parts for this file instead
          // of wasting work uploading parts that will be discarded when the whole transfer fails.
          controller.abort();
          throw caught;
        }
      });
      chunkTasks.push(task);
    }
    await Promise.all(chunkTasks);

    completedParts.sort((left, right) => left.partNumber - right.partNumber);

    const completeResult = await withRetry(() =>
      activeProvider.complete(providerUploadId, completedParts, context),
    );

    if (store) {
      await store.delete(source.fileId);
    }

    return {
      fileId: source.fileId,
      totalBytes: source.size,
      ...(completeResult.location !== undefined
        ? {
            location: completeResult.location,
          }
        : {}),
      ...(completeResult.etag !== undefined
        ? {
            etag: completeResult.etag,
          }
        : {}),
    };
  }

  async function execute(): Promise<UploadResult> {
    try {
      setStatus("uploading");
      emitter.emit("started", {
        fileId: source.fileId,
      });

      let result: UploadResult;
      if (provider) {
        result = await executeMultipart(provider, transport);
      } else if (transport) {
        if (options.url === undefined) {
          throw new UploadValidationError(
            "A `url` is required in UploadOptions when no `provider` is configured.",
            {
              fileId: source.fileId,
            },
          );
        }
        result = await executeSimple(transport, options.url);
      } else {
        throw new UploadValidationError(
          "Either a `provider` or a `transport` must be configured to start an upload.",
          {
            fileId: source.fileId,
          },
        );
      }

      setStatus("completed");
      emitter.emit("completed", {
        fileId: source.fileId,
        result,
      });
      return result;
    } catch (caught) {
      const error: UploadError = toUploadError(toError(caught));
      if (error instanceof AbortError) {
        if (store) {
          await store.delete(source.fileId);
        }
        setStatus("cancelled");
        emitter.emit("cancelled", {
          fileId: source.fileId,
        });
      } else {
        setStatus("failed");
        emitter.emit("failed", {
          error,
          fileId: source.fileId,
        });
      }
      throw error;
    }
  }

  function pause(): void {
    if (status !== "uploading") {
      return;
    }
    setStatus("paused");
    pauseGate = new Promise((resolve) => {
      releasePauseGate = resolve;
    });
    emitter.emit("paused", {
      fileId: source.fileId,
    });
  }

  function resume(): void {
    if (status !== "paused") {
      return;
    }
    setStatus("uploading");
    releasePauseGate?.();
    pauseGate = undefined;
    releasePauseGate = undefined;
    emitter.emit("resumed", {
      fileId: source.fileId,
    });
  }

  function cancel(): void {
    if (status === "completed" || status === "cancelled") {
      return;
    }
    controller.abort();
    releasePauseGate?.();
    if (status === "queued") {
      setStatus("cancelled");
      emitter.emit("cancelled", {
        fileId: source.fileId,
      });
    }
  }

  return {
    cancel,
    execute,
    get fileId() {
      return source.fileId;
    },
    on: emitter.on,
    pause,
    resume,
    get status() {
      return status;
    },
  };
}
