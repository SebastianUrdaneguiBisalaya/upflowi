import { AbortError, NetworkError } from "@upflowi/core";
import { describe, expect, it } from "vitest";
import { createXhrTransport } from "../src/index.js";

type ProgressPayload = {
  lengthComputable: boolean;
  loaded: number;
  total: number;
};

class FakeUploadTarget {
  private readonly progressListeners: Array<(event: ProgressPayload) => void> =
    [];

  addEventListener(
    _type: "progress",
    listener: (event: ProgressPayload) => void,
  ): void {
    this.progressListeners.push(listener);
  }

  emitProgress(event: ProgressPayload): void {
    for (const listener of this.progressListeners) {
      listener(event);
    }
  }
}

class FakeXhr {
  readonly upload = new FakeUploadTarget();
  readonly requestHeaders: Record<string, string> = {};
  status = 0;
  responseText = "";
  method = "";
  url = "";
  sentBody: unknown;
  aborted = false;

  private responseHeadersRaw = "";
  private readonly loadListeners: Array<() => void> = [];
  private readonly errorListeners: Array<() => void> = [];
  private readonly timeoutListeners: Array<() => void> = [];
  private readonly abortListeners: Array<() => void> = [];

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(key: string, value: string): void {
    this.requestHeaders[key] = value;
  }

  addEventListener(
    type: "load" | "error" | "timeout" | "abort",
    listener: () => void,
  ): void {
    if (type === "load") this.loadListeners.push(listener);
    else if (type === "error") this.errorListeners.push(listener);
    else if (type === "timeout") this.timeoutListeners.push(listener);
    else this.abortListeners.push(listener);
  }

  getAllResponseHeaders(): string {
    return this.responseHeadersRaw;
  }

  send(body: unknown): void {
    this.sentBody = body;
  }

  abort(): void {
    this.aborted = true;
    for (const listener of this.abortListeners) {
      listener();
    }
  }

  respond(status: number, body: string, rawHeaders = ""): void {
    this.status = status;
    this.responseText = body;
    this.responseHeadersRaw = rawHeaders;
    for (const listener of this.loadListeners) {
      listener();
    }
  }

  fail(): void {
    for (const listener of this.errorListeners) {
      listener();
    }
  }

  timeoutNow(): void {
    for (const listener of this.timeoutListeners) {
      listener();
    }
  }
}

function asXhr(fake: FakeXhr): XMLHttpRequest {
  return fake as unknown as XMLHttpRequest;
}

describe("createXhrTransport", () => {
  it("opens the request, sets headers, and resolves with status/body/headers on load", async () => {
    const fake = new FakeXhr();
    const transport = createXhrTransport({
      createXhr: () => asXhr(fake),
    });

    const promise = transport.send({
      body: "payload",
      headers: {
        "content-type": "text/plain",
      },
      method: "PUT",
      url: "https://example.test/upload",
    });

    expect(fake.method).toBe("PUT");
    expect(fake.url).toBe("https://example.test/upload");
    expect(fake.requestHeaders["content-type"]).toBe("text/plain");
    expect(fake.sentBody).toBe("payload");

    fake.respond(200, "ok", "ETag: abc123\r\nContent-Type: text/plain\r\n");
    const response = await promise;

    expect(response.status).toBe(200);
    expect(response.body).toBe("ok");
    // biome-ignore lint/complexity/useLiteralKeys: bracket access required by tsconfig's noPropertyAccessFromIndexSignature
    expect(response.headers["etag"]).toBe("abc123");
    expect(response.headers["content-type"]).toBe("text/plain");
  });

  it("normalizes an ArrayBufferView body into a fresh Uint8Array before sending", async () => {
    const fake = new FakeXhr();
    const transport = createXhrTransport({
      createXhr: () => asXhr(fake),
    });

    const view = new Uint8Array([
      1,
      2,
      3,
      4,
    ]);
    const promise = transport.send({
      body: view,
      method: "PUT",
      url: "https://example.test/upload",
    });
    fake.respond(200, "");
    await promise;

    expect(fake.sentBody).toBeInstanceOf(Uint8Array);
    expect(fake.sentBody).not.toBe(view);
    expect(Array.from(fake.sentBody as Uint8Array)).toEqual([
      1,
      2,
      3,
      4,
    ]);
  });

  it("resolves with a non-2xx response instead of rejecting", async () => {
    const fake = new FakeXhr();
    const transport = createXhrTransport({
      createXhr: () => asXhr(fake),
    });

    const promise = transport.send({
      method: "PUT",
      url: "https://example.test/upload",
    });
    fake.respond(500, "server error");

    const response = await promise;
    expect(response.status).toBe(500);
  });

  it("forwards fine-grained upload progress from xhr.upload", async () => {
    const fake = new FakeXhr();
    const transport = createXhrTransport({
      createXhr: () => asXhr(fake),
    });

    const events: Array<{
      loadedBytes: number;
      totalBytes: number;
    }> = [];
    const promise = transport.send({
      method: "PUT",
      onProgress: (event) => events.push(event),
      url: "https://example.test/upload",
    });

    fake.upload.emitProgress({
      lengthComputable: true,
      loaded: 50,
      total: 200,
    });
    fake.upload.emitProgress({
      lengthComputable: true,
      loaded: 200,
      total: 200,
    });
    fake.upload.emitProgress({
      lengthComputable: false,
      loaded: 0,
      total: 0,
    });
    fake.respond(200, "");
    await promise;

    expect(events).toEqual([
      {
        loadedBytes: 50,
        totalBytes: 200,
      },
      {
        loadedBytes: 200,
        totalBytes: 200,
      },
    ]);
  });

  it("rejects with NetworkError on an error event", async () => {
    const fake = new FakeXhr();
    const transport = createXhrTransport({
      createXhr: () => asXhr(fake),
    });

    const promise = transport.send({
      method: "PUT",
      url: "https://example.test/upload",
    });
    fake.fail();

    await expect(promise).rejects.toBeInstanceOf(NetworkError);
  });

  it("rejects with NetworkError on a timeout event", async () => {
    const fake = new FakeXhr();
    const transport = createXhrTransport({
      createXhr: () => asXhr(fake),
    });

    const promise = transport.send({
      method: "PUT",
      url: "https://example.test/upload",
    });
    fake.timeoutNow();

    await expect(promise).rejects.toBeInstanceOf(NetworkError);
  });

  it("aborts the underlying xhr and rejects with AbortError when the signal fires", async () => {
    const fake = new FakeXhr();
    const transport = createXhrTransport({
      createXhr: () => asXhr(fake),
    });
    const controller = new AbortController();

    const promise = transport.send({
      method: "PUT",
      signal: controller.signal,
      url: "https://example.test/upload",
    });
    controller.abort();

    await expect(promise).rejects.toBeInstanceOf(AbortError);
    expect(fake.aborted).toBe(true);
  });

  it("aborts immediately without sending when the signal is already aborted", async () => {
    const fake = new FakeXhr();
    const transport = createXhrTransport({
      createXhr: () => asXhr(fake),
    });
    const controller = new AbortController();
    controller.abort();

    const promise = transport.send({
      method: "PUT",
      signal: controller.signal,
      url: "https://example.test/upload",
    });

    await expect(promise).rejects.toBeInstanceOf(AbortError);
    expect(fake.sentBody).toBeUndefined();
  });
});
