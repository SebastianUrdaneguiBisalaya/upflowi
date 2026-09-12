import "server-only";
import { createHash, randomUUID } from "node:crypto";

/**
 * In-memory backend for `@upflowi/provider-http`'s five-route JSON convention, powering the
 * playground's "custom" tab — no cloud account required. A module-scoped `Map` is correct and
 * sufficient here because this whole module is only ever imported from route handlers gated to
 * `NODE_ENV === "development"` (see env.ts): it runs inside a single long-lived `next dev` Node
 * process, never as a multi-instance serverless deployment.
 */

const MAX_PART_BYTES = 64 * 1024 * 1024;

type StoredPart = {
  readonly data: Buffer;
  readonly etag: string;
};

type StoredUpload = {
  readonly fileId: string;
  readonly parts: Map<number, StoredPart>;
  /** Per-part attempt counter backing the "simulate transient failures" demo control. */
  readonly attemptsByPart: Map<number, number>;
};

const uploads = new Map<string, StoredUpload>();

function hash(data: Buffer): string {
  return createHash("md5").update(data).digest("hex");
}

export function createUpload(fileId: string): {
  uploadId: string;
} {
  const uploadId = randomUUID();
  uploads.set(uploadId, {
    attemptsByPart: new Map(),
    fileId,
    parts: new Map(),
  });
  return {
    uploadId,
  };
}

export type SimulatedFailureError = {
  readonly kind: "simulated-failure";
  readonly attempt: number;
};

/**
 * Records one attempt at uploading `partNumber` and, when `failuresBeforeSuccess` is set, returns
 * a simulated-failure marker for the first N attempts before letting the real write through —
 * exercising the SDK's actual retry/backoff path end-to-end. `failuresBeforeSuccess: "always"`
 * never lets the part succeed, to demonstrate `RetryExhaustedError`.
 */
export function putPart(
  uploadId: string,
  partNumber: number,
  data: Buffer,
  failuresBeforeSuccess: number | "always" | undefined,
):
  | {
      etag: string;
    }
  | SimulatedFailureError
  | undefined {
  const upload = uploads.get(uploadId);
  if (upload === undefined) {
    return undefined;
  }
  if (data.byteLength > MAX_PART_BYTES) {
    throw new RangeError(
      `Part ${partNumber} is ${data.byteLength} bytes, over the playground's ${MAX_PART_BYTES}-byte demo limit.`,
    );
  }

  const attempt = (upload.attemptsByPart.get(partNumber) ?? 0) + 1;
  upload.attemptsByPart.set(partNumber, attempt);

  const shouldFail =
    failuresBeforeSuccess === "always" ||
    (typeof failuresBeforeSuccess === "number" &&
      attempt <= failuresBeforeSuccess);
  if (shouldFail) {
    return {
      attempt,
      kind: "simulated-failure",
    };
  }

  const etag = hash(data);
  upload.parts.set(partNumber, {
    data,
    etag,
  });
  return {
    etag,
  };
}

export function completeUpload(uploadId: string):
  | {
      etag: string;
      totalBytes: number;
    }
  | "not-found" {
  const upload = uploads.get(uploadId);
  if (upload === undefined) {
    return "not-found";
  }
  const partNumbers = [
    ...upload.parts.keys(),
  ].sort((a, b) => a - b);
  const buffer = Buffer.concat(
    partNumbers.map((partNumber) => {
      const part = upload.parts.get(partNumber);
      if (part === undefined) {
        throw new Error(`Missing part ${partNumber} for upload ${uploadId}.`);
      }
      return part.data;
    }),
  );
  uploads.delete(uploadId);
  return {
    etag: hash(buffer),
    totalBytes: buffer.byteLength,
  };
}

export function abortUpload(uploadId: string): void {
  uploads.delete(uploadId);
}

export function listParts(uploadId: string):
  | Array<{
      partNumber: number;
      etag: string;
      sizeBytes: number;
    }>
  | undefined {
  const upload = uploads.get(uploadId);
  if (upload === undefined) {
    return undefined;
  }
  return [
    ...upload.parts.entries(),
  ]
    .map(([partNumber, part]) => ({
      etag: part.etag,
      partNumber,
      sizeBytes: part.data.byteLength,
    }))
    .sort((a, b) => a.partNumber - b.partNumber);
}
