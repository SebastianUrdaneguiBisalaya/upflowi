# @upflowi/transport-fetch

An `UploadTransport` for [upflowi](https://github.com/SebastianUrdaneguiBisalaya/upflowi) backed by the standard **Fetch API**. Works anywhere `fetch` is a global — modern browsers and Node.js 18+.

```bash
pnpm add @upflowi/core @upflowi/transport-fetch
```

```ts
import { createUploader } from "@upflowi/core";
import { createFetchTransport } from "@upflowi/transport-fetch";

const uploader = createUploader({
  transport: createFetchTransport(),
});
```

## When to use this vs. `@upflowi/transport-xhr`

- **`@upflowi/transport-fetch`** — works in both browsers and Node.js 18+. Use this by default.
- **`@upflowi/transport-xhr`** — browser-only, but reports fine-grained, continuously-updating upload progress via `xhr.upload.onprogress`, which the Fetch API cannot provide. Reach for it specifically when you need smoother progress bars for large uploads.

A non-2xx HTTP response is returned as a normal response object, not thrown — `@upflowi/core` decides what counts as a failure. Only network failures and aborts are thrown, as `NetworkError` and `AbortError` respectively.

## Peer dependency

Requires `@upflowi/core` as a peer dependency — install both.

## Documentation

See the [monorepo README](https://github.com/SebastianUrdaneguiBisalaya/upflowi#readme) for full usage examples and [`AGENTS.md`](https://github.com/SebastianUrdaneguiBisalaya/upflowi/blob/main/AGENTS.md) for the architecture.

## License

[ISC](https://github.com/SebastianUrdaneguiBisalaya/upflowi/blob/main/LICENSE)
