import "server-only";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  ListPartsCommand,
  type S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Matches `@upflowi/provider-s3`'s `S3PresignedUrlOperation` and `@upflowi/provider-r2`'s
 * `R2PresignedUrlOperation` — the two packages define this union independently (see AGENTS.md,
 * "no shared provider branches"), but the shape is identical, and so is what a backend needs to
 * presign for each: this one function backs both playground presign routes.
 */
export type PresignOperation =
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

function isPresignOperation(value: unknown): value is PresignOperation {
  if (value === null || typeof value !== "object" || !("type" in value)) {
    return false;
  }
  const type = (
    value as {
      type: unknown;
    }
  ).type;
  return (
    type === "create" ||
    type === "uploadPart" ||
    type === "complete" ||
    type === "abort" ||
    type === "listParts"
  );
}

export function parsePresignOperation(
  body: unknown,
): PresignOperation | undefined {
  return isPresignOperation(body) ? body : undefined;
}

/** Objects created by the playground are namespaced under this prefix, so they're easy to find
 * and clean up in whatever bucket you point `PLAYGROUND_AWS_S3_BUCKET`/`PLAYGROUND_R2_BUCKET` at. */
export function playgroundKey(fileId: string): string {
  return `playground/${fileId}`;
}

const EXPIRES_IN_SECONDS = 900;

export async function presign(
  client: S3Client,
  bucket: string,
  operation: PresignOperation,
): Promise<{
  url: string;
}> {
  const key = playgroundKey(operation.fileId);

  // Each branch calls getSignedUrl directly (rather than building a command union first) because
  // its overloads are keyed to one concrete Command type each — a union confuses inference.
  switch (operation.type) {
    case "create": {
      const url = await getSignedUrl(
        client,
        new CreateMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
        }),
        {
          expiresIn: EXPIRES_IN_SECONDS,
        },
      );
      return {
        url,
      };
    }
    case "uploadPart": {
      const url = await getSignedUrl(
        client,
        new UploadPartCommand({
          Bucket: bucket,
          Key: key,
          PartNumber: operation.partNumber,
          UploadId: operation.uploadId,
        }),
        {
          expiresIn: EXPIRES_IN_SECONDS,
        },
      );
      return {
        url,
      };
    }
    case "complete": {
      const url = await getSignedUrl(
        client,
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: operation.uploadId,
        }),
        {
          expiresIn: EXPIRES_IN_SECONDS,
        },
      );
      return {
        url,
      };
    }
    case "abort": {
      const url = await getSignedUrl(
        client,
        new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: operation.uploadId,
        }),
        {
          expiresIn: EXPIRES_IN_SECONDS,
        },
      );
      return {
        url,
      };
    }
    case "listParts": {
      const url = await getSignedUrl(
        client,
        new ListPartsCommand({
          Bucket: bucket,
          Key: key,
          UploadId: operation.uploadId,
        }),
        {
          expiresIn: EXPIRES_IN_SECONDS,
        },
      );
      return {
        url,
      };
    }
  }
}
