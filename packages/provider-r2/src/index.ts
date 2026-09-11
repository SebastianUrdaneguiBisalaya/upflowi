// @upflowi/provider-r2 — Cloudflare R2 multipart storage provider for @upflowi/core.
//
// This is the only file that decides the package's public surface (see AGENTS.md, section 1).

export type {
  R2PresignedRequest,
  R2PresignedUrlOperation,
  R2ProviderConfig,
} from "./r2-provider.js";
export { createR2Provider } from "./r2-provider.js";
