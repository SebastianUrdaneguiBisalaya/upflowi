import { Section } from "@/components/landing/section";
import { CodeBlock } from "@/components/ui/code-block";
import { docsFeatures } from "@/lib/docs-content";
import { DocsToc, DocsTocItem } from "./docs-toc";

function indexFor(position: number): string {
  return String(position + 1).padStart(2, "0");
}

export function DocsContent() {
  return (
    <>
      <DocsToc>
        <DocsTocItem
          id="docs-intro"
          title="Every feature, step by step"
        />
        {docsFeatures.map((feature) => (
          <DocsTocItem
            id={feature.id}
            key={feature.id}
            title={feature.title}
          />
        ))}
      </DocsToc>

      <Section
        border={false}
        id="docs-intro"
        index="00"
      >
        <Section.Title>Every feature, step by step</Section.Title>
        <Section.Lede>
          Installation, the exact type every function returns, every
          transport/provider combination, and how to wire persistence and
          integrity checking — enough to implement upflowi in a real project
          from this page alone.
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
    </>
  );
}
