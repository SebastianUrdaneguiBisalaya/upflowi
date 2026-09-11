import type { ReactNode } from "react";

function TypeListRoot({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>;
}

function TypeItem({
  name,
  kicker,
  fields,
  note,
}: {
  name: string;
  kicker: string;
  fields: Array<{
    field: string;
    type: string;
  }>;
  note: string;
}) {
  return (
    <div className="border border-line bg-bg-elevated px-5 py-4">
      <div className="mb-2.5 flex flex-col md:flex-row items-baseline justify-between gap-1 md:gap-3">
        <code className="font-mono text-[12.5px] text-ink">{name}</code>
        <span className="font-mono text-[10.5px] tracking-wide text-ink-faint">
          {kicker}
        </span>
      </div>
      {fields.length > 0 ? (
        <div className="mb-2.5 flex flex-col gap-1 border-l border-line pl-4 font-mono text-[12px] leading-[1.9]">
          {fields.map((f) => (
            <div
              className="flex gap-2"
              key={f.field}
            >
              <span className="text-ink-soft">{f.field}</span>
              <span className="text-ink-faint">{f.type}</span>
            </div>
          ))}
        </div>
      ) : null}
      <p className="text-[12.5px] leading-[1.6] text-ink-faint">{note}</p>
    </div>
  );
}

export const TypeList = Object.assign(TypeListRoot, {
  Item: TypeItem,
});
