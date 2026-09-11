import { ArchitectureFlow } from "@/components/landing/architecture-flow";
import { Reveal } from "@/components/ui/reveal";
import { architectureLayers } from "@/lib/architecture";

export function Architecture() {
  return (
    <div>
      <ArchitectureFlow />

      <div className="relative pl-8">
        <div
          aria-hidden="true"
          className="absolute bottom-1 left-0.75 top-1 w-px bg-line"
        />

        {architectureLayers.map((layer, i) => (
          <Reveal
            className="relative pb-9 last:pb-0"
            delay={i * 0.06}
            key={layer.name}
          >
            <span
              aria-hidden="true"
              className="absolute left-7.25 top-1.75 h-1.75 w-1.75 rounded-full bg-ink"
            />

            <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="font-mono text-[13px] uppercase tracking-wide text-ink">
                {layer.name}
              </h3>
              <span className="font-mono text-[10.5px] text-ink-faint">
                {layer.files}
              </span>
            </div>

            <p className="mb-2.5 max-w-[52ch] text-[14.5px] leading-[1.65] text-ink-soft">
              {layer.role}
            </p>

            <div className="flex flex-col gap-1 font-mono text-[11.5px] leading-[1.7] text-ink-faint">
              <span>
                <span className="text-ink-soft">knows</span> — {layer.knows}
              </span>
              <span>
                <span className="text-ink-soft">never</span> — {layer.never}
              </span>
            </div>
          </Reveal>
        ))}
      </div>

      <p className="mt-2 max-w-[62ch] border-t border-line pt-6 text-[13px] leading-[1.7] text-ink-faint">
        A new transport or provider never touches{" "}
        <code className="text-ink-soft">scheduler.ts</code> or{" "}
        <code className="text-ink-soft">queue.ts</code> — if it does, the
        abstraction leaked.
      </p>
    </div>
  );
}
