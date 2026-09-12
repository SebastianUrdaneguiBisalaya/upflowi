# @upflowi/provider-s3

A `StorageProvider` for [upflowi](https://github.com/SebastianUrdaneguiBisalaya/upflowi) that drives **AWS S3 multipart uploads** entirely through presigned URLs your own backend generates. This package never receives or stores AWS credentials — it only calls the `getPresignedUrl` callback you provide.

```bash
pnpm add @upflowi/core @upflowi/transport-fetch @upflowi/provider-s3
```

```ts
import { createUploader } from "@upflowi/core";
import { createFetchTransport } from "@upflowi/transport-fetch";
import { createS3Provider } from "@upflowi/provider-s3";

const provider = createS3Provider({
  getPresignedUrl: (operation) => backendClient.getS3PresignedUrl(operation),
});

const uploader = createUploader({
  concurrency: 3,
  chunkSize: 8 * 1024 * 1024, // 8 MiB parts
  transport: createFetchTransport(),
  provider,
});
```

## How it works

`createS3Provider` calls your `getPresignedUrl` callback once per S3 operation the multipart lifecycle needs (`create`, `uploadPart`, `complete`, `abort`, `listParts`) and does the rest — signing, XML parsing, and mapping the result onto `StorageProvider`. Your backend's only job is to sign a `CreateMultipartUploadCommand`/`UploadPartCommand`/`CompleteMultipartUploadCommand`/`AbortMultipartUploadCommand`/`ListPartsCommand` and return the URL — it never needs the AWS SDK client itself to touch the request body.

`listParts` support (via `StorageProvider.resume`) lets a paired `UploadStore` (`@upflowi/store-indexeddb` or `@upflowi/store-memory`) resume a multipart upload after a reload or crash without re-transferring parts S3 already has.

## Checksums

Supports `"SHA-256"`, `"CRC32"`, and `"MD5"` via `@upflowi/core`'s optional `checksum` config — `compute()` must return **base64**. SHA-256/CRC32 use S3's additional-checksums feature (`x-amz-checksum-*`); MD5 uses the older `Content-MD5` header. See the [monorepo README's checksum table](https://github.com/SebastianUrdaneguiBisalaya/upflowi#per-part-integrity-checking-optional) for the exact wiring, including the `ChecksumAlgorithm` your backend must pass to `CreateMultipartUploadCommand`.

## Peer dependency

Requires `@upflowi/core` as a peer dependency — install both.

## Documentation

See the [monorepo README](https://github.com/SebastianUrdaneguiBisalaya/upflowi#readme) for the full multipart S3 example (client + backend) and [`AGENTS.md`](https://github.com/SebastianUrdaneguiBisalaya/upflowi/blob/main/AGENTS.md) for the architecture.

## License

[ISC](https://github.com/SebastianUrdaneguiBisalaya/upflowi/blob/main/LICENSE)
