---
"@upflowi/core": minor
"@upflowi/provider-http": minor
---

Wire up the previously-unused `ChecksumComputer` abstraction: `createUploader`/`UploadOptions` now accept an optional `checksum`, threaded through to `StorageProviderContext.checksum` for every multipart part. A provider that wants per-part integrity checking reads it and attaches the computed value however its backend expects.

`@upflowi/provider-http` is the reference implementation: when `context.checksum` is set, it computes the checksum over the part body and sends it as `x-upflowi-checksum-algorithm`/`x-upflowi-checksum-value` headers.
