export type DocsFeature = {
  readonly id: string;
  readonly category: string;
  readonly title: string;
  readonly description: string;
  readonly code: string;
};

export const docsFeatures: DocsFeature[] = [
  {
    category: "Orchestration",
    code: `const uploader = createUploader({ transport, provider });

const one = uploader.add({ source, options: { url } });
const many = uploader.addMany([{ source: a }, { source: b }]);

uploader.start();`,
    description:
      "Register one or many files with add()/addMany(); each gets its own fileId and independent status. Nothing transfers until start() runs the queue.",
    id: "orchestration",
    title: "Register files, then start the queue",
  },
  {
    category: "Concurrency & scheduling",
    code: `createUploader({
  concurrency: 3,       // files in flight at once
  chunkConcurrency: 3,  // parts in flight, across every file
});`,
    description:
      "A concurrency-limited scheduler caps how many files — and, separately, how many multipart chunks across every file — run at once. Never more than configured, whatever the queue size.",
    id: "concurrency",
    title: "Bounded concurrency, per file and per chunk",
  },
  {
    category: "Chunking & multipart",
    code: `createUploader({ chunkSize: 8 * 1024 * 1024 });

// source.read() is called per byte range, never the whole file at once
read: async ({ start, end }) => file.slice(start, end)`,
    description:
      "Large files are split into parts of chunkSize bytes and streamed range-by-range — a multi-GB file never has to sit fully in memory.",
    id: "chunking",
    title: "Stream large files in bounded-size parts",
  },
  {
    category: "Retries & backoff",
    code: `createUploader({
  retry: {
    maxAttempts: 5,
    initialDelayMs: 500,
    backoffFactor: 2,
    jitter: true,
    shouldRetry: (error) => error.retryable,
  },
});`,
    description:
      "Exponential backoff with jitter by default; classification is per error type (NetworkError and 5xx/429 are retryable, AbortError and validation errors never are). Override the policy entirely with shouldRetry.",
    id: "retries",
    title: "Exponential backoff, typed error classification",
  },
  {
    category: "Progress & typed events",
    code: `upload.on("progress", ({ loadedBytes, totalBytes, percent }) => {});
uploader.on("allCompleted", ({ completedCount, failedCount }) => {});

// queued · started · progress · paused · resumed
// retry · completed · failed · cancelled · allCompleted`,
    description:
      "Per-file and aggregated-across-every-file progress, plus a fully typed event for every lifecycle transition — no any, no string-keyed guessing.",
    id: "events",
    title: "Ten typed events, per-file and global progress",
  },
  {
    category: "Cancellation",
    code: `upload.cancel();               // this file only — others keep going
uploader.cancel();              // every tracked file

uploader.add({ source, options: { signal: controller.signal } });`,
    description:
      "Cancel a single file (in flight, still queued, or never started) without touching the others, or cancel everything at once. A native AbortSignal works too.",
    id: "cancellation",
    title: "Cancel one file, or all of them, safely",
  },
  {
    category: "Pause / resume",
    code: `upload.pause();
upload.resume();`,
    description:
      "Pausing halts a file after its current network call settles; resuming picks up exactly where it left off — no re-queueing, no lost progress.",
    id: "pause-resume",
    title: "Pause a transfer, resume without restarting",
  },
  {
    category: "Persistence & resume",
    code: `type UploadStore = {
  get(fileId): Promise<StoredUploadRecord | undefined>;
  set(fileId, record): Promise<void>;
  delete(fileId): Promise<void>;
};

createUploader({ store: myUploadStore });`,
    description:
      "Three methods, no bundled implementation — bring your own (localStorage, IndexedDB, a backend). A crashed tab or process resumes without re-uploading parts the provider confirms as already completed.",
    id: "persistence",
    title: "Bring your own store, resume without re-uploading",
  },
  {
    category: "Transports",
    code: `import { createFetchTransport } from "@upflowi/transport-fetch";
import { createXhrTransport } from "@upflowi/transport-xhr";`,
    description:
      "Fetch works everywhere (browser and Node 18+) but only reports 0%/100% progress. XHR is browser-only but reports continuous upload progress via xhr.upload — pick per file, not just per app.",
    id: "transports",
    title: "Fetch everywhere, XHR for continuous progress",
  },
  {
    category: "Providers",
    code: `createS3Provider({ getPresignedUrl });     // AWS S3 multipart
createR2Provider({ getPresignedUrl });     // Cloudflare R2 multipart
createHttpProvider({ baseUrl });           // your own backend, 5 JSON routes`,
    description:
      "One StorageProvider interface, three official implementations. S3 and R2 never see your cloud credentials — every request goes through a presigned URL your own backend signs.",
    id: "providers",
    title: "S3, R2, or your own backend — same interface",
  },
];
