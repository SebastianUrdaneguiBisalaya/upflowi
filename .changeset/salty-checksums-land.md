---
"@upflowi/core": minor
"@upflowi/provider-s3": minor
"@upflowi/provider-r2": minor
---

Wire up per-part checksum support (`checksum` on `createUploader`/`UploadOptions`) into `@upflowi/provider-s3` and `@upflowi/provider-r2`, matching what each backend actually supports (verified against AWS's and Cloudflare's own docs — the two are not symmetric):

- `@upflowi/provider-s3` implements S3's real "additional checksums" feature for `"SHA-256"`/`"CRC32"`: the algorithm is declared on `create()`'s presigned-URL request (a new optional `checksumAlgorithm` field on `S3PresignedUrlOperation`'s `"create"` variant, for your backend to pass to `CreateMultipartUploadCommand`), each part's checksum is sent as an `x-amz-checksum-*` header and returned in `ProviderPartResult.checksum` (a new optional field), and `complete()` echoes it back into the `CompleteMultipartUpload` XML body as required by S3. `"MD5"` uses the older, simpler `Content-MD5` header instead, which needs no declaration.
- `@upflowi/provider-r2` only supports `"MD5"` via `Content-MD5` — R2 does not implement S3's `x-amz-checksum-*`/`ChecksumAlgorithm` feature at all. Configuring `"SHA-256"`/`"CRC32"` against `provider-r2` now throws `UploadValidationError` immediately instead of silently sending a header R2 ignores.
- `@upflowi/core`'s `ProviderPartResult` gains an optional `checksum?: string` field so a provider can carry a per-part checksum value from `uploadPart`/`resume` through to `complete` — core never reads or interprets it.
