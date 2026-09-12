import "fake-indexeddb/auto";
import type {
  ProviderCompleteResult,
  ProviderCreateResult,
  ProviderPartResult,
  StorageProvider,
  UploadSource,
} from "@upflowi/core";
import { createUploader } from "@upflowi/core";
import { describe, expect, it } from "vitest";
import { createIndexedDbStore } from "../src/index.js";

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
 * End-to-end: a real @upflowi/core Uploader, paired with a real createIndexedDbStore(), survives
 * a mid-transfer failure and resumes — a second, independent store instance pointed at the same
 * IndexedDB database (simulating a reloaded page) picks up the persisted progress and skips
 * already-completed parts, exercising the store through the actual resume code path.
 */
describe("createIndexedDbStore + createUploader — resume integration", () => {
  it("persists progress across a simulated page reload and skips already-completed parts on resume", async () => {
    const dbName = "upflowi-integration-test";
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
      // Simulates the tab that started the upload — it's about to "crash".
      store: createIndexedDbStore({
        dbName,
      }),
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

    // A brand-new store instance pointed at the same database — simulates reopening the page
    // after a reload, where nothing survives in memory except what IndexedDB itself persisted.
    const secondUploader = createUploader({
      chunkConcurrency: 1,
      chunkSize: 10,
      provider: resumingProvider,
      store: createIndexedDbStore({
        dbName,
      }),
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
  });
});
