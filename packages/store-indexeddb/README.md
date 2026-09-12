# @upflowi/store-indexeddb

A browser `UploadStore` for [upflowi](https://github.com/SebastianUrdaneguiBisalaya/upflowi) backed by **IndexedDB** — resume state survives a page reload or a crashed tab.

```bash
pnpm add @upflowi/core @upflowi/store-indexeddb
```

```ts
import { createUploader } from "@upflowi/core";
import { createIndexedDbStore } from "@upflowi/store-indexeddb";

const uploader = createUploader({
  provider,
  transport,
  store: createIndexedDbStore(),
});
```

Optionally configure the database/store names:

```ts
createIndexedDbStore({ dbName: "my-app", storeName: "uploads" });
```

## Requirements

Requires a global `indexedDB` (any modern browser). Throws `UploadValidationError` immediately if called somewhere `indexedDB` isn't available (e.g. a Node.js server) instead of failing later on the first `get`/`set`/`delete` call — use `@upflowi/store-memory` outside the browser.

Paired with a `StorageProvider` that supports resuming (e.g. `@upflowi/provider-s3`'s `listParts`), a multipart upload resumes after a reload without re-transferring parts already completed.

## Peer dependency

Requires `@upflowi/core` as a peer dependency — install both.

## Documentation

See the [monorepo README](https://github.com/SebastianUrdaneguiBisalaya/upflowi#readme) for the full resumable-uploads example and [`AGENTS.md`](https://github.com/SebastianUrdaneguiBisalaya/upflowi/blob/main/AGENTS.md) for the architecture.

## License

[ISC](https://github.com/SebastianUrdaneguiBisalaya/upflowi/blob/main/LICENSE)
