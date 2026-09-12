import { UploadValidationError } from "./errors.js";

/** Configuration accepted by {@link createScheduler}. */
export type SchedulerConfig = {
  /** Maximum number of tasks allowed to run at once. Must be a positive integer. */
  concurrency: number;
};

/** A concurrency-limited task runner, independent of what the scheduled task actually does. */
export type Scheduler = {
  /** Queues `task` and resolves/rejects with its result once it has run. */
  schedule<TResult>(task: () => Promise<TResult>): Promise<TResult>;
  /** Changes the concurrency limit, immediately draining more tasks if it was raised. */
  setConcurrency(concurrency: number): void;
  readonly concurrency: number;
  readonly active: number;
  readonly pending: number;
};

function assertPositiveInteger(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new UploadValidationError(
      `Scheduler concurrency must be a positive integer, received ${value}.`,
    );
  }
}

/** Creates a {@link Scheduler} that runs at most `config.concurrency` tasks at once. */
export function createScheduler(config: SchedulerConfig): Scheduler {
  assertPositiveInteger(config.concurrency);

  let concurrency = config.concurrency;
  let active = 0;
  const waiting: Array<() => void> = [];

  function drain(): void {
    while (active < concurrency) {
      const run = waiting.shift();
      if (run === undefined) {
        return;
      }
      active += 1;
      run();
    }
  }

  return {
    get active() {
      return active;
    },
    get concurrency() {
      return concurrency;
    },
    get pending() {
      return waiting.length;
    },
    schedule<TResult>(task: () => Promise<TResult>): Promise<TResult> {
      return new Promise<TResult>((resolve, reject) => {
        waiting.push(() => {
          task()
            .then(resolve, reject)
            .finally(() => {
              active -= 1;
              drain();
            });
        });
        drain();
      });
    },
    setConcurrency(next: number) {
      assertPositiveInteger(next);
      concurrency = next;
      drain();
    },
  };
}
