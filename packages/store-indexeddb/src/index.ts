import type { StoredUploadRecord, UploadStore } from "@upflowi/core";
import { UploadValidationError } from "@upflowi/core";

/** Configuration accepted by {@link createIndexedDbStore}. */
export type IndexedDbStoreConfig = {
  /** Name of the IndexedDB database. Defaults to `"upflowi"`. */
  dbName?: string;
  /** Name of the object store (table) inside the database. Defaults to `"uploads"`. */
  storeName?: string;
};

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function openDatabase(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ?? new Error("Failed to open the IndexedDB database."),
      );
  });
}

/**
 * Creates a browser {@link UploadStore} backed by IndexedDB: resume state survives a page reload
 * or a crashed tab, unlike `@upflowi/store-memory`.
 *
 * Requires a global `indexedDB` (any modern browser). Throws {@link UploadValidationError}
 * immediately if called somewhere `indexedDB` isn't available (e.g. a Node.js server, or an older
 * browser) instead of failing later on the first `get`/`set`/`delete` call.
 *
 * @example
 * ```ts
 * const uploader = createUploader({ provider, transport, store: createIndexedDbStore() });
 * ```
 */
export function createIndexedDbStore(
  config: IndexedDbStoreConfig = {},
): UploadStore {
  if (typeof indexedDB === "undefined") {
    throw new UploadValidationError(
      "@upflowi/store-indexeddb requires a global `indexedDB` (a browser environment). Use @upflowi/store-memory or your own UploadStore outside the browser.",
    );
  }

  const dbName = config.dbName ?? "upflowi";
  const storeName = config.storeName ?? "uploads";
  let dbPromise: Promise<IDBDatabase> | undefined;

  function getDb(): Promise<IDBDatabase> {
    dbPromise ??= openDatabase(dbName, storeName);
    return dbPromise;
  }

  return {
    async delete(fileId) {
      const db = await getDb();
      const tx = db.transaction(storeName, "readwrite");
      await requestToPromise(tx.objectStore(storeName).delete(fileId));
    },
    async get(fileId) {
      const db = await getDb();
      const tx = db.transaction(storeName, "readonly");
      const result = await requestToPromise<StoredUploadRecord | undefined>(
        tx.objectStore(storeName).get(fileId),
      );
      return result;
    },
    async set(fileId, record) {
      const db = await getDb();
      const tx = db.transaction(storeName, "readwrite");
      await requestToPromise(tx.objectStore(storeName).put(record, fileId));
    },
  };
}
