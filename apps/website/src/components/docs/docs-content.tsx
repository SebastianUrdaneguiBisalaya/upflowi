import { Section } from "@/components/landing/section";
import { CodeBlock } from "@/components/ui/code-block";
import { docsFeatures } from "@/lib/docs-content";

const RUN_LOCALLY = `git clone https://github.com/SebastianUrdaneguiBisalaya/upflowi.git
cd upflowi
pnpm install
pnpm run build

# apps/website/.env.local — optional, only needed to try S3/R2 for real:
# PLAYGROUND_AWS_REGION=...
# PLAYGROUND_AWS_ACCESS_KEY_ID=...
# PLAYGROUND_AWS_SECRET_ACCESS_KEY=...
# PLAYGROUND_AWS_S3_BUCKET=...
# PLAYGROUND_R2_ACCOUNT_ID=...
# PLAYGROUND_R2_ACCESS_KEY_ID=...
# PLAYGROUND_R2_SECRET_ACCESS_KEY=...
# PLAYGROUND_R2_BUCKET=...

pnpm --filter ./apps/website run dev
# open http://localhost:3000/playground — it becomes a live control room`;

function indexFor(position: number): string {
  return String(position + 1).padStart(2, "0");
}

export function DocsContent() {
  return (
    <>
      <Section
        border={false}
        id="docs-intro"
        index="00"
      >
        <Section.Title>Every feature, in code</Section.Title>
        <Section.Lede>
          This is the real, exported API — not marketing paraphrase. Want to try
          it instead of reading it? The{" "}
          <code className="font-mono text-ink">/playground</code> route (drag a
          file in, watch it chunk, pause it, cancel it, kill your dev server
          mid-transfer and resume) only runs when the site is running locally,
          against your own AWS/R2 credentials or the zero-config local backend —
          never against a deployed instance.
        </Section.Lede>
      </Section>

      {docsFeatures.map((feature, position) => (
        <Section
          id={feature.id}
          index={indexFor(position)}
          key={feature.id}
        >
          <span className="mb-2 block font-mono text-[10.5px] uppercase tracking-wide text-ink-faint">
            {feature.category}
          </span>
          <Section.Title>{feature.title}</Section.Title>
          <Section.Lede>{feature.description}</Section.Lede>
          <CodeBlock
            code={feature.code}
            title={`${feature.id}.ts`}
          />
        </Section>
      ))}

      <Section
        id="run-locally"
        index={indexFor(docsFeatures.length)}
      >
        <Section.Title>Run the interactive playground</Section.Title>
        <Section.Lede>
          Clone the repo and run the site locally —{" "}
          <code className="font-mono text-ink">/playground</code> becomes a live
          control room: pick a provider (S3, R2, or a zero-config custom
          backend), a transport, chunk size, and retry policy, then upload real
          files and watch every event fire.
        </Section.Lede>
        <CodeBlock
          code={RUN_LOCALLY}
          title="terminal"
        />
      </Section>
    </>
  );
}
