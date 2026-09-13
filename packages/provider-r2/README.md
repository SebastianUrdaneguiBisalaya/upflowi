# @upflowi/provider-r2

A `StorageProvider` for [upflowi](https://github.com/SebastianUrdaneguiBisalaya/upflowi) that drives **Cloudflare R2 multipart uploads** entirely through presigned URLs your own backend generates. This package never receives or stores R2/S3 credentials — it only calls the `getPresignedUrl` callback you provide.

```bash
pnpm add @upflowi/core @upflowi/transport-fetch @upflowi/provider-r2
```

```ts
import { createUploader } from "@upflowi/core";
import { createFetchTransport } from "@upflowi/transport-fetch";
import { createR2Provider } from "@upflowi/provider-r2";

const provider = createR2Provider({
  getPresignedUrl: (operation) => backendClient.getR2PresignedUrl(operation),
});

const uploader = createUploader({
  concurrency: 3,
  chunkSize: 8 * 1024 * 1024, // 8 MiB parts
  transport: createFetchTransport(),
  provider,
});
```

## How it works

`createR2Provider` calls your `getPresignedUrl` callback once per R2 operation the multipart lifecycle needs (`create`, `uploadPart`, `complete`, `abort`, `listParts`) — the same client code as `@upflowi/provider-s3`, so swapping between S3 and R2 only changes how your backend signs URLs.

## R2 vs. S3 differences (handled inside this package, not core)

R2's S3-compatible API does **not** implement S3's `x-amz-checksum-*`/`ChecksumAlgorithm` additional-checksums feature. Only `"MD5"` (via `Content-MD5`) is supported here; configuring `"SHA-256"` or `"CRC32"` against `@upflowi/provider-r2` throws `UploadValidationError` immediately rather than silently doing nothing. See the [monorepo README's checksum table](https://github.com/SebastianUrdaneguiBisalaya/upflowi#per-part-integrity-checking-optional) for the full comparison across providers.

## Peer dependency

Requires `@upflowi/core` as a peer dependency — install both.

## Documentation

See the [monorepo README](https://github.com/SebastianUrdaneguiBisalaya/upflowi#readme) for full usage examples and [`AGENTS.md`](https://github.com/SebastianUrdaneguiBisalaya/upflowi/blob/main/AGENTS.md) for the architecture.

## License

[ISC](https://github.com/SebastianUrdaneguiBisalaya/upflowi/blob/main/LICENSE)
