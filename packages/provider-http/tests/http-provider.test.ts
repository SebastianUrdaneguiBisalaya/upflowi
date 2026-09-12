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

  describe("retryable classification of non-2xx responses", () => {
    const cases: Array<{
      status: number;
      retryable: boolean;
    }> = [
      {
        retryable: true,
        status: 500,
      },
      {
        retryable: true,
        status: 502,
      },
      {
        retryable: true,
        status: 503,
      },
      {
        retryable: true,
        status: 429,
      },
      {
        retryable: false,
        status: 400,
      },
      {
        retryable: false,
        status: 401,
      },
      {
        retryable: false,
        status: 403,
      },
      {
        retryable: false,
        status: 404,
      },
    ];

    it.each(cases)(
      "create(): status $status -> retryable=$retryable",
      async ({ status, retryable }) => {
        const transport: UploadTransport = {
          send: async () => jsonResponse(status, {}),
        };
        const provider = createHttpProvider({
          baseUrl: "https://api.example.com",
        });

        const error = await provider
          .create("file-1", contextWith(transport))
          .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ProviderError);
        expect((error as ProviderError).retryable).toBe(retryable);
        expect((error as ProviderError).providerCode).toBe(String(status));
      },
    );

    it.each(cases)(
      "uploadPart(): status $status -> retryable=$retryable",
      async ({ status, retryable }) => {
        const transport: UploadTransport = {
          send: async () => ({
            body: "",
            headers: {},
            status,
          }),
        };
        const provider = createHttpProvider({
          baseUrl: "https://api.example.com",
        });

        const error = await provider
          .uploadPart(
            "upload-1",
            {
              end: 10,
              partNumber: 1,
              size: 10,
              start: 0,
            },
            "chunk-bytes",
            contextWith(transport),
          )
          .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ProviderError);
        expect((error as ProviderError).retryable).toBe(retryable);
      },
    );

    it.each(cases)(
      "complete(): status $status -> retryable=$retryable",
      async ({ status, retryable }) => {
        const transport: UploadTransport = {
          send: async () => jsonResponse(status, {}),
        };
        const provider = createHttpProvider({
          baseUrl: "https://api.example.com",
        });

        const error = await provider
          .complete("upload-1", [], contextWith(transport))
          .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ProviderError);
        expect((error as ProviderError).retryable).toBe(retryable);
      },
    );
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

  it("uploadPart() defaults to a content-type header so server-side body parsers can match it", async () => {
    const send = vi.fn(
      async (_request: TransportRequest): Promise<TransportResponse> =>
        jsonResponse(200, {
          etag: "e1",
        }),
    );
    const provider = createHttpProvider({
      baseUrl: "https://api.example.com",
    });

    await provider.uploadPart(
      "u1",
      {
        end: 10,
        partNumber: 1,
        size: 10,
        start: 0,
      },
      "bytes",
      contextWith({
        send,
      }),
    );

    const request = send.mock.calls[0]?.[0] as TransportRequest;
    expect(request.headers?.["content-type"]).toBe("application/octet-stream");
  });

  it("uploadPart() lets getHeaders() override the default content-type", async () => {
    const send = vi.fn(
      async (_request: TransportRequest): Promise<TransportResponse> =>
        jsonResponse(200, {
          etag: "e1",
        }),
    );
    const provider = createHttpProvider({
      baseUrl: "https://api.example.com",
      getHeaders: () => ({
        "content-type": "application/custom",
      }),
    });

    await provider.uploadPart(
      "u1",
      {
        end: 10,
        partNumber: 1,
        size: 10,
        start: 0,
      },
      "bytes",
      contextWith({
        send,
      }),
    );

    const request = send.mock.calls[0]?.[0] as TransportRequest;
    expect(request.headers?.["content-type"]).toBe("application/custom");
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
