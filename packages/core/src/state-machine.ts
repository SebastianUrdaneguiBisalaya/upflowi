import { UploadValidationError } from "./errors.js";

/** The lifecycle status of a single {@link Upload}. */
export type UploadStatus =
  | "queued"
  | "uploading"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

const ALLOWED_TRANSITIONS: Readonly<
  Record<UploadStatus, readonly UploadStatus[]>
> = {
  cancelled: [],
  completed: [],
  failed: [
    "queued",
  ],
  paused: [
    "uploading",
    "cancelled",
  ],
  queued: [
    "uploading",
    "cancelled",
  ],
  uploading: [
    "paused",
    "completed",
    "failed",
    "cancelled",
  ],
};

/** Returns whether transitioning an upload from `from` to `to` is legal. */
export function canTransition(from: UploadStatus, to: UploadStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Throws {@link UploadValidationError} if transitioning from `from` to `to` is not a legal status change. */
export function assertTransition(
  from: UploadStatus,
  to: UploadStatus,
  fileId?: string,
): void {
  if (!canTransition(from, to)) {
    throw new UploadValidationError(
      `Illegal upload status transition from "${from}" to "${to}".`,
      fileId
        ? {
            fileId,
          }
        : {},
    );
  }
}
