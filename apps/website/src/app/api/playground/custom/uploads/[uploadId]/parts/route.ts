import { listParts } from "@/lib/playground/custom-store";
import { rejectOutsidePlaygroundDev } from "@/lib/playground/env";

export async function GET(
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
  const parts = listParts(uploadId);
  if (parts === undefined) {
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
    parts,
  });
}
