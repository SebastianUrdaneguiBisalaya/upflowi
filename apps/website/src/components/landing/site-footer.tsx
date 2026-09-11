"use client";

import { motion } from "motion/react";
import { GitHubIcon } from "@/components/theme/theme-icons";

const GITHUB_URL = "https://github.com/SebastianUrdaneguiBisalaya/upflowi";
const AUTHOR_URL = "https://sebastianurdanegui.com";
const AUTHOR_NAME = "Sebastian Marat Urdanegui Bisalaya";

const YEAR = new Date().getFullYear();

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-bg">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[url('/bg-granito.jpg')] bg-cover bg-center opacity-[0.07] mix-blend-multiply grayscale mask-[linear-gradient(to_bottom,transparent,black_180px)] dark:opacity-[0.10] dark:mix-blend-screen"
      />

      <div className="relative mx-auto max-w-205 px-6 pt-12 sm:px-8 sm:pt-14 @container">
        <motion.div
          className="flex flex-col gap-5 pb-10 sm:flex-row sm:items-baseline sm:justify-between"
          initial={{
            opacity: 0,
            y: 10,
          }}
          transition={{
            duration: 0.6,
            ease: [
              0.16,
              1,
              0.3,
              1,
            ],
          }}
          viewport={{
            margin: "-40px",
            once: true,
          }}
          whileInView={{
            opacity: 1,
            y: 0,
          }}
        >
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] leading-relaxed text-ink-faint">
              © {YEAR} upflowi — ISC License.
            </span>
            <a
              className="font-mono text-[11px] leading-relaxed text-ink-faint underline decoration-line underline-offset-4 transition-colors duration-200 hover:text-ink"
              href={AUTHOR_URL}
              rel="noreferrer noopener"
              target="_blank"
            >
              Built by {AUTHOR_NAME}
            </a>
          </div>

          <a
            aria-label="upflowi on GitHub"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-faint transition-colors duration-200 hover:border-line-strong hover:text-ink"
            href={GITHUB_URL}
            rel="noreferrer noopener"
            target="_blank"
          >
            <GitHubIcon className="h-4 w-4" />
          </a>
        </motion.div>

        <motion.div
          aria-hidden="true"
          className="relative w-full select-none overflow-hidden h-[20cqw]"
          initial={{
            opacity: 0,
            y: 24,
          }}
          transition={{
            delay: 0.1,
            duration: 1,
            ease: [
              0.16,
              1,
              0.3,
              1,
            ],
          }}
          viewport={{
            margin: "-40px",
            once: true,
          }}
          whileInView={{
            opacity: 1,
            y: 0,
          }}
        >
          <span className="absolute bottom-[-3.5cqw] left-1/2 -translate-x-1/2 whitespace-nowrap bg-clip-text font-body font-bold leading-[0.86] tracking-[-0.02em] text-transparent bg-[linear-gradient(to_bottom,color-mix(in_oklch,var(--color-ink)_50%,transparent)_0%,color-mix(in_oklch,var(--color-ink)_10%,transparent)_55%,color-mix(in_oklch,var(--color-ink)_2%,transparent)_100%)] text-[28cqw]">
            upflowi
          </span>
        </motion.div>
      </div>
    </footer>
  );
}
