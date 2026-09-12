"use client";

import type {
  ChecksumComputer,
  ChunkRange,
  Upload,
  Uploader,
} from "@upflowi/core";
import { createUploader } from "@upflowi/core";
import { createHttpProvider } from "@upflowi/provider-http";
import { createR2Provider } from "@upflowi/provider-r2";
import { createS3Provider } from "@upflowi/provider-s3";
import { createFetchTransport } from "@upflowi/transport-fetch";
import { createXhrTransport } from "@upflowi/transport-xhr";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { md5Base64, sha256Base64 } from "@/lib/playground/checksum";
import { createLocalStorageStore } from "@/lib/playground/local-storage-store";
import type { LogEntry, PlaygroundConfig, UploaderStats } from "./types";

/**
 * @upflowi/provider-r2 only accepts the "MD5" algorithm (R2 doesn't implement S3's
 * x-amz-checksum-* feature); provider-s3 and provider-http both work fine with SHA-256, so that's
 * what they get here — there's no reason to prefer MD5 for either.
 */
function createPlaygroundChecksumComputer(
  provider: PlaygroundConfig["provider"],
): ChecksumComputer {
  return provider === "r2"
    ? {
        algorithm: "MD5",
        compute: md5Base64,
      }
    : {
        algorithm: "SHA-256",
        compute: sha256Base64,
      };
}

