---
"@upflowi/core": patch
"@upflowi/provider-http": patch
"@upflowi/provider-r2": patch
"@upflowi/provider-s3": patch
---

Fix `ProviderError` always being classified as non-retryable regardless of the underlying response status, which meant any failure a provider reported when a request wasn't 2xx — including a transient 503/429 from S3, R2, or a custom backend — skipped `retry.maxAttempts` entirely and failed after a single attempt.

`ProviderError` now accepts an optional `retryable` flag (still defaulting to `false` for provider-detected failures that aren't about a response status, e.g. a missing `UploadId` or `ETag`). `@upflowi/provider-http`, `@upflowi/provider-s3`, and `@upflowi/provider-r2` now set it to `true` for 5xx and 429 responses, matching the retry classification `HttpError` already used at the transport layer.
