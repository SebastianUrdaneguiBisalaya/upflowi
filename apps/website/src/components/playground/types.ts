export type ProviderKind = "s3" | "r2" | "custom";
export type TransportKind = "fetch" | "xhr";
export type SimulateFailures = "off" | 1 | 2 | 3 | "always";

export type PlaygroundConfig = {
  provider: ProviderKind;
  transport: TransportKind;
  concurrency: number;
  chunkSize: number;
  maxAttempts: number;
  simulateFailures: SimulateFailures;
};

export type LogEntry = {
  readonly id: number;
  readonly timestamp: number;
  readonly event: string;
  readonly fileId?: string;
  readonly detail?: string;
};

export type UploaderStats = {
  readonly size: number;
  readonly pending: number;
  readonly active: number;
  readonly completed: number;
  readonly failed: number;
};

export const DEFAULT_CONFIG: PlaygroundConfig = {
  chunkSize: 5 * 1024 * 1024,
  concurrency: 3,
  maxAttempts: 3,
  provider: "custom",
  simulateFailures: "off",
  transport: "fetch",
};
