"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function FileDropZone({
  onFiles,
}: {
  onFiles: (files: FileList) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the drop target wraps a real file input; drag handlers only toggle a visual state, the input is the interactive element.
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-6 py-10 text-center transition-colors duration-150",
        isDraggingOver && "border-line-strong bg-bg-elevated",
      )}
      onDragLeave={() => setIsDraggingOver(false)}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDraggingOver(true);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDraggingOver(false);
        if (event.dataTransfer.files.length > 0) {
          onFiles(event.dataTransfer.files);
        }
      }}
    >
      <p className="font-mono text-[12.5px] text-ink-soft">
        Drag files here, or{" "}
        <label
          className="cursor-pointer text-ink underline underline-offset-2"
          htmlFor={inputId}
        >
          browse
        </label>
      </p>
      <p className="text-[11px] text-ink-faint">
        Multiple files upload concurrently, up to the configured concurrency.
      </p>
      <input
        className="sr-only"
        id={inputId}
        multiple
        onChange={(event) => {
          if (event.target.files && event.target.files.length > 0) {
            onFiles(event.target.files);
          }
          if (inputRef.current) {
            inputRef.current.value = "";
          }
        }}
        ref={inputRef}
        type="file"
      />
    </div>
  );
}
