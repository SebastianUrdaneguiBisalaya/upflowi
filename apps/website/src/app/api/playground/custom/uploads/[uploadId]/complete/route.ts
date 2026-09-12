import { completeUpload } from "@/lib/playground/custom-store";
import { rejectOutsidePlaygroundDev } from "@/lib/playground/env";

export async function POST(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      uploadId: string;
    }>;
  },
): Promise<Response> {
  const rejected = rejectOutsidePlaygroundDev();
  if (rejected) {
    return rejected;
  }

  const { uploadId } = await params;
  const result = completeUpload(uploadId);
  if (result === "not-found") {
    return Response.json(
      {
        message: `Unknown upload "${uploadId}".`,
      },
      {
        status: 404,
      },
    );
  }

  return Response.json({
    etag: result.etag,
  });
}
