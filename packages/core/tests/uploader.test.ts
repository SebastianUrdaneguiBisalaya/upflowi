import { describe, expect, it, vi } from "vitest";
import {
  HttpError,
  NetworkError,
  ProviderError,
  UploadValidationError,
} from "../src/errors.js";
import type { FileProgress } from "../src/progress.js";
import type {
  ProviderCompleteResult,
  ProviderCreateResult,
  ProviderPartResult,
  StorageProvider,
} from "../src/provider.js";
import type { StoredUploadRecord, UploadStore } from "../src/store.js";
import type {
  TransportRequest,
  TransportResponse,
  UploadTransport,
} from "../src/transport.js";
import type { UploadSource } from "../src/upload.js";
import { createUploader } from "../src/uploader.js";

function createMemoryStore(): UploadStore & {
  readonly records: ReadonlyMap<string, StoredUploadRecord>;
} {
  const records = new Map<string, StoredUploadRecord>();
  return {
    delete: async (fileId) => {
      records.delete(fileId);
    },
    get: async (fileId) => records.get(fileId),
    records,
    set: async (fileId, record) => {
      records.set(fileId, record);
    },
  };
}

function createSource(fileId: string, size: number): UploadSource {
  return {
    fileId,
    read: async () => new Uint8Array(size),
    size,
  };
}

function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = (): void => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error("waitFor timed out"));
        return;
      }
      setTimeout(tick, 5);
    };
    tick();
  });
}

describe("createUploader — simple transport mode", () => {
  it("never runs more files concurrently than configured, and reports aggregated progress", async () => {
    let active = 0;
    let maxActive = 0;

    const transport: UploadTransport = {
      send: async (request: TransportRequest): Promise<TransportResponse> => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 20));
        request.onProgress?.({
          loadedBytes: 100,
          totalBytes: 100,
        });
        active -= 1;
        return {
          body: "",
          headers: {},
          status: 200,
        };
      },
    };

    const uploader = createUploader({
      concurrency: 2,
      transport,
    });
    const progressEvents: FileProgress[] = [];
    uploader.on("progress", (payload) => progressEvents.push(payload));

    const files = [
      "a",
      "b",
      "c",
      "d",
    ].map((id) => createSource(id, 100));
    for (const source of files) {
      uploader.add({
        options: {
          url: `https://example.test/${source.fileId}`,
        },
        source,
      });
    }

    let completedCount = 0;
    let failedCount = 0;
    const allCompleted = new Promise<void>((resolve) => {
      uploader.on("allCompleted", (payload) => {
        completedCount = payload.completedCount;
        failedCount = payload.failedCount;
        resolve();
      });
    });

    uploader.start();
    await allCompleted;

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(completedCount).toBe(4);
    expect(failedCount).toBe(0);
    expect(progressEvents).toHaveLength(4);
    expect(progressEvents.every((event) => event.percent === 100)).toBe(true);
  });

  it("retries a transient network failure and eventually completes", async () => {
    let attempts = 0;
    const transport: UploadTransport = {
      send: async (request: TransportRequest): Promise<TransportResponse> => {
        attempts += 1;
        if (attempts < 2) {
          throw new NetworkError("connection reset");
        }
        request.onProgress?.({
          loadedBytes: 10,
          totalBytes: 10,
        });
        return {
          body: "",
          headers: {},
          status: 200,
        };
      },
    };

    const uploader = createUploader({
      retry: {
        initialDelayMs: 1,
        jitter: false,
        maxAttempts: 3,
      },
      transport,
    });
    const retryEvents: number[] = [];
    uploader.on("retry", (payload) => retryEvents.push(payload.attempt));

    const upload = uploader.add({
      options: {
        url: "https://example.test/file",
      },
      source: createSource("file-1", 10),
    });
    uploader.start();

    await waitFor(() => upload.status === "completed");
    expect(retryEvents).toEqual([
      1,
    ]);
    expect(attempts).toBe(2);
  });

  it("fails after exhausting all configured attempts", async () => {
    const transport: UploadTransport = {
      send: async () => {
        throw new NetworkError("still down");
      },
    };

    const uploader = createUploader({
      retry: {
        initialDelayMs: 1,
        jitter: false,
        maxAttempts: 2,
      },
      transport,
    });
    const failed = vi.fn();
    uploader.on("failed", failed);

    const upload = uploader.add({
      options: {
        url: "https://example.test/file",
      },
      source: createSource("file-1", 10),
    });
    uploader.start();

    await waitFor(() => upload.status === "failed");
    expect(failed).toHaveBeenCalledTimes(1);
  });
});

