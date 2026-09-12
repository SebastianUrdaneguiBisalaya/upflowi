import { describe, expect, it } from "vitest";
import type { ChecksumComputer } from "../src/checksum.js";
import type {
  ProviderCompleteResult,
  ProviderCreateResult,
  ProviderPartResult,
  StorageProvider,
  StorageProviderContext,
} from "../src/provider.js";
import type { UploadSource } from "../src/upload.js";
import { createUploader } from "../src/uploader.js";

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

function trackingChecksumComputer(): ChecksumComputer & {
  readonly calls: number;
} {
  let calls = 0;
  return {
    algorithm: "SHA-256",
    get calls() {
      return calls;
    },
    compute: async (data: ArrayBuffer) => {
      calls += 1;
      return `sha256:${data.byteLength}`;
    },
  };
}

describe("ChecksumComputer plumbing", () => {
  it("core never calls the checksum computer itself — only threads it through context", async () => {
    const checksum = trackingChecksumComputer();
    const seenContexts: StorageProviderContext[] = [];

    const provider: StorageProvider = {
      abort: async () => undefined,
      complete: async (): Promise<ProviderCompleteResult> => ({}),
      create: async (): Promise<ProviderCreateResult> => ({
        providerUploadId: "upload-1",
      }),
      resume: async () => undefined,
      uploadPart: async (
        _id,
        chunk,
        _body,
        context,
      ): Promise<ProviderPartResult> => {
        seenContexts.push(context);
        return {
          etag: `etag-${chunk.partNumber}`,
          partNumber: chunk.partNumber,
          sizeBytes: chunk.size,
        };
      },
    };

    const uploader = createUploader({
      checksum,
      provider,
    });
    const upload = uploader.add({
      source: createSource("file-1", 10),
    });
    uploader.start();

    await waitFor(() => upload.status === "completed");
    expect(seenContexts).toHaveLength(1);
    expect(seenContexts[0]?.checksum).toBe(checksum);
    expect(checksum.calls).toBe(0);
  });

  it("a per-file checksum computer in UploadOptions overrides the uploader-level one", async () => {
    const uploaderLevel = trackingChecksumComputer();
    const perFile = trackingChecksumComputer();
    let seenChecksum: ChecksumComputer | undefined;

    const provider: StorageProvider = {
      abort: async () => undefined,
      complete: async (): Promise<ProviderCompleteResult> => ({}),
      create: async (): Promise<ProviderCreateResult> => ({
        providerUploadId: "upload-1",
      }),
      resume: async () => undefined,
      uploadPart: async (
        _id,
        chunk,
        _body,
        context,
      ): Promise<ProviderPartResult> => {
        seenChecksum = context.checksum;
        return {
          etag: `etag-${chunk.partNumber}`,
          partNumber: chunk.partNumber,
          sizeBytes: chunk.size,
        };
      },
    };

    const uploader = createUploader({
      checksum: uploaderLevel,
      provider,
    });
    const upload = uploader.add({
      options: {
        checksum: perFile,
      },
      source: createSource("file-1", 10),
    });
    uploader.start();

    await waitFor(() => upload.status === "completed");
    expect(seenChecksum).toBe(perFile);
  });

  it("context.checksum is undefined when no checksum computer is configured", async () => {
    let seenChecksum: ChecksumComputer | undefined = trackingChecksumComputer();

    const provider: StorageProvider = {
      abort: async () => undefined,
      complete: async (): Promise<ProviderCompleteResult> => ({}),
      create: async (): Promise<ProviderCreateResult> => ({
        providerUploadId: "upload-1",
      }),
      resume: async () => undefined,
      uploadPart: async (
        _id,
        chunk,
        _body,
        context,
      ): Promise<ProviderPartResult> => {
        seenChecksum = context.checksum;
        return {
          etag: `etag-${chunk.partNumber}`,
          partNumber: chunk.partNumber,
          sizeBytes: chunk.size,
        };
      },
    };

    const uploader = createUploader({
      provider,
    });
    const upload = uploader.add({
      source: createSource("file-1", 10),
    });
    uploader.start();

    await waitFor(() => upload.status === "completed");
    expect(seenChecksum).toBeUndefined();
  });
});
