import { AbortError, type UploadError } from "./errors.js";

/** Retry/backoff policy applied to a failed network operation (a whole-file upload or a single part). */
export type RetryConfig = {
  /** Maximum number of attempts, including the first one. */
  maxAttempts: number;
  /** Base delay, in milliseconds, before the first retry. */
  initialDelayMs: number;
  /** Upper bound, in milliseconds, the computed delay is capped at. */
  maxDelayMs: number;
  /** Multiplier applied to the delay after each failed attempt. */
  backoffFactor: number;
  /** Whether to randomize the computed delay to avoid retry storms across many concurrent parts. */
  jitter: boolean;
  /**
   * Overrides the default retryable/permanent classification. When omitted, an error retries iff
   * `error.retryable` is `true` (and it is never an {@link AbortError}, regardless of this override).
   */
  shouldRetry?: (error: UploadError, attempt: number) => boolean;
};

/** The retry policy used by {@link createUploader} when the consumer does not supply one. */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  backoffFactor: 2,
  initialDelayMs: 500,
  jitter: true,
  maxAttempts: 3,
  maxDelayMs: 30_000,
};

/** The outcome of evaluating a {@link RetryConfig} against a failed attempt. */
export type RetryDecision = {
  readonly shouldRetry: boolean;
  /** Milliseconds to wait before the next attempt. Only meaningful when `shouldRetry` is `true`. */
  readonly delayMs: number;
};

/** Whether `error` is retryable under the default classification (ignores a custom `shouldRetry`). */
export function isRetryableError(error: UploadError): boolean {
  if (error instanceof AbortError) {
    return false;
  }
  return error.retryable;
}

/** Computes the backoff delay for the given (1-indexed) attempt number under `config`. */
export function computeBackoffDelay(
  config: RetryConfig,
  attempt: number,
): number {
  const exponential =
    config.initialDelayMs * config.backoffFactor ** (attempt - 1);
  const capped = Math.min(exponential, config.maxDelayMs);
  if (!config.jitter) {
    return capped;
  }
  return Math.round(capped * (0.5 + Math.random() * 0.5));
}

/** Decides whether a failed `attempt` should be retried under `config`, and after how long. */
export function evaluateRetry(
  config: RetryConfig,
  error: UploadError,
  attempt: number,
): RetryDecision {
  if (error instanceof AbortError) {
    return {
      delayMs: 0,
      shouldRetry: false,
    };
  }
  const withinAttemptBudget = attempt < config.maxAttempts;
  const permittedByPolicy = config.shouldRetry
    ? config.shouldRetry(error, attempt)
    : isRetryableError(error);
  const shouldRetryNow = withinAttemptBudget && permittedByPolicy;
  return {
    delayMs: shouldRetryNow ? computeBackoffDelay(config, attempt) : 0,
    shouldRetry: shouldRetryNow,
  };
}

/** Resolves after `ms` milliseconds, or rejects with {@link AbortError} if `signal` fires first. */
export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError());
      return;
    }

    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new AbortError());
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal?.addEventListener("abort", onAbort, {
      once: true,
    });
  });
}
