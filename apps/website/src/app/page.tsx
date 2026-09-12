import { Architecture } from "@/components/landing/architecture";
import { DefinitionList } from "@/components/landing/definition-list";
import { Hero } from "@/components/landing/hero";
import { PackageList } from "@/components/landing/package-list";
import { Section } from "@/components/landing/section";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { TypeList } from "@/components/landing/type-list";
import { UseCases } from "@/components/landing/use-cases";
import { CodeBlock } from "@/components/ui/code-block";
import { definitions, errors, events, packages, useCases } from "@/lib/content";
import { isPlaygroundInteractive } from "@/lib/playground/env";

const QUICKSTART = `import { createUploader } from "@upflowi/core";
import { createFetchTransport } from "@upflowi/transport-fetch";
import { createS3Provider } from "@upflowi/provider-s3";

const uploader = createUploader({
  concurrency: 3,
  transport: createFetchTransport(),
  provider: createS3Provider({
    getPresignedUrl: (operation) => backendClient.getS3PresignedUrl(operation),
  }),
});

const upload = uploader.add({ source: mySource });
upload.on("progress", (progress) => console.log(\`\${progress.percent.toFixed(1)}%\`));
uploader.start();`;

export default function Home() {
  return (
    <>
      <SiteHeader showPlayground={isPlaygroundInteractive} />

      <Hero />

      <Section
        id="definitions"
        index="01"
      >
        <Section.Title>What it is, precisely</Section.Title>
        <DefinitionList>
          {definitions.map((d) => (
            <DefinitionList.Item
              key={d.term}
              term={d.term}
            >
              {d.body}
            </DefinitionList.Item>
          ))}
        </DefinitionList>
      </Section>

      <Section index="02">
        <Section.Title>Against the usual paths</Section.Title>
        <Section.Lede>
          A single-cloud SDK is fast to start and permanent to leave — switching
          storage means rewriting the upload path. A full-service uploader ships
          a UI you didn&apos;t ask for and now have to theme, translate, and
          maintain. upflowi keeps the orchestration — queueing, chunking, retry,
          progress, resumable state — identical across providers, and asks
          nothing of your interface.
        </Section.Lede>
      </Section>

      <Section
        id="architecture"
        index="03"
      >
        <Section.Title>Four layers, one boundary</Section.Title>
        <Section.Lede>
          Headless and provider-agnostic aren&apos;t claims — they&apos;re a
          consequence of keeping these four concerns apart. Each layer only ever
          talks to the one below it.
        </Section.Lede>
        <Architecture />
      </Section>

      <Section
        id="packages"
        index="04"
      >
        <Section.Title>Packages</Section.Title>
        <Section.Lede>
          A pnpm workspace. Install{" "}
          <code className="font-mono text-ink">@upflowi/core</code> plus one
          transport; add a provider only for multipart transfers.
        </Section.Lede>
        <PackageList>
          {packages.map((pkg) => (
            <PackageList.Item
              install={pkg.install}
              key={pkg.name}
              name={pkg.name}
            >
              {pkg.note}
            </PackageList.Item>
          ))}
        </PackageList>
      </Section>

      <Section
        id="quickstart"
        index="05"
      >
        <Section.Title>Quickstart</Section.Title>
        <Section.Lede>
          Multipart upload to S3, driven entirely by presigned URLs your backend
          issues.
        </Section.Lede>
        <CodeBlock
          code={QUICKSTART}
          title="quickstart.ts"
        />
      </Section>

      <Section
        id="use-cases"
        index="06"
      >
        <Section.Title>Every shape of upload</Section.Title>
        <UseCases items={useCases} />
      </Section>

      <Section
        id="types"
        index="07"
      >
        <Section.Title>Events and errors, typed</Section.Title>
        <Section.Lede>
          Every error extends{" "}
          <code className="font-mono text-ink">UploadError</code> — branch on it
          with <code className="font-mono text-ink">instanceof</code> instead of
          parsing strings.
        </Section.Lede>

        <h3 className="mb-4 font-mono text-[11px] uppercase tracking-wide text-ink-faint">
          Typed events
        </h3>
        <TypeList>
          {events.map((event) => (
            <TypeList.Item
              fields={event.payload}
              key={`${event.scope}.${event.name}`}
              kicker={event.scope}
              name={event.name}
              note={`Emitted by ${event.scope === "Upload" ? "every Upload handle" : "the Uploader"}.`}
            />
          ))}
        </TypeList>

        <h3 className="mb-4 mt-10 font-mono text-[11px] uppercase tracking-wide text-ink-faint">
          Typed errors
        </h3>
        <TypeList>
          {errors.map((err) => (
            <TypeList.Item
              fields={err.fields}
              key={err.name}
              kicker={`extends ${err.extends}`}
              name={err.name}
              note={err.note}
            />
          ))}
        </TypeList>
      </Section>

      <SiteFooter showPlayground={isPlaygroundInteractive} />
    </>
  );
}
