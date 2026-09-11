import { UploadValidationError } from "./errors.js";

/** A single contiguous byte range of a file, ready to be read and transferred as one part. */
export type ChunkRange = {
  /** 1-indexed part number, matching the numbering most multipart providers (e.g. S3) expect. */
  readonly partNumber: number;
  /** Start byte offset, inclusive. */
  readonly start: number;
  /** End byte offset, exclusive. */
  readonly end: number;
  /** Number of bytes in this range (`end - start`). */
  readonly size: number;
};

/** The full set of chunk ranges computed for a file, plus the inputs used to compute it. */
export type ChunkPlan = {
  readonly totalSize: number;
  readonly chunkSize: number;
  readonly partCount: number;
  readonly ranges: readonly ChunkRange[];
};

function assertValidInputs(totalSize: number, chunkSize: number): void {
  if (!Number.isInteger(totalSize) || totalSize < 0) {
    throw new UploadValidationError(
      `totalSize must be a non-negative integer, received ${totalSize}.`,
    );
  }
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new UploadValidationError(
      `chunkSize must be a positive integer, received ${chunkSize}.`,
    );
  }
}

/**
 * Lazily iterates the {@link ChunkRange}s of a file of `totalSize` bytes cut into `chunkSize`-byte
 * parts, without loading the file into memory. A zero-byte file yields a single empty range so
 * callers can still perform a (zero-byte) upload.
 */
export function* iterateChunks(
  totalSize: number,
  chunkSize: number,
): Generator<ChunkRange, void, void> {
  assertValidInputs(totalSize, chunkSize);

  if (totalSize === 0) {
    yield {
      end: 0,
      partNumber: 1,
      size: 0,
      start: 0,
    };
    return;
  }

  let start = 0;
  let partNumber = 1;
  while (start < totalSize) {
    const end = Math.min(start + chunkSize, totalSize);
    yield {
      end,
      partNumber,
      size: end - start,
      start,
    };
    start = end;
    partNumber += 1;
  }
}

/** Eagerly computes a {@link ChunkPlan} for a file of `totalSize` bytes cut into `chunkSize`-byte parts. */
export function planChunks(totalSize: number, chunkSize: number): ChunkPlan {
  const ranges = Array.from(iterateChunks(totalSize, chunkSize));
  return {
    chunkSize,
    partCount: ranges.length,
    ranges,
    totalSize,
  };
}
