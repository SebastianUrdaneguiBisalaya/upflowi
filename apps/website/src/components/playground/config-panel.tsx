"use client";

import { SegmentedControl } from "./segmented-control";
import type { PlaygroundConfig, SimulateFailures } from "./types";

const SIMULATE_FAILURE_OPTIONS = [
  {
    label: "Off",
    value: "off",
  },
  {
    label: "Fail 1x",
    value: "1",
  },
  {
    label: "Fail 2x",
    value: "2",
  },
  {
    label: "Always fail",
    value: "always",
  },
] as const;

function parseSimulateFailures(raw: string): SimulateFailures {
  if (raw === "off" || raw === "always") {
    return raw;
  }
  const parsed = Number.parseInt(raw, 10);
  return parsed === 1 || parsed === 2 || parsed === 3 ? parsed : "off";
}

export function ConfigPanel({
  config,
  onChange,
  locked,
  s3Enabled,
  r2Enabled,
}: {
  config: PlaygroundConfig;
  onChange: (next: PlaygroundConfig) => void;
  locked: boolean;
  s3Enabled: boolean;
  r2Enabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-5 border border-line bg-bg-elevated p-5">
      <SegmentedControl
        disabled={locked}
        label="Provider"
        onChange={(provider) =>
          onChange({
            ...config,
            provider,
          })
        }
        options={[
          {
            disabled: !s3Enabled,
            hint: s3Enabled ? undefined : "Add PLAYGROUND_AWS_* to .env.local",
            label: "S3",
            value: "s3",
          },
          {
            disabled: !r2Enabled,
            hint: r2Enabled ? undefined : "Add PLAYGROUND_R2_* to .env.local",
            label: "R2",
            value: "r2",
          },
          {
            label: "Custom",
            value: "custom",
          },
        ]}
        value={config.provider}
      />

      <SegmentedControl
        disabled={locked}
        label="Transport"
        onChange={(transport) =>
          onChange({
            ...config,
            transport,
          })
        }
        options={[
          {
            label: "Fetch",
            value: "fetch",
          },
          {
            label: "XHR",
            value: "xhr",
          },
        ]}
        value={config.transport}
      />

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink-faint">
            Concurrency
          </span>
          <input
            className="rounded-lg border border-line bg-bg px-3 py-1.5 font-mono text-[12.5px] text-ink disabled:cursor-not-allowed disabled:opacity-40"
            disabled={locked}
            max={10}
            min={1}
            onChange={(event) =>
              onChange({
                ...config,
                concurrency: Number(event.target.value) || 1,
              })
            }
            type="number"
            value={config.concurrency}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink-faint">
            Chunk size (MiB)
          </span>
          <input
            className="rounded-lg border border-line bg-bg px-3 py-1.5 font-mono text-[12.5px] text-ink disabled:cursor-not-allowed disabled:opacity-40"
            disabled={locked}
            min={1}
            onChange={(event) =>
              onChange({
                ...config,
                chunkSize: (Number(event.target.value) || 1) * 1024 * 1024,
              })
            }
            type="number"
            value={Math.round(config.chunkSize / (1024 * 1024))}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink-faint">
            Retry max attempts
          </span>
          <input
            className="rounded-lg border border-line bg-bg px-3 py-1.5 font-mono text-[12.5px] text-ink disabled:cursor-not-allowed disabled:opacity-40"
            disabled={locked}
            max={10}
            min={1}
            onChange={(event) =>
              onChange({
                ...config,
                maxAttempts: Number(event.target.value) || 1,
              })
            }
            type="number"
            value={config.maxAttempts}
          />
        </label>
      </div>

      <SegmentedControl
        disabled={config.provider !== "custom"}
        label={
          config.provider === "custom"
            ? "Simulate part failures (custom backend only)"
            : "Simulate part failures (custom backend only — switch provider to Custom)"
        }
        onChange={(raw) =>
          onChange({
            ...config,
            simulateFailures: parseSimulateFailures(raw),
          })
        }
        options={SIMULATE_FAILURE_OPTIONS}
        value={String(config.simulateFailures)}
      />
    </div>
  );
}
