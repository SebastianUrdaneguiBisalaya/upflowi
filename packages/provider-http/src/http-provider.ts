import {
  type ChecksumComputer,
  type ChunkRange,
  type ProviderCompleteResult,
  type ProviderCreateResult,
  ProviderError,
  type ProviderPartResult,
  type ProviderResumeState,
  type StorageProvider,
  type StorageProviderContext,
  type TransportRequestBody,
  type TransportResponse,
  type UploadTransport,
  UploadValidationError,
} from "@upflowi/core";
import { isRecord, parseJson, readNumber, readString } from "./json.js";

/** Reads the full byte content of a {@link TransportRequestBody}, regardless of its concrete shape. */
async function toArrayBuffer(body: TransportRequestBody): Promise<ArrayBuffer> {
  if (typeof body === "string") {
    return new TextEncoder().encode(body).buffer as ArrayBuffer;
  }
  if (body instanceof Blob) {
    return body.arrayBuffer();
  }
  if (body instanceof ArrayBuffer) {
    return body;
  }
  return body.buffer.slice(
    body.byteOffset,
    body.byteOffset + body.byteLength,
  ) as ArrayBuffer;
}

/**
 * Computes `context.checksum` over `body`, if a {@link ChecksumComputer} was configured, and
 * returns the two headers this provider's backend convention expects it under. Returns an empty
 * object (no headers added) when no checksum computer is configured — the feature is entirely
 * opt-in on both ends: the consumer configures a `ChecksumComputer`, and the backend chooses
 * whether to read/verify these headers at all.
 */
async function computeChecksumHeaders(
  checksum: ChecksumComputer | undefined,
  body: TransportRequestBody,
): Promise<Record<string, string>> {
  if (!checksum) {
    return {};
  }
  const value = await checksum.compute(await toArrayBuffer(body));
  return {
    "x-upflowi-checksum-algorithm": checksum.algorithm,
    "x-upflowi-checksum-value": value,
  };
}

/** Configuration accepted by {@link createHttpProvider}. */
export type HttpProviderConfig = {
  /** Base URL of your own backend, e.g. `https://api.example.com` or `https://my-vps.example.com`. */
  baseUrl: string;
  /**
   * Called before every request to attach auth headers (a bearer token, a session cookie header,
   * ...). Unlike `@upflowi/provider-s3`/`-r2`, this provider talks to your own trusted backend
   * directly rather than a presigned third-party URL, so sending your own auth here is expected.
   */
  getHeaders?: () =>
    | Promise<Readonly<Record<string, string>>>
    | Readonly<Record<string, string>>;
};

function requireTransport(context: StorageProviderContext): UploadTransport {
  if (!context.transport) {
    throw new UploadValidationError(
      "@upflowi/provider-http requires a transport to be configured (uploader-level or per-file).",
      {
        fileId: context.fileId,
      },
    );
  }
  return context.transport;
}

async function resolveHeaders(
  config: HttpProviderConfig,
  extra: Readonly<Record<string, string>> = {},
): Promise<Record<string, string>> {
  const dynamic = config.getHeaders ? await config.getHeaders() : {};
  return {
    ...extra,
    ...dynamic,
  };
}

function assertSuccessful(
  response: TransportResponse,
  operation: string,
  fileId: string,
): void {
  if (response.status < 200 || response.status >= 300) {
    throw new ProviderError(
      `Backend ${operation} failed with status ${response.status}.`,
      {
        fileId,
        providerCode: String(response.status),
        retryable: response.status >= 500 || response.status === 429,
      },
    );
  }
}

function parsePartEntry(entry: unknown, fileId: string): ProviderPartResult {
  if (!isRecord(entry)) {
    throw new ProviderError(
      "The backend returned a malformed part entry while listing parts.",
      {
        fileId,
      },
    );
  }
  const partNumber = readNumber(entry, "partNumber");
  const etag = readString(entry, "etag");
  const sizeBytes = readNumber(entry, "sizeBytes");
  if (
    partNumber === undefined ||
    etag === undefined ||
    sizeBytes === undefined
  ) {
    throw new ProviderError(
      "The backend returned a part entry missing `partNumber`, `etag`, or `sizeBytes` while listing parts.",
      {
        fileId,
      },
    );
  }
  return {
    etag,
    partNumber,
    sizeBytes,
  };
}

/**
 * Creates a {@link StorageProvider} for a self-hosted or otherwise custom backend — your own VPS,
 * an internal API, anything that doesn't speak S3/R2's protocol. Implement these five routes on
 * that backend — no XML, no cloud SDK, just plain JSON:
 *
 * ```text
 * POST   {baseUrl}/uploads                               -> { uploadId: string }
 * PUT    {baseUrl}/uploads/{uploadId}/parts/{partNumber}  -> { etag: string }   (body = raw part bytes)
 * POST   {baseUrl}/uploads/{uploadId}/complete            -> { location?: string, etag?: string }
 * DELETE {baseUrl}/uploads/{uploadId}                     -> any 2xx
 * GET    {baseUrl}/uploads/{uploadId}/parts               -> { parts: Array<{ partNumber, etag, sizeBytes }> }
 *                                                             (404 if the upload is unknown/expired)
 * ```
 *
 * Unlike `@upflowi/provider-s3`/`-r2`, which never see cloud credentials because bytes flow
 * straight to the cloud provider via presigned URLs, this provider talks directly to your own
 * backend (which you already trust), so it supports sending your own auth headers via
 * `getHeaders`.
 *
 * @example
 * ```ts
 * const provider = createHttpProvider({
 *   baseUrl: "https://my-vps.example.com/api",
 *   getHeaders: () => ({ authorization: `Bearer ${getSessionToken()}` }),
 * });
 * const uploader = createUploader({ provider, transport: createFetchTransport() });
 * ```
 */