async function presignVia(
  endpoint: "/api/playground/s3/presign" | "/api/playground/r2/presign",
  operation: unknown,
): Promise<{
  url: string;
  headers?: Record<string, string>;
}> {
  const response = await fetch(endpoint, {
    body: JSON.stringify(operation),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as
      | {
          message?: string;
        }
      | undefined;
    throw new Error(
      body?.message ?? `Presign request failed with status ${response.status}.`,
    );
  }
  return response.json();
}

function summarizeEvent(event: string, payload: unknown): string | undefined {
  if (event === "progress" && payload && typeof payload === "object") {
    const p = payload as {
      percent?: number;
    };
    return typeof p.percent === "number"
      ? `${p.percent.toFixed(1)}%`
      : undefined;
  }
  if (
    (event === "retry" || event === "failed") &&
    payload &&
    typeof payload === "object" &&
    "error" in payload
  ) {
    const error = (
      payload as {
        error?: {
          name?: string;
          message?: string;
        };
      }
    ).error;
    return error
      ? `${error.name ?? "Error"}: ${error.message ?? ""}`
      : undefined;
  }
  if (event === "allCompleted" && payload && typeof payload === "object") {
    const p = payload as {
      completedCount?: number;
      failedCount?: number;
    };
    return `${p.completedCount ?? 0} completed, ${p.failedCount ?? 0} failed`;
  }
  return undefined;
}

function buildUploader(
  config: PlaygroundConfig,
  simulateFailuresRef: {
    current: PlaygroundConfig["simulateFailures"];
  },
): Uploader {
  const transport =
    config.transport === "fetch"
      ? createFetchTransport()
      : createXhrTransport();

  const provider =
    config.provider === "s3"
      ? createS3Provider({
          getPresignedUrl: (operation) =>
            presignVia("/api/playground/s3/presign", operation),
        })
      : config.provider === "r2"
        ? createR2Provider({
            getPresignedUrl: (operation) =>
              presignVia("/api/playground/r2/presign", operation),
          })
        : createHttpProvider({
            baseUrl: "/api/playground/custom",
            getHeaders: (): Readonly<Record<string, string>> => {
              const value = simulateFailuresRef.current;
              const headers: Record<string, string> = {};
              if (value !== "off") {
                headers["x-playground-fail-count"] = String(value);
              }
              return headers;
            },
          });

  return createUploader({
    ...(config.checksumEnabled
      ? {
          checksum: createPlaygroundChecksumComputer(config.provider),
        }
      : {}),
    chunkSize: config.chunkSize,
    concurrency: config.concurrency,
    provider,
    retry: {
      initialDelayMs: 300,
      maxAttempts: config.maxAttempts,
    },
    store: createLocalStorageStore(),
    transport,
  });
}

export function usePlaygroundUploader(config: PlaygroundConfig): {
  uploads: Upload[];
  log: LogEntry[];
  stats: UploaderStats;
  addFiles: (files: FileList | File[]) => void;
  pauseAll: () => void;
  resumeAll: () => void;
  cancelAll: () => void;
} {
  const simulateFailuresRef = useRef(config.simulateFailures);
  simulateFailuresRef.current = config.simulateFailures;

  const {
    provider,
    transport,
    concurrency,
    chunkSize,
    maxAttempts,
    checksumEnabled,
  } = config;
  const uploader = useMemo(
    () =>
      buildUploader(
        {
          checksumEnabled,
          chunkSize,
          concurrency,
          maxAttempts,
          provider,
          simulateFailures: simulateFailuresRef.current,
          transport,
        },
        simulateFailuresRef,
      ),
    [
      provider,
      transport,
      concurrency,
      chunkSize,
      maxAttempts,
      checksumEnabled,
    ],
  );

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<UploaderStats>({
    active: 0,
    completed: 0,
    failed: 0,
    pending: 0,
    size: 0,
  });
  const logIdRef = useRef(0);
  const knownFileIdsRef = useRef(new Set<string>());
  const startedUploaderRef = useRef<Uploader | null>(null);

  useEffect(() => {
    setUploads([]);
    setLog([]);
    knownFileIdsRef.current = new Set();

    function pushLog(event: string, payload: unknown): void {
      logIdRef.current += 1;
      const fileId =
        payload && typeof payload === "object" && "fileId" in payload
          ? String(
              (
                payload as {
                  fileId: unknown;
                }
              ).fileId,
            )
          : undefined;
      setLog((previous) => [
        ...previous.slice(-199),
        {
          detail: summarizeEvent(event, payload),
          event,
          fileId,
          id: logIdRef.current,
          timestamp: Date.now(),
        },
      ]);
      setStats({
        active: uploader.active,
        completed: uploader.completed,
        failed: uploader.failed,
        pending: uploader.pending,
        size: uploader.size,
      });
    }

    const unsubscribes = [
      uploader.on("queued", (payload) => pushLog("queued", payload)),
      uploader.on("started", (payload) => pushLog("started", payload)),
      uploader.on("progress", (payload) => pushLog("progress", payload)),
      uploader.on("paused", (payload) => pushLog("paused", payload)),
      uploader.on("resumed", (payload) => pushLog("resumed", payload)),
      uploader.on("retry", (payload) => pushLog("retry", payload)),
      uploader.on("completed", (payload) => pushLog("completed", payload)),
      uploader.on("failed", (payload) => pushLog("failed", payload)),
      uploader.on("cancelled", (payload) => pushLog("cancelled", payload)),
      uploader.on("allCompleted", (payload) =>
        pushLog("allCompleted", payload),
      ),
    ];
    // React (dev) Strict Mode invokes this effect twice per mount; guard so
    // uploader.start() — not idempotent — never runs twice on the same
    // uploader instance, which would double-process its queue and emit
    // every event twice.
    if (startedUploaderRef.current !== uploader) {
      startedUploaderRef.current = uploader;
      uploader.start();
    }

    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [
    uploader,
  ]);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const inputs = Array.from(files)
        .map((file) => ({
          file,
          fileId: `${file.name}-${file.size}-${file.lastModified}`,
        }))
        .filter(({ fileId }) => {
          if (knownFileIdsRef.current.has(fileId)) {
            return false;
          }
          knownFileIdsRef.current.add(fileId);
          return true;
        })
        .map(({ fileId, file }) => ({
          source: {
            fileId,
            read: async (range: ChunkRange) =>
              file.slice(range.start, range.end),
            size: file.size,
          },
        }));

      if (inputs.length === 0) {
        return;
      }
      const added = uploader.addMany(inputs);
      setUploads((previous) => [
        ...previous,
        ...added,
      ]);
    },
    [
      uploader,
    ],
  );

  const pauseAll = useCallback(
    () => uploader.pause(),
    [
      uploader,
    ],
  );
  const resumeAll = useCallback(
    () => uploader.resume(),
    [
      uploader,
    ],
  );
  const cancelAll = useCallback(
    () => uploader.cancel(),
    [
      uploader,
    ],
  );

  return {
    addFiles,
    cancelAll,
    log,
    pauseAll,
    resumeAll,
    stats,
    uploads,
  };
}
