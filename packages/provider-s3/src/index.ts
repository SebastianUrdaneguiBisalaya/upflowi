// @upflowi/provider-s3 — AWS S3 multipart storage provider for @upflowi/core.
//
// This is the only file that decides the package's public surface (see AGENTS.md, section 1).

export type {
  S3PresignedRequest,
  S3PresignedUrlOperation,
  S3ProviderConfig,
} from "./s3-provider.js";
export { createS3Provider } from "./s3-provider.js";
