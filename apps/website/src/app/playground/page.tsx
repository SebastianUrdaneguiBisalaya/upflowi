import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { PlaygroundConsole } from "@/components/playground/playground-console";
import {
  hasR2Config,
  hasS3Config,
  isPlaygroundInteractive,
} from "@/lib/playground/env";

export const metadata: Metadata = {
  description:
    "A live control room for upflowi, wired to real uploads — only runs when the site is running locally.",
  title: "Playground — upflowi",
};

function ProductionNotice() {
  return (
    <div className="mx-auto max-w-205 px-6 py-20 text-center sm:px-8">
      <span className="mb-3 block font-mono text-[11px] text-ink-faint">
        Development only
      </span>
      <h1 className="mx-auto mb-4 max-w-[28ch] font-display text-[26px] font-medium leading-[1.3] text-ink sm:text-[28px]">
        This playground only runs on your own machine
      </h1>
      <p className="mx-auto mb-8 max-w-[52ch] text-[15px] leading-[1.7] text-ink-soft">
        It never touches cloud credentials or real uploads from a deployed
        instance — clone the repo and run it locally to try every feature
        against real files, or read the same feature set with runnable code in
        the docs.
      </p>
      <Link
        className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 font-mono text-[12px] uppercase tracking-wide text-ink transition-colors duration-200 hover:border-line-strong"
        href="/docs"
      >
        Read the docs
      </Link>
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <>
      <SiteHeader />
      {isPlaygroundInteractive ? (
        <PlaygroundConsole
          r2Enabled={hasR2Config()}
          s3Enabled={hasS3Config()}
        />
      ) : (
        <ProductionNotice />
      )}
      <SiteFooter />
    </>
  );
}
