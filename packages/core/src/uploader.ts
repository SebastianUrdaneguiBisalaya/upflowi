import type { ChecksumComputer } from "./checksum.js";
import { UploadValidationError } from "./errors.js";
import {
  createEventEmitter,
  type EventListener,
  type EventUnsubscribe,
  type UploaderEventMap,
} from "./events.js";
import type { StorageProvider } from "./provider.js";
import { createQueue } from "./queue.js";
import { DEFAULT_RETRY_CONFIG, type RetryConfig } from "./retry.js";
import { createScheduler, type Scheduler } from "./scheduler.js";
import type { UploadStore } from "./store.js";
import type { UploadTransport } from "./transport.js";
import {
  createUpload,
  type Upload,
  type UploadHandle,
  type UploadOptions,
  type UploadSource,
} from "./upload.js";

const DEFAULT_CONCURRENCY = 3;
const DEFAULT_CHUNK_CONCURRENCY = 3;
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;

/** Configuration accepted by {@link createUploader}. */
export type UploaderConfig = {
  /** Maximum number of files transferred at once. Defaults to 3. */
  concurrency?: number;
  /** Maximum number of multipart chunks transferred at once, across all files. Defaults to 3. */
  chunkConcurrency?: number;
  /** Default part size, in bytes, for multipart transfers. Defaults to 5 MiB. */
  chunkSize?: number;
  /** Overrides applied on top of {@link DEFAULT_RETRY_CONFIG}. */
  retry?: Partial<RetryConfig>;
  /** Default transport used for files that don't override it in their own {@link UploadOptions}. */
  transport?: UploadTransport;
  /** Default storage provider used for files that don't override it in their own {@link UploadOptions}. */
  provider?: StorageProvider;
  /** Used to persist upload progress so interrupted transfers can be resumed. */
  store?: UploadStore;
  /**
   * Default checksum computer used for files that don't override it in their own
   * {@link UploadOptions}. When set, it's threaded through to `StorageProviderContext.checksum`
   * for every multipart part — a provider that wants per-part integrity checking calls
   * `checksum.compute(bytes)` itself and attaches the result however its backend expects (a
   * request header, most commonly). Core never calls it and has no opinion on the header
   * format — see `@upflowi/provider-http` for a reference implementation.
   */
  checksum?: ChecksumComputer;
};

/** A single file to register with {@link Uploader.add}/{@link Uploader.addMany}. */
export type AddFileInput = {
  source: UploadSource;
  options?: UploadOptions;
};

/** The headless, provider-agnostic file transfer engine returned by {@link createUploader}. */
export type Uploader = {
  /** Registers a file. If the uploader was already started, it begins transferring immediately. */
  add(input: AddFileInput): Upload;
  addMany(inputs: readonly AddFileInput[]): readonly Upload[];
  /** Starts scheduling queued files, respecting the configured concurrency. */
  start(): void;
  /** Pauses every upload currently tracked. */
  pause(): void;
  /** Resumes every paused upload currently tracked. */
  resume(): void;
  /** Cancels every upload currently tracked. */
  cancel(): void;
  on<TEvent extends keyof UploaderEventMap>(
    event: TEvent,
    listener: EventListener<UploaderEventMap[TEvent]>,
  ): EventUnsubscribe;
  /** Total number of files ever registered. */
  readonly size: number;
  /** Number of files not yet scheduled to run. */
  readonly pending: number;
  /** Number of files currently transferring. */
  readonly active: number;
  readonly completed: number;
  readonly failed: number;
};

function forwardUploadEvents(
  handle: UploadHandle,
  emitter: ReturnType<typeof createEventEmitter<UploaderEventMap>>,
): void {
  handle.on("started", (payload) => emitter.emit("started", payload));
  handle.on("progress", (payload) => emitter.emit("progress", payload));
  handle.on("paused", (payload) => emitter.emit("paused", payload));
  handle.on("resumed", (payload) => emitter.emit("resumed", payload));
  handle.on("retry", (payload) => emitter.emit("retry", payload));
  handle.on("completed", (payload) => emitter.emit("completed", payload));
  handle.on("failed", (payload) => emitter.emit("failed", payload));
  handle.on("cancelled", (payload) => emitter.emit("cancelled", payload));
}

