import { S3Client } from "@aws-sdk/client-s3";
import { readR2Config, rejectOutsidePlaygroundDev } from "@/lib/playground/env";
import { parsePresignOperation, presign } from "@/lib/playground/s3-compatible";

export async function POST(request: Request): Promise<Response> {
  const rejected = rejectOutsidePlaygroundDev();
  if (rejected) {
    return rejected;
  }

  const config = readR2Config();
  if (!config) {
    return Response.json(
      {
        message:
          "R2 isn't configured. Add PLAYGROUND_R2_ACCOUNT_ID, PLAYGROUND_R2_ACCESS_KEY_ID, PLAYGROUND_R2_SECRET_ACCESS_KEY, and PLAYGROUND_R2_BUCKET to apps/website/.env.local.",
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
        message: "Expected a valid R2 presign operation in the request body.",
      },
      {
        status: 400,
      },
    );
  }

  // R2 is S3-API-compatible: same commands, account-scoped endpoint instead of a region, "auto"
  // region (Cloudflare's own recommendation for the AWS SDK v3 client).
  const client = new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    region: "auto",
  });

  const result = await presign(client, config.bucket, operation);
  return Response.json(result);
}
