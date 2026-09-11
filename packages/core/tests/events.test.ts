import { describe, expect, it, vi } from "vitest";
import { createEventEmitter } from "../src/events.js";

type TestEventMap = {
  ping: {
    count: number;
  };
  greet: {
    name: string;
  };
};

describe("createEventEmitter", () => {
  it("delivers an emitted payload to every registered listener", () => {
    const emitter = createEventEmitter<TestEventMap>();
    const first = vi.fn();
    const second = vi.fn();
    emitter.on("ping", first);
    emitter.on("ping", second);

    emitter.emit("ping", {
      count: 1,
    });

    expect(first).toHaveBeenCalledWith({
      count: 1,
    });
    expect(second).toHaveBeenCalledWith({
      count: 1,
    });
  });

  it("does not cross-deliver events across different names", () => {
    const emitter = createEventEmitter<TestEventMap>();
    const pingListener = vi.fn();
    const greetListener = vi.fn();
    emitter.on("ping", pingListener);
    emitter.on("greet", greetListener);

    emitter.emit("ping", {
      count: 1,
    });

    expect(pingListener).toHaveBeenCalledTimes(1);
    expect(greetListener).not.toHaveBeenCalled();
  });

  it("stops delivering to a listener once unsubscribed via the returned callback", () => {
    const emitter = createEventEmitter<TestEventMap>();
    const listener = vi.fn();
    const unsubscribe = emitter.on("ping", listener);

    unsubscribe();
    emitter.emit("ping", {
      count: 1,
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it("stops delivering to a listener removed via off", () => {
    const emitter = createEventEmitter<TestEventMap>();
    const listener = vi.fn();
    emitter.on("greet", listener);

    emitter.off("greet", listener);
    emitter.emit("greet", {
      name: "ada",
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it("is a no-op emitting an event with no listeners", () => {
    const emitter = createEventEmitter<TestEventMap>();
    expect(() =>
      emitter.emit("ping", {
        count: 1,
      }),
    ).not.toThrow();
  });
});
