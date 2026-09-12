import { createHash } from "node:crypto";
import { putPart } from "@/lib/playground/custom-store";
import { rejectOutsidePlaygroundDev } from "@/lib/playground/env";

/** Node's crypto module names algorithms lowercase and without the hyphen upflowi's
 * ChecksumAlgorithm uses ("SHA-256" -> "sha256"). MD5 is fine for this integrity check even though
 * it's unsuitable for anything security-sensitive — see @upflowi/provider-r2's checksum support. */
function toNodeHashAlgorithm(algorithm: string): string | undefined {
  const normalized = algorithm.toLowerCase().replace("-", "");
  return normalized === "sha256" || normalized === "md5"
    ? normalized
    : undefined;
}

/** Verifies `x-upflowi-checksum-algorithm`/`x-upflowi-checksum-value`, provider-http's own
 * convention (see packages/provider-http/src/http-provider.ts) — this is what makes the
 * playground's checksum toggle a real integrity check rather than a header nobody reads. */
function verifyChecksum(
  request: Request,
  buffer: Buffer,
):
  | {
      message: string;
    }
  | undefined {
  const algorithm = request.headers.get("x-upflowi-checksum-algorithm");
  const expected = request.headers.get("x-upflowi-checksum-value");
  if (algorithm === null || expected === null) {
    return undefined;
  }
  const nodeAlgorithm = toNodeHashAlgorithm(algorithm);
  if (nodeAlgorithm === undefined) {
    return {
      message: `Unsupported checksum algorithm "${algorithm}".`,
    };
  }
  const actual = createHash(nodeAlgorithm).update(buffer).digest("base64");
  if (actual !== expected) {
    return {
      message: `Checksum mismatch: expected ${expected}, computed ${actual}.`,
    };
  }
  return undefined;
}

/** `x-playground-fail-count` sent by the playground UI's "simulate transient failures" control:
 * an integer (fail this many attempts before succeeding) or the literal `always`. */
function parseFailuresBeforeSuccess(
  request: Request,
): number | "always" | undefined {
  const header = request.headers.get("x-playground-fail-count");
  if (header === null) {
    return undefined;
  }
  if (header === "always") {
    return "always";
  }
  const parsed = Number.parseInt(header, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export async function PUT(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      uploadId: string;
      partNumber: string;
    }>;
  },
): Promise<Response> {
  const rejected = rejectOutsidePlaygroundDev();
  if (rejected) {
    return rejected;
  }

  const { uploadId, partNumber } = await params;
  const buffer = Buffer.from(await request.arrayBuffer());

  const checksumError = verifyChecksum(request, buffer);
  if (checksumError) {
    return Response.json(checksumError, {
      status: 400,
    });
  }

  let result: ReturnType<typeof putPart>;
  try {
    result = putPart(
      uploadId,
      Number.parseInt(partNumber, 10),
      buffer,
      parseFailuresBeforeSuccess(request),
    );
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    return Response.json(
      {
        message,
      },
      {
        status: 413,
      },
    );
  }

  if (result === undefined) {
    return Response.json(
      {
        message: `Unknown upload "${uploadId}".`,
      },
      {
        status: 404,
      },
    );
  }
  if ("kind" in result) {
    return Response.json(
      {
        message: `Simulated failure on attempt ${result.attempt}.`,
      },
      {
        status: 503,
      },
    );
  }

  return Response.json({
    etag: result.etag,
  });
}
