"use client";

import { useLenis } from "lenis/react";
import { useEffect } from "react";

// How far a section's content sits below the viewport top once scrolled to — well past
// clearing the sticky header, so there's real breathing room above the heading, not just
// enough to avoid overlap.
const HEADER_OFFSET = -80;

export function SmoothAnchorLinks() {
  const lenis = useLenis();

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;

      // Matches both a bare "#section" and a root-prefixed "/#section" (the header/footer use
      // the latter so the same link also works from other routes like /docs).
      const anchor = (event.target as HTMLElement).closest("a[href*='#']");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      const hashIndex = href.indexOf("#");
      const hash = href.slice(hashIndex + 1);
      if (!hash) return;

      const pathname = href.slice(0, hashIndex);
      // A link to a different route (or a full URL) navigates normally — scroll-mt-* on the
      // target handles the landing offset there instead of this same-page smooth scroll.
      if (pathname && pathname !== window.location.pathname) return;

      const targetEl = document.getElementById(hash);
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
