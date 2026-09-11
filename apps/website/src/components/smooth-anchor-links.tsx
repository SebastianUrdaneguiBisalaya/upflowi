"use client";

import { useLenis } from "lenis/react";
import { useEffect } from "react";

const HEADER_OFFSET = -88;

export function SmoothAnchorLinks() {
  const lenis = useLenis();

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;

      const anchor = (event.target as HTMLElement).closest("a[href^='#']");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.length < 2) return;

      const targetEl = document.getElementById(href.slice(1));
      if (!targetEl) return;

      event.preventDefault();
      lenis?.scrollTo(targetEl, {
        duration: 1.3,
        offset: HEADER_OFFSET,
      });
      history.pushState(null, "", href);
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [
    lenis,
  ]);

  return null;
}
