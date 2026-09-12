"use client";

import { cn } from "@/lib/utils";

export type SegmentedControlOption<TValue extends string> = {
  value: TValue;
  label: string;
  disabled?: boolean;
  hint?: string;
};

export function SegmentedControl<TValue extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: TValue;
  options: ReadonlyArray<SegmentedControlOption<TValue>>;
  onChange: (value: TValue) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink-faint">
        {label}
      </span>
      <div
        aria-label={label}
        className="flex flex-wrap gap-1 rounded-xl border border-line bg-bg-elevated p-1"
        role="radiogroup"
      >
        {options.map((option) => {
          const isActive = option.value === value;
          const isDisabled = disabled || option.disabled;
          return (
            <button
              aria-pressed={isActive}
              className={cn(
                "flex-1 cursor-pointer rounded-lg px-3 py-1.5 font-mono text-[11.5px] transition-colors duration-150",
                isActive ? "bg-ink text-bg" : "text-ink-soft hover:text-ink",
                isDisabled &&
                  "cursor-not-allowed opacity-40 hover:text-ink-soft",
              )}
              disabled={isDisabled}
              key={option.value}
              onClick={() => onChange(option.value)}
              title={option.hint}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
