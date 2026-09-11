import { AbortError, NetworkError } from "@upflowi/core";
import { describe, expect, it, vi } from "vitest";
import { createFetchTransport } from "../src/index.js";

function jsonResponse(
  status: number,
  body: string,
  headers: Record<string, string> = {},
): Response {
  return new Response(body, {
    headers,
    status,
  });
}

describe("createFetchTransport", () => {
  it("sends the request and returns status, headers and body", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, "ok", {
        "x-request-id": "abc",
      }),
    );
    const transport = createFetchTransport({
      fetch: fetchMock as unknown as typeof fetch,
    });

    const response = await transport.send({
      method: "PUT",
      url: "https://example.test/upload",
    });

    expect(response.status).toBe(200);
    expect(response.body).toBe("ok");
    expect(response.headers["x-request-id"]).toBe("abc");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/upload",
      expect.objectContaining({
        method: "PUT",
      }),
    );
  });

  it("returns a non-2xx response instead of throwing", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(503, "unavailable"));
    const transport = createFetchTransport({
      fetch: fetchMock as unknown as typeof fetch,
    });

    const response = await transport.send({
      method: "PUT",
      url: "https://example.test/upload",
    });
    expect(response.status).toBe(503);
  });

  it("reports 0 and then the full size as best-effort progress", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, ""));
    const transport = createFetchTransport({
      fetch: fetchMock as unknown as typeof fetch,
    });

    const events: Array<{
      loadedBytes: number;
      totalBytes: number;
    }> = [];
    await transport.send({
      body: "hello world",
      method: "PUT",
      onProgress: (event) => events.push(event),
      url: "https://example.test/upload",
    });

    expect(events).toEqual([
      {
        loadedBytes: 0,
        totalBytes: 11,
      },
      {
        loadedBytes: 11,
        totalBytes: 11,
      },
    ]);
  });

  it("normalizes an ArrayBufferView body into a fresh Uint8Array before sending", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(200, ""),
    );
    const transport = createFetchTransport({
      fetch: fetchMock as unknown as typeof fetch,
    });

    const view = new Uint8Array([
      1,
      2,
      3,
      4,
    ]);
    const response = await transport.send({
      body: view,
      method: "PUT",
      url: "https://example.test/upload",
    });

    expect(response.status).toBe(200);
    const call = fetchMock.mock.calls[0];
    const sentBody = call?.[1]?.body;
    expect(sentBody).toBeInstanceOf(Uint8Array);
    expect(sentBody).not.toBe(view);
    expect(Array.from(sentBody as Uint8Array)).toEqual([
      1,
      2,
      3,
      4,
    ]);
  });

  it("wraps a rejected fetch into a NetworkError", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const transport = createFetchTransport({
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(
      transport.send({
        method: "PUT",
        url: "https://example.test/upload",
      }),
    ).rejects.toBeInstanceOf(NetworkError);
  });

  it("wraps a DOMException AbortError into the core AbortError", async () => {
    const fetchMock = vi.fn(async () => {
      throw new DOMException("The operation was aborted.", "AbortError");
    });
    const transport = createFetchTransport({
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(
      transport.send({
        method: "PUT",
        url: "https://example.test/upload",
      }),
    ).rejects.toBeInstanceOf(AbortError);
  });
});
