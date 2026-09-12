import type { Metadata } from "next";
import { notFound } from "next/navigation";
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

export default function PlaygroundPage() {
  if (!isPlaygroundInteractive) {
    notFound();
  }

  return (
    <>
      <SiteHeader showPlayground />
      <PlaygroundConsole
        r2Enabled={hasR2Config()}
        s3Enabled={hasS3Config()}
      />
      <SiteFooter showPlayground />
    </>
  );
}
