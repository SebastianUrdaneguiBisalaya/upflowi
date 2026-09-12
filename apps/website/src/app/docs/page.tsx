import type { Metadata } from "next";
import { DocsContent } from "@/components/docs/docs-content";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { isPlaygroundInteractive } from "@/lib/playground/env";

export const metadata: Metadata = {
  description:
    "Every upflowi feature, explained with the real exported API and runnable code: orchestration, concurrency, chunking, retries, events, cancellation, persistence, transports, and providers.",
  title: "Docs — upflowi",
};

export default function DocsPage() {
  return (
    <>
      <SiteHeader showPlayground={isPlaygroundInteractive} />
      <DocsContent />
      <SiteFooter showPlayground={isPlaygroundInteractive} />
    </>
  );
}