/**
 * Creates a headless, provider-agnostic file upload engine: it orchestrates queueing,
 * concurrency, chunking, retries, and progress, but performs no I/O itself — that is delegated to
 * the `transport`/`provider` supplied here or per-file in {@link UploadOptions}.
 *
 * @example
 * ```ts
 * const uploader = createUploader({ concurrency: 3, retry: { maxAttempts: 5 } });
 * const upload = uploader.add({ source: mySource, options: { transport: myTransport, url } });
 * upload.on("progress", (progress) => console.log(progress.percent));
 * uploader.start();
 * ```
 */
export function createUploader(config: UploaderConfig = {}): Uploader {
  const concurrency = config.concurrency ?? DEFAULT_CONCURRENCY;
  const chunkConcurrency = config.chunkConcurrency ?? DEFAULT_CHUNK_CONCURRENCY;
  const chunkSize = config.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const retryConfig: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...config.retry,
  };

  const fileScheduler: Scheduler = createScheduler({
    concurrency,
  });
  const chunkScheduler: Scheduler = createScheduler({
    concurrency: chunkConcurrency,
  });
  const queue = createQueue<UploadHandle>();
  const emitter = createEventEmitter<UploaderEventMap>();

  const handles = new Map<string, UploadHandle>();
  let completedCount = 0;
  let failedCount = 0;
  let settledCount = 0;
  let queuedTotal = 0;
  let started = false;

  function checkAllCompleted(): void {
    if (started && queuedTotal > 0 && settledCount === queuedTotal) {
      emitter.emit("allCompleted", {
        completedCount,
        failedCount,
      });
    }
  }

  function runUpload(handle: UploadHandle): void {
    void fileScheduler
      .schedule(async () => {
        // A file cancelled while still queued (never started) must not reach
        // execute(): its status is already "cancelled", and that state has no
        // legal transitions (see state-machine.ts), so calling execute() would
        // throw trying to move to "uploading" instead of being a no-op.
        if (handle.status !== "cancelled") {
          await handle.execute();
        }
      })
      .then(
        () => {
          settledCount += 1;
          if (handle.status === "completed") {
            completedCount += 1;
          }
          checkAllCompleted();
        },
        () => {
          settledCount += 1;
          // A rejection with status "cancelled" is a legitimate cancellation
          // (execute() re-throws AbortError after transitioning), not a failure.
          if (handle.status !== "cancelled") {
            failedCount += 1;
          }
          checkAllCompleted();
        },
      );
  }

  function add(input: AddFileInput): Upload {
    const fileId = input.source.fileId;
    if (handles.has(fileId)) {
      throw new UploadValidationError(
        `An upload with fileId "${fileId}" was already added.`,
        {
          fileId,
        },
      );
    }

    const dependencies = {
      chunkScheduler,
      chunkSize,
      retryConfig,
      ...(config.provider
        ? {
            provider: config.provider,
          }
        : {}),
      ...(config.transport
        ? {
            transport: config.transport,
          }
        : {}),
      ...(config.store
        ? {
            store: config.store,
          }
        : {}),
      ...(config.checksum
        ? {
            checksum: config.checksum,
          }
        : {}),
    };
    const handle = createUpload(
      input.source,
      input.options ?? {},
      dependencies,
    );

    handles.set(fileId, handle);
    queuedTotal += 1;
    forwardUploadEvents(handle, emitter);
    emitter.emit("queued", {
      fileId,
    });

    if (started) {
      runUpload(handle);
    } else {
      queue.enqueue(
        handle,
        input.options?.priority !== undefined
          ? {
              priority: input.options.priority,
            }
          : {},
      );
    }

    return handle;
  }

  function addMany(inputs: readonly AddFileInput[]): readonly Upload[] {
    return inputs.map((input) => add(input));
  }

  function start(): void {
    started = true;
    for (;;) {
      const item = queue.dequeue();
      if (item === undefined) {
        break;
      }
      runUpload(item.payload);
    }
  }

  function pause(): void {
    for (const handle of handles.values()) {
      handle.pause();
    }
  }

  function resume(): void {
    for (const handle of handles.values()) {
      handle.resume();
    }
  }

  function cancel(): void {
    for (const handle of handles.values()) {
      handle.cancel();
    }
  }

  return {
    get active() {
      return fileScheduler.active;
    },
    add,
    addMany,
    cancel,
    get completed() {
      return completedCount;
    },
    get failed() {
      return failedCount;
    },
    on: emitter.on,
    pause,
    get pending() {
      return queue.size + fileScheduler.pending;
    },
    resume,
    get size() {
      return handles.size;
    },
    start,
  };
}
