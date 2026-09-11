// @upflowi/core — headless, provider-agnostic file transfer engine.
//
// This is the only file that decides the package's public surface (see AGENTS.md, section 1).
// Anything not re-exported here can be freely refactored without being a breaking change.

export type { ChecksumAlgorithm, ChecksumComputer } from "./checksum.js";
export type { ChunkPlan, ChunkRange } from "./chunking.js";
export type {
  ProviderErrorOptions,
  RetryExhaustedErrorOptions,
  UploadErrorCode,
  UploadErrorOptions,
} from "./errors.js";
export {
  AbortError,
  HttpError,
  NetworkError,
  ProviderError,
  RetryExhaustedError,
  UploadError,
  UploadValidationError,
} from "./errors.js";
export type {
  EventListener,
  EventUnsubscribe,
  UploadCancelledEvent,
  UploadCompletedEvent,
  UploadEventMap,
  UploaderEventMap,
  UploadFailedEvent,
  UploadPausedEvent,
  UploadQueuedEvent,
  UploadResumedEvent,
  UploadRetryEvent,
  UploadStartedEvent,
} from "./events.js";
export type { FileProgress, GlobalProgress } from "./progress.js";
export type {
  ProviderCompleteResult,
  ProviderCreateResult,
  ProviderPartResult,
  ProviderResumeState,
  StorageProvider,
  StorageProviderContext,
} from "./provider.js";
export type { RetryConfig, RetryDecision } from "./retry.js";
export { DEFAULT_RETRY_CONFIG } from "./retry.js";
export type { UploadStatus } from "./state-machine.js";
export type { StoredUploadRecord, UploadStore } from "./store.js";
export type {
  TransportMethod,
  TransportProgressEvent,
  TransportRequest,
  TransportRequestBody,
  TransportResponse,
  UploadTransport,
} from "./transport.js";
export type {
  Upload,
  UploadOptions,
  UploadResult,
  UploadSource,
} from "./upload.js";
export type { AddFileInput, Uploader, UploaderConfig } from "./uploader.js";
export { createUploader } from "./uploader.js";
