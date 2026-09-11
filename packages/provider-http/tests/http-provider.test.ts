import type {
  StorageProviderContext,
  TransportRequest,
  TransportResponse,
  UploadTransport,
} from "@upflowi/core";
import { ProviderError, UploadValidationError } from "@upflowi/core";
import { describe, expect, it, vi } from "vitest";
import { createHttpProvider } from "../src/http-provider.js";

function jsonResponse(status: number, data: unknown): TransportResponse {
  return {
    body: JSON.stringify(data),
    headers: {},
    status,
  };
}

function contextWith(
  transport: UploadTransport | undefined,
  fileId = "file-1",
): StorageProviderContext {
  return transport
    ? {
        fileId,
        transport,
      }
    : {
        fileId,
      };
}

describe("createHttpProvider", () => {
  it("create() POSTs to {baseUrl}/uploads and returns the uploadId", async () => {
    const send = vi.fn(
      async (_request: TransportRequest): Promise<TransportResponse> =>
        jsonResponse(200, {
          uploadId: "u1",
        }),
    );
    const provider = createHttpProvider({
      baseUrl: "https://api.example.com",
    });

    const result = await provider.create(
      "file-1",
      contextWith({
        send,
      }),
    );

    expect(result).toEqual({
      providerUploadId: "u1",
    });
    const request = send.mock.calls[0]?.[0] as TransportRequest;
    expect(request.method).toBe("POST");
    expect(request.url).toBe("https://api.example.com/uploads");
    expect(request.body).toBe(
      JSON.stringify({
        fileId: "file-1",
      }),
    );
  });

  it("strips a trailing slash from baseUrl", async () => {
    const send = vi.fn(
      async (_request: TransportRequest): Promise<TransportResponse> =>
        jsonResponse(200, {
          uploadId: "u1",
        }),
    );
    const provider = createHttpProvider({
      baseUrl: "https://api.example.com/",
    });

    await provider.create(
      "file-1",
      contextWith({
        send,
      }),
    );
    const request = send.mock.calls[0]?.[0] as TransportRequest;
    expect(request.url).toBe("https://api.example.com/uploads");
  });

  it("create() throws ProviderError when the backend omits uploadId", async () => {
    const transport: UploadTransport = {
      send: async () => jsonResponse(200, {}),
    };
    const provider = createHttpProvider({
      baseUrl: "https://api.example.com",
    });

    await expect(
      provider.create("file-1", contextWith(transport)),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("create() throws ProviderError on a non-2xx response", async () => {
    const transport: UploadTransport = {
      send: async () =>
        jsonResponse(500, {
          message: "boom",
        }),
    };
    const provider = createHttpProvider({
      baseUrl: "https://api.example.com",
    });

    await expect(
      provider.create("file-1", contextWith(transport)),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("attaches headers from getHeaders() to every request", async () => {
    const send = vi.fn(
      async (_request: TransportRequest): Promise<TransportResponse> =>
        jsonResponse(200, {
          uploadId: "u1",
        }),
    );
    const provider = createHttpProvider({
      baseUrl: "https://api.example.com",
      getHeaders: () => ({
        authorization: "Bearer token-123",
      }),
    });

    await provider.create(
      "file-1",
      contextWith({
        send,
      }),
    );
    const request = send.mock.calls[0]?.[0] as TransportRequest;
    // biome-ignore lint/complexity/useLiteralKeys: bracket access required by tsconfig's noPropertyAccessFromIndexSignature
    expect(request.headers?.["authorization"]).toBe("Bearer token-123");
  });

  it("uploadPart() PUTs to the part URL with the raw body and reads the etag", async () => {
    const send = vi.fn(
      async (_request: TransportRequest): Promise<TransportResponse> =>
        jsonResponse(200, {
          etag: "e3",
        }),
    );
    const provider = createHttpProvider({
      baseUrl: "https://api.example.com",
    });

    const result = await provider.uploadPart(
      "u1",
      {
        end: 30,
        partNumber: 3,
        size: 10,
        start: 20,
      },
      "chunk-bytes",
      contextWith({
        send,
      }),
    );

    expect(result).toEqual({
      etag: "e3",
      partNumber: 3,
      sizeBytes: 10,
    });
    const request = send.mock.calls[0]?.[0] as TransportRequest;
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("https://api.example.com/uploads/u1/parts/3");
    expect(request.body).toBe("chunk-bytes");
  });

  it("complete() POSTs the part list and returns location/etag", async () => {
    const send = vi.fn(
      async (_request: TransportRequest): Promise<TransportResponse> =>
        jsonResponse(200, {
          etag: "final",
          location: "https://api.example.com/files/f1",
        }),
    );
    const provider = createHttpProvider({
      baseUrl: "https://api.example.com",
    });

    const result = await provider.complete(
      "u1",
      [
        {
          etag: "e1",
          partNumber: 1,
          sizeBytes: 10,
        },
        {
          etag: "e2",
          partNumber: 2,
          sizeBytes: 10,
        },
      ],
      contextWith({
        send,
      }),
    );

    expect(result).toEqual({
      etag: "final",
      location: "https://api.example.com/files/f1",
    });
    const request = send.mock.calls[0]?.[0] as TransportRequest;
    expect(request.url).toBe("https://api.example.com/uploads/u1/complete");
    expect(JSON.parse(request.body as string)).toEqual({
      parts: [
        {
          etag: "e1",
          partNumber: 1,
          sizeBytes: 10,
        },
        {
          etag: "e2",
          partNumber: 2,
          sizeBytes: 10,
        },
      ],
    });
  });

  it("abort() sends a DELETE to the upload URL", async () => {
    const send = vi.fn(
      async (_request: TransportRequest): Promise<TransportResponse> => ({
        body: "",
        headers: {},
        status: 204,
      }),
    );
    const provider = createHttpProvider({
      baseUrl: "https://api.example.com",
    });

    await expect(
      provider.abort(
        "u1",
        contextWith({
          send,
        }),
      ),
    ).resolves.toBeUndefined();
    const request = send.mock.calls[0]?.[0] as TransportRequest;
    expect(request.method).toBe("DELETE");
    expect(request.url).toBe("https://api.example.com/uploads/u1");
  });

  it("resume() returns undefined on a 404", async () => {
    const transport: UploadTransport = {
      send: async () => ({
        body: "",
        headers: {},
        status: 404,
      }),
    };
    const provider = createHttpProvider({
      baseUrl: "https://api.example.com",
    });

    await expect(
      provider.resume("file-1", "u1", contextWith(transport)),
    ).resolves.toBeUndefined();
  });

  it("resume() parses the returned parts array", async () => {
    const transport: UploadTransport = {
      send: async () =>
        jsonResponse(200, {
          parts: [
            {
              etag: "e1",
              partNumber: 1,
              sizeBytes: 10,
            },
            {
              etag: "e2",
              partNumber: 2,
              sizeBytes: 15,
            },
          ],
        }),
    };
    const provider = createHttpProvider({
      baseUrl: "https://api.example.com",
    });

    const result = await provider.resume(
      "file-1",
      "u1",
      contextWith(transport),
    );

    expect(result).toEqual({
      completedParts: [
        {
          etag: "e1",
          partNumber: 1,
          sizeBytes: 10,
        },
        {
          etag: "e2",
          partNumber: 2,
          sizeBytes: 15,
        },
      ],
      providerUploadId: "u1",
    });
  });

  it("resume() throws ProviderError when `parts` is missing or malformed", async () => {
    const transport: UploadTransport = {
      send: async () =>
        jsonResponse(200, {
          notParts: [],
        }),
    };
    const provider = createHttpProvider({
      baseUrl: "https://api.example.com",
    });

    await expect(
      provider.resume("file-1", "u1", contextWith(transport)),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("throws ProviderError when the response body is not valid JSON", async () => {
    const transport: UploadTransport = {
      send: async () => ({
        body: "not json",
        headers: {},
        status: 200,
      }),
    };
    const provider = createHttpProvider({
      baseUrl: "https://api.example.com",
    });

    await expect(
      provider.create("file-1", contextWith(transport)),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("throws UploadValidationError when no transport is configured", async () => {
    const provider = createHttpProvider({
      baseUrl: "https://api.example.com",
    });

    await expect(
      provider.create("file-1", contextWith(undefined)),
    ).rejects.toBeInstanceOf(UploadValidationError);
  });
});
