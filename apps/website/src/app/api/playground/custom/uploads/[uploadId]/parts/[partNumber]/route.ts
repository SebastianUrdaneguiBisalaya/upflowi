import { putPart } from "@/lib/playground/custom-store";
import { rejectOutsidePlaygroundDev } from "@/lib/playground/env";

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
