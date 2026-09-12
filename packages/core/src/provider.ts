import type { ChecksumComputer } from "./checksum.js";
import type { ChunkRange } from "./chunking.js";
import type { TransportRequestBody, UploadTransport } from "./transport.js";

/** The result of {@link StorageProvider.create}. */
export type ProviderCreateResult = {
  readonly providerUploadId: string;
};

/** The result of successfully transferring one part with {@link StorageProvider.uploadPart}. */
export type ProviderPartResult = {
  readonly partNumber: number;
  readonly etag: string;
  readonly sizeBytes: number;
  /**
   * The value a provider computed via `context.checksum` for this part, in whatever format that
   * provider's backend expects back at {@link StorageProvider.complete} time (e.g. S3's additional
   * checksums must be echoed into the `CompleteMultipartUpload` request body, per part). Opaque to
   * core — it only carries this value from `uploadPart`/`resume` through to `complete` unchanged.
   */
  readonly checksum?: string;
};

/** The result of {@link StorageProvider.complete}. */
export type ProviderCompleteResult = {
  readonly location?: string;
  readonly etag?: string;
};

/** The state {@link StorageProvider.resume} needs to skip parts a previous attempt already completed. */
export type ProviderResumeState = {
  readonly providerUploadId: string;
  readonly completedParts: readonly ProviderPartResult[];
};

/** Context passed to every {@link StorageProvider} operation. */
export type StorageProviderContext = {
  /** The upload this operation belongs to. Every backend needs this to address the right object. */
  readonly fileId: string;
  /** The transport the provider may use to perform its own HTTP calls, when it needs one. */
  readonly transport?: UploadTransport;
  readonly signal?: AbortSignal;
  /**
   * Set when the consumer configured a {@link ChecksumComputer} (uploader-level or per-file). A
   * provider that wants per-part integrity checking calls `checksum.compute(bytes)` on the part
   * body inside its own {@link StorageProvider.uploadPart} and attaches the result however its
   * backend expects (a request header, most commonly) — core only threads the computer through,
   * it never calls it itself, since the header name/format is entirely backend-specific.
   */
  readonly checksum?: ChecksumComputer;
};

/**
 * What operations exist on a given storage backend, and how it maps them onto one or more
 * transport calls. Core ships no implementation: `@upflowi/provider-s3` and `@upflowi/provider-r2`
 * provide concrete providers implementing this interface against presigned URLs supplied by the
 * consumer's own backend — this type never receives or stores provider credentials directly.
 */
export type StorageProvider = {
  create(
    fileId: string,
    context: StorageProviderContext,
  ): Promise<ProviderCreateResult>;
  uploadPart(
    providerUploadId: string,
    chunk: ChunkRange,
    body: TransportRequestBody,
    context: StorageProviderContext,
  ): Promise<ProviderPartResult>;
  complete(
    providerUploadId: string,
    parts: readonly ProviderPartResult[],
    context: StorageProviderContext,
  ): Promise<ProviderCompleteResult>;
  abort(
    providerUploadId: string,
    context: StorageProviderContext,
  ): Promise<void>;
  /**
   * Returns previously completed parts for the multipart upload identified by `providerUploadId`
   * (as returned by an earlier {@link StorageProvider.create} and persisted via an
   * {@link UploadStore}), or `undefined` when nothing can be resumed (e.g. the backend reports the
   * upload no longer exists).
   */
  resume(
    fileId: string,
    providerUploadId: string,
    context: StorageProviderContext,
  ): Promise<ProviderResumeState | undefined>;
};
