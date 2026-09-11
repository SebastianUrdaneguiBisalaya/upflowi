/** The body accepted by a {@link UploadTransport} request. */
export type TransportRequestBody =
  | string
  | ArrayBuffer
  | ArrayBufferView
  | Blob;

/** A single progress tick reported by a transport while a request is in flight. */
export type TransportProgressEvent = {
  readonly loadedBytes: number;
  readonly totalBytes: number;
};

/** An HTTP method a transport must support. */
export type TransportMethod = "GET" | "PUT" | "POST" | "DELETE";

/** Describes a single HTTP request a transport must perform. */
export type TransportRequest = {
  readonly url: string;
  readonly method: TransportMethod;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: TransportRequestBody;
  readonly signal?: AbortSignal;
  readonly onProgress?: (event: TransportProgressEvent) => void;
};

/** The result of a completed {@link UploadTransport.send} call. */
export type TransportResponse = {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
};

/**
 * How bytes physically move over HTTP. Has no concept of "multipart" or a specific storage
 * provider — it only knows how to perform one request and report its progress/result. Core ships
 * no implementation: `@upflowi/transport-xhr` and `@upflowi/transport-fetch` provide concrete
 * transports implementing this interface.
 */
export type UploadTransport = {
  send(request: TransportRequest): Promise<TransportResponse>;
};
