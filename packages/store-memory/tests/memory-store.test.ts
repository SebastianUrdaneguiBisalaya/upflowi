import type { StoredUploadRecord } from "@upflowi/core";
import { describe, expect, it } from "vitest";
import { createMemoryStore } from "../src/index.js";

function record(
  overrides: Partial<StoredUploadRecord> = {},
): StoredUploadRecord {
  return {
    completedPartNumbers: [],
    fileId: "file-1",
    status: "uploading",
    totalBytes: 100,
    updatedAt: Date.now(),
    uploadedBytes: 0,
    ...overrides,
  };
}

describe("createMemoryStore", () => {
  it("returns undefined for a fileId that was never set", async () => {
    const store = createMemoryStore();
    await expect(store.get("missing")).resolves.toBeUndefined();
  });

  it("round-trips a record through set() and get()", async () => {
    const store = createMemoryStore();
    const stored = record({
      completedPartNumbers: [
        1,
        2,
      ],
      providerUploadId: "upload-123",
    });

    await store.set("file-1", stored);
    await expect(store.get("file-1")).resolves.toEqual(stored);
  });

  it("overwrites a previous record for the same fileId", async () => {
    const store = createMemoryStore();
    await store.set(
      "file-1",
      record({
        uploadedBytes: 10,
      }),
    );
    await store.set(
      "file-1",
      record({
        uploadedBytes: 50,
      }),
    );

    const current = await store.get("file-1");
    expect(current?.uploadedBytes).toBe(50);
  });

  it("keeps records for different fileIds independent", async () => {
    const store = createMemoryStore();
    await store.set(
      "file-1",
      record({
        fileId: "file-1",
      }),
    );
    await store.set(
      "file-2",
      record({
        fileId: "file-2",
      }),
    );

    await expect(store.get("file-1")).resolves.toMatchObject({
      fileId: "file-1",
    });
    await expect(store.get("file-2")).resolves.toMatchObject({
      fileId: "file-2",
    });
  });

  it("removes a record on delete(), leaving others untouched", async () => {
    const store = createMemoryStore();
    await store.set(
      "file-1",
      record({
        fileId: "file-1",
      }),
    );
    await store.set(
      "file-2",
      record({
        fileId: "file-2",
      }),
    );

    await store.delete("file-1");

    await expect(store.get("file-1")).resolves.toBeUndefined();
    await expect(store.get("file-2")).resolves.toMatchObject({
      fileId: "file-2",
    });
  });

  it("delete() on a fileId that was never set is a no-op", async () => {
    const store = createMemoryStore();
    await expect(store.delete("missing")).resolves.toBeUndefined();
  });

  it("is isolated per store instance", async () => {
    const storeA = createMemoryStore();
    const storeB = createMemoryStore();

    await storeA.set("file-1", record());

    await expect(storeA.get("file-1")).resolves.toBeDefined();
    await expect(storeB.get("file-1")).resolves.toBeUndefined();
  });
});
