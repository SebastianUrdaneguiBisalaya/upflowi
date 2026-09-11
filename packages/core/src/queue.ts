/** A single entry stored in a {@link Queue}. */
export type QueueItem<TPayload> = {
  readonly id: string;
  readonly payload: TPayload;
  readonly priority: number;
  readonly enqueuedAt: number;
};

/** Options accepted by {@link Queue.enqueue}. */
export type EnqueueOptions = {
  /** A caller-supplied id; a sequential one is generated when omitted. */
  id?: string;
  /** Higher values are dequeued first. Ties are broken FIFO. Defaults to 0. */
  priority?: number;
};

/** A FIFO queue with an optional per-item priority hook. */
export type Queue<TPayload> = {
  enqueue(payload: TPayload, options?: EnqueueOptions): string;
  dequeue(): QueueItem<TPayload> | undefined;
  peek(): QueueItem<TPayload> | undefined;
  remove(id: string): boolean;
  clear(): void;
  readonly size: number;
};

/** Creates an empty {@link Queue}. */
export function createQueue<TPayload>(): Queue<TPayload> {
  const items: QueueItem<TPayload>[] = [];
  let sequence = 0;

  function insertByPriority(item: QueueItem<TPayload>): void {
    let index = items.length;
    while (index > 0) {
      const previous = items[index - 1];
      if (previous !== undefined && previous.priority >= item.priority) {
        break;
      }
      index -= 1;
    }
    items.splice(index, 0, item);
  }

  return {
    clear() {
      items.length = 0;
    },
    dequeue() {
      return items.shift();
    },
    enqueue(payload, options = {}) {
      sequence += 1;
      const id = options.id ?? `item-${sequence}`;
      const item: QueueItem<TPayload> = {
        enqueuedAt: sequence,
        id,
        payload,
        priority: options.priority ?? 0,
      };
      insertByPriority(item);
      return id;
    },
    peek() {
      return items[0];
    },
    remove(id) {
      const index = items.findIndex((item) => item.id === id);
      if (index === -1) {
        return false;
      }
      items.splice(index, 1);
      return true;
    },
    get size() {
      return items.length;
    },
  };
}
