/**
 * Machine-readable discriminant carried by every {@link UploadError}. Prefer
 * `instanceof` checks against the concrete subclasses below; use `code` only
 * when serializing an error across a boundary (e.g. logging, IPC).
 */
export type UploadErrorCode =
  | "NETWORK_ERROR"
  | "HTTP_ERROR"
  | "ABORTED"
  | "RETRY_EXHAUSTED"
  | "VALIDATION_ERROR"
  | "PROVIDER_ERROR";

/** Common constructor options shared by every {@link UploadError} subclass. */
export type UploadErrorOptions = {
  /** The underlying error that caused this one, if any. */
  cause?: Error;
  /** The upload this error is associated with, if known. */
  fileId?: string;
  /** The multipart part number this error is associated with, if any. */
  partNumber?: number;
};

/**
 * Base type every upload error extends. Never thrown directly — throw one of
 * the concrete subclasses below so consumers can `instanceof` against the
 * specific failure they want to handle.
 *
 * This is the sole use of `class` in this package: JavaScript's exception
 * model (correct prototype chain for `instanceof`, native stack traces)
 * requires it, unlike the rest of the SDK's domain logic, which uses plain
 * factory functions per this project's no-class convention.
 */
export class UploadError extends Error {
  readonly code: UploadErrorCode;
  readonly retryable: boolean;
  readonly fileId: string | undefined;
  readonly partNumber: number | undefined;

  constructor(
    code: UploadErrorCode,
    message: string,
    retryable: boolean,
    options: UploadErrorOptions = {},
  ) {
    super(
      message,
      options.cause
        ? {
            cause: options.cause,
          }
        : undefined,
    );
    this.name = new.target.name;
    this.code = code;
    this.retryable = retryable;
    this.fileId = options.fileId;
    this.partNumber = options.partNumber;
  }
}

/** A transport-layer failure where no HTTP response was received (DNS, TCP reset, offline). Always retryable. */
export class NetworkError extends UploadError {
  constructor(message: string, options: UploadErrorOptions = {}) {
    super("NETWORK_ERROR", message, true, options);
  }
}

/** A non-2xx HTTP response was received. Retryable for 5xx and 429, permanent otherwise. */
export class HttpError extends UploadError {
  readonly status: number;

  constructor(
    status: number,
    message: string,
    options: UploadErrorOptions = {},
  ) {
    super("HTTP_ERROR", message, status >= 500 || status === 429, options);
    this.status = status;
  }
}

/** Raised when an {@link AbortSignal} fires. Never retryable, regardless of a custom `shouldRetry`. */
export class AbortError extends UploadError {
  constructor(
    message = "Upload was aborted",
    options: UploadErrorOptions = {},
  ) {
    super("ABORTED", message, false, options);
  }
}

/** Options for {@link RetryExhaustedError}. */
export type RetryExhaustedErrorOptions = UploadErrorOptions & {
  /** The total number of attempts made before giving up. */
  attempts: number;
};

/** All configured retry attempts failed; wraps the last underlying error as `cause`. */
export class RetryExhaustedError extends UploadError {
  readonly attempts: number;

  constructor(message: string, options: RetryExhaustedErrorOptions) {
    super("RETRY_EXHAUSTED", message, false, options);
    this.attempts = options.attempts;
  }
}

/** Bad input caught before any network call (invalid `chunkSize`, empty file list, illegal status transition, ...). */
export class UploadValidationError extends UploadError {
  constructor(message: string, options: UploadErrorOptions = {}) {
    super("VALIDATION_ERROR", message, false, options);
  }
}

/** Options for {@link ProviderError}. */
export type ProviderErrorOptions = UploadErrorOptions & {
  /** The storage provider's own error code, if it exposes one, kept for debugging. */
  providerCode?: string;
  /**
   * Whether this specific failure is transient and worth retrying (e.g. the provider's HTTP
   * response was a 5xx or 429). Defaults to `false` — a provider rejecting an operation is
   * presumed permanent (bad request shape, invalid part, expired upload id, ...) unless the
   * provider package can tell it apart from the underlying response status.
   */
  retryable?: boolean;
};

/** A storage provider rejected an operation (e.g. S3 failed to complete a multipart upload). */
export class ProviderError extends UploadError {
  readonly providerCode: string | undefined;

  constructor(message: string, options: ProviderErrorOptions = {}) {
    super("PROVIDER_ERROR", message, options.retryable ?? false, options);
    this.providerCode = options.providerCode;
  }
}

/** Normalizes an arbitrary caught {@link Error} into an {@link UploadError}, wrapping it as `cause` when needed. */
export function toUploadError(caught: Error): UploadError {
  if (caught instanceof UploadError) {
    return caught;
  }
  return new UploadValidationError(caught.message, {
    cause: caught,
  });
}
