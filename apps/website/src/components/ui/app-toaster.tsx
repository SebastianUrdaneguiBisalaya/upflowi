"use client";

import { useTheme } from "next-themes";
import type { ComponentProps } from "react";
import { Toaster } from "sonner";

export function AppToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      position="bottom-right"
      theme={
        (resolvedTheme as ComponentProps<typeof Toaster>["theme"]) ?? "dark"
      }
      toastOptions={{
        classNames: {
          description: "!text-ink-faint",
          toast:
            "!border !border-line !bg-bg-elevated !text-ink !font-mono !text-[12px] !shadow-none !rounded-none",
        },
      }}
    />
  );
}
