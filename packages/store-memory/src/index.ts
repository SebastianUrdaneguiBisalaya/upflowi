import type { StoredUploadRecord, UploadStore } from "@upflowi/core";

/**
 * Creates an {@link UploadStore} backed by a plain in-memory `Map`.
 *
 * Resume state lives only as long as this store instance — a page reload, a process restart, or
 * creating a new store all lose it. Reach for `@upflowi/store-indexeddb` (browser) or your own
 * `UploadStore` (e.g. a thin client over your backend, backed by Redis or a database) when resume
 * state needs to survive that. This one is meant for tests, short-lived Node scripts, or any case
 * where losing in-flight resume state on restart is acceptable.
 *
 * @example
 * ```ts
 * const uploader = createUploader({ provider, transport, store: createMemoryStore() });
 * ```
 */
export function createMemoryStore(): UploadStore {
  const records = new Map<string, StoredUploadRecord>();

  return {
    async delete(fileId) {
      records.delete(fileId);
    },
    async get(fileId) {
      return records.get(fileId);
    },
    async set(fileId, record) {
      records.set(fileId, record);
    },
  };
}
