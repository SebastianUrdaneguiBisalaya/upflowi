"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { CodeBlock } from "@/components/ui/code-block";
import type { UseCase } from "@/lib/content";
import { cn } from "@/lib/utils";

export function UseCases({ items }: { items: UseCase[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id);
  const active = items.find((item) => item.id === activeId) ?? items[0];

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-x-6 gap-y-2 border-b border-line pb-4">
        {items.map((item) => {
          const isActive = item.id === active.id;
          return (
            <button
              aria-pressed={isActive}
              className={cn(
                "relative pb-2 font-mono text-[12px] tracking-wide transition-colors duration-200",
                isActive ? "text-ink" : "text-ink-faint hover:text-ink-soft",
              )}
              key={item.id}
              onClick={() => setActiveId(item.id)}
              type="button"
            >
              {item.label}
              {isActive ? (
                <motion.span
                  className="absolute -bottom-4.25 left-0 right-0 hidden h-px bg-ink sm:block"
                  layoutId="use-case-underline"
                  transition={{
                    damping: 40,
                    stiffness: 500,
                    type: "spring",
                  }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          animate={{
            opacity: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            y: -6,
          }}
          initial={{
            opacity: 0,
            y: 6,
          }}
          key={active.id}
          transition={{
            duration: 0.25,
            ease: [
              0.16,
              1,
              0.3,
              1,
            ],
          }}
        >
          <p className="mb-4 max-w-[58ch] text-[14.5px] leading-[1.7] text-ink-soft">
            {active.summary}
          </p>
          <CodeBlock
            code={active.code}
            title={`${active.id}.ts`}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
