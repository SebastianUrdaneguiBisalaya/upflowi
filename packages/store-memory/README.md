# @upflowi/store-memory

An in-memory `UploadStore` for [upflowi](https://github.com/SebastianUrdaneguiBisalaya/upflowi) — resume state lives for the lifetime of the process. Good for tests and short-lived Node scripts; not for anything that needs to survive a page reload or process restart.

```bash
pnpm add @upflowi/core @upflowi/store-memory
```

```ts
import { createUploader } from "@upflowi/core";
import { createMemoryStore } from "@upflowi/store-memory";

const uploader = createUploader({
  provider,
  transport,
  store: createMemoryStore(),
});
```

## When to use this vs. `@upflowi/store-indexeddb`

- **`@upflowi/store-memory`** — resume state lives only as long as this store instance; a page reload, a process restart, or creating a new store all lose it. Use it for tests, short-lived Node scripts, or anywhere losing in-flight resume state on restart is acceptable.
- **`@upflowi/store-indexeddb`** — browser-only, resume state survives a page reload or a crashed tab.

`@upflowi/core` ships no store implementation on purpose (it stays dependency-free) — you can also implement `UploadStore` yourself; it's three methods (`get`/`set`/`delete`).

## Peer dependency

Requires `@upflowi/core` as a peer dependency — install both.

## Documentation

See the [monorepo README](https://github.com/SebastianUrdaneguiBisalaya/upflowi#readme) for the full resumable-uploads example and [`AGENTS.md`](https://github.com/SebastianUrdaneguiBisalaya/upflowi/blob/main/AGENTS.md) for the architecture.

## License

[ISC](https://github.com/SebastianUrdaneguiBisalaya/upflowi/blob/main/LICENSE)
