import { describe, expect, it } from "vitest";
import {
  AbortError,
  HttpError,
  NetworkError,
  ProviderError,
  RetryExhaustedError,
  toUploadError,
  UploadError,
  UploadValidationError,
} from "../src/errors.js";

describe("upload errors", () => {
  it("every subclass is an instanceof both itself and the shared UploadError base", () => {
    expect(new NetworkError("offline")).toBeInstanceOf(UploadError);
    expect(new HttpError(500, "boom")).toBeInstanceOf(UploadError);
    expect(new AbortError()).toBeInstanceOf(UploadError);
    expect(
      new RetryExhaustedError("gave up", {
        attempts: 3,
      }),
    ).toBeInstanceOf(UploadError);
    expect(new UploadValidationError("bad")).toBeInstanceOf(UploadError);
    expect(new ProviderError("provider said no")).toBeInstanceOf(UploadError);
  });

  it("carries code, retryable, fileId and partNumber", () => {
    const error = new HttpError(503, "unavailable", {
      fileId: "file-1",
      partNumber: 4,
    });
    expect(error.code).toBe("HTTP_ERROR");
    expect(error.retryable).toBe(true);
    expect(error.fileId).toBe("file-1");
    expect(error.partNumber).toBe(4);
    expect(error.status).toBe(503);
  });

  it("classifies 4xx (non-429) HTTP errors as permanent", () => {
    expect(new HttpError(400, "bad request").retryable).toBe(false);
    expect(new HttpError(429, "rate limited").retryable).toBe(true);
  });

  it("RetryExhaustedError records the number of attempts made", () => {
    const error = new RetryExhaustedError("all attempts failed", {
      attempts: 5,
    });
    expect(error.attempts).toBe(5);
    expect(error.retryable).toBe(false);
  });

  it("wraps the original error as cause", () => {
    const original = new Error("socket hang up");
    const error = new NetworkError("network failure", {
      cause: original,
    });
    expect(error.cause).toBe(original);
  });

  describe("toUploadError", () => {
    it("returns an UploadError unchanged", () => {
      const original = new AbortError();
      expect(toUploadError(original)).toBe(original);
    });

    it("wraps a plain Error into an UploadValidationError with it as cause", () => {
      const original = new Error("unexpected");
      const wrapped = toUploadError(original);
      expect(wrapped).toBeInstanceOf(UploadValidationError);
      expect(wrapped.cause).toBe(original);
    });
  });
});
