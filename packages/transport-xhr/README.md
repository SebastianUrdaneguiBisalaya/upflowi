# @upflowi/transport-xhr

An `UploadTransport` for [upflowi](https://github.com/SebastianUrdaneguiBisalaya/upflowi) backed by **`XMLHttpRequest`**. Browser-only — use it when you need fine-grained, continuously-updating upload progress that the standard Fetch API cannot provide.

```bash
pnpm add @upflowi/core @upflowi/transport-xhr
```

```ts
import { createUploader } from "@upflowi/core";
import { createXhrTransport } from "@upflowi/transport-xhr";

const uploader = createUploader({
  transport: createXhrTransport(),
});
```

## When to use this vs. `@upflowi/transport-fetch`

- **`@upflowi/transport-xhr`** — browser-only. Reports upload progress via `xhr.upload`'s `progress` event, giving smoother, more granular progress updates than Fetch can.
- **`@upflowi/transport-fetch`** — works in both browsers and Node.js 18+. Use it by default unless you specifically need `transport-xhr`'s progress granularity.

A non-2xx HTTP response is returned as a normal response object, not thrown — `@upflowi/core` decides what counts as a failure. Only network failures and aborts are thrown, as `NetworkError` and `AbortError` respectively.

## Peer dependency

Requires `@upflowi/core` as a peer dependency — install both.

## Documentation

See the [monorepo README](https://github.com/SebastianUrdaneguiBisalaya/upflowi#readme) for full usage examples and [`AGENTS.md`](https://github.com/SebastianUrdaneguiBisalaya/upflowi/blob/main/AGENTS.md) for the architecture.

## License

[ISC](https://github.com/SebastianUrdaneguiBisalaya/upflowi/blob/main/LICENSE)
