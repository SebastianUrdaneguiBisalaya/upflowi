import { ThemeToggle } from "@/components/theme/theme-toggle";

const links = [
  {
    href: "#definitions",
    label: "What it is",
  },
  {
    href: "#architecture",
    label: "Architecture",
  },
  {
    href: "#packages",
    label: "Packages",
  },
  {
    href: "#quickstart",
    label: "Quickstart",
  },
  {
    href: "#use-cases",
    label: "Use cases",
  },
  {
    href: "#types",
    label: "Types",
  },
];

export function SiteHeader() {
  return (
    <header className="sticky top-3 z-30 mx-auto max-w-205 px-6 sm:px-8">
      <div className="flex items-center justify-between gap-6 rounded-2xl border border-line bg-bg/75 px-5 py-3.5 backdrop-blur-md sm:px-6">
        <a
          className="font-body font-bold text-[15px] text-ink"
          href="#top"
        >
          upflowi
        </a>
        <nav className="hidden flex-1 items-baseline gap-5 pl-8 font-mono text-[11px] uppercase tracking-wide text-ink-faint lg:flex">
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