describe("createUploader — cancellation", () => {
  it("cancelling one file mid-transfer lets the others complete normally", async () => {
    const sendCalls: string[] = [];
    const transport: UploadTransport = {
      send: async (request: TransportRequest): Promise<TransportResponse> => {
        sendCalls.push(request.url);
        await new Promise((resolve) => setTimeout(resolve, 30));
        request.onProgress?.({
          loadedBytes: 100,
          totalBytes: 100,
        });
        return {
          body: "",
          headers: {},
          status: 200,
        };
      },
    };

    const uploader = createUploader({
      concurrency: 3,
      transport,
    });

    const uploads = [
      "a",
      "b",
      "c",
    ].map((id) =>
      uploader.add({
        options: {
          url: `https://example.test/${id}`,
        },
        source: createSource(id, 100),
      }),
    );

    let completedCount = 0;
    let failedCount = 0;
    const allCompleted = new Promise<void>((resolve) => {
      uploader.on("allCompleted", (payload) => {
        completedCount = payload.completedCount;
        failedCount = payload.failedCount;
        resolve();
      });
    });

    uploader.start();
    const [, target] = uploads;
    target?.cancel();

    await allCompleted;

    expect(target?.status).toBe("cancelled");
    expect(uploads[0]?.status).toBe("completed");
    expect(uploads[2]?.status).toBe("completed");
    expect(completedCount).toBe(2);
    expect(failedCount).toBe(0);
  });

  it("cancelling a file still waiting behind the concurrency limit skips it entirely and lets the others finish", async () => {
    const executed: string[] = [];
    const transport: UploadTransport = {
      send: async (request: TransportRequest): Promise<TransportResponse> => {
        executed.push(request.url);
        await new Promise((resolve) => setTimeout(resolve, 10));
        request.onProgress?.({
          loadedBytes: 100,
          totalBytes: 100,
        });
        return {
          body: "",
          headers: {},
          status: 200,
        };
      },
    };

    const uploader = createUploader({
      concurrency: 1,
      transport,
    });

    const first = uploader.add({
      options: {
        url: "https://example.test/first",
      },
      source: createSource("first", 100),
    });
    const second = uploader.add({
      options: {
        url: "https://example.test/second",
      },
      source: createSource("second", 100),
    });

    // "second" is still sitting behind the concurrency limit, never started.
    second.cancel();
    expect(second.status).toBe("cancelled");

    const allCompleted = new Promise<void>((resolve) => {
      uploader.on("allCompleted", () => resolve());
    });
    uploader.start();
    await allCompleted;

    expect(first.status).toBe("completed");
    expect(second.status).toBe("cancelled");
    expect(executed).toEqual([
      "https://example.test/first",
    ]);
  });

  it("cancelling a file before start() is ever called excludes it from execution once start() runs", async () => {
    const executed: string[] = [];
    const transport: UploadTransport = {
      send: async (request: TransportRequest): Promise<TransportResponse> => {
        executed.push(request.url);
        request.onProgress?.({
          loadedBytes: 50,
          totalBytes: 50,
        });
        return {
          body: "",
          headers: {},
          status: 200,
        };
      },
    };

    const uploader = createUploader({
      transport,
    });

    const kept = uploader.add({
      options: {
        url: "https://example.test/kept",
      },
      source: createSource("kept", 50),
    });
    const removed = uploader.add({
      options: {
        url: "https://example.test/removed",
      },
      source: createSource("removed", 50),
    });

    removed.cancel();

    const allCompleted = new Promise<void>((resolve) => {
      uploader.on("allCompleted", () => resolve());
    });
    uploader.start();
    await allCompleted;

    expect(kept.status).toBe("completed");
    expect(removed.status).toBe("cancelled");
    expect(executed).toEqual([
      "https://example.test/kept",
    ]);
  });
});

