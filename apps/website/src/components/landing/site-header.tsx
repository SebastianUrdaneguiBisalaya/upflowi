import { ThemeToggle } from "@/components/theme/theme-toggle";

// Primary wayfinding only — the home page's own sections (What it is, Architecture,
// Packages, Quickstart, Use cases, Types) don't need top-level nav shortcuts; a visitor
// scrolls to reach them. The full sitemap, including those section anchors, lives in
// SiteFooter instead of overloading this bar.
const baseLinks = [
  {
    href: "/#packages",
    label: "Packages",
  },
  {
    href: "/#quickstart",
    label: "Quickstart",
  },
  {
    href: "/docs",
    label: "Docs",
  },
  {
    href: "/#footer",
    label: "More info",
  },
];

const playgroundLink = {
  href: "/playground",
  label: "Playground",
};

export function SiteHeader({
  showPlayground = false,
}: {
  showPlayground?: boolean;
} = {}) {
  const links = showPlayground
    ? [
        ...baseLinks.slice(0, 3),
        playgroundLink,
        ...baseLinks.slice(3),
      ]
    : baseLinks;

  return (
    <header className="sticky top-3 z-30 mx-auto max-w-205 px-6 sm:px-8">
      <div className="flex items-center justify-between gap-6 rounded-2xl border border-line bg-bg/75 px-5 py-3.5 backdrop-blur-md sm:px-6">
        <a
          className="font-body font-bold text-[15px] text-ink"
          href="/"
        >
          upflowi
        </a>
        <nav className="hidden md:flex flex-row items-center gap-4 pl-6 font-mono text-[11px] uppercase tracking-wide text-ink-faint sm:gap-5 sm:pl-8">
          {links.map((link) => (
            <a
              className="transition-colors duration-200 hover:text-ink"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
