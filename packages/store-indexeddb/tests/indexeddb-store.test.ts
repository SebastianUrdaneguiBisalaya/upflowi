import "fake-indexeddb/auto";
import type { StoredUploadRecord } from "@upflowi/core";
import { UploadValidationError } from "@upflowi/core";
import { describe, expect, it } from "vitest";
import { createIndexedDbStore } from "../src/index.js";

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

// fake-indexeddb keeps its data in-process; give every test its own database name so they can't
// see each other's records.
let dbCounter = 0;
function freshDbName(): string {
  dbCounter += 1;
  return `upflowi-test-${dbCounter}`;
}

describe("createIndexedDbStore", () => {
  it("returns undefined for a fileId that was never set", async () => {
    const store = createIndexedDbStore({
      dbName: freshDbName(),
    });
    await expect(store.get("missing")).resolves.toBeUndefined();
  });

  it("round-trips a record through set() and get()", async () => {
    const store = createIndexedDbStore({
      dbName: freshDbName(),
    });
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
    const store = createIndexedDbStore({
      dbName: freshDbName(),
    });
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
    const store = createIndexedDbStore({
      dbName: freshDbName(),
    });
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
    const store = createIndexedDbStore({
      dbName: freshDbName(),
    });
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
    const store = createIndexedDbStore({
      dbName: freshDbName(),
    });
    await expect(store.delete("missing")).resolves.toBeUndefined();
  });

  it("persists across store instances pointed at the same database (simulates a page reload)", async () => {
    const dbName = freshDbName();
    const before = createIndexedDbStore({
      dbName,
    });
    await before.set(
      "file-1",
      record({
        uploadedBytes: 42,
      }),
    );

    const after = createIndexedDbStore({
      dbName,
    });
    await expect(after.get("file-1")).resolves.toMatchObject({
      uploadedBytes: 42,
    });
  });

  it("keeps two different dbName/storeName configurations isolated", async () => {
    const storeA = createIndexedDbStore({
      dbName: freshDbName(),
      storeName: "uploadsA",
    });
    const storeB = createIndexedDbStore({
      dbName: freshDbName(),
      storeName: "uploadsB",
    });

    await storeA.set("file-1", record());
    await expect(storeB.get("file-1")).resolves.toBeUndefined();
  });

  it("throws UploadValidationError when indexedDB isn't available in this environment", async () => {
    const original = globalThis.indexedDB;
    // @ts-expect-error -- simulating a non-browser environment for this one test
    delete globalThis.indexedDB;

    try {
      expect(() => createIndexedDbStore()).toThrow(UploadValidationError);
    } finally {
      globalThis.indexedDB = original;
    }
  });
});