describe("createUploader — multipart provider mode", () => {
  it("limits chunk concurrency and completes with parts sorted by partNumber", async () => {
    let activeParts = 0;
    let maxActiveParts = 0;
    const uploadedPartNumbers: number[] = [];

    const provider: StorageProvider = {
      abort: async () => undefined,
      complete: async (_id, parts): Promise<ProviderCompleteResult> => {
        expect(parts.map((part) => part.partNumber)).toEqual(
          [
            ...parts,
          ].map((_, index) => index + 1),
        );
        return {
          etag: "final-etag",
          location: "https://example.test/object",
        };
      },
      create: async (): Promise<ProviderCreateResult> => ({
        providerUploadId: "upload-123",
      }),
      resume: async () => undefined,
      uploadPart: async (_id, chunk): Promise<ProviderPartResult> => {
        activeParts += 1;
        maxActiveParts = Math.max(maxActiveParts, activeParts);
        await new Promise((resolve) => setTimeout(resolve, 10));
        uploadedPartNumbers.push(chunk.partNumber);
        activeParts -= 1;
        return {
          etag: `etag-${chunk.partNumber}`,
          partNumber: chunk.partNumber,
          sizeBytes: chunk.size,
        };
      },
    };

    const uploader = createUploader({
      chunkConcurrency: 2,
      chunkSize: 10,
      provider,
    });
    const upload = uploader.add({
      source: createSource("big-file", 45),
    });
    uploader.start();

    await waitFor(() => upload.status === "completed");
    expect(maxActiveParts).toBeLessThanOrEqual(2);
    expect(uploadedPartNumbers.sort((a, b) => a - b)).toEqual([
      1,
      2,
      3,
      4,
      5,
    ]);
  });

  it("retries a part rejected with a retryable ProviderError (e.g. a 503) and eventually completes", async () => {
    let attempts = 0;
    const provider: StorageProvider = {
      abort: async () => undefined,
      complete: async (): Promise<ProviderCompleteResult> => ({
        etag: "final-etag",
      }),
      create: async (): Promise<ProviderCreateResult> => ({
        providerUploadId: "upload-503",
      }),
      resume: async () => undefined,
      uploadPart: async (_id, chunk): Promise<ProviderPartResult> => {
        attempts += 1;
        if (attempts < 3) {
          throw new ProviderError(
            "Backend upload part failed with status 503.",
            {
              providerCode: "503",
              retryable: true,
            },
          );
        }
        return {
          etag: `etag-${chunk.partNumber}`,
          partNumber: chunk.partNumber,
          sizeBytes: chunk.size,
        };
      },
    };

    const uploader = createUploader({
      provider,
      retry: {
        initialDelayMs: 1,
        jitter: false,
        maxAttempts: 3,
      },
    });
    const retryEvents: number[] = [];
    uploader.on("retry", (payload) => retryEvents.push(payload.attempt));

    const upload = uploader.add({
      source: createSource("flaky-file", 10),
    });
    uploader.start();

    await waitFor(() => upload.status === "completed");
    expect(retryEvents).toEqual([
      1,
      2,
    ]);
    expect(attempts).toBe(3);
  });

  it("does not retry a part rejected with a non-retryable ProviderError (e.g. a 400)", async () => {
    let attempts = 0;
    const provider: StorageProvider = {
      abort: async () => undefined,
      complete: async (): Promise<ProviderCompleteResult> => ({}),
      create: async (): Promise<ProviderCreateResult> => ({
        providerUploadId: "upload-400",
      }),
      resume: async () => undefined,
      uploadPart: async (): Promise<ProviderPartResult> => {
        attempts += 1;
        throw new ProviderError("Backend upload part failed with status 400.", {
          providerCode: "400",
          retryable: false,
        });
      },
    };

    const uploader = createUploader({
      provider,
      retry: {
        initialDelayMs: 1,
        jitter: false,
        maxAttempts: 3,
      },
    });
    const retryEvents: number[] = [];
    uploader.on("retry", (payload) => retryEvents.push(payload.attempt));

    const upload = uploader.add({
      source: createSource("permanently-broken-file", 10),
    });
    uploader.start();

    await waitFor(() => upload.status === "failed");
    expect(retryEvents).toEqual([]);
    expect(attempts).toBe(1);
  });
});

