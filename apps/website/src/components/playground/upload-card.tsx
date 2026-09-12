"use client";

import type { Upload, UploadStatus } from "@upflowi/core";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<UploadStatus, string> = {
  cancelled: "text-ink-faint",
  completed: "text-ink",
  failed: "text-ink",
  paused: "text-ink-soft",
  queued: "text-ink-faint",
  uploading: "text-ink",
};

export function UploadCard({ upload }: { upload: Upload }) {
  const [status, setStatus] = useState<UploadStatus>(upload.status);
  const [percent, setPercent] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    setStatus(upload.status);
    const unsubscribes = [
      upload.on("started", () => setStatus("uploading")),
      upload.on("progress", (event) => setPercent(event.percent)),
      upload.on("paused", () => setStatus("paused")),
      upload.on("resumed", () => setStatus("uploading")),
      upload.on("completed", () => {
        setStatus("completed");
        setPercent(100);
      }),
      upload.on("failed", (event) => {
        setStatus("failed");
        setErrorMessage(`${event.error.name}: ${event.error.message}`);
      }),
      upload.on("cancelled", () => setStatus("cancelled")),
    ];
    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [
    upload,
  ]);

  const canPause = status === "uploading";
  const canResume = status === "paused";
  const canCancel =
    status === "queued" || status === "uploading" || status === "paused";

  return (
    <div className="flex min-w-0 flex-col gap-2 border border-line bg-bg-elevated p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 break-all font-mono text-[12px] text-ink">
          {upload.fileId}
        </span>
        <span
          className={cn(
            "shrink-0 font-mono text-[10.5px] uppercase tracking-wide",
            STATUS_STYLES[status],
          )}
        >
          {status}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-200",
            status === "failed" ? "bg-ink-faint" : "bg-ink",
          )}
          style={{
            width: `${percent}%`,
          }}
        />
      </div>

      {errorMessage ? (
        <p className="break-all text-[11px] text-ink-faint">{errorMessage}</p>
      ) : null}

      <div className="flex gap-2">
        <button
          className="rounded-md border border-line px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-wide text-ink-soft transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canPause}
          onClick={() => upload.pause()}
          type="button"
        >
          Pause
        </button>
        <button
          className="rounded-md border border-line px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-wide text-ink-soft transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canResume}
          onClick={() => upload.resume()}
          type="button"
        >
          Resume
        </button>
        <button
          className="rounded-md border border-line px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-wide text-ink-soft transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canCancel}
          onClick={() => upload.cancel()}
          type="button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
