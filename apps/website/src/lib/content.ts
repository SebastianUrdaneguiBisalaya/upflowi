export const packages = [
  {
    install: "pnpm add -E @upflowi/core",
    name: "@upflowi/core",
    note: "Engine. Zero runtime dependencies.",
  },
  {
    install: "pnpm add -E @upflowi/transport-fetch",
    name: "@upflowi/transport-fetch",
    note: "Fetch API. Browser and Node 18+.",
  },
  {
    install: "pnpm add -E @upflowi/transport-xhr",
    name: "@upflowi/transport-xhr",
    note: "XMLHttpRequest. Browser only — continuous progress.",
  },
  {
    install: "pnpm add -E @upflowi/provider-s3",
    name: "@upflowi/provider-s3",
    note: "AWS S3 multipart, via presigned URLs.",
  },
  {
    install: "pnpm add -E @upflowi/provider-r2",
    name: "@upflowi/provider-r2",
    note: "Cloudflare R2 multipart, via presigned URLs.",
  },
  {
    install: "pnpm add -E @upflowi/provider-http",
    name: "@upflowi/provider-http",
    note: "Your own backend — JSON over HTTP.",
  },
] as const;

export const definitions: Array<{
  term: string;
  body: string;
}> = [
  {
    body: "No file picker, no dashboard, no React components. The engine, and nothing you didn't ask for.",
    term: "Headless",
  },
  {
    body: "S3, R2, a VPS, or an API you haven't written yet — through one StorageProvider interface.",
    term: "Provider-agnostic",
  },
  {
    body: "The S3 and R2 providers run on presigned URLs your backend issues. The SDK never holds a key.",
    term: "Credential-free",
  },
  {
    body: "Paired with an UploadStore, a crashed or reloaded transfer skips parts already completed.",
    term: "Resumable",
  },
  {
    body: "strict: true, no any on the public surface, typed events, typed errors you can instanceof against.",
    term: "Strictly typed",
  },
];

export type UseCase = {
  id: string;
  label: string;
  summary: string;
  code: string;
};

export const useCases: UseCase[] = [
  {
    code: `import { createUploader } from "@upflowi/core";
import { createFetchTransport } from "@upflowi/transport-fetch";

const uploader = createUploader({ transport: createFetchTransport() });

const upload = uploader.add({
  source: {
    fileId: "avatar.png",
    size: file.size,
    read: async () => file, // Blob, ArrayBuffer, ArrayBufferView, or string
  },
  options: { url: "https://your-backend.example.com/uploads/avatar.png" },
});

upload.on("completed", ({ result }) => console.log("done:", result));
uploader.start();`,
    id: "simple",
    label: "Simplest upload",
    summary: "No provider, one request — a destination URL and a source.",
  },
  {
    code: `import { createUploader } from "@upflowi/core";
import { createFetchTransport } from "@upflowi/transport-fetch";
import { createS3Provider } from "@upflowi/provider-s3";

const provider = createS3Provider({
  getPresignedUrl: async (operation) => {
    const res = await fetch("/api/s3-presign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(operation),
    });
    return res.json(); // { url, headers? }
  },
});

const uploader = createUploader({
  concurrency: 3,
  chunkSize: 8 * 1024 * 1024, // 8 MiB parts
  transport: createFetchTransport(),
  provider,
});

uploader.add({
  source: {
    fileId: file.name,
    size: file.size,
    read: async ({ start, end }) => file.slice(start, end),
  },
});

uploader.start();`,
    id: "s3",
    label: "S3 multipart",
    summary: "Chunked multipart to AWS S3, driven entirely by presigned URLs.",
  },
  {
    code: `import { createUploader } from "@upflowi/core";
import { createFetchTransport } from "@upflowi/transport-fetch";

const uploader = createUploader({
  provider,
  transport: createFetchTransport(),
  store: myUploadStore, // implements get/set/delete — three methods
});

// A crashed tab or a page reload resumes the same upload;
// completed parts are never re-sent, when the provider can
// report state back (S3's ListParts, for example).`,
    id: "resumable",
    label: "Resumable",
    summary:
      "Pair a provider with an UploadStore — no re-transferring completed parts.",
  },
  {
    code: `import { createHttpProvider } from "@upflowi/provider-http";

const provider = createHttpProvider({
  baseUrl: "https://my-vps.example.com/api",
  getHeaders: () => ({ authorization: \`Bearer \${getSessionToken()}\` }),
});

// Your backend implements five routes matching StorageProvider:
// create, uploadPart, complete, abort, resume.
// No base class, no package required if you'd rather
// implement StorageProvider directly — it's five functions.`,
    id: "custom-backend",
    label: "Custom backend",
    summary:
      "Not S3/R2-compatible? @upflowi/provider-http speaks a small JSON convention.",
  },
  {
    code: `// nest: uploader.provider.ts
import { createUploader } from "@upflowi/core";
import { createFetchTransport } from "@upflowi/transport-fetch";
import { createS3Provider } from "@upflowi/provider-s3";

export const UPLOADER = Symbol("UPLOADER");

export const uploaderProvider = {
  provide: UPLOADER,
  useFactory: () =>
    createUploader({
      transport: createFetchTransport(),
      provider: createS3Provider({
        getPresignedUrl: (op) => presignService.sign(op),
      }),
    }),
};`,
    id: "nestjs",
    label: "Framework adapter",
    summary: "No class, no new — register the factory as a custom provider.",
  },
];

