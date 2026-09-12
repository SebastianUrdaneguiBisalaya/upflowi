"use client";

import { useState } from "react";
import { ConfigPanel } from "./config-panel";
import { EventLog } from "./event-log";
import { FileDropZone } from "./file-drop-zone";
import { DEFAULT_CONFIG } from "./types";
import { UploadCard } from "./upload-card";
import { usePlaygroundUploader } from "./use-playground-uploader";

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5 border border-line bg-bg-elevated px-4 py-2.5">
      <span className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
        {label}
      </span>
      <span className="font-mono text-[15px] text-ink">{value}</span>
    </div>
  );
}

export function PlaygroundConsole({
  s3Enabled,
  r2Enabled,
}: {
  s3Enabled: boolean;
  r2Enabled: boolean;
}) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const { uploads, log, stats, addFiles, pauseAll, resumeAll, cancelAll } =
    usePlaygroundUploader(config);

  const locked = stats.active + stats.pending > 0;

  return (
    <div className="mx-auto max-w-205 px-6 py-14 sm:px-8 sm:py-16">
      <span className="mb-2 block font-mono text-[11px] text-ink-faint">
        Interactive — development only, never rendered in a deployed build
      </span>
      <h1 className="mb-8 max-w-[24ch] font-display text-[26px] font-medium leading-[1.3] text-ink sm:text-[28px]">
        Try every feature against real uploads
      </h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-4">
          <ConfigPanel
            config={config}
            locked={locked}
            onChange={setConfig}
            r2Enabled={r2Enabled}
            s3Enabled={s3Enabled}
          />
          {locked ? (
            <p className="text-[11px] text-ink-faint">
              Provider/transport are locked while an upload is in flight —
              cancel everything to change them.
            </p>
          ) : null}

          <div className="grid grid-cols-3 gap-2">
            <StatTile
              label="Queued"
              value={stats.pending}
            />
            <StatTile
              label="Active"
              value={stats.active}
            />
            <StatTile
              label="Done"
              value={stats.completed}
            />
          </div>

          <div className="flex gap-2">
            <button
              className="flex-1 cursor-pointer rounded-md border border-line px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-ink-soft transition-colors hover:text-ink"
              onClick={pauseAll}
              type="button"
            >
              Pause all
            </button>
            <button
              className="flex-1 cursor-pointer rounded-md border border-line px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-ink-soft transition-colors hover:text-ink"
              onClick={resumeAll}
              type="button"
            >
              Resume all
            </button>
            <button
              className="flex-1 cursor-pointer rounded-md border border-line px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-ink-soft transition-colors hover:text-ink"
              onClick={cancelAll}
              type="button"
            >
              Cancel all
            </button>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <FileDropZone onFiles={addFiles} />

          <p className="text-[11px] text-ink-faint">
            To see resumability: start a multipart upload (Custom or S3/R2, a
            file large enough to need several chunks), reload this page
            mid-transfer, then re-select the exact same file — already-completed
            parts read from <code>localStorage</code> won&apos;t be re-uploaded.
          </p>

          {uploads.length > 0 ? (
            <div className="grid grid-cols-1 gap-2">
              {uploads.map((upload) => (
                <UploadCard
                  key={upload.fileId}
                  upload={upload}
                />
              ))}
            </div>
          ) : null}

          <EventLog entries={log} />
        </div>
      </div>
    </div>
  );
}
