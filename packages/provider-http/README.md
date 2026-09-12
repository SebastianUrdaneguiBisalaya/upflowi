# @upflowi/provider-http

A `StorageProvider` for [upflowi](https://github.com/SebastianUrdaneguiBisalaya/upflowi) that targets **your own backend** — a VPS, an internal API, anything that isn't S3/R2-compatible — over a small JSON-over-HTTP convention you implement server-side. No cloud SDK required on either side.

```bash
pnpm add @upflowi/core @upflowi/transport-fetch @upflowi/provider-http
```

```ts
import { createUploader } from "@upflowi/core";
import { createFetchTransport } from "@upflowi/transport-fetch";
import { createHttpProvider } from "@upflowi/provider-http";

const provider = createHttpProvider({
  baseUrl: "https://my-vps.example.com/api",
  getHeaders: () => ({ authorization: `Bearer ${getSessionToken()}` }),
});

const uploader = createUploader({
  transport: createFetchTransport(),
  provider,
});
```

## Backend contract

Implement these five routes on your backend — no XML, no cloud SDK, just plain JSON:

```text
POST   {baseUrl}/uploads                               -> { uploadId: string }
PUT    {baseUrl}/uploads/{uploadId}/parts/{partNumber}  -> { etag: string }   (body = raw part bytes)
POST   {baseUrl}/uploads/{uploadId}/complete            -> { location?: string, etag?: string }
DELETE {baseUrl}/uploads/{uploadId}                     -> any 2xx
GET    {baseUrl}/uploads/{uploadId}/parts               -> { parts: Array<{ partNumber, etag, sizeBytes }> }
                                                            (404 if the upload is unknown/expired)
```

`getHeaders` runs before every request, letting you attach a bearer token, session cookie, or any other auth header your backend expects.

## Checksums

If you pass a `checksum` computer to `createUploader`, this provider sends it via `x-upflowi-checksum-algorithm`/`x-upflowi-checksum-value` headers — the encoding is entirely opaque to the SDK and up to your own backend to interpret.

## Peer dependency

Requires `@upflowi/core` as a peer dependency — install both.

## Documentation

See the [monorepo README](https://github.com/SebastianUrdaneguiBisalaya/upflowi#readme) for full usage examples and [`AGENTS.md`](https://github.com/SebastianUrdaneguiBisalaya/upflowi/blob/main/AGENTS.md) for the architecture.

## License

[ISC](https://github.com/SebastianUrdaneguiBisalaya/upflowi/blob/main/LICENSE)
