import {
  type ChecksumAlgorithm,
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

/**
 * S3's "additional checksums" feature (declared at `CreateMultipartUpload`, verified per part,
 * echoed back into `CompleteMultipartUpload`) only covers SHA-256 and CRC32. MD5 instead uses the
 * older, separate `Content-MD5` mechanism, which needs no declaration up front and never appears
 * in the `CompleteMultipartUpload` body — see
 * https://docs.aws.amazon.com/AmazonS3/latest/userguide/tutorial-s3-mpu-additional-checksums.html.
 */
type AdditionalChecksumAlgorithm = Extract<
  ChecksumAlgorithm,
  "SHA-256" | "CRC32"
>;

function isAdditionalChecksumAlgorithm(
  algorithm: ChecksumAlgorithm,
): algorithm is AdditionalChecksumAlgorithm {
  return algorithm === "SHA-256" || algorithm === "CRC32";
}

/** The `x-amz-checksum-*` header S3 expects the (base64) checksum value under, per algorithm. */
function checksumHeaderName(algorithm: ChecksumAlgorithm): string {
  return algorithm === "MD5"
    ? "content-md5"
    : `x-amz-checksum-${algorithm.toLowerCase().replace("-", "")}`;
}

/** The `<Checksum...>` tag S3 expects inside `CompleteMultipartUpload`'s `<Part>` body, per algorithm. */
function checksumXmlTag(algorithm: AdditionalChecksumAlgorithm): string {
  return algorithm === "SHA-256" ? "ChecksumSHA256" : "ChecksumCRC32";
}

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
      /**
       * Set when the consumer configured a {@link ChecksumComputer} using SHA-256 or CRC32 — S3
       * requires the algorithm to be declared as `ChecksumAlgorithm` on `CreateMultipartUpload`
       * (via `getSignedUrl`/`CreateMultipartUploadCommand`) before any part's checksum header is
       * honored. Not set for MD5 (the older `Content-MD5` mechanism needs no such declaration).
       */
      readonly checksumAlgorithm?: "SHA-256" | "CRC32";
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
        retryable: response.status >= 500 || response.status === 429,
      },
    );
  }
}

function buildCompleteMultipartUploadBody(
  parts: readonly ProviderPartResult[],
  additionalChecksumAlgorithm: AdditionalChecksumAlgorithm | undefined,
): string {
  const tag = additionalChecksumAlgorithm
    ? checksumXmlTag(additionalChecksumAlgorithm)
    : undefined;
  const partsXml = parts
    .map(
      (part) =>
        `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>${escapeXmlText(part.etag)}</ETag>${
          tag && part.checksum
            ? `<${tag}>${escapeXmlText(part.checksum)}</${tag}>`
            : ""
        }</Part>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`;
}

function parsePart(
  block: string,
  fileId: string,
  additionalChecksumAlgorithm: AdditionalChecksumAlgorithm | undefined,
): ProviderPartResult {
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

  const checksum = additionalChecksumAlgorithm
    ? extractXmlTag(block, checksumXmlTag(additionalChecksumAlgorithm))
    : undefined;

  return {
    etag,
    partNumber,
    sizeBytes,
    ...(checksum
      ? {
          checksum,
        }
      : {}),
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
      const additionalChecksumAlgorithm =
        context.checksum &&
        isAdditionalChecksumAlgorithm(context.checksum.algorithm)
          ? context.checksum.algorithm
          : undefined;
      const response = await transport.send({
        body: buildCompleteMultipartUploadBody(
          parts,
          additionalChecksumAlgorithm,
        ),
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
      const additionalChecksumAlgorithm =
        context.checksum &&
        isAdditionalChecksumAlgorithm(context.checksum.algorithm)
          ? context.checksum.algorithm
          : undefined;
      const presigned = await config.getPresignedUrl({
        fileId,
        type: "create",
        ...(additionalChecksumAlgorithm
          ? {
              checksumAlgorithm: additionalChecksumAlgorithm,
            }
          : {}),
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

      const additionalChecksumAlgorithm =
        context.checksum &&
        isAdditionalChecksumAlgorithm(context.checksum.algorithm)
          ? context.checksum.algorithm
          : undefined;
      const completedParts = extractXmlBlocks(response.body, "Part").map(
        (block) => parsePart(block, fileId, additionalChecksumAlgorithm),
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
      const checksumValue = context.checksum
        ? await context.checksum.compute(await toArrayBuffer(body))
        : undefined;
      const response = await transport.send({
        body,
        headers: {
          ...presigned.headers,
          ...(checksumValue && context.checksum
            ? {
                [checksumHeaderName(context.checksum.algorithm)]: checksumValue,
              }
            : {}),
        },
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
        ...(checksumValue &&
        context.checksum &&
        isAdditionalChecksumAlgorithm(context.checksum.algorithm)
          ? {
              checksum: checksumValue,
            }
          : {}),
      };
    },
  };
}
