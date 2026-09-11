import { describe, expect, it } from "vitest";
import { createQueue } from "../src/queue.js";

describe("createQueue", () => {
  it("dequeues in FIFO order for equal priority", () => {
    const queue = createQueue<string>();
    queue.enqueue("a");
    queue.enqueue("b");
    queue.enqueue("c");

    expect(queue.dequeue()?.payload).toBe("a");
    expect(queue.dequeue()?.payload).toBe("b");
    expect(queue.dequeue()?.payload).toBe("c");
    expect(queue.dequeue()).toBeUndefined();
  });

  it("dequeues higher priority items first, preserving FIFO within the same priority", () => {
    const queue = createQueue<string>();
    queue.enqueue("low-1", {
      priority: 0,
    });
    queue.enqueue("high-1", {
      priority: 10,
    });
    queue.enqueue("low-2", {
      priority: 0,
    });
    queue.enqueue("high-2", {
      priority: 10,
    });

    expect(queue.dequeue()?.payload).toBe("high-1");
    expect(queue.dequeue()?.payload).toBe("high-2");
    expect(queue.dequeue()?.payload).toBe("low-1");
    expect(queue.dequeue()?.payload).toBe("low-2");
  });

  it("tracks size and supports peek without removing", () => {
    const queue = createQueue<number>();
    queue.enqueue(1);
    queue.enqueue(2);

    expect(queue.size).toBe(2);
    expect(queue.peek()?.payload).toBe(1);
    expect(queue.size).toBe(2);
  });

  it("removes an item by id", () => {
    const queue = createQueue<string>();
    const id = queue.enqueue("target");
    queue.enqueue("other");

    expect(queue.remove(id)).toBe(true);
    expect(queue.remove(id)).toBe(false);
    expect(queue.size).toBe(1);
    expect(queue.dequeue()?.payload).toBe("other");
  });

  it("honors a caller-supplied id", () => {
    const queue = createQueue<string>();
    const id = queue.enqueue("payload", {
      id: "custom-id",
    });
    expect(id).toBe("custom-id");
  });

  it("clears every pending item", () => {
    const queue = createQueue<number>();
    queue.enqueue(1);
    queue.enqueue(2);
    queue.clear();
    expect(queue.size).toBe(0);
    expect(queue.dequeue()).toBeUndefined();
  });
});
