import { describe, expect, it, vi } from "vitest";
import {
  AbortError,
  HttpError,
  NetworkError,
  UploadValidationError,
} from "../src/errors.js";
import type { RetryConfig } from "../src/retry.js";
import {
  computeBackoffDelay,
  delay,
  evaluateRetry,
  isRetryableError,
} from "../src/retry.js";

const baseConfig: RetryConfig = {
  backoffFactor: 2,
  initialDelayMs: 100,
  jitter: false,
  maxAttempts: 3,
  maxDelayMs: 10_000,
};

describe("isRetryableError", () => {
  it("treats a network error as retryable", () => {
    expect(isRetryableError(new NetworkError("offline"))).toBe(true);
  });

  it("treats a 5xx HTTP error as retryable and a 4xx (non-429) as permanent", () => {
    expect(isRetryableError(new HttpError(503, "unavailable"))).toBe(true);
    expect(isRetryableError(new HttpError(429, "rate limited"))).toBe(true);
    expect(isRetryableError(new HttpError(403, "forbidden"))).toBe(false);
  });

  it("never treats an AbortError as retryable", () => {
    expect(isRetryableError(new AbortError())).toBe(false);
  });

  it("treats a validation error as permanent", () => {
    expect(isRetryableError(new UploadValidationError("bad input"))).toBe(
      false,
    );
  });
});

describe("computeBackoffDelay", () => {
  it("grows exponentially by backoffFactor, capped at maxDelayMs", () => {
    expect(computeBackoffDelay(baseConfig, 1)).toBe(100);
    expect(computeBackoffDelay(baseConfig, 2)).toBe(200);
    expect(computeBackoffDelay(baseConfig, 3)).toBe(400);
    expect(
      computeBackoffDelay(
        {
          ...baseConfig,
          maxDelayMs: 150,
        },
        3,
      ),
    ).toBe(150);
  });

  it("applies jitter within [50%, 100%] of the computed delay", () => {
    const config = {
      ...baseConfig,
      jitter: true,
    };
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const value = computeBackoffDelay(config, 2);
      expect(value).toBeGreaterThanOrEqual(100);
      expect(value).toBeLessThanOrEqual(200);
    }
  });
});

describe("evaluateRetry", () => {
  it("retries while within the attempt budget for a retryable error", () => {
    const decision = evaluateRetry(baseConfig, new NetworkError("offline"), 1);
    expect(decision.shouldRetry).toBe(true);
    expect(decision.delayMs).toBeGreaterThan(0);
  });

  it("stops once maxAttempts is reached", () => {
    const decision = evaluateRetry(baseConfig, new NetworkError("offline"), 3);
    expect(decision.shouldRetry).toBe(false);
    expect(decision.delayMs).toBe(0);
  });

  it("never retries an AbortError, even with a permissive custom shouldRetry", () => {
    const config: RetryConfig = {
      ...baseConfig,
      shouldRetry: () => true,
    };
    const decision = evaluateRetry(config, new AbortError(), 1);
    expect(decision.shouldRetry).toBe(false);
  });

  it("lets a custom shouldRetry override the default classification", () => {
    const permissive: RetryConfig = {
      ...baseConfig,
      shouldRetry: () => true,
    };
    const strict: RetryConfig = {
      ...baseConfig,
      shouldRetry: () => false,
    };

    expect(
      evaluateRetry(permissive, new HttpError(403, "forbidden"), 1).shouldRetry,
    ).toBe(true);
    expect(
      evaluateRetry(strict, new NetworkError("offline"), 1).shouldRetry,
    ).toBe(false);
  });
});

describe("delay", () => {
  it("resolves after the given time", async () => {
    vi.useFakeTimers();
    const promise = delay(1000);
    vi.advanceTimersByTime(1000);
    await expect(promise).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it("rejects immediately with AbortError when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(delay(1000, controller.signal)).rejects.toBeInstanceOf(
      AbortError,
    );
  });

  it("rejects with AbortError if the signal fires before the delay elapses", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const promise = delay(1000, controller.signal);
    controller.abort();
    await expect(promise).rejects.toBeInstanceOf(AbortError);
    vi.useRealTimers();
  });
});
