import type { ReactNode } from "react";

function DefinitionListRoot({ children }: { children: ReactNode }) {
  return <dl className="flex flex-col">{children}</dl>;
}

function DefinitionItem({
  term,
  children,
}: {
  term: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 border-t border-line py-5 last:border-b sm:grid-cols-[180px_1fr] sm:gap-6">
      <dt className="font-display text-[15.5px] text-ink">{term}</dt>
      <dd className="max-w-[54ch] text-[14.5px] leading-[1.7] text-ink-soft">
        {children}
      </dd>
    </div>
  );
}

export const DefinitionList = Object.assign(DefinitionListRoot, {
  Item: DefinitionItem,
});
