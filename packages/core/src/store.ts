import type { UploadStatus } from "./state-machine.js";

/** The durable state needed to resume an interrupted upload without re-transferring completed parts. */
export type StoredUploadRecord = {
  readonly fileId: string;
  readonly status: UploadStatus;
  readonly totalBytes: number;
  readonly uploadedBytes: number;
  readonly completedPartNumbers: readonly number[];
  readonly providerUploadId?: string;
  readonly updatedAt: number;
};

/**
 * Persistence abstraction for upload state. Core ships no implementation — `@upflowi/store-memory`
 * and `@upflowi/store-indexeddb` provide concrete backends implementing this interface.
 */
export type UploadStore = {
  get(fileId: string): Promise<StoredUploadRecord | undefined>;
  set(fileId: string, record: StoredUploadRecord): Promise<void>;
  delete(fileId: string): Promise<void>;
};
