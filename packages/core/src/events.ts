import type { UploadError } from "./errors.js";
import type { FileProgress } from "./progress.js";
import type { UploadResult } from "./upload.js";

/** A single event listener bound to a specific payload shape. */
export type EventListener<TPayload> = (payload: TPayload) => void;

/** Call to remove the listener it was returned for. */
export type EventUnsubscribe = () => void;

/** A minimal, strictly-typed emitter over a fixed map of event name → payload shape. */
export type EventEmitter<TEventMap extends Record<string, object>> = {
  on<TEvent extends keyof TEventMap>(
    event: TEvent,
    listener: EventListener<TEventMap[TEvent]>,
  ): EventUnsubscribe;
  off<TEvent extends keyof TEventMap>(
    event: TEvent,
    listener: EventListener<TEventMap[TEvent]>,
  ): void;
  emit<TEvent extends keyof TEventMap>(
    event: TEvent,
    payload: TEventMap[TEvent],
  ): void;
};

/** Creates an empty {@link EventEmitter} for the given event map. */
export function createEventEmitter<
  TEventMap extends Record<string, object>,
>(): EventEmitter<TEventMap> {
  type AnyListener = EventListener<TEventMap[keyof TEventMap]>;
  const listenersByEvent = new Map<keyof TEventMap, Set<AnyListener>>();

  return {
    emit(event, payload) {
      const listeners = listenersByEvent.get(event);
      if (listeners === undefined) {
        return;
      }
      for (const listener of listeners) {
        listener(payload);
      }
    },
    off(event, listener) {
      listenersByEvent.get(event)?.delete(listener as AnyListener);
    },
    on(event, listener) {
      let listeners = listenersByEvent.get(event);
      if (listeners === undefined) {
        listeners = new Set();
        listenersByEvent.set(event, listeners);
      }
      const stored = listener as AnyListener;
      listeners.add(stored);
      return () => {
        listenersByEvent.get(event)?.delete(stored);
      };
    },
  };
}

/** Payload for the `queued` event: a file has been added and is waiting for its turn. */
export type UploadQueuedEvent = {
  readonly fileId: string;
};
/** Payload for the `started` event: transfer has begun. */
export type UploadStartedEvent = {
  readonly fileId: string;
};
/** Payload for the `paused` event. */
export type UploadPausedEvent = {
  readonly fileId: string;
};
/** Payload for the `resumed` event. */
export type UploadResumedEvent = {
  readonly fileId: string;
};
/** Payload for the `retry` event: an attempt failed and will be retried. */
export type UploadRetryEvent = {
  readonly fileId: string;
  readonly attempt: number;
  readonly error: UploadError;
};
/** Payload for the `failed` event: all attempts were exhausted or a permanent error occurred. */
export type UploadFailedEvent = {
  readonly fileId: string;
  readonly error: UploadError;
};
/** Payload for the `cancelled` event. */
export type UploadCancelledEvent = {
  readonly fileId: string;
};

/** Payload for the `completed` event. */
export type UploadCompletedEvent = {
  readonly fileId: string;
  readonly result: UploadResult;
};

/** Every event a single {@link Upload} can emit, keyed by event name. */
export type UploadEventMap = {
  started: UploadStartedEvent;
  progress: FileProgress;
  paused: UploadPausedEvent;
  resumed: UploadResumedEvent;
  retry: UploadRetryEvent;
  completed: UploadCompletedEvent;
  failed: UploadFailedEvent;
  cancelled: UploadCancelledEvent;
};

/** Every event a {@link Uploader} can emit: every {@link UploadEventMap} event, plus `queued` and `allCompleted`. */
export type UploaderEventMap = UploadEventMap & {
  queued: UploadQueuedEvent;
  allCompleted: {
    readonly completedCount: number;
    readonly failedCount: number;
  };
};