export function createHttpProvider(
  config: HttpProviderConfig,
): StorageProvider {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");

  return {
    async abort(providerUploadId, context) {
      const transport = requireTransport(context);
      const headers = await resolveHeaders(config);
      const response = await transport.send({
        headers,
        method: "DELETE",
        ...(context.signal
          ? {
              signal: context.signal,
            }
          : {}),
        url: `${baseUrl}/uploads/${encodeURIComponent(providerUploadId)}`,
      });
      assertSuccessful(response, "abort upload", context.fileId);
    },

    async complete(
      providerUploadId,
      parts,
      context,
    ): Promise<ProviderCompleteResult> {
      const transport = requireTransport(context);
      const headers = await resolveHeaders(config, {
        "content-type": "application/json",
      });
      const response = await transport.send({
        body: JSON.stringify({
          parts: parts.map((part) => ({
            etag: part.etag,
            partNumber: part.partNumber,
            sizeBytes: part.sizeBytes,
          })),
        }),
        headers,
        method: "POST",
        ...(context.signal
          ? {
              signal: context.signal,
            }
          : {}),
        url: `${baseUrl}/uploads/${encodeURIComponent(providerUploadId)}/complete`,
      });
      assertSuccessful(response, "complete upload", context.fileId);

      const parsed = parseJson(
        response.body,
        context.fileId,
        "complete upload",
      );
      const location = isRecord(parsed)
        ? readString(parsed, "location")
        : undefined;
      const etag = isRecord(parsed) ? readString(parsed, "etag") : undefined;
      return {
        ...(location !== undefined
          ? {
              location,
            }
          : {}),
        ...(etag !== undefined
          ? {
              etag,
            }
          : {}),
      };
    },

    async create(fileId, context): Promise<ProviderCreateResult> {
      const transport = requireTransport(context);
      const headers = await resolveHeaders(config, {
        "content-type": "application/json",
      });
      const response = await transport.send({
        body: JSON.stringify({
          fileId,
        }),
        headers,
        method: "POST",
        ...(context.signal
          ? {
              signal: context.signal,
            }
          : {}),
        url: `${baseUrl}/uploads`,
      });
      assertSuccessful(response, "create upload", fileId);

      const parsed = parseJson(response.body, fileId, "create upload");
      const providerUploadId = isRecord(parsed)
        ? readString(parsed, "uploadId")
        : undefined;
      if (providerUploadId === undefined) {
        throw new ProviderError(
          "The backend did not return an `uploadId` when creating an upload.",
          {
            fileId,
          },
        );
      }
      return {
        providerUploadId,
      };
    },

    async resume(
      fileId,
      providerUploadId,
      context,
    ): Promise<ProviderResumeState | undefined> {
      const transport = requireTransport(context);
      const headers = await resolveHeaders(config);
      const response = await transport.send({
        headers,
        method: "GET",
        ...(context.signal
          ? {
              signal: context.signal,
            }
          : {}),
        url: `${baseUrl}/uploads/${encodeURIComponent(providerUploadId)}/parts`,
      });

      if (response.status === 404) {
        return undefined;
      }
      assertSuccessful(response, "list parts", fileId);

      const parsed = parseJson(response.body, fileId, "list parts");
      // biome-ignore lint/complexity/useLiteralKeys: bracket access required by tsconfig's noPropertyAccessFromIndexSignature
      const partsValue = isRecord(parsed) ? parsed["parts"] : undefined;
      if (!Array.isArray(partsValue)) {
        throw new ProviderError(
          "The backend did not return a `parts` array when listing parts.",
          {
            fileId,
          },
        );
      }
      const completedParts = partsValue.map((entry: unknown) =>
        parsePartEntry(entry, fileId),
      );
      return {
        completedParts,
        providerUploadId,
      };
    },

    async uploadPart(
      providerUploadId: string,
      chunk: ChunkRange,
      body: TransportRequestBody,
      context: StorageProviderContext,
    ): Promise<ProviderPartResult> {
      const transport = requireTransport(context);
      // A default content-type is required here: unlike a Blob with its own `.type`, a raw
      // ArrayBuffer/ArrayBufferView/string body sent via fetch/XHR carries no content-type header
      // on its own, which breaks any server-side body parser that matches on it (e.g. Express's
      // `express.raw({ type: ... })`). `resolveHeaders` still lets `getHeaders()` override it.
      const checksumHeaders = await computeChecksumHeaders(
        context.checksum,
        body,
      );
      const headers = await resolveHeaders(config, {
        "content-type": "application/octet-stream",
        ...checksumHeaders,
      });
      const response = await transport.send({
        body,
        headers,
        method: "PUT",
        ...(context.signal
          ? {
              signal: context.signal,
            }
          : {}),
        url: `${baseUrl}/uploads/${encodeURIComponent(providerUploadId)}/parts/${chunk.partNumber}`,
      });
      assertSuccessful(
        response,
        `upload part ${chunk.partNumber}`,
        context.fileId,
      );

      const parsed = parseJson(
        response.body,
        context.fileId,
        `upload part ${chunk.partNumber}`,
      );
      const etag = isRecord(parsed) ? readString(parsed, "etag") : undefined;
      if (etag === undefined) {
        throw new ProviderError(
          `The backend did not return an \`etag\` for part ${chunk.partNumber}.`,
          {
            fileId: context.fileId,
            partNumber: chunk.partNumber,
          },
        );
      }
      return {
        etag,
        partNumber: chunk.partNumber,
        sizeBytes: chunk.size,
      };
    },
  };
}
