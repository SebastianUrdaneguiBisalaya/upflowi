# upflowi

**A headless, provider-agnostic file transfer engine for TypeScript and JavaScript.**

upflowi orchestrates uploads — concurrency, chunking, multipart, retries, progress, pause/resume, cancellation, and resumable persistence — without shipping a UI, without locking you into one storage backend, and without ever seeing your cloud credentials. It's built for the client (any browser, any frontend framework); the core has no browser/Node assumptions baked in, so it happens to run in Node.js too, but a backend's role stays limited to issuing presigned URLs — never running the uploader itself.

```bash
pnpm add @upflowi/core @upflowi/transport-fetch @upflowi/provider-s3
```

```ts
import { createUploader } from "@upflowi/core";
import { createFetchTransport } from "@upflowi/transport-fetch";
import { createS3Provider } from "@upflowi/provider-s3";

const uploader = createUploader({
  concurrency: 3,
  transport: createFetchTransport(),
  provider: createS3Provider({
    getPresignedUrl: (operation) => backendClient.getS3PresignedUrl(operation),
  }),
});

const upload = uploader.add({ source: mySource });
upload.on("progress", (progress) => console.log(`${progress.percent.toFixed(1)}%`));
uploader.start();
```

## Why upflowi

- **Headless.** No file picker, no dashboard, no React components — just the engine. Bring your own UI.
- **Runtime-agnostic core.** `@upflowi/core` has zero runtime dependencies and no browser/Node assumptions; everything environment-specific lives in a transport or provider package.
- **Provider-agnostic.** AWS S3, Cloudflare R2, your own VPS, or an API you haven't written yet — all through the same `StorageProvider` interface. Install only the provider(s) you actually use.
- **No credentials in your app bundle.** The S3 and R2 providers are driven entirely by presigned URLs your own backend generates; the SDK never touches an access key.
- **Resumable.** Multipart uploads survive a page reload or process crash when paired with an `UploadStore` — completed parts are never re-transferred.
- **Strictly typed.** `strict: true`, no `any` on the public surface, typed events, typed errors you can `instanceof` against.

## Packages

This is a `pnpm` workspace: install only what you need.

