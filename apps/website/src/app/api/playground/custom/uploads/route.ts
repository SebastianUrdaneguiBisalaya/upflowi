import { createUpload } from "@/lib/playground/custom-store";
import { rejectOutsidePlaygroundDev } from "@/lib/playground/env";

export async function POST(request: Request): Promise<Response> {
  const rejected = rejectOutsidePlaygroundDev();
  if (rejected) {
    return rejected;
  }

  const body: unknown = await request.json().catch(() => undefined);
  const fileId =
    body && typeof body === "object" && "fileId" in body
      ? String(
          (
            body as {
              fileId: unknown;
            }
          ).fileId,
        )
      : undefined;
  if (!fileId) {
    return Response.json(
      {
        message: "Expected a JSON body with a `fileId` string field.",
      },
      {
        status: 400,
      },
    );
  }

  const { uploadId } = createUpload(fileId);
  return Response.json({
    uploadId,
  });
}
