/**
 * Minimal, dependency-free helpers for reading and writing the small subset of the S3-compatible
 * multipart XML protocol R2 speaks. Deliberately not a general-purpose XML parser: these responses
 * have a flat, predictable shape, so a full parser would be dead weight (see AGENTS.md section 6:
 * zero runtime dependencies whenever possible).
 */

/** Returns the text content of the first `<tagName>...</tagName>` element found in `xml`, if any. */
export function extractXmlTag(
  xml: string,
  tagName: string,
): string | undefined {
  const match = new RegExp(`<${tagName}>([^<]*)</${tagName}>`).exec(xml);
  return match?.[1];
}

/** Returns the inner content of every `<tagName>...</tagName>` block found in `xml`, in order. */
export function extractXmlBlocks(
  xml: string,
  tagName: string,
): readonly string[] {
  const pattern = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "g");
  const blocks: string[] = [];
  for (const match of xml.matchAll(pattern)) {
    const captured = match[1];
    if (captured !== undefined) {
      blocks.push(captured);
    }
  }
  return blocks;
}

/** Escapes text for safe inclusion inside an XML element (only the characters XML requires it for). */
export function escapeXmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