describe("createUploader — registration and lifecycle controls", () => {
  it("throws when adding a file whose fileId was already registered", () => {
    const transport: UploadTransport = {
      send: async () => ({
        body: "",
        headers: {},
        status: 200,
      }),
    };
    const uploader = createUploader({
      transport,
    });
    uploader.add({
      options: {
        url: "https://example.test/dup",
      },
      source: createSource("dup", 10),
    });

    expect(() =>
      uploader.add({
        options: {
          url: "https://example.test/dup",
        },
        source: createSource("dup", 10),
      }),
    ).toThrow(UploadValidationError);
  });

  it("runs a file immediately when it's added after start() was already called", async () => {
    const executed: string[] = [];
    const transport: UploadTransport = {
      send: async (request: TransportRequest): Promise<TransportResponse> => {
        executed.push(request.url);
        return {
          body: "",
          headers: {},
          status: 200,
        };
      },
    };
    const uploader = createUploader({
      transport,
    });
    uploader.start();

    const upload = uploader.add({
      options: {
        url: "https://example.test/late",
      },
      source: createSource("late", 10),
    });

    await waitFor(() => upload.status === "completed");
    expect(executed).toEqual([
      "https://example.test/late",
    ]);
  });

  it("addMany registers every file, and uploader.cancel()/getters cover the whole batch", async () => {
    const executed: string[] = [];
    const transport: UploadTransport = {
      send: async (request: TransportRequest): Promise<TransportResponse> => {
        executed.push(request.url);
        return {
          body: "",
          headers: {},
          status: 200,
        };
      },
    };
    const uploader = createUploader({
      transport,
    });

    const uploads = uploader.addMany([
      {
        options: {
          url: "https://example.test/a",
        },
        source: createSource("a", 10),
      },
      {
        options: {
          url: "https://example.test/b",
        },
        source: createSource("b", 10),
      },
    ]);

    expect(uploads).toHaveLength(2);
    expect(uploader.size).toBe(2);
    expect(uploader.pending).toBe(2);
    expect(uploads[0]?.fileId).toBe("a");

    uploader.cancel();
    expect(uploads.every((upload) => upload.status === "cancelled")).toBe(true);

    const allCompleted = new Promise<void>((resolve) => {
      uploader.on("allCompleted", () => resolve());
    });
    uploader.start();
    await allCompleted;

    expect(executed).toEqual([]);
    expect(uploader.completed).toBe(0);
    expect(uploader.failed).toBe(0);
    expect(uploader.active).toBe(0);
    expect(uploader.pending).toBe(0);
  });

  it("uploader.pause() and uploader.resume() propagate to every in-flight file", async () => {
    const transport: UploadTransport = {
      send: async (): Promise<TransportResponse> => {
        await new Promise((resolve) => setTimeout(resolve, 15));
        return {
          body: "",
          headers: {},
          status: 200,
        };
      },
    };
    const uploader = createUploader({
      concurrency: 2,
      transport,
    });

    let startedCount = 0;
    uploader.on("started", () => {
      startedCount += 1;
      if (startedCount === 2) {
        uploader.pause();
      }
    });

    const uploads = uploader.addMany([
      {
        options: {
          url: "https://example.test/pause-a",
        },
        source: createSource("pause-a", 10),
      },
      {
        options: {
          url: "https://example.test/pause-b",
        },
        source: createSource("pause-b", 10),
      },
    ]);

    const allCompleted = new Promise<void>((resolve) => {
      uploader.on("allCompleted", () => resolve());
    });

    uploader.start();
    await waitFor(() => uploads.every((upload) => upload.status === "paused"));
    uploader.resume();
    await allCompleted;

    expect(uploads.every((upload) => upload.status === "completed")).toBe(true);
  });

  it("cancelling an already-completed upload is a no-op", async () => {
    const transport: UploadTransport = {
      send: async () => ({
        body: "",
        headers: {},
        status: 200,
      }),
    };
    const uploader = createUploader({
      transport,
    });
    const upload = uploader.add({
      options: {
        url: "https://example.test/idempotent-cancel",
      },
      source: createSource("idempotent-cancel", 10),
    });
    uploader.start();

    await waitFor(() => upload.status === "completed");
    upload.cancel();
    expect(upload.status).toBe("completed");
  });

  it("cancelling an already-cancelled upload is a no-op", () => {
    const transport: UploadTransport = {
      send: async () => ({
        body: "",
        headers: {},
        status: 200,
      }),
    };
    const uploader = createUploader({
      transport,
    });
    const cancelledUpload = uploader.add({
      options: {
        url: "https://example.test/never-runs",
      },
      source: createSource("never-runs", 10),
    });
    cancelledUpload.cancel();
    cancelledUpload.cancel();
    expect(cancelledUpload.status).toBe("cancelled");
  });
});

