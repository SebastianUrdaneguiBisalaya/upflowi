import Link from "next/link";
import { ArrowDownIcon } from "@/components/theme/theme-icons";
import { CopyButton } from "@/components/ui/copy-button";
import { Reveal } from "@/components/ui/reveal";

const INSTALL =
  "pnpm add @upflowi/core @upflowi/transport-fetch @upflowi/provider-s3";

export function Hero() {
  return (
    <section
      className="mx-auto flex flex-col items-center max-w-205 px-6 py-14 sm:px-8 sm:py-16"
      id="top"
    >
      <Reveal>
        <span className="mb-6 block font-mono text-[11px] uppercase tracking-wide text-ink-faint">
          Engine reference
        </span>
      </Reveal>

      <Reveal delay={0.08}>
        <h1 className="mb-7 max-w-[17ch] font-display text-center text-[38px] font-medium leading-[1.12] tracking-tight text-ink sm:text-[52px]">
          A file transfer engine that stays out of your UI.
        </h1>
      </Reveal>

      <Reveal delay={0.16}>
        <p className="mb-9 max-w-[58ch] text-[16.5px] text-center leading-[1.7] text-ink-soft">
          upflowi orchestrates uploads — concurrency, chunking, multipart,
          retries, progress, pause and resume, cancellation, resumable
          persistence — for TypeScript and JavaScript, in the browser and in
          Node.js, without an opinion on what your interface looks like.
        </p>
      </Reveal>

      <Reveal delay={0.24}>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <div className="flex items-center gap-3 border border-line bg-bg-elevated py-3 pl-4 pr-2">
            <code className="font-mono text-[12.5px] text-ink-soft">
              {INSTALL}
            </code>
            <CopyButton
              label="Copy install command"
              value={INSTALL}
            />
          </div>
          <Link
            className="inline-flex items-center gap-2 font-mono text-[12.5px] text-ink-faint transition-colors duration-200 hover:text-ink"
            href="#quickstart"
          >
            Read the quickstart
            <ArrowDownIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
