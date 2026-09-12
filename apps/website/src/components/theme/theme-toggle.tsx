"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTheme } from "next-themes";
import { useLayoutEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { MoonIcon, SunIcon, SystemIcon } from "./theme-icons";

const options = [
  {
    Icon: SunIcon,
    label: "Light",
    value: "light",
  },
  {
    Icon: SystemIcon,
    label: "System",
    value: "system",
  },
  {
    Icon: MoonIcon,
    label: "Dark",
    value: "dark",
  },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // Server render and the client's very first render (pre-hydration) must produce byte-identical
  // HTML, or React discards and re-renders the mismatched subtree — the flash/console error this
  // was causing. The server has no way to know the visitor's theme (it's in localStorage), so
  // instead of guessing, both sides start with `mounted = false` — no button shows as active,
  // which is a structurally identical, valid first render either way. `useLayoutEffect` (not
  // `useEffect`) then flips `mounted` synchronously, before the browser paints that first frame,
  // so the correct icon is what actually reaches the screen — no visible in-between state.
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  const active = theme ?? "system";

  return (
    <div
      aria-label="Theme"
      className="relative flex items-center gap-0.5 rounded-full border border-line bg-bg-elevated p-0.5"
      role="radiogroup"
    >
      {options.map(({ value, label, Icon }) => {
        const isActive = mounted && active === value;
        return (
          <button
            aria-label={label}
            aria-pressed={isActive}
            className="relative cursor-pointer z-10 flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-300"
            key={value}
            onClick={() => setTheme(value)}
            type="button"
          >
            {isActive ? (
              <motion.span
                className="absolute inset-0 rounded-full bg-ink"
                layoutId="theme-toggle-pill"
                transition={{
                  damping: 34,
                  stiffness: 500,
                  type: "spring",
                }}
              />
            ) : null}
            <AnimatePresence
              initial={false}
              mode="wait"
            >
              <motion.span
                animate={{
                  opacity: 1,
                  scale: 1,
                }}
                className="relative"
                exit={{
                  opacity: 0,
                  scale: 0.7,
                }}
                initial={{
                  opacity: 0,
                  scale: 0.7,
                }}
                key={isActive ? `${value}-active` : `${value}-idle`}
                transition={{
                  duration: 0.15,
                }}
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5",
                    isActive ? "text-bg" : "text-ink-faint",
                  )}
                />
              </motion.span>
            </AnimatePresence>
          </button>
        );
      })}
    </div>
  );
}
