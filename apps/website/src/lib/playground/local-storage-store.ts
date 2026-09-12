"use client";

import type { StoredUploadRecord, UploadStore } from "@upflowi/core";

const KEY_PREFIX = "upflowi:playground:upload:";

/**
 * A real `UploadStore` (get/set/delete — three methods, per the SDK's own README) backed by
 * `localStorage`. Powers the playground's "reload the page mid-upload, then resume" demo: a
 * crashed or reloaded tab resumes the same upload, and completed parts are never re-sent.
 */
export function createLocalStorageStore(): UploadStore {
  return {
    async delete(fileId) {
      window.localStorage.removeItem(KEY_PREFIX + fileId);
    },
    async get(fileId) {
      const raw = window.localStorage.getItem(KEY_PREFIX + fileId);
      if (raw === null) {
        return undefined;
      }
      try {
        return JSON.parse(raw) as StoredUploadRecord;
      } catch {
        return undefined;
      }
    },
    async set(fileId, record) {
      window.localStorage.setItem(KEY_PREFIX + fileId, JSON.stringify(record));
    },
  };
}
