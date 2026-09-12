import { S3Client } from "@aws-sdk/client-s3";
import { readS3Config, rejectOutsidePlaygroundDev } from "@/lib/playground/env";
import { parsePresignOperation, presign } from "@/lib/playground/s3-compatible";

export async function POST(request: Request): Promise<Response> {
  const rejected = rejectOutsidePlaygroundDev();
  if (rejected) {
    return rejected;
  }

  const config = readS3Config();
  if (!config) {
    return Response.json(
      {
        message:
          "S3 isn't configured. Add PLAYGROUND_AWS_REGION, PLAYGROUND_AWS_ACCESS_KEY_ID, PLAYGROUND_AWS_SECRET_ACCESS_KEY, and PLAYGROUND_AWS_S3_BUCKET to apps/website/.env.local.",
      },
      {
        status: 501,
      },
    );
  }

  const operation = parsePresignOperation(
    await request.json().catch(() => undefined),
  );
  if (!operation) {
    return Response.json(
      {
        message: "Expected a valid S3 presign operation in the request body.",
      },
      {
        status: 400,
      },
    );
  }

  const client = new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    region: config.region,
  });

  const result = await presign(client, config.bucket, operation);
  return Response.json(result);
}
