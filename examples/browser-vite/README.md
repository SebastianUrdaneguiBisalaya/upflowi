# browser-vite example

A plain Vite + TypeScript page (no framework) that uploads a file through `@upflowi/core` + `@upflowi/transport-fetch` + `@upflowi/provider-http`, with a live progress bar and pause/resume/cancel controls. Pairs with [`examples/server-express`](../server-express).

## Run it

Start the backend first (in one terminal, from the repo root):

```bash
pnpm install
pnpm run build
pnpm --filter ./examples/server-express run dev
```

Then, in another terminal:

```bash
pnpm --filter ./examples/browser-vite run dev
```

Open the printed URL (typically `http://localhost:5173`), pick a file, and click **Start**. Progress, retries, and the final result are logged live on the page.

## What it demonstrates

- `createUploader({ chunkSize, chunkConcurrency, provider, transport })`
- A `UploadSource` reading `File.slice(start, end)` — the file is never fully loaded into memory
- Every typed event (`started`, `progress`, `retry`, `paused`, `resumed`, `completed`, `failed`, `cancelled`)
- `upload.pause()` / `.resume()` / `.cancel()` wired to buttons

See [`src/main.ts`](./src/main.ts) — it's under 100 lines.

## Pointing it at S3/R2 instead

Swap the `createHttpProvider({ baseUrl })` call for `createS3Provider({ getPresignedUrl })` / `createR2Provider({ getPresignedUrl })` and point `getPresignedUrl` at a backend endpoint that signs S3/R2 requests — see the root [`README.md`](../../README.md#multipart-upload-to-s3-with-presigned-urls).