describe("createUploader — external AbortSignal", () => {
  it("honors an already-aborted signal by cancelling before any request is sent", async () => {
    const sent: string[] = [];
    const transport: UploadTransport = {
      send: async (request: TransportRequest): Promise<TransportResponse> => {
        sent.push(request.url);
        return {
          body: "",
          headers: {},
          status: 200,
        };
      },
    };
    const controller = new AbortController();
    controller.abort();

    const uploader = createUploader({
      transport,
    });
    const upload = uploader.add({
      options: {
        signal: controller.signal,
        url: "https://example.test/pre-aborted",
      },
      source: createSource("pre-aborted", 10),
    });
    uploader.start();

    await waitFor(() => upload.status === "cancelled");
    expect(sent).toEqual([]);
  });

  it("honors a signal aborted after the upload has already started", async () => {
    const transport: UploadTransport = {
      send: async (): Promise<TransportResponse> => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return {
          body: "",
          headers: {},
          status: 200,
        };
      },
    };
    const controller = new AbortController();
    const uploader = createUploader({
      transport,
    });
    const upload = uploader.add({
      options: {
        signal: controller.signal,
        url: "https://example.test/live-abort",
      },
      source: createSource("live-abort", 10),
    });
    uploader.on("started", () => controller.abort());
    uploader.start();

    await waitFor(() => upload.status === "cancelled");
  });
});

describe("createUploader — configuration validation", () => {
  it("fails when a transport is configured but no destination url is given", async () => {
    const transport: UploadTransport = {
      send: async () => ({
        body: "",
        headers: {},
        status: 200,
      }),
    };
    const uploader = createUploader({
      transport,
    });
    const upload = uploader.add({
      source: createSource("no-url", 10),
    });
    uploader.start();

    await waitFor(() => upload.status === "failed");
  });

  it("fails when neither a transport nor a provider is configured", async () => {
    const uploader = createUploader({});
    const upload = uploader.add({
      source: createSource("no-transport", 10),
    });
    uploader.start();

    await waitFor(() => upload.status === "failed");
  });

  it("fails with HttpError when the transport responds with a non-2xx status", async () => {
    const transport: UploadTransport = {
      send: async (): Promise<TransportResponse> => ({
        body: "",
        headers: {},
        status: 400,
      }),
    };
    const uploader = createUploader({
      transport,
    });
    const upload = uploader.add({
      options: {
        url: "https://example.test/bad-status",
      },
      source: createSource("bad-status", 10),
    });
    let capturedError: unknown;
    upload.on("failed", ({ error }) => {
      capturedError = error;
    });
    uploader.start();

    await waitFor(() => upload.status === "failed");
    expect(capturedError).toBeInstanceOf(HttpError);
  });
});

