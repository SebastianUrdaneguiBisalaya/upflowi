import { CopyButton } from "./copy-button";

export function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="border border-line-strong bg-bg-elevated">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <span className="font-mono text-[11px] tracking-wide text-ink-faint">
          {title}
        </span>
        <CopyButton
          label="Copy code"
          value={code}
        />
      </div>
      <pre className="overflow-x-auto px-6 py-6 font-mono text-[12.5px] leading-[1.75] text-ink-soft">
        <code>{code}</code>
      </pre>
    </div>
  );
}
