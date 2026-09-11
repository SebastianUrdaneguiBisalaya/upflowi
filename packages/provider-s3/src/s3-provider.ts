import {
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
import { escapeXmlText, extractXmlBlocks, extractXmlTag } from "./xml.js";

/** One presigned request: the URL your backend signed, plus any headers it signed alongside it. */
export type S3PresignedRequest = {
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
};

/**
 * Every S3 multipart operation this provider needs a presigned URL for. Your backend receives one
 * of these (typically over your own API) and returns a presigned URL for the matching S3 REST
 * call — this provider never sees your AWS credentials.
 */
export type S3PresignedUrlOperation =
  | {
      readonly type: "create";
      readonly fileId: string;
    }
  | {
      readonly type: "uploadPart";
      readonly fileId: string;
      readonly uploadId: string;
      readonly partNumber: number;
    }
  | {
      readonly type: "complete";
      readonly fileId: string;
      readonly uploadId: string;
    }
  | {
      readonly type: "abort";
      readonly fileId: string;
      readonly uploadId: string;
    }
  | {
      readonly type: "listParts";
      readonly fileId: string;
      readonly uploadId: string;
    };

/** Configuration accepted by {@link createS3Provider}. */
export type S3ProviderConfig = {
  /**
   * Called before every S3 REST call this provider makes. Implement this on top of your own
   * backend endpoint (which holds your AWS credentials) to return a presigned URL for the given
   * operation — e.g. a presigned `POST .../{key}?uploads` for `"create"`, a presigned
   * `PUT .../{key}?partNumber=N&uploadId=...` for `"uploadPart"`, and so on.
   */
  getPresignedUrl(
    operation: S3PresignedUrlOperation,
  ): Promise<S3PresignedRequest>;
};

function requireTransport(context: StorageProviderContext): UploadTransport {
  if (!context.transport) {
    throw new UploadValidationError(
      "@upflowi/provider-s3 requires a transport to be configured (uploader-level or per-file).",
      {
        fileId: context.fileId,
      },
    );
  }
  return context.transport;
}

function getHeader(
  headers: Readonly<Record<string, string>>,
  name: string,
): string | undefined {
  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }
  return undefined;
}

function assertSuccessful(
  response: TransportResponse,
  operation: string,
  fileId: string,
): void {
  if (response.status < 200 || response.status >= 300) {
    throw new ProviderError(
      `S3 ${operation} failed with status ${response.status}.`,
      {
        fileId,
        providerCode: String(response.status),
      },
    );
  }
}

function buildCompleteMultipartUploadBody(
  parts: readonly ProviderPartResult[],
): string {
  const partsXml = parts
    .map(
      (part) =>
        `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>${escapeXmlText(part.etag)}</ETag></Part>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`;
}

function parsePart(block: string, fileId: string): ProviderPartResult {
  const partNumberText = extractXmlTag(block, "PartNumber");
  const etag = extractXmlTag(block, "ETag");
  const sizeText = extractXmlTag(block, "Size");
  const partNumber =
    partNumberText !== undefined ? Number(partNumberText) : Number.NaN;
  const sizeBytes = sizeText !== undefined ? Number(sizeText) : Number.NaN;

  if (
    !Number.isInteger(partNumber) ||
    etag === undefined ||
    !Number.isInteger(sizeBytes)
  ) {
    throw new ProviderError(
      "S3 returned a malformed <Part> entry while listing parts.",
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
 * Creates a {@link StorageProvider} for AWS S3 multipart uploads.
 *
 * This provider speaks S3's multipart REST protocol directly (initiate → upload part × N →
 * complete, with list-parts for resume) instead of depending on the AWS SDK, keeping it a
 * zero-runtime-dependency package. It never touches AWS credentials: every request goes through a
 * presigned URL your `getPresignedUrl` callback fetches from your own backend.
 *
 * @example
 * ```ts
 * const provider = createS3Provider({
 *   getPresignedUrl: (operation) => backendClient.getS3PresignedUrl(operation),
 * });
 * const uploader = createUploader({ provider, transport: createFetchTransport() });
 * ```
 */
export function createS3Provider(config: S3ProviderConfig): StorageProvider {
  return {
    async abort(providerUploadId, context) {
      const transport = requireTransport(context);
      const presigned = await config.getPresignedUrl({
        fileId: context.fileId,
        type: "abort",
        uploadId: providerUploadId,
      });
      const response = await transport.send({
        ...(presigned.headers
          ? {
              headers: presigned.headers,
            }
          : {}),
        method: "DELETE",
        ...(context.signal
          ? {
              signal: context.signal,
            }
          : {}),
        url: presigned.url,
      });
      assertSuccessful(response, "abort multipart upload", context.fileId);
    },

    async complete(
      providerUploadId,
      parts,
      context,
    ): Promise<ProviderCompleteResult> {
      const transport = requireTransport(context);
      const presigned = await config.getPresignedUrl({
        fileId: context.fileId,
        type: "complete",
        uploadId: providerUploadId,
      });
      const response = await transport.send({
        body: buildCompleteMultipartUploadBody(parts),
        headers: {
          "content-type": "application/xml",
          ...presigned.headers,
        },
        method: "POST",
        ...(context.signal
          ? {
              signal: context.signal,
            }
          : {}),
        url: presigned.url,
      });
      assertSuccessful(response, "complete multipart upload", context.fileId);

      const location = extractXmlTag(response.body, "Location");
      const etag = extractXmlTag(response.body, "ETag");
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
      const presigned = await config.getPresignedUrl({
        fileId,
        type: "create",
      });
      const response = await transport.send({
        ...(presigned.headers
          ? {
              headers: presigned.headers,
            }
          : {}),
        method: "POST",
        ...(context.signal
          ? {
              signal: context.signal,
            }
          : {}),
        url: presigned.url,
      });
      assertSuccessful(response, "initiate multipart upload", fileId);

      const providerUploadId = extractXmlTag(response.body, "UploadId");
      if (providerUploadId === undefined) {
        throw new ProviderError(
          "S3 did not return an UploadId when initiating a multipart upload.",
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
      const presigned = await config.getPresignedUrl({
        fileId,
        type: "listParts",
        uploadId: providerUploadId,
      });
      const response = await transport.send({
        ...(presigned.headers
          ? {
              headers: presigned.headers,
            }
          : {}),
        method: "GET",
        ...(context.signal
          ? {
              signal: context.signal,
            }
          : {}),
        url: presigned.url,
      });

      if (response.status === 404) {
        return undefined;
      }
      assertSuccessful(response, "list parts", fileId);

      const completedParts = extractXmlBlocks(response.body, "Part").map(
        (block) => parsePart(block, fileId),
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
      const presigned = await config.getPresignedUrl({
        fileId: context.fileId,
        partNumber: chunk.partNumber,
        type: "uploadPart",
        uploadId: providerUploadId,
      });
      const response = await transport.send({
        body,
        ...(presigned.headers
          ? {
              headers: presigned.headers,
            }
          : {}),
        method: "PUT",
        ...(context.signal
          ? {
              signal: context.signal,
            }
          : {}),
        url: presigned.url,
      });
      assertSuccessful(
        response,
        `upload part ${chunk.partNumber}`,
        context.fileId,
      );

      const etag = getHeader(response.headers, "etag");
      if (etag === undefined) {
        throw new ProviderError(
          `S3 did not return an ETag header for part ${chunk.partNumber}.`,
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
