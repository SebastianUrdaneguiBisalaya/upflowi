import "server-only";

/**
 * Whether the interactive playground console should render at all. Statically `true` only under
 * `next dev` — Next replaces `process.env.NODE_ENV` at build time, so every production build
 * (including every Vercel preview and production deployment) dead-code-eliminates the interactive
 * console, its client components, and everything they import.
 */
export const isPlaygroundInteractive = process.env.NODE_ENV === "development";

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value !== undefined && value.length > 0 ? value : undefined;
}

export function readS3Config():
  | {
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
      bucket: string;
    }
  | undefined {
  const region = readEnv("PLAYGROUND_AWS_REGION");
  const accessKeyId = readEnv("PLAYGROUND_AWS_ACCESS_KEY_ID");
  const secretAccessKey = readEnv("PLAYGROUND_AWS_SECRET_ACCESS_KEY");
  const bucket = readEnv("PLAYGROUND_AWS_S3_BUCKET");
  if (!region || !accessKeyId || !secretAccessKey || !bucket) {
    return undefined;
  }
  return {
    accessKeyId,
    bucket,
    region,
    secretAccessKey,
  };
}

export function readR2Config():
  | {
      accountId: string;
      accessKeyId: string;
      secretAccessKey: string;
      bucket: string;
    }
  | undefined {
  const accountId = readEnv("PLAYGROUND_R2_ACCOUNT_ID");
  const accessKeyId = readEnv("PLAYGROUND_R2_ACCESS_KEY_ID");
  const secretAccessKey = readEnv("PLAYGROUND_R2_SECRET_ACCESS_KEY");
  const bucket = readEnv("PLAYGROUND_R2_BUCKET");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return undefined;
  }
  return {
    accessKeyId,
    accountId,
    bucket,
    secretAccessKey,
  };
}

/** Boolean-only — safe to pass to a client component. Never leaks the credential values themselves. */
export function hasS3Config(): boolean {
  return readS3Config() !== undefined;
}

/** Boolean-only — safe to pass to a client component. Never leaks the credential values themselves. */
export function hasR2Config(): boolean {
  return readR2Config() !== undefined;
}

/**
 * Runtime guard for every `api/playground/**` route handler. Unlike the page component, a route
 * handler still deploys as a real serverless function regardless of branching inside it, so this
 * must be a genuine runtime check rather than relying on dead-code elimination — call it first in
 * every handler and return its result immediately when defined.
 */
export function rejectOutsidePlaygroundDev(): Response | undefined {
  if (!isPlaygroundInteractive) {
    return new Response(null, {
      status: 404,
    });
  }
  return undefined;
}
