"use client";

import { useEffect, useRef } from "react";
import type { LogEntry } from "./types";

export function EventLog({ entries }: { entries: LogEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const lastEntryId = entries.at(-1)?.id;

  useEffect(() => {
    const el = scrollRef.current;
    if (el && lastEntryId !== undefined) {
      el.scrollTop = el.scrollHeight;
    }
  }, [
    lastEntryId,
  ]);

  return (
    <div className="flex flex-col border border-line bg-bg-elevated">
      <div className="border-b border-line px-4 py-2.5">
        <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink-faint">
          Event log
        </span>
      </div>
      <div
        className="max-h-72 overflow-y-auto px-4 py-3 font-mono text-[11.5px] leading-[1.9]"
        ref={scrollRef}
      >
        {entries.length === 0 ? (
          <p className="text-ink-faint">
            Add a file to see the typed event stream.
          </p>
        ) : (
          entries.map((entry) => (
            <div
              className="flex gap-2 text-ink-soft"
              key={entry.id}
            >
              <span className="shrink-0 text-ink-faint">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              <span className="shrink-0 text-ink">{entry.event}</span>
              {entry.fileId ? (
                <span className="truncate text-ink-faint">{entry.fileId}</span>
              ) : null}
              {entry.detail ? (
                <span className="truncate">{entry.detail}</span>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
