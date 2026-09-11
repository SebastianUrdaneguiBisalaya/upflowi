import { describe, expect, it } from "vitest";
import { UploadValidationError } from "../src/errors.js";
import type { UploadStatus } from "../src/state-machine.js";
import { assertTransition, canTransition } from "../src/state-machine.js";

const ALL_STATUSES: readonly UploadStatus[] = [
  "queued",
  "uploading",
  "paused",
  "completed",
  "failed",
  "cancelled",
];

const LEGAL_TRANSITIONS: ReadonlyArray<
  readonly [
    UploadStatus,
    UploadStatus,
  ]
> = [
  [
    "queued",
    "uploading",
  ],
  [
    "queued",
    "cancelled",
  ],
  [
    "uploading",
    "paused",
  ],
  [
    "uploading",
    "completed",
  ],
  [
    "uploading",
    "failed",
  ],
  [
    "uploading",
    "cancelled",
  ],
  [
    "paused",
    "uploading",
  ],
  [
    "paused",
    "cancelled",
  ],
  [
    "failed",
    "queued",
  ],
];

describe("state machine", () => {
  it.each(LEGAL_TRANSITIONS)("allows %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it("rejects every transition not in the allow-list", () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const isLegal = LEGAL_TRANSITIONS.some(
          ([legalFrom, legalTo]) => legalFrom === from && legalTo === to,
        );
        expect(canTransition(from, to)).toBe(isLegal);
      }
    }
  });

  it("throws UploadValidationError with the fileId attached", () => {
    try {
      assertTransition("completed", "uploading", "file-1");
      throw new Error("expected assertTransition to throw");
    } catch (caught) {
      expect(caught).toBeInstanceOf(UploadValidationError);
      expect((caught as UploadValidationError).fileId).toBe("file-1");
    }
  });

  it("has no terminal state that transitions anywhere except failed -> queued", () => {
    expect(canTransition("completed", "queued")).toBe(false);
    expect(canTransition("cancelled", "queued")).toBe(false);
    expect(canTransition("failed", "queued")).toBe(true);
  });
});
