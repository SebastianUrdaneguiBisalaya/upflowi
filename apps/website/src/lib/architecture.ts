export type ArchitectureLayer = {
  name: string;
  files: string;
  role: string;
  knows: string;
  never: string;
};

export const architectureLayers: ArchitectureLayer[] = [
  {
    files: "uploader.ts · upload.ts · queue.ts · state-machine.ts",
    knows: "queue order, retry count, upload status",
    name: "Orchestration",
    never: "HTTP mechanics, a specific provider's API shape",
    role: "Decides what to upload, in what order, and tracks status.",
  },
  {
    files: "scheduler.ts",
    knows: "concurrency limits",
    name: "Scheduling",
    never: "what the operation actually does",
    role: "Decides how many operations run at once — global, per-file, per-chunk.",
  },
  {
    files: "transport-fetch · transport-xhr",
    knows: "how to send a request and report progress",
    name: "Transport",
    never: "multipart, S3, or any provider concept",
    role: "Moves bytes — HTTP mechanics, progress events, headers, abort wiring.",
  },
  {
    files: "provider-s3 · provider-r2 · provider-http",
    knows: "create / uploadPart / complete / abort / resume",
    name: "Provider",
    never: "how bytes physically move, or how many run at once",
    role: "Defines which operations exist on a backend and maps them onto transport calls.",
  },
];
