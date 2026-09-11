import {
  AbortError,
  NetworkError,
  type TransportRequest,
  type TransportResponse,
  type UploadTransport,
  UploadValidationError,
} from "@upflowi/core";

/** Configuration accepted by {@link createFetchTransport}. */
export type FetchTransportConfig = {
  /** Overrides the global `fetch` implementation. Useful for tests or non-standard runtimes. */
  fetch?: typeof fetch;
};

function computeBodySize(body: TransportRequest["body"]): number {
  if (body === undefined) {
    return 0;
  }
  if (typeof body === "string") {
    return new TextEncoder().encode(body).byteLength;
  }
  if (body instanceof Blob) {
    return body.size;
  }
  if (body instanceof ArrayBuffer) {
    return body.byteLength;
  }
  return body.byteLength;
}

/**
 * Normalizes a {@link TransportRequest} body into a `fetch`-safe `BodyInit`. `ArrayBufferView` is
 * copied into a fresh `Uint8Array` backed by a plain `ArrayBuffer`, since `TransportRequestBody`
 * allows any `ArrayBufferView` (including one backed by a `SharedArrayBuffer`), which `fetch`'s
 * `BodyInit` does not accept.
 */
function toBodyInit(body: TransportRequest["body"]): BodyInit | undefined {
  if (
    body === undefined ||
    typeof body === "string" ||
    body instanceof Blob ||
    body instanceof ArrayBuffer
  ) {
    return body;
  }
  const bytes = new Uint8Array(body.byteLength);
  bytes.set(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
  return bytes;
}

function normalizeHeaders(headers: Headers): Record<string, string> {
  const normalized: Record<string, string> = {};
  headers.forEach((value, key) => {
    normalized[key] = value;
  });
  return normalized;
}

function isAbortError(caught: Error): boolean {
  return caught instanceof DOMException && caught.name === "AbortError";
}

/**
 * Creates an {@link UploadTransport} backed by the standard Fetch API.
 *
 * Fetch has no native upload-progress event: this transport reports `onProgress` only at the
 * start (0 bytes) and once the response has been received (full size). For fine-grained,
 * continuously-updating upload progress in a browser, use `@upflowi/transport-xhr` instead.
 *
 * A non-2xx HTTP response is returned as a normal {@link TransportResponse}, not thrown — the
 * caller (`@upflowi/core`) decides what counts as a failure. Only network failures and aborts are
 * thrown, as {@link NetworkError} and {@link AbortError} respectively.
 */
export function createFetchTransport(
  config: FetchTransportConfig = {},
): UploadTransport {
  const fetchImpl = config.fetch ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new UploadValidationError(
      "No global `fetch` implementation was found. Pass one explicitly via `FetchTransportConfig.fetch`.",
    );
  }

  return {
    async send(request: TransportRequest): Promise<TransportResponse> {
      const totalBytes = computeBodySize(request.body);
      request.onProgress?.({
        loadedBytes: 0,
        totalBytes,
      });

      let response: Response;
      try {
        const body = toBodyInit(request.body);
        response = await fetchImpl(request.url, {
          method: request.method,
          ...(body !== undefined
            ? {
                body,
              }
            : {}),
          ...(request.headers !== undefined
            ? {
                headers: request.headers,
              }
            : {}),
          ...(request.signal !== undefined
            ? {
                signal: request.signal,
              }
            : {}),
        });
      } catch (caught) {
        const error =
          caught instanceof Error ? caught : new Error(String(caught));
        if (isAbortError(error)) {
          throw new AbortError();
        }
        throw new NetworkError(error.message, {
          cause: error,
        });
      }

      const body = await response.text();
      request.onProgress?.({
        loadedBytes: totalBytes,
        totalBytes,
      });

      return {
        body,
        headers: normalizeHeaders(response.headers),
        status: response.status,
      };
    },
  };
}
