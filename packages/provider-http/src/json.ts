import { ProviderError } from "@upflowi/core";

/** Narrows a parsed JSON value down to a plain object so its fields can be read safely. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reads a string field from a parsed JSON object, or `undefined` if it's missing or the wrong type. */
export function readString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

/** Reads a number field from a parsed JSON object, or `undefined` if it's missing or the wrong type. */
export function readNumber(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = record[key];
  return typeof value === "number" ? value : undefined;
}

/** Parses `text` as JSON, wrapping a parse failure into a {@link ProviderError}. */
export function parseJson(
  text: string,
  fileId: string,
  operation: string,
): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (caught) {
    const cause = caught instanceof Error ? caught : new Error(String(caught));
    throw new ProviderError(
      `Failed to parse the backend's JSON response for ${operation}.`,
      {
        cause,
        fileId,
      },
    );
  }
}
