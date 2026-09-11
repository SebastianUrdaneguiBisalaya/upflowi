"use client";

import { ReactLenis } from "lenis/react";
import type { ReactNode } from "react";
import { SmoothAnchorLinks } from "@/components/smooth-anchor-links";

export function SmoothScroll({ children }: { children: ReactNode }) {
  return (
    <ReactLenis
      options={{
        duration: 1.1,
        lerp: 0.11,
        smoothWheel: true,
      }}
      root
    >
      <SmoothAnchorLinks />
      {children}
    </ReactLenis>
  );
}
