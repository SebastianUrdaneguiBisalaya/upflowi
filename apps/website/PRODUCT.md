# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two distinct audiences this site serves:

1. **Evaluating developers** — arriving via search, GitHub, or word of mouth, deciding whether to adopt upflowi for file-upload needs in their app (browser and/or Node.js), comparing it against rolling their own upload logic, a full-service uploader with baked-in UI (e.g. Uppy), or a single-cloud SDK used directly. They need to understand fast what upflowi does and why it's different, and trust that it's real and maintained.
2. **Adopting developers** — already using or committed to upflowi, here for task-oriented reference: installation per package, API reference, event/error handling, provider setup (S3/R2/self-hosted).

## Product Purpose

upflowi is a headless, provider-agnostic file transfer engine for TypeScript/JavaScript. It orchestrates uploads — concurrency, chunking, multipart, retries, progress, pause/resume, cancellation, and resumable persistence — without shipping a UI and without locking consumers into one storage backend. It runs identically in the browser and in Node.js.

Success for this site: an evaluating developer understands the value proposition quickly enough to try the quick-start example; an adopting developer finds the answer they need without leaving the site.

## Positioning

Unlike a single-cloud SDK (the AWS SDK, a Cloudflare-specific client) or a full-service uploader with baked-in UI, upflowi is engine-only and storage-agnostic: the same orchestration code (queueing, chunking, retry, progress, resumable persistence) works against AWS S3, Cloudflare R2, or a self-hosted backend, through one small `StorageProvider` interface — and it never touches cloud credentials directly, since the S3/R2 providers are driven entirely by presigned URLs the consumer's own backend issues.

## Operating Context

- This site is a Next.js (App Router) + Tailwind CSS app living at `apps/website` inside the upflowi pnpm workspace, which also contains `packages/*` (the published SDK, independently-versioned packages) and `examples/*` (runnable demo apps).
- The SDK packages: `@upflowi/core` (the engine, zero runtime dependencies), `@upflowi/transport-fetch`, `@upflowi/transport-xhr` (browser-only), `@upflowi/provider-s3`, `@upflowi/provider-r2`, `@upflowi/provider-http` (self-hosted/custom backends).
- The SDK is not yet published to npm; it is under active development in this monorepo.

## Capabilities and Constraints

- Documentation must cover: per-package installation, a minimal `createUploader`/`add`/`start` example, a chunked multipart-to-S3 example using presigned URLs, every typed event, and every exported error class.
- This site ships no SDK logic itself — it only documents and markets the packages in `packages/*`.
- Code samples must stay accurate to the real exported API: no `class`/`new` on the SDK's public surface (factory functions only), typed events, typed errors.
- Undecided: deploy target/hosting; whether docs are hand-authored pages on the existing Next.js scaffold or built on a docs framework (e.g. Nextra, Fumadocs) layered on top of it; and the site's information architecture (single scrolling landing vs. a separate docs section or subdomain).

## Brand Commitments

None yet. No logo, palette, or tone has been confirmed — open for a visual world to be established in `new-work`.

## Evidence on Hand

- The repo-root `README.md` already contains real, accurate copy usable as source content: the value proposition, the package table, quick-start code, the S3 presigned-URL example, and the event/error reference.
- `examples/server-express` and `examples/browser-vite` are real, tested, working demos (verified end-to-end: a 12 MiB file uploaded in 3 parts, assembled byte-for-byte correctly) that can be linked, referenced, or embedded as proof.
- No testimonials, customer logos, or usage metrics exist; none should be fabricated.
- Current site content is only the Next.js starter scaffold ("Hello world!") — no real copy has been written for this site yet.

## Product Principles

- Show, don't just tell: prefer real, runnable code matching the actual exported API over abstract marketing claims.
- "Provider-agnostic" and "headless" are the two ideas everything else supports — no example should read as if S3 (or any single provider) is the only path.
- Never advertise a capability the SDK doesn't have yet (a hosted UI, a dashboard, npm availability) before it's true.
- Landing and docs share one voice but different jobs: landing sells the decision, docs serve the task — a visitor should be able to tell which mode a page is in.

## Accessibility & Inclusion

No product-specific requirement established yet.