| Package                     | What it is                                                              |
| ---------------------------- | ------------------------------------------------------------------------ |
| `@upflowi/core`               | The engine: `createUploader`, queueing, scheduling, chunking, retries, progress, the `UploadTransport`/`StorageProvider`/`UploadStore` interfaces, and every error class. Zero runtime dependencies. |
| `@upflowi/transport-fetch`     | Moves bytes over the standard Fetch API. Works in browsers and Node.js 18+. |
| `@upflowi/transport-xhr`       | Moves bytes over `XMLHttpRequest`. Browser-only; use it when you need fine-grained, continuously-updating upload progress that Fetch cannot provide. |
| `@upflowi/provider-s3`         | Multipart uploads to AWS S3, driven by presigned URLs from your backend. |
| `@upflowi/provider-r2`         | Multipart uploads to Cloudflare R2, driven by presigned URLs from your backend. |
| `@upflowi/provider-http`       | Multipart uploads to **your own backend** (a VPS, an internal API — anything that isn't S3/R2-compatible) over a small JSON-over-HTTP convention you implement server-side. |
| `@upflowi/store-memory`        | In-memory `UploadStore` — resume state for the lifetime of the process. Good for tests and short-lived scripts. |
| `@upflowi/store-indexeddb`     | Browser `UploadStore` backed by IndexedDB — resume state survives a page reload or a crashed tab. |

You always need `@upflowi/core` plus one transport. A provider is only required for multipart transfers — a single small file can be uploaded with just a transport and a destination `url` (see below).

## Quick start

### The simplest possible upload (no provider, one request)

```ts
import { createUploader } from "@upflowi/core";
import { createFetchTransport } from "@upflowi/transport-fetch";

const uploader = createUploader({ transport: createFetchTransport() });

const upload = uploader.add({
  source: {
    fileId: "avatar.png",
    size: file.size,
    read: async () => file, // a Blob, ArrayBuffer, ArrayBufferView, or string
  },
  options: { url: "https://your-backend.example.com/uploads/avatar.png" },
});

upload.on("completed", ({ result }) => console.log("done:", result));
uploader.start();
```

### Multipart upload to S3 with presigned URLs

Your backend never hands its AWS credentials to the browser — it only signs URLs on request. `@upflowi/provider-s3` calls your `getPresignedUrl` callback once per S3 operation (`create`, `uploadPart`, `complete`, `abort`, `listParts`) and does the rest.

```ts
// client
import { createUploader } from "@upflowi/core";
import { createFetchTransport } from "@upflowi/transport-fetch";
import { createS3Provider } from "@upflowi/provider-s3";

const provider = createS3Provider({
  getPresignedUrl: async (operation) => {
    const response = await fetch("/api/s3-presign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(operation),
    });
    return response.json(); // { url, headers? }
  },
});

const uploader = createUploader({
  concurrency: 3,
  chunkSize: 8 * 1024 * 1024, // 8 MiB parts
  transport: createFetchTransport(),
  provider,
});

const upload = uploader.add({
  source: {
    fileId: file.name,
    size: file.size,
    read: async ({ start, end }) => file.slice(start, end),
  },
});

uploader.start();
```

```ts
// backend (any framework — see examples/server-express for a full one)
import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
} from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: "us-east-1" });

app.post("/api/s3-presign", async (req, res) => {
  const operation = req.body; // the same S3PresignedUrlOperation the client sent
  const bucket = "my-bucket";
  const key = operation.fileId;

  const command =
    operation.type === "create"
      ? new CreateMultipartUploadCommand({ Bucket: bucket, Key: key })
      : operation.type === "uploadPart"
        ? new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: operation.uploadId, PartNumber: operation.partNumber })
        : operation.type === "complete"
          ? new CompleteMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: operation.uploadId })
          : operation.type === "abort"
            ? new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: operation.uploadId })
            : new ListPartsCommand({ Bucket: bucket, Key: key, UploadId: operation.uploadId });

  res.json({ url: await getSignedUrl(s3, command, { expiresIn: 900 }) });
});
```

Swap `@upflowi/provider-s3` for `@upflowi/provider-r2` to target Cloudflare R2 instead — the client code above doesn't change, only how your backend signs URLs.

### Resumable uploads

Pair a provider with an `UploadStore` and a crashed or reloaded upload resumes without re-transferring completed parts:

```ts
import { createIndexedDbStore } from "@upflowi/store-indexeddb";

const uploader = createUploader({
  provider,
  transport: createFetchTransport(),
  store: createIndexedDbStore(),
});
```

`@upflowi/core` ships no store implementation on purpose (keep it dependency-free): use `@upflowi/store-indexeddb` in the browser, `@upflowi/store-memory` for tests or short-lived Node scripts, or implement `UploadStore` yourself — it's three methods (`get`/`set`/`delete`). Your own implementation can point anywhere you want — your own backend (backed by Redis, a database, whatever), `localStorage`, a file — that choice belongs entirely to you; the SDK only needs the interface satisfied.

### Your own backend (VPS, internal API, anything not S3/R2-compatible)

If your storage isn't S3-compatible, `@upflowi/provider-http` gives you a ready-made adapter for a small JSON-over-HTTP convention instead of writing a `StorageProvider` from scratch:

```ts
import { createHttpProvider } from "@upflowi/provider-http";

const provider = createHttpProvider({
  baseUrl: "https://my-vps.example.com/api",
  getHeaders: () => ({ authorization: `Bearer ${getSessionToken()}` }),
});
```

Your backend implements five routes — see [`@upflowi/provider-http`'s docs](./packages/provider-http/src/http-provider.ts) for the exact shapes, or [`examples/server-express`](./examples/server-express) for a full working implementation.

If your backend's API doesn't fit that convention either, implement `StorageProvider` (`create`/`uploadPart`/`complete`/`abort`/`resume`) directly — it's a plain object of five functions, no base class or package required. See `@upflowi/core`'s exported `StorageProvider` type.

## Events

Every `Upload` and the `Uploader` itself emit typed events:

```ts
upload.on("started", ({ fileId }) => {});
upload.on("progress", ({ fileId, loadedBytes, totalBytes, percent }) => {});
upload.on("paused", ({ fileId }) => {});
upload.on("resumed", ({ fileId }) => {});
upload.on("retry", ({ fileId, attempt, error }) => {});
upload.on("completed", ({ fileId, result }) => {});
upload.on("failed", ({ fileId, error }) => {});
upload.on("cancelled", ({ fileId }) => {});

uploader.on("queued", ({ fileId }) => {});
uploader.on("allCompleted", ({ completedCount, failedCount }) => {});
```

`upload.on(...)` returns an unsubscribe function.

## Cancellation

Every `Upload` can be cancelled independently with `upload.cancel()` (or by aborting the `AbortSignal` passed in `UploadOptions.signal`) — cancelling one file never affects the others, regardless of when it's cancelled:

```ts
const uploads = uploader.addMany(files.map((source) => ({ source })));
uploader.start();

uploads[1]?.cancel(); // only this one stops; the rest keep going
```

- **Mid-transfer**: the in-flight request/parts stop as soon as the transport/provider observes the abort signal; the file's status becomes `"cancelled"` and its `cancelled` event fires. It does **not** count toward `Uploader`'s `failed`.
- **Still queued** (added, but waiting behind `concurrency` or not yet released by `start()`): cancelling it removes it from execution entirely — it never calls its transport/provider, and the other queued files run unaffected. This is what to reach for when you want to "remove an item from the queue" before it starts.

```ts
uploader.on("allCompleted", ({ completedCount, failedCount }) => {
  // a cancelled file is counted in neither completedCount nor failedCount
});
```

## Error handling

Every error thrown by upflowi extends `UploadError` (`code`, `message`, `cause`, `retryable`, and `fileId`/`partNumber` when applicable) so you can branch with `instanceof`:

```ts
import { AbortError, HttpError, NetworkError, ProviderError, RetryExhaustedError, UploadValidationError } from "@upflowi/core";

upload.on("failed", ({ error }) => {
  if (error instanceof RetryExhaustedError) {
    // every configured attempt failed — error.attempts, error.cause is the last underlying error
  } else if (error instanceof ProviderError) {
    // S3/R2/your backend rejected the operation — error.providerCode
  } else if (error instanceof HttpError) {
    // a non-2xx response — error.status
  } else if (error instanceof NetworkError) {
    // no response was received at all
  } else if (error instanceof UploadValidationError) {
    // bad input, caught before any network call
  } else if (error instanceof AbortError) {
    // the upload was cancelled — never retried
  }
});
```

Customize retry behavior per uploader:

```ts
createUploader({
  retry: {
    maxAttempts: 5,
    initialDelayMs: 500,
    maxDelayMs: 30_000,
    backoffFactor: 2,
    jitter: true,
    shouldRetry: (error, attempt) => error.retryable, // override the default classification
  },
});
```

## Where this runs

`createUploader`, its transport, and its provider are meant to run **client-side** — a browser tab (any frontend framework, or none) is the primary target, since the whole point of a presigned-URL provider (`@upflowi/provider-s3`/`-r2`) is that bytes flow straight from the browser to storage, never through your backend. `@upflowi/transport-fetch` also happens to work in Node.js 18+, so the same engine can drive a server-to-server transfer if you have one, but that's a secondary use case, not the design center.

Your backend's job in the primary flow is narrow and stays entirely separate from the engine itself: expose an endpoint that returns a presigned URL for `getPresignedUrl` to call (or implement `@upflowi/provider-http`'s five JSON routes if you're not S3/R2-compatible). Whatever else your backend does — persist resume state in Redis via your own `UploadStore`, authenticate the presign request, whatever your app needs — is entirely up to you; the SDK has no opinion on it and no dependency on it.

## Access control

upflowi has no concept of public or private — visibility is entirely your backend's decision, not the SDK's.

- **Uploads always go through a presigned URL** (or your own backend, for `@upflowi/provider-http`), whether the finished object ends up public or private — you never want anonymous public writes to a bucket.
- **Whether the object is public or private is decided when your backend signs the URL**: set `x-amz-acl: public-read` (or a bucket policy) when it signs the `create`/`complete` operation for a public file, or leave it private and only ever hand out presigned GET URLs for reads.
- **Serving the file back isn't something upflowi does either**: return a public or CDN URL from your own backend after `complete`, or sign a short-lived GET URL the same way you sign uploads.

This is deliberate, not an oversight — access control is a security decision that belongs in your backend, not in an upload-orchestration engine. See [`AGENTS.md`](./AGENTS.md#9-explicitly-out-of-scope-do-not-build-without-an-explicit-ask) for what's intentionally out of scope.

## Examples

Two runnable examples live in [`examples/`](./examples), wired together:

- [`examples/server-express`](./examples/server-express) — a minimal Express backend implementing `@upflowi/provider-http`'s JSON convention against the local filesystem, plus documentation on wiring S3/R2 presigned URLs instead.
- [`examples/browser-vite`](./examples/browser-vite) — a plain Vite + TypeScript page (no framework) that uploads a file through `@upflowi/core` + `@upflowi/transport-fetch` + `@upflowi/provider-http` against the server example, with a live progress bar and pause/resume/cancel controls.

Run both from the repo root:

```bash
pnpm install
pnpm run build
pnpm --filter ./examples/server-express run dev
pnpm --filter ./examples/browser-vite run dev   # in another terminal
```

## Contributing & architecture

See [`AGENTS.md`](./AGENTS.md) for the full architecture (orchestration vs. scheduling vs. transport vs. provider), the local development workflow, versioning/release process, and the standards every package in this monorepo follows. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for how to open a pull request.

## License

[ISC](./LICENSE)
