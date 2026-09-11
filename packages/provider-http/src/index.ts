// @upflowi/provider-http — storage provider for self-hosted/custom backends (VPS, internal APIs).
//
// This is the only file that decides the package's public surface (see AGENTS.md, section 1).

export type { HttpProviderConfig } from "./http-provider.js";
export { createHttpProvider } from "./http-provider.js";