describe("createUploader — multipart cancellation and persistence", () => {
  it("deletes the persisted store record when a multipart upload is cancelled mid-transfer", async () => {
    const store = createMemoryStore();
    const provider: StorageProvider = {
      abort: async () => undefined,
      complete: async (): Promise<ProviderCompleteResult> => ({}),
      create: async (): Promise<ProviderCreateResult> => ({
        providerUploadId: "cancel-me",
      }),
      resume: async () => undefined,
      uploadPart: async (_id, chunk): Promise<ProviderPartResult> => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          etag: `etag-${chunk.partNumber}`,
          partNumber: chunk.partNumber,
          sizeBytes: chunk.size,
        };
      },
    };
    const uploader = createUploader({
      chunkConcurrency: 1,
      chunkSize: 10,
      provider,
      store,
    });
    const upload = uploader.add({
      source: createSource("cancel-multipart", 30),
    });

    let progressCount = 0;
    upload.on("progress", () => {
      progressCount += 1;
      if (progressCount === 1) {
        upload.cancel();
      }
    });
    uploader.start();

    await waitFor(() => upload.status === "cancelled");
    expect(store.records.has("cancel-multipart")).toBe(false);
  });
});

describe("createUploader — resume idempotency via UploadStore", () => {
  it("persists completed parts, survives a mid-transfer failure, and resumes without re-uploading them", async () => {
    const store = createMemoryStore();

    const failingProvider: StorageProvider = {
      abort: async () => undefined,
      complete: async (): Promise<ProviderCompleteResult> => {
        throw new Error("complete should never be called before the failure");
      },
      create: async (): Promise<ProviderCreateResult> => ({
        providerUploadId: "upload-abc",
      }),
      resume: async () => undefined,
      uploadPart: async (_id, chunk): Promise<ProviderPartResult> => {
        if (chunk.partNumber === 3) {
          throw new UploadValidationError("permanent failure on part 3");
        }
        return {
          etag: `etag-${chunk.partNumber}`,
          partNumber: chunk.partNumber,
          sizeBytes: chunk.size,
        };
      },
    };

    const firstUploader = createUploader({
      chunkConcurrency: 1,
      chunkSize: 10,
      provider: failingProvider,
      store,
    });
    const firstUpload = firstUploader.add({
      source: createSource("resumable-file", 45),
    });
    firstUploader.start();

    await waitFor(() => firstUpload.status === "failed");

    const stored = store.records.get("resumable-file");
    expect(stored?.providerUploadId).toBe("upload-abc");
    expect(stored?.completedPartNumbers).toEqual([
      1,
      2,
    ]);
    expect(stored?.uploadedBytes).toBe(20);

    const createSpy = vi.fn();
    const uploadPartSpy = vi.fn();
    const resumingProvider: StorageProvider = {
      abort: async () => undefined,
      complete: async (_id, parts): Promise<ProviderCompleteResult> => {
        expect(
          parts.map((part) => part.partNumber).sort((a, b) => a - b),
        ).toEqual([
          1,
          2,
          3,
          4,
          5,
        ]);
        return {
          etag: "final-etag",
          location: "https://example.test/object",
        };
      },
      create: async (fileId, context): Promise<ProviderCreateResult> => {
        createSpy(fileId, context);
        return {
          providerUploadId: "should-not-be-used",
        };
      },
      resume: async (): Promise<
        | {
            providerUploadId: string;
            completedParts: readonly ProviderPartResult[];
          }
        | undefined
      > => ({
        completedParts: [
          {
            etag: "etag-1",
            partNumber: 1,
            sizeBytes: 10,
          },
          {
            etag: "etag-2",
            partNumber: 2,
            sizeBytes: 10,
          },
        ],
        providerUploadId: "upload-abc",
      }),
      uploadPart: async (_id, chunk): Promise<ProviderPartResult> => {
        uploadPartSpy(chunk.partNumber);
        return {
          etag: `etag-${chunk.partNumber}`,
          partNumber: chunk.partNumber,
          sizeBytes: chunk.size,
        };
      },
    };

    const secondUploader = createUploader({
      chunkConcurrency: 2,
      chunkSize: 10,
      provider: resumingProvider,
      store,
    });
    const secondUpload = secondUploader.add({
      source: createSource("resumable-file", 45),
    });
    secondUploader.start();

    await waitFor(() => secondUpload.status === "completed");

    expect(createSpy).not.toHaveBeenCalled();
    expect(
      uploadPartSpy.mock.calls.map((call) => call[0]).sort((a, b) => a - b),
    ).toEqual([
      3,
      4,
      5,
    ]);
    expect(store.records.has("resumable-file")).toBe(false);
  });
});
