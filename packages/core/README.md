# @upflowi/core

**The engine at the center of [upflowi](https://github.com/SebastianUrdaneguiBisalaya/upflowi): a headless, provider-agnostic file transfer engine.** Concurrency, queueing, chunking, retries, progress, pause/resume, cancellation, and resumable persistence — with zero runtime dependencies and no knowledge of any specific transport or storage backend.

`@upflowi/core` never moves bytes on its own. It orchestrates *when* and *how* they move, and delegates the actual HTTP mechanics to an `UploadTransport` package (`@upflowi/transport-fetch`, `@upflowi/transport-xhr`) and — for multipart transfers — to a `StorageProvider` package (`@upflowi/provider-s3`, `@upflowi/provider-r2`, `@upflowi/provider-http`).

```bash
pnpm add @upflowi/core @upflowi/transport-fetch
```

```ts
import { createUploader } from "@upflowi/core";
import { createFetchTransport } from "@upflowi/transport-fetch";

const uploader = createUploader({
  concurrency: 3,
  transport: createFetchTransport(),
});

const upload = uploader.add({
  source: {
    fileId: "avatar.png",
    size: file.size,
    read: async () => file,
  },
  options: { url: "https://your-backend.example.com/uploads/avatar.png" },
});

upload.on("progress", (progress) => console.log(`${progress.percent.toFixed(1)}%`));
uploader.start();
```

## What's in this package

- `createUploader(config)` — the factory that builds an `Uploader`: `add`/`addMany`, `start`/`pause`/`resume`/`cancel`, `on`, and queue introspection.
- `Upload` — the per-file handle returned by `add()`/`addMany()`: `pause()`, `resume()`, `cancel()`, `on()`, `status`.
- Typed events for both `Upload` and `Uploader`: `queued`, `started`, `progress`, `paused`, `resumed`, `retry`, `completed`, `failed`, `cancelled`, `allCompleted`.
- Typed errors you can `instanceof` against: `UploadError`, `NetworkError`, `HttpError`, `AbortError`, `RetryExhaustedError`, `UploadValidationError`, `ProviderError`.
- Extension interfaces third-party packages implement: `UploadTransport`, `StorageProvider`, `UploadStore`.
- Configurable retry/backoff policy (`RetryConfig`) and an optional per-part checksum abstraction (`ChecksumComputer`).

`@upflowi/core` has **zero runtime dependencies** and no AWS, Cloudflare, XHR, fetch, or IndexedDB code — those live in separate transport/provider/store packages so you only install what you actually use.

## You'll also need

At least one transport (moves bytes):

```bash
pnpm add @upflowi/transport-fetch   # or @upflowi/transport-xhr
```

For multipart uploads, a storage provider:

```bash
pnpm add @upflowi/provider-s3   # or provider-r2, provider-http
```

For resumable uploads across a page reload or crash, an `UploadStore`:

```bash
pnpm add @upflowi/store-indexeddb   # or store-memory
```

## Where this runs

Runtime-agnostic by design: no browser or Node.js assumptions are baked in. In practice it's meant to run **client-side** — a browser tab is the primary target, since the whole point of a presigned-URL provider is bytes flowing straight from the browser to storage, bypassing your backend. `@upflowi/transport-fetch` also happens to work in Node.js 18+, so the engine can drive a server-to-server transfer too, but that's a secondary use case.

## Documentation

See the [monorepo README](https://github.com/SebastianUrdaneguiBisalaya/upflowi#readme) for the full quick start (simple uploads, multipart S3 with presigned URLs, resumable uploads, checksums, events, cancellation, error handling) and [`AGENTS.md`](https://github.com/SebastianUrdaneguiBisalaya/upflowi/blob/main/AGENTS.md) for the architecture behind orchestration vs. scheduling vs. transport vs. provider.

## License

[ISC](https://github.com/SebastianUrdaneguiBisalaya/upflowi/blob/main/LICENSE)
