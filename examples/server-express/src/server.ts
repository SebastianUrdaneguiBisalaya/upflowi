import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import cors from "cors";
import type { Request, Response } from "express";
import express from "express";

/**
 * Minimal reference backend implementing @upflowi/provider-http's JSON-over-HTTP convention
 * against the local filesystem — no cloud account needed to try upflowi end to end. See this
 * example's README for the routes it implements, and the root README's S3 section for how the
 * same client code targets a real cloud provider instead.
 */

const PORT = Number(process.env.PORT ?? 3001);
const DATA_DIR = path.resolve(process.cwd(), ".data");
const PARTS_DIR = path.join(DATA_DIR, "parts");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

type UploadRecord = {
  readonly fileId: string;
};

const uploads = new Map<string, UploadRecord>();

function requireParam(value: string | string[] | undefined): string {
  if (typeof value !== "string") {
    throw new Error(
      "Expected a single route parameter, got an array or undefined.",
    );
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function partsDir(uploadId: string): string {
  return path.join(PARTS_DIR, uploadId);
}

function partFile(uploadId: string, partNumber: string | number): string {
  return path.join(partsDir(uploadId), `${partNumber}.part`);
}

async function hashFile(filePath: string): Promise<{
  etag: string;
  sizeBytes: number;
}> {
  const buffer = await readFile(filePath);
  return {
    etag: createHash("md5").update(buffer).digest("hex"),
    sizeBytes: buffer.byteLength,
  };
}

const app = express();
app.use(cors());

app.post("/uploads", express.json(), async (req: Request, res: Response) => {
  const fileId = isRecord(req.body)
    ? readString(req.body, "fileId")
    : undefined;
  if (fileId === undefined) {
    res.status(400).json({
      message: "`fileId` is required.",
    });
    return;
  }
  const uploadId = randomUUID();
  uploads.set(uploadId, {
    fileId,
  });
  await mkdir(partsDir(uploadId), {
    recursive: true,
  });
  res.json({
    uploadId,
  });
});

app.put(
  "/uploads/:uploadId/parts/:partNumber",
  express.raw({
    limit: "1gb",
    type: "*/*",
  }),
  async (req: Request, res: Response) => {
    const uploadId = requireParam(req.params.uploadId);
    const partNumber = requireParam(req.params.partNumber);
    if (!uploads.has(uploadId)) {
      res.status(404).json({
        message: "Unknown upload.",
      });
      return;
    }
    const body = req.body as Buffer;
    await writeFile(partFile(uploadId, partNumber), body);
    res.json({
      etag: createHash("md5").update(body).digest("hex"),
    });
  },
);

app.post(
  "/uploads/:uploadId/complete",
  express.json(),
  async (req: Request, res: Response) => {
    const uploadId = requireParam(req.params.uploadId);
    const record = uploads.get(uploadId);
    if (record === undefined) {
      res.status(404).json({
        message: "Unknown upload.",
      });
      return;
    }

    const partsValue = isRecord(req.body) ? req.body.parts : undefined;
    if (!Array.isArray(partsValue)) {
      res.status(400).json({
        message: "`parts` must be an array.",
      });
      return;
    }

    const partNumbers = partsValue
      .map((entry: unknown) => (isRecord(entry) ? entry.partNumber : undefined))
      .filter((value): value is number => typeof value === "number")
      .sort((a, b) => a - b);

    const destination = path.join(UPLOADS_DIR, record.fileId);
    await mkdir(path.dirname(destination), {
      recursive: true,
    });
    const handle = await open(destination, "w");
    try {
      for (const partNumber of partNumbers) {
        const chunk = await readFile(partFile(uploadId, partNumber));
        await handle.write(chunk);
      }
    } finally {
      await handle.close();
    }

    await rm(partsDir(uploadId), {
      force: true,
      recursive: true,
    });
    uploads.delete(uploadId);

    const { etag } = await hashFile(destination);
    res.json({
      etag,
      location: `/files/${encodeURIComponent(record.fileId)}`,
    });
  },
);

app.delete("/uploads/:uploadId", async (req: Request, res: Response) => {
  const uploadId = requireParam(req.params.uploadId);
  await rm(partsDir(uploadId), {
    force: true,
    recursive: true,
  });
  uploads.delete(uploadId);
  res.status(204).end();
});

app.get("/uploads/:uploadId/parts", async (req: Request, res: Response) => {
  const uploadId = requireParam(req.params.uploadId);
  if (!uploads.has(uploadId)) {
    res.status(404).json({
      message: "Unknown upload.",
    });
    return;
  }
  const dir = partsDir(uploadId);
  const entries = await readdir(dir).catch(() => [] as string[]);
  const parts = await Promise.all(
    entries
      .filter((name) => name.endsWith(".part"))
      .map(async (name) => {
        const partNumber = Number(name.slice(0, -".part".length));
        const { etag, sizeBytes } = await hashFile(path.join(dir, name));
        return {
          etag,
          partNumber,
          sizeBytes,
        };
      }),
  );
  res.json({
    parts,
  });
});

app.use("/files", express.static(UPLOADS_DIR));

app.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    _next: (error?: unknown) => void,
  ) => {
    console.error(error);
    res.status(500).json({
      message:
        error instanceof Error ? error.message : "Internal server error.",
    });
  },
);

async function main(): Promise<void> {
  await mkdir(PARTS_DIR, {
    recursive: true,
  });
  await mkdir(UPLOADS_DIR, {
    recursive: true,
  });
  app.listen(PORT, () => {
    console.log(`upflowi example server listening on http://localhost:${PORT}`);
  });
}

void main();