export type EventType = {
  scope: "Upload" | "Uploader";
  name: string;
  payload: Array<{
    field: string;
    type: string;
  }>;
};

export const events: EventType[] = [
  {
    name: "started",
    payload: [
      {
        field: "fileId",
        type: "string",
      },
    ],
    scope: "Upload",
  },
  {
    name: "progress",
    payload: [
      {
        field: "fileId",
        type: "string",
      },
      {
        field: "loadedBytes",
        type: "number",
      },
      {
        field: "totalBytes",
        type: "number",
      },
      {
        field: "percent",
        type: "number",
      },
    ],
    scope: "Upload",
  },
  {
    name: "paused",
    payload: [
      {
        field: "fileId",
        type: "string",
      },
    ],
    scope: "Upload",
  },
  {
    name: "resumed",
    payload: [
      {
        field: "fileId",
        type: "string",
      },
    ],
    scope: "Upload",
  },
  {
    name: "retry",
    payload: [
      {
        field: "fileId",
        type: "string",
      },
      {
        field: "attempt",
        type: "number",
      },
      {
        field: "error",
        type: "UploadError",
      },
    ],
    scope: "Upload",
  },
  {
    name: "completed",
    payload: [
      {
        field: "fileId",
        type: "string",
      },
      {
        field: "result",
        type: "unknown",
      },
    ],
    scope: "Upload",
  },
  {
    name: "failed",
    payload: [
      {
        field: "fileId",
        type: "string",
      },
      {
        field: "error",
        type: "UploadError",
      },
    ],
    scope: "Upload",
  },
  {
    name: "cancelled",
    payload: [
      {
        field: "fileId",
        type: "string",
      },
    ],
    scope: "Upload",
  },
  {
    name: "queued",
    payload: [
      {
        field: "fileId",
        type: "string",
      },
    ],
    scope: "Uploader",
  },
  {
    name: "allCompleted",
    payload: [
      {
        field: "completedCount",
        type: "number",
      },
      {
        field: "failedCount",
        type: "number",
      },
    ],
    scope: "Uploader",
  },
];

export type ErrorType = {
  name: string;
  extends: string;
  fields: Array<{
    field: string;
    type: string;
  }>;
  note: string;
};

export const errors: ErrorType[] = [
  {
    extends: "Error",
    fields: [
      {
        field: "code",
        type: "string",
      },
      {
        field: "message",
        type: "string",
      },
      {
        field: "cause",
        type: "unknown",
      },
      {
        field: "retryable",
        type: "boolean",
      },
      {
        field: "fileId?",
        type: "string",
      },
      {
        field: "partNumber?",
        type: "number",
      },
    ],
    name: "UploadError",
    note: "The base every other error extends. Branch on any of these with instanceof.",
  },
  {
    extends: "UploadError",
    fields: [],
    name: "NetworkError",
    note: "No response was received at all.",
  },
  {
    extends: "UploadError",
    fields: [
      {
        field: "status",
        type: "number",
      },
    ],
    name: "HttpError",
    note: "A non-2xx response came back.",
  },
  {
    extends: "UploadError",
    fields: [],
    name: "AbortError",
    note: "The AbortSignal fired. retryable is always false.",
  },
  {
    extends: "UploadError",
    fields: [
      {
        field: "attempts",
        type: "number",
      },
    ],
    name: "RetryExhaustedError",
    note: "Every configured attempt failed. cause is the last underlying error.",
  },
  {
    extends: "UploadError",
    fields: [],
    name: "UploadValidationError",
    note: "Bad input, caught before any network call.",
  },
  {
    extends: "UploadError",
    fields: [
      {
        field: "providerCode",
        type: "string",
      },
    ],
    name: "ProviderError",
    note: "S3 / R2 / your backend rejected the operation.",
  },
];
