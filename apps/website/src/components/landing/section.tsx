import type { ReactNode } from "react";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

function SectionRoot({
  id,
  index,
  children,
  className,
  border = true,
}: {
  id?: string;
  index: string;
  children: ReactNode;
  className?: string;
  border?: boolean;
}) {
  return (
    <section
      className={cn(
        "mx-auto max-w-205 px-6 py-14 sm:px-8 sm:py-16",
        border && "border-t border-line",
        className,
      )}
      id={id}
    >
      <Reveal>
        <span className="mb-5 block font-mono text-[11px] text-ink-faint">
          {index}
        </span>
        {children}
      </Reveal>
    </section>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-7 max-w-[24ch] font-display text-[26px] font-medium leading-[1.3] text-ink sm:text-[28px]">
      {children}
    </h2>
  );
}

function SectionLede({ children }: { children: ReactNode }) {
  return (
    <p className="mb-6 max-w-[56ch] text-[15px] leading-[1.7] text-ink-soft">
      {children}
    </p>
  );
}

export const Section = Object.assign(SectionRoot, {
  Lede: SectionLede,
  Title: SectionTitle,
});
