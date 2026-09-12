import type {
  StorageProviderContext,
  TransportRequest,
  TransportResponse,
  UploadTransport,
} from "@upflowi/core";
import { ProviderError, UploadValidationError } from "@upflowi/core";
import { describe, expect, it, vi } from "vitest";
import { createR2Provider } from "../src/r2-provider.js";

function xmlResponse(
  status: number,
  body: string,
  headers: Record<string, string> = {},
): TransportResponse {
  return {
    body,
    headers,
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

describe("createR2Provider", () => {
  it("create() calls a presigned URL for the operation and parses the UploadId", async () => {
    const send = vi.fn(
      async (_request: TransportRequest): Promise<TransportResponse> =>
        xmlResponse(
          200,
          "<InitiateMultipartUploadResult><UploadId>abc-123</UploadId></InitiateMultipartUploadResult>",
        ),
    );
    const transport: UploadTransport = {
      send,
    };
    const getPresignedUrl = vi.fn(async () => ({
      url: "https://r2.example/bucket/key?uploads",
    }));
    const provider = createR2Provider({
      getPresignedUrl,
    });

    const result = await provider.create("file-1", contextWith(transport));

    expect(result.providerUploadId).toBe("abc-123");
    expect(getPresignedUrl).toHaveBeenCalledWith({
      fileId: "file-1",
      type: "create",
    });
    const request = send.mock.calls[0]?.[0] as TransportRequest;
    expect(request.method).toBe("POST");
    expect(request.url).toBe("https://r2.example/bucket/key?uploads");
  });

  it("create() throws ProviderError when the response has no UploadId", async () => {
    const transport: UploadTransport = {
      send: async () => xmlResponse(200, "<Empty/>"),
    };
    const provider = createR2Provider({
      getPresignedUrl: async () => ({
        url: "https://r2.example/x",
      }),
    });

    await expect(
      provider.create("file-1", contextWith(transport)),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("create() throws ProviderError on a non-2xx response", async () => {
    const transport: UploadTransport = {
      send: async () => xmlResponse(500, "<Error/>"),
    };
    const provider = createR2Provider({
      getPresignedUrl: async () => ({
        url: "https://r2.example/x",
      }),
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
        status: 403,
      },
      {
        retryable: false,
        status: 404,
      },
    ];
    const provider = createR2Provider({
      getPresignedUrl: async () => ({
        url: "https://r2.example/x",
      }),
    });

    it.each(cases)(
      "create(): status $status -> retryable=$retryable",
      async ({ status, retryable }) => {
        const transport: UploadTransport = {
          send: async () => xmlResponse(status, "<Error/>"),
        };
        const error = await provider
          .create("file-1", contextWith(transport))
          .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ProviderError);
        expect((error as ProviderError).retryable).toBe(retryable);
      },
    );

    it.each(cases)(
      "uploadPart(): status $status -> retryable=$retryable",
      async ({ status, retryable }) => {
        const transport: UploadTransport = {
          send: async () => xmlResponse(status, "<Error/>"),
        };
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
          send: async () => xmlResponse(status, "<Error/>"),
        };
        const error = await provider
          .complete("upload-1", [], contextWith(transport))
          .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ProviderError);
        expect((error as ProviderError).retryable).toBe(retryable);
      },
    );
  });

  it("uploadPart() requests a part-specific presigned URL and reads the ETag response header", async () => {
    const send = vi.fn(
      async (_request: TransportRequest): Promise<TransportResponse> =>
        xmlResponse(200, "", {
          ETag: '"etag-part-3"',
        }),
    );
    const transport: UploadTransport = {
      send,
    };
    const getPresignedUrl = vi.fn(async () => ({
      url: "https://r2.example/bucket/key?partNumber=3&uploadId=abc",
    }));
    const provider = createR2Provider({
      getPresignedUrl,
    });

    const result = await provider.uploadPart(
      "abc",
      {
        end: 30,
        partNumber: 3,
        size: 10,
        start: 20,
      },
      "chunk-bytes",
      contextWith(transport),
    );

    expect(result).toEqual({
      etag: '"etag-part-3"',
      partNumber: 3,
      sizeBytes: 10,
    });
    expect(getPresignedUrl).toHaveBeenCalledWith({
      fileId: "file-1",
      partNumber: 3,
      type: "uploadPart",
      uploadId: "abc",
    });
    const request = send.mock.calls[0]?.[0] as TransportRequest;
    expect(request.method).toBe("PUT");
    expect(request.body).toBe("chunk-bytes");
  });

  it("uploadPart() throws ProviderError when no ETag header is returned", async () => {
    const transport: UploadTransport = {
      send: async () => xmlResponse(200, ""),
    };
    const provider = createR2Provider({
      getPresignedUrl: async () => ({
        url: "https://r2.example/x",
      }),
    });

    await expect(
      provider.uploadPart(
        "abc",
        {
          end: 10,
          partNumber: 1,
          size: 10,
          start: 0,
        },
        "body",
        contextWith(transport),
      ),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("complete() sends a CompleteMultipartUpload XML body listing every part", async () => {
    const send = vi.fn(
      async (_request: TransportRequest): Promise<TransportResponse> =>
        xmlResponse(
          200,
          '<CompleteMultipartUploadResult><Location>https://r2.example/bucket/key</Location><ETag>"final-etag"</ETag></CompleteMultipartUploadResult>',
        ),
    );
    const transport: UploadTransport = {
      send,
    };
    const provider = createR2Provider({
      getPresignedUrl: async () => ({
        url: "https://r2.example/complete",
      }),
    });

    const result = await provider.complete(
      "abc",
      [
        {
          etag: '"e1"',
          partNumber: 1,
          sizeBytes: 10,
        },
        {
          etag: '"e2"',
          partNumber: 2,
          sizeBytes: 10,
        },
      ],
      contextWith(transport),
    );

    expect(result).toEqual({
      etag: '"final-etag"',
      location: "https://r2.example/bucket/key",
    });
    const request = send.mock.calls[0]?.[0] as TransportRequest;
    expect(request.method).toBe("POST");
    expect(request.body).toContain("<PartNumber>1</PartNumber>");
    expect(request.body).toContain("<PartNumber>2</PartNumber>");
    expect(request.body).toContain('<ETag>"e1"</ETag>');
  });

  it("abort() sends a DELETE and resolves on a 2xx response", async () => {
    const send = vi.fn(
      async (_request: TransportRequest): Promise<TransportResponse> =>
        xmlResponse(204, ""),
    );
    const transport: UploadTransport = {
      send,
    };
    const provider = createR2Provider({
      getPresignedUrl: async () => ({
        url: "https://r2.example/abort",
      }),
    });

    await expect(
      provider.abort("abc", contextWith(transport)),
    ).resolves.toBeUndefined();
    const request = send.mock.calls[0]?.[0] as TransportRequest;
    expect(request.method).toBe("DELETE");
  });

  it("resume() returns undefined on a 404 (upload no longer exists)", async () => {
    const transport: UploadTransport = {
      send: async () => xmlResponse(404, "<Error/>"),
    };
    const provider = createR2Provider({
      getPresignedUrl: async () => ({
        url: "https://r2.example/list",
      }),
    });

    await expect(
      provider.resume("file-1", "abc", contextWith(transport)),
    ).resolves.toBeUndefined();
  });

  it("resume() parses every listed <Part> into completed parts", async () => {
    const body = `<ListPartsResult>
      <Part><PartNumber>1</PartNumber><ETag>"e1"</ETag><Size>10</Size></Part>
      <Part><PartNumber>2</PartNumber><ETag>"e2"</ETag><Size>15</Size></Part>
    </ListPartsResult>`;
    const transport: UploadTransport = {
      send: async () => xmlResponse(200, body),
    };
    const provider = createR2Provider({
      getPresignedUrl: async () => ({
        url: "https://r2.example/list",
      }),
    });

    const result = await provider.resume(
      "file-1",
      "abc",
      contextWith(transport),
    );

    expect(result).toEqual({
      completedParts: [
        {
          etag: '"e1"',
          partNumber: 1,
          sizeBytes: 10,
        },
        {
          etag: '"e2"',
          partNumber: 2,
          sizeBytes: 15,
        },
      ],
      providerUploadId: "abc",
    });
  });

  it("throws UploadValidationError when no transport is configured", async () => {
    const provider = createR2Provider({
      getPresignedUrl: async () => ({
        url: "https://r2.example/x",
      }),
    });

    await expect(
      provider.create("file-1", contextWith(undefined)),
    ).rejects.toBeInstanceOf(UploadValidationError);
  });
});
