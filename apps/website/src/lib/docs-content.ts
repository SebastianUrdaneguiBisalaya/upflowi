export type DocsFeature = {
  readonly id: string;
  readonly category: string;
  readonly title: string;
  readonly description: string;
  readonly code: string;
};

export const docsFeatures: DocsFeature[] = [
  {
    category: "Getting started",
    code: `# Every project needs exactly two packages: the engine, and one transport.
pnpm add -E @upflowi/core @upflowi/transport-fetch

# Add a provider only if you need multipart (large files, resumable uploads).
# Pick the one matching your storage — you only pay for what you use:
pnpm add -E @upflowi/provider-s3      # AWS S3
pnpm add -E @upflowi/provider-r2      # Cloudflare R2
pnpm add -E @upflowi/provider-http    # your own backend (VPS, internal API)

# Add a store only if you want interrupted uploads to resume later:
pnpm add -E @upflowi/store-indexeddb  # browser — survives a page reload
pnpm add -E @upflowi/store-memory     # tests / short-lived Node scripts`,
    description:
      "@upflowi/core alone can't move a single byte — it has zero runtime dependencies and no idea what a transport or a provider even is. You always add exactly one transport package on top of it. A provider and a store are both optional, and independent of each other: add a provider when you need multipart (large files split into parts), add a store when you want an interrupted upload to resume later. A small file uploaded with no provider and no store still works fine.",
    id: "install",
    title: "Which packages do I actually need?",
  },
  {
    category: "Getting started",
    code: `import { createUploader } from "@upflowi/core";
import { createFetchTransport } from "@upflowi/transport-fetch";

// createUploader(config) returns a Uploader — the object you keep around
// for the whole page/session. You create it once, not once per file.
const uploader = createUploader({
  transport: createFetchTransport(),
});

// uploader.add(input) registers ONE file and returns a Upload — a handle
// scoped to that single file (its own status, its own pause/resume/cancel).
const upload = uploader.add({
  source: {
    fileId: "avatar.png",       // must be unique per file you register
    size: file.size,             // total size in bytes, known up front
    read: async () => file,      // returns the bytes — see the next card
  },
  options: {
    url: "https://your-backend.example.com/uploads/avatar.png",
  },
});

// Nothing has been sent over the network yet. start() is what kicks off
// the queue — call it once, after you've registered every file you have
// right now (you can still add() more files after start(), they'll run
// through the same queue).
uploader.start();`,
    description:
      "This is the entire lifecycle: create one Uploader, register each file with add() (or addMany() for several at once), then call start() once. Nothing transfers before start() runs — add() only queues. If you call add() again after start(), that new file joins the same running queue immediately, respecting the same concurrency limit.",
    id: "connect",
    title: "The three calls every integration makes",
  },
  {
    category: "Getting started",
    code: `// What createUploader(config) returns — every method and field, and its
// exact type. This is the real "Uploader" type, not a summary of it.
type Uploader = {
  add(input: AddFileInput): Upload;
  addMany(inputs: readonly AddFileInput[]): readonly Upload[];
  start(): void;
  pause(): void;     // pauses every file currently tracked
  resume(): void;    // resumes every paused file currently tracked
  cancel(): void;    // cancels every file currently tracked
  on(event, listener): () => void;   // returns an unsubscribe function

  // Read-only counters, always in sync with the current queue state:
  readonly size: number;       // total files ever registered
  readonly pending: number;    // registered, not yet started transferring
  readonly active: number;     // transferring right now
  readonly completed: number;
  readonly failed: number;
};

// What uploader.add()/addMany() return — the per-file handle:
type Upload = {
  readonly fileId: string;
  readonly status: UploadStatus;   // "queued" | "uploading" | "paused"
                                    // | "completed" | "failed" | "cancelled"
  pause(): void;
  resume(): void;
  cancel(): void;
  on(event, listener): () => void;
};`,
    description:
      "Every function's return type, spelled out — no guessing, no 'check the source'. Uploader.size/pending/active/completed/failed are counts of files (not bytes), and they update live as the queue runs; read them any time, including inside an event listener. There is no aggregated byte-level progress across every file — only per-file progress via Upload's 'progress' event (see the events card below).",
    id: "return-types",
    title: "Uploader and Upload, field by field",
  },
  {
    category: "Getting started",
    code: `// UploadSource — what you pass as \`source\` to add()/addMany().
type UploadSource = {
  fileId: string;   // your own unique id for this file
  size: number;      // total bytes, known before any byte is read
  // Called once per chunk range during a multipart transfer (or once,
  // with the whole file's range, for a single-request transfer). Never
  // asked to return the whole file at once for a large upload — this is
  // what lets a multi-GB file never sit fully in memory.
  read(range: { start: number; end: number; partNumber: number }):
    Promise<string | ArrayBuffer | ArrayBufferView | Blob>;
};

// In the browser, slicing a File/Blob is the usual implementation:
const source = {
  fileId: file.name,
  size: file.size,
  read: async ({ start, end }) => file.slice(start, end),
};

// AddFileInput — what add()/addMany() actually accept:
type AddFileInput = {
  source: UploadSource;
  options?: {
    transport?: UploadTransport;   // override the uploader-level transport
    provider?: StorageProvider;    // override the uploader-level provider
    url?: string;                  // destination, only for no-provider transfers
    priority?: number;             // higher runs before lower; default 0
    signal?: AbortSignal;          // cancel this file via a native AbortSignal
    chunkSize?: number;            // override the uploader-level chunk size
    store?: UploadStore;           // override the uploader-level store
    checksum?: ChecksumComputer;   // override the uploader-level checksum
    metadata?: Record<string, string>;
  };
};`,
    description:
      "Every field in options is optional and falls back to whatever you passed createUploader() itself — set something once at the uploader level, then override it per file only when one specific upload actually needs to differ (a different provider, a smaller chunkSize, its own AbortSignal).",
    id: "add-file",
    title: "The exact shape of a file you register",
  },
  {
    category: "Getting started",
    code: `// No store — the common case. A fresh id per attempt is all you need:
uploader.add({
  source: { fileId: crypto.randomUUID(), size: file.size, read: async () => file },
  options: { url },
});

// With a store — fileId doubles as the resume key, so it must be the
// SAME value across a reload for the same logical upload:
const fileId = \`\${userId}-\${file.name}-\${file.size}-\${file.lastModified}\`;

// Or, if the file can be renamed/moved and should still resume:
const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
const stableFileId = Array.from(new Uint8Array(digest))
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("");`,
    description:
      "add() throws UploadValidationError if fileId is already tracked by a queued or uploading file in that Uploader — but once an upload reaches completed, failed, or cancelled, its fileId is freed and can be reused. Core never generates one for you: with no store, a random id per attempt is enough; with a store, fileId is also the persistence key, so it needs to be stable and deterministic across a reload for the store to find the right record.",
    id: "file-id-strategy",
    title: "Choosing a fileId: random vs. stable",
  },
  {
    category: "Orchestration",
    code: `// The full lifecycle of a single Upload — every legal transition:
//
//   queued -----> uploading -----> completed
//                    |  |  |
//                    |  |  +-----> failed -----> queued (retried)
//                    |  +--------> cancelled
//                    +-----------> paused -----> uploading
//                                              -> cancelled
//
// "cancelled" and "completed" are terminal — nothing can leave them.
// upload.status always reflects exactly where a file is right now.

uploader.on("queued", ({ fileId }) => {});
upload.on("started", ({ fileId }) => {
  console.log(upload.status); // "uploading"
});`,
    description:
      'Every Upload starts at "queued" the moment add() runs. It moves to "uploading" once the scheduler actually invokes it (respecting concurrency — see the next card), and only from "uploading" can it reach "completed", "failed", or "paused". A file that never got picked up yet (still "queued") can be cancelled directly, skipping "uploading" entirely.',
    id: "orchestration",
    title: "The status lifecycle, exactly as implemented",
  },
  {
    category: "Concurrency & scheduling",
    code: `createUploader({
  concurrency: 3,       // files in flight at once — default 3
  chunkConcurrency: 3,  // parts in flight, across every file — default 3
});`,
    description:
      "Two independent limits. concurrency caps how many files run at once, regardless of size. chunkConcurrency caps how many multipart parts run at once across every file combined — so 2 files each splitting into 5 parts still never exceed chunkConcurrency parts in flight in total, not 2x that. Neither limit is per-provider or per-transport; they're purely about how much work runs in parallel.",
    id: "concurrency",
    title: "Bounded concurrency, per file and per chunk",
  },
  {
    category: "Chunking & multipart",
    code: `createUploader({ chunkSize: 8 * 1024 * 1024 }); // default: 5 MiB

// A ChunkRange — what source.read() and a provider's uploadPart() both
// receive for one part of a multipart transfer:
type ChunkRange = {
  partNumber: number;   // 1-indexed, matches what S3/R2 expect
  start: number;         // inclusive byte offset
  end: number;           // exclusive byte offset
  size: number;          // end - start
};

// source.read() is called once per range, never with the whole file:
read: async ({ start, end }) => file.slice(start, end)`,
    description:
      'A file only goes through multipart chunking when a provider is configured — with no provider, a file transfers as one request regardless of chunkSize (see the "providers" card). When multipart does apply, the file is split into chunkSize-byte ChunkRanges and each is read/transferred independently, so a multi-GB file never needs to sit fully in memory at once.',
    id: "chunking",
    title: "Stream large files in bounded-size parts",
  },
  {
    category: "Retries & backoff",
    code: `// Defaults if you pass no "retry" at all:
// { maxAttempts: 3, initialDelayMs: 500, maxDelayMs: 30_000,
//   backoffFactor: 2, jitter: true }

createUploader({
  retry: {
    maxAttempts: 5,        // including the first attempt
    initialDelayMs: 500,   // delay before the 1st retry
    maxDelayMs: 30_000,    // computed delay never exceeds this
    backoffFactor: 2,      // delay doubles after each failed attempt
    jitter: true,          // randomizes the delay within [50%, 100%]
    shouldRetry: (error, attempt) => error.retryable, // full override
  },
});

// Whether a failure retries at all is decided by error.retryable, unless
// you override it with shouldRetry above:
// NetworkError        -> always true
// HttpError           -> true for 5xx and 429, false otherwise
// ProviderError        -> false by default; @upflowi/provider-s3/-r2/-http
//                        set it true for a 5xx/429 response from the
//                        provider/backend
// AbortError           -> always false, even if shouldRetry returns true —
//                        a cancelled upload is never retried
// UploadValidationError -> always false (bad input, not a transient failure)
// RetryExhaustedError   -> always false (this IS the "gave up" error)`,
    description:
      'Retrying happens per part (multipart) or per whole file (no provider) — a part that fails retries on its own without restarting the other already-completed parts. Once maxAttempts is exhausted, the file\'s "failed" event fires with a RetryExhaustedError wrapping the last underlying error as .cause.',
    id: "retries",
    title: "Exponential backoff, typed error classification",
  },
  {
    category: "Progress & typed events",
    code: `// Every event a single Upload can emit, and its exact payload:
upload.on("started",   ({ fileId }) => {});
upload.on("progress",  ({ fileId, loadedBytes, totalBytes, percent }) => {});
upload.on("paused",    ({ fileId }) => {});
upload.on("resumed",   ({ fileId }) => {});
upload.on("retry",     ({ fileId, attempt, error }) => {});      // error: UploadError
upload.on("completed", ({ fileId, result }) => {});               // result: UploadResult
upload.on("failed",    ({ fileId, error }) => {});                 // error: UploadError
upload.on("cancelled", ({ fileId }) => {});

// UploadResult — what "completed" hands you:
type UploadResult = {
  fileId: string;
  totalBytes: number;
  location?: string;  // set when the provider/backend returns one
  etag?: string;
};

// A Uploader emits every event above too (same payloads, fired for
// whichever file triggered it), plus two of its own:
uploader.on("queued",       ({ fileId }) => {});
uploader.on("allCompleted", ({ completedCount, failedCount }) => {});

// Every on() call returns an unsubscribe function:
const unsubscribe = upload.on("progress", () => {});
unsubscribe();`,
    description:
      "Ten typed events total, fully typed payloads on both Upload and Uploader — no string-keyed guessing, no any. progress fires per file as bytes move; there's no separate aggregated multi-file progress event, so add up loadedBytes/totalBytes yourself across every Upload if you need one combined bar.",
    id: "events",
    title: "Every event, with its exact payload type",
  },
  {
    category: "Cancellation",
    code: `upload.cancel();               // this file only — others keep going
uploader.cancel();              // every tracked file

// A native AbortSignal cancels the same way:
const controller = new AbortController();
uploader.add({ source, options: { signal: controller.signal } });
controller.abort();`,
    description:
      "Cancelling one file never affects the others, no matter what state each one is in: mid-transfer (its in-flight request/part stops as soon as the transport/provider observes the signal), still queued behind the concurrency limit (it's removed before ever calling the transport/provider), or not yet released by start(). A cancelled file's status becomes \"cancelled\" and it's counted in neither completed nor failed on allCompleted.",
    id: "cancellation",
    title: "Cancel one file, or all of them, safely",
  },
  {
    category: "Pause / resume",
    code: `upload.pause();
upload.resume();

// Pausing every tracked file at once:
uploader.pause();
uploader.resume();`,
    description:
      "Pausing halts a file after its current network call settles — it doesn't abort mid-request. Resuming picks up exactly where it left off: for a multipart transfer, only the remaining, not-yet-completed parts run; nothing already confirmed is re-sent.",
    id: "pause-resume",
    title: "Pause a transfer, resume without restarting",
  },
  {
    category: "Persistence & resume",
    code: `// UploadStore — the interface core defines and ships no implementation
// for. Three methods, both official packages implement exactly this:
type UploadStore = {
  get(fileId: string): Promise<StoredUploadRecord | undefined>;
  set(fileId: string, record: StoredUploadRecord): Promise<void>;
  delete(fileId: string): Promise<void>;
};

// Browser — survives a page reload or a crashed tab:
import { createIndexedDbStore } from "@upflowi/store-indexeddb";
createUploader({ store: createIndexedDbStore() });

// Tests / short-lived Node scripts — lost when the process exits:
import { createMemoryStore } from "@upflowi/store-memory";
createUploader({ store: createMemoryStore() });`,
    description:
      "A store only matters for multipart transfers (it persists which parts a provider already confirmed, via ProviderResumeState). Pick @upflowi/store-indexeddb in a browser app, @upflowi/store-memory in tests or a Node script, or implement UploadStore yourself against anything else — your own backend (Redis, a database), a file, whatever you want; the SDK only needs those three methods.",
    id: "persistence",
    title: "Bring your own store, resume without re-uploading",
  },
  {
    category: "Integrity checking",
    code: `// ChecksumComputer — optional, core never calls it itself. The encoding
// compute() must return DEPENDS ON THE PROVIDER — get it wrong and the
// provider either rejects every part, or silently ignores it:
//
//   provider-http  any algorithm, any encoding — your own backend decides
//   provider-s3    "SHA-256" | "CRC32" | "MD5", value must be base64
//   provider-r2    "MD5" only — throws for SHA-256/CRC32 (R2 doesn't
//                   implement S3's x-amz-checksum-* feature at all)

createUploader({
  provider,  // e.g. createS3Provider({ getPresignedUrl })
  transport,
  checksum: {
    algorithm: "SHA-256",
    compute: async (data) => {
      const digest = await crypto.subtle.digest("SHA-256", data);
      // base64, not hex — required by both provider-s3 and provider-r2:
      return btoa(String.fromCharCode(...new Uint8Array(digest)));
    },
  },
});

// For provider-s3's SHA-256/CRC32 path, your backend's getPresignedUrl
// must also read the checksumAlgorithm field added to the "create"
// operation and pass it through — S3 only honors a part's checksum
// header when the algorithm was declared up front:
new CreateMultipartUploadCommand({
  Bucket, Key,
  ChecksumAlgorithm: operation.checksumAlgorithm?.replace("-", ""),
  // "SHA-256" -> "SHA256"
});`,
    description:
      "Configuring checksum threads it through to StorageProviderContext.checksum for every multipart part. provider-http is the simplest case (any algorithm, any encoding — it's your own backend). provider-s3 implements S3's real \"additional checksums\" feature for SHA-256/CRC32 (declared at CreateMultipartUpload, verified per part, echoed into CompleteMultipartUpload) plus the older Content-MD5 mechanism for MD5. provider-r2 only supports MD5 via Content-MD5 — R2 genuinely does not implement x-amz-checksum-* headers, so configuring SHA-256/CRC32 against it throws immediately instead of silently doing nothing.",
    id: "checksum",
    title: "Per-part integrity checking (optional)",
  },
  {
    category: "Error handling",
    code: `// Every error extends UploadError:
type UploadError = Error & {
  code: "NETWORK_ERROR" | "HTTP_ERROR" | "ABORTED" | "RETRY_EXHAUSTED"
      | "VALIDATION_ERROR" | "PROVIDER_ERROR";
  retryable: boolean;
  fileId?: string;
  partNumber?: number;
};

upload.on("failed", ({ error }) => {
  if (error instanceof RetryExhaustedError) {
    // error.attempts: number, error.cause: the last underlying error
  } else if (error instanceof ProviderError) {
    // the provider/backend rejected the operation — error.providerCode
  } else if (error instanceof HttpError) {
    // a non-2xx response was received — error.status: number
  } else if (error instanceof NetworkError) {
    // no response was received at all (DNS, TCP reset, offline)
  } else if (error instanceof UploadValidationError) {
    // bad input, caught before any network call
  } else if (error instanceof AbortError) {
    // the upload was cancelled — never retried, ever
  }
});`,
    description:
      "Every one of these six classes is exported from @upflowi/core and extends the shared UploadError base, so you can always fall back to a single instanceof UploadError check, or branch on .code as a plain string when you need to serialize the error across a boundary (logging, an API response).",
    id: "errors",
    title: "Six typed error classes, always instanceof-able",
  },
  {
    category: "Transports",
    code: `import { createFetchTransport } from "@upflowi/transport-fetch";
import { createXhrTransport } from "@upflowi/transport-xhr";

createFetchTransport({ fetch: customFetch }); // optional override, for tests
createXhrTransport({ createXhr: () => new XMLHttpRequest() }); // optional too

// UploadTransport — the interface both implement. Bring your own if
// neither fits (React Native, a custom HTTP client):
type UploadTransport = {
  send(request: TransportRequest): Promise<TransportResponse>;
};`,
    description:
      "@upflowi/transport-fetch uses the standard Fetch API and works in both browsers and Node.js 18+, but only reports progress at 0% and 100% — Fetch's request body has no native upload-progress event. @upflowi/transport-xhr uses XMLHttpRequest, which only exists in a browser, and reports continuous progress via xhr.upload as bytes actually leave the client. Pick per file via options.transport if one upload specifically needs continuous progress while the rest of your app uses Fetch.",
    id: "transports",
    title: "Fetch everywhere, XHR for continuous progress",
  },
  {
    category: "Providers",
    code: `import { createS3Provider } from "@upflowi/provider-s3";
import { createR2Provider } from "@upflowi/provider-r2";
import { createHttpProvider } from "@upflowi/provider-http";

createS3Provider({
  getPresignedUrl: (operation) => backendClient.getS3PresignedUrl(operation),
});
createR2Provider({
  getPresignedUrl: (operation) => backendClient.getR2PresignedUrl(operation),
});
createHttpProvider({
  baseUrl: "https://my-vps.example.com/api",
  getHeaders: () => ({ authorization: \`Bearer \${getSessionToken()}\` }),
});

// S3 and R2 both request a presigned URL for the same five operations:
type PresignedUrlOperation =
  | { type: "create"; fileId: string }
  | { type: "uploadPart"; fileId: string; uploadId: string; partNumber: number }
  | { type: "complete"; fileId: string; uploadId: string }
  | { type: "abort"; fileId: string; uploadId: string }
  | { type: "listParts"; fileId: string; uploadId: string };

// provider-http instead expects your own backend to implement 5 plain
// JSON routes — no XML, no cloud SDK:
// POST   {baseUrl}/uploads                               -> { uploadId }
// PUT    {baseUrl}/uploads/{uploadId}/parts/{partNumber}  -> { etag }
// POST   {baseUrl}/uploads/{uploadId}/complete            -> { location?, etag? }
// DELETE {baseUrl}/uploads/{uploadId}                     -> any 2xx
// GET    {baseUrl}/uploads/{uploadId}/parts               -> { parts: [...] }`,
    description:
      'One StorageProvider interface, three official implementations. S3 and R2 never see your cloud credentials — every request goes through a presigned URL your own backend signs and hands back via getPresignedUrl. provider-http instead talks to your own already-trusted backend directly, so sending your own auth via getHeaders is expected. No provider is required at all for a single small file transferred as one request — pass options.url instead (see "the three calls every integration makes", above).',
    id: "providers",
    title: "S3, R2, or your own backend — same interface",
  },
  {
    category: "Compatibility",
    code: `//                        transport-fetch        transport-xhr
//  no provider (url)      OK  browser + Node       OK  browser only
//  provider-s3             OK  browser + Node       OK  browser only
//  provider-r2             OK  browser + Node       OK  browser only
//  provider-http            OK  browser + Node       OK  browser only
//
// Every transport works with every provider — a provider only calls
// context.transport.send(), it has no opinion on which transport that is.
// The only real constraint is the environment a transport itself needs:
// transport-xhr requires a global XMLHttpRequest (a real browser),
// transport-fetch needs global fetch (any browser, or Node 18+).`,
    description:
      "There is no invalid transport/provider pairing — pick the provider for your storage backend and the transport for the progress granularity/runtime you need, independently of each other. The one thing that can go wrong is running transport-xhr somewhere without a browser (a Node script, a service worker without XHR) — use transport-fetch there instead.",
    id: "compatibility",
    title: "Every transport works with every provider",
  },
];
