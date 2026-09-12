import { abortUpload } from "@/lib/playground/custom-store";
import { rejectOutsidePlaygroundDev } from "@/lib/playground/env";

export async function DELETE(
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
  abortUpload(uploadId);
  return new Response(null, {
    status: 204,
  });
}
