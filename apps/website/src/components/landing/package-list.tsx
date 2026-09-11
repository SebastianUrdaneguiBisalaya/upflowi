import type { ReactNode } from "react";
import { CopyButton } from "@/components/ui/copy-button";

function PackageListRoot({ children }: { children: ReactNode }) {
  return <div className="flex flex-col">{children}</div>;
}

function PackageItem({
  name,
  install,
  children,
}: {
  name: string;
  install: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 border-t border-line py-4 last:border-b sm:grid-cols-[minmax(220px,260px)_1fr_auto] sm:gap-x-10">
      <span className="font-mono text-[12.5px] text-ink font-bold">{name}</span>
      <span className="col-span-2 text-[14px] leading-[1.6] text-ink-soft sm:col-span-1">
        {children}
      </span>
      <CopyButton
        className="justify-self-end"
        label={`Copy install command for ${name}`}
        value={install}
      />
    </div>
  );
}

export const PackageList = Object.assign(PackageListRoot, {
  Item: PackageItem,
});
