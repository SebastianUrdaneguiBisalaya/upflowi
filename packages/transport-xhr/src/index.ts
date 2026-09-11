import {
  AbortError,
  NetworkError,
  type TransportRequest,
  type TransportResponse,
  type UploadTransport,
} from "@upflowi/core";

/** Configuration accepted by {@link createXhrTransport}. */
export type XhrTransportConfig = {
  /** Overrides how the underlying `XMLHttpRequest` instance is created. Useful for testing. */
  createXhr?: () => XMLHttpRequest;
};

/**
 * Normalizes a {@link TransportRequest} body into a value `XMLHttpRequest.send` accepts.
 * `ArrayBufferView` is copied into a fresh `Uint8Array` backed by a plain `ArrayBuffer`, since
 * `TransportRequestBody` allows any `ArrayBufferView` (including one backed by a
 * `SharedArrayBuffer`), which `XMLHttpRequestBodyInit` does not accept.
 */
function toXhrBody(
  body: TransportRequest["body"],
): XMLHttpRequestBodyInit | null {
  if (body === undefined) {
    return null;
  }
  if (
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

function parseResponseHeaders(raw: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of raw.trim().split(/\r?\n/)) {
    if (line === "") {
      continue;
    }
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    headers[key] = value;
  }
  return headers;
}

/**
 * Creates an {@link UploadTransport} backed by `XMLHttpRequest`, reporting fine-grained,
 * continuously-updating upload progress via `xhr.upload`'s `progress` event — something the
 * standard Fetch API cannot do. Browser-only: `XMLHttpRequest` is not a Node.js global.
 *
 * A non-2xx HTTP response is returned as a normal {@link TransportResponse}, not thrown — the
 * caller (`@upflowi/core`) decides what counts as a failure. Only network failures and aborts are
 * thrown, as {@link NetworkError} and {@link AbortError} respectively.
 */
export function createXhrTransport(
  config: XhrTransportConfig = {},
): UploadTransport {
  const createXhr = config.createXhr ?? (() => new XMLHttpRequest());

  return {
    send(request: TransportRequest): Promise<TransportResponse> {
      return new Promise<TransportResponse>((resolve, reject) => {
        const xhr = createXhr();
        xhr.open(request.method, request.url, true);

        if (request.headers) {
          for (const [key, value] of Object.entries(request.headers)) {
            xhr.setRequestHeader(key, value);
          }
        }

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            request.onProgress?.({
              loadedBytes: event.loaded,
              totalBytes: event.total,
            });
          }
        });

        xhr.addEventListener("load", () => {
          resolve({
            body: xhr.responseText,
            headers: parseResponseHeaders(xhr.getAllResponseHeaders()),
            status: xhr.status,
          });
        });

        xhr.addEventListener("error", () => {
          reject(new NetworkError(`XHR request to "${request.url}" failed.`));
        });

        xhr.addEventListener("timeout", () => {
          reject(
            new NetworkError(`XHR request to "${request.url}" timed out.`),
          );
        });

        xhr.addEventListener("abort", () => {
          reject(new AbortError());
        });

        const { signal } = request;
        if (signal) {
          if (signal.aborted) {
            xhr.abort();
            return;
          }
          signal.addEventListener("abort", () => xhr.abort(), {
            once: true,
          });
        }

        xhr.send(toXhrBody(request.body));
      });
    },
  };
}
