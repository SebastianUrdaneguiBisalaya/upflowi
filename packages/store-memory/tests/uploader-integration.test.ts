import type {
  ProviderCompleteResult,
  ProviderCreateResult,
  ProviderPartResult,
  StorageProvider,
  UploadSource,
} from "@upflowi/core";
import { createUploader } from "@upflowi/core";
import { describe, expect, it } from "vitest";
import { createMemoryStore } from "../src/index.js";

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

/**
 * End-to-end: a real @upflowi/core Uploader, paired with the real createMemoryStore(), survives a
 * mid-transfer failure and resumes without re-uploading already-completed parts — exercising the
 * store through the actual resume code path in `upload.ts`, not just its own get/set/delete
 * contract in isolation.
 */
describe("createMemoryStore + createUploader — resume integration", () => {
  it("persists progress across uploader instances and skips already-completed parts on resume", async () => {
    const store = createMemoryStore();
    const uploadedPartNumbers: number[] = [];

    const failingProvider: StorageProvider = {
      abort: async () => undefined,
      complete: async (): Promise<ProviderCompleteResult> => {
        throw new Error("complete should never be called before the failure");
      },
      create: async (): Promise<ProviderCreateResult> => ({
        providerUploadId: "resume-upload-1",
      }),
      resume: async () => undefined,
      uploadPart: async (_id, chunk): Promise<ProviderPartResult> => {
        if (chunk.partNumber === 3) {
          throw new Error("simulated crash mid-transfer");
        }
        uploadedPartNumbers.push(chunk.partNumber);
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
      retry: {
        maxAttempts: 1,
      },
      store,
    });
    const firstUpload = firstUploader.add({
      source: createSource("resume-me", 50),
    });
    firstUploader.start();

    await waitFor(() => firstUpload.status === "failed");
    expect(uploadedPartNumbers).toEqual([
      1,
      2,
    ]);

    const stored = await store.get("resume-me");
    expect(stored?.completedPartNumbers).toEqual([
      1,
      2,
    ]);
    expect(stored?.providerUploadId).toBe("resume-upload-1");

    const resumingProvider: StorageProvider = {
      abort: async () => undefined,
      complete: async (): Promise<ProviderCompleteResult> => ({
        etag: "final-etag",
      }),
      create: async (): Promise<ProviderCreateResult> => {
        throw new Error("create should never be called again on resume");
      },
      resume: async (_fileId, providerUploadId) => ({
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
        providerUploadId,
      }),
      uploadPart: async (_id, chunk): Promise<ProviderPartResult> => {
        uploadedPartNumbers.push(chunk.partNumber);
        return {
          etag: `etag-${chunk.partNumber}`,
          partNumber: chunk.partNumber,
          sizeBytes: chunk.size,
        };
      },
    };

    const secondUploader = createUploader({
      chunkConcurrency: 1,
      chunkSize: 10,
      provider: resumingProvider,
      store,
    });
    const secondUpload = secondUploader.add({
      source: createSource("resume-me", 50),
    });
    secondUploader.start();

    await waitFor(() => secondUpload.status === "completed");
    expect(uploadedPartNumbers).toEqual([
      1,
      2,
      3,
      4,
      5,
    ]);
    await expect(store.get("resume-me")).resolves.toBeUndefined();
  });
});
