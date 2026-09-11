# server-express example

A minimal Express backend implementing `@upflowi/provider-http`'s JSON-over-HTTP convention against the local filesystem. No cloud account needed — it's meant to be paired with [`examples/browser-vite`](../browser-vite) to try a real multipart upload end to end in a few minutes.

## Run it

From the repo root:

```bash
pnpm install
pnpm run build                              # builds the @upflowi/* packages
pnpm --filter ./examples/server-express run dev
```

It listens on `http://localhost:3001` and stores uploaded files under `.data/` (gitignored).

## Routes

| Method | Path                          | Body                                | Response                               |
| ------ | ----------------------------- | ------------------------------------ | ---------------------------------------- |
| POST   | `/uploads`                    | `{ fileId }`                         | `{ uploadId }`                            |
| PUT    | `/uploads/:uploadId/parts/:n` | raw bytes                             | `{ etag }`                                |
| POST   | `/uploads/:uploadId/complete` | `{ parts: [{partNumber,etag,sizeBytes}] }` | `{ location, etag }`                |
| DELETE | `/uploads/:uploadId`          | —                                     | `204`                                     |
| GET    | `/uploads/:uploadId/parts`    | —                                     | `{ parts: [...] }`, or `404` if unknown  |

This is exactly the convention `@upflowi/provider-http` speaks — see its [source](../../packages/provider-http/src/http-provider.ts) for the client side.

Completed files are served back at `GET /files/:fileId`.

## Using S3 or R2 instead

This example exists to give you something to point `examples/browser-vite` at without a cloud account. To target a real S3/R2 bucket instead, swap `@upflowi/provider-http` for `@upflowi/provider-s3` / `@upflowi/provider-r2` on the client, and replace these routes with a single `POST /api/s3-presign` endpoint that signs a URL per S3 operation — see the root [`README.md`](../../README.md#multipart-upload-to-s3-with-presigned-urls) for the full snippet with `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`.

## Why no auth?

This is a demo. `@upflowi/provider-http`'s `getHeaders` option exists precisely so a real backend can require auth on every route — see the root README's "Your own backend" section.
