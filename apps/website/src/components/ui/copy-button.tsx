"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckIcon, CopyIcon } from "@/components/theme/theme-icons";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast("Copied to clipboard.");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy — copy it manually instead");
    }
  }

  return (
    <button
      aria-label={copied ? "Copied" : label}
      className={cn(
        "group inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg cursor-pointer border border-line text-ink-faint",
        "transition-colors duration-200 hover:border-line-strong hover:text-ink",
        copied && "animate-flash border-line-strong text-ink",
        className,
      )}
      onClick={handleCopy}
      type="button"
    >
      {copied ? (
        <CheckIcon className="h-3.5 w-3.5" />
      ) : (
        <CopyIcon className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
