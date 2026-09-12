"use client";

import { motion, useReducedMotion } from "motion/react";

const nodes = [
  {
    label: "Source",
    sub: "browser · node",
    x: 40,
  },
  {
    label: "Orchestration",
    sub: "queue · status",
    x: 168,
  },
  {
    label: "Scheduling",
    sub: "concurrency",
    x: 296,
  },
  {
    label: "Transport",
    sub: "fetch · xhr",
    x: 424,
  },
  {
    label: "Provider",
    sub: "create · complete",
    x: 552,
  },
  {
    label: "Storage",
    sub: "s3 · r2 · http",
    x: 680,
  },
];

const Y = 40;
const PATH_START = nodes[0].x;
const PATH_END = nodes[nodes.length - 1].x;

// The pulse is a short light-green-to-green window inside a
// `userSpaceOnUse` gradient.
// Sliding its x1/x2 together (same width, moving in lockstep) along the
// line is what makes it read as a comet travelling the path, the same
// technique used by Vercel's "Powered By" line — a duplicate of the static
// path, stroked with a gradient instead of a flat color.
const PULSE_WIDTH = 220;
const PULSE_TRAVEL_START = PATH_START - PULSE_WIDTH;
const PULSE_TRAVEL_END = PATH_END + PULSE_WIDTH;

const pulseTransition = {
  delay: 0.6,
  duration: 5.2,
  ease: "linear" as const,
  repeat: Infinity,
  repeatDelay: 0.6,
};

const MotionLinearGradient = motion.create("linearGradient");

export function ArchitectureFlow() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="mb-11 hidden overflow-x-auto pb-2 sm:block">
      <svg
        aria-label="A file's path from source through orchestration, scheduling, transport, and provider, to storage"
        className="h-auto w-full min-w-160"
        role="img"
        viewBox="0 0 720 104"
      >
        <defs>
          <MotionLinearGradient
            animate={
              reduceMotion
                ? undefined
                : {
                    x1: [
                      PULSE_TRAVEL_START,
                      PULSE_TRAVEL_END,
                    ],
                    x2: [
                      PULSE_TRAVEL_START + PULSE_WIDTH,
                      PULSE_TRAVEL_END + PULSE_WIDTH,
                    ],
                  }
            }
            gradientUnits="userSpaceOnUse"
            id="architecture-flow-pulse"
            initial={{
              x1: PULSE_TRAVEL_START,
              x2: PULSE_TRAVEL_START + PULSE_WIDTH,
            }}
            transition={
              reduceMotion
                ? {
                    duration: 0,
                  }
                : pulseTransition
            }
            y1={Y}
            y2={Y}
          >
            <stop
              offset="0%"
              stopColor="#86efac"
              stopOpacity={0}
            />
            <stop
              offset="18%"
              stopColor="#86efac"
            />
            <stop
              offset="60%"
              stopColor="#22c55e"
            />
            <stop
              offset="100%"
              stopColor="#22c55e"
              stopOpacity={0}
            />
          </MotionLinearGradient>
        </defs>

        <motion.line
          className="stroke-line-strong"
          initial={{
            pathLength: 0,
          }}
          strokeWidth={1}
          transition={{
            duration: 1.1,
            ease: [
              0.16,
              1,
              0.3,
              1,
            ],
          }}
          viewport={{
            margin: "-60px",
            once: true,
          }}
          whileInView={{
            pathLength: 1,
          }}
          x1={PATH_START}
          x2={PATH_END}
          y1={Y}
          y2={Y}
        />

        {!reduceMotion && (
          <line
            stroke="url(#architecture-flow-pulse)"
            strokeLinecap="round"
            strokeWidth={2}
            x1={PATH_START}
            x2={PATH_END}
            y1={Y}
            y2={Y}
          />
        )}

        {nodes.map((node, i) => (
          <g key={node.label}>
            <motion.circle
              className="fill-bg stroke-ink"
              cx={node.x}
              cy={Y}
              initial={{
                scale: 0,
              }}
              r={4.5}
              strokeWidth={1.4}
              style={{
                transformOrigin: `${node.x}px ${Y}px`,
              }}
              transition={{
                delay: i * 0.1,
                duration: 0.3,
                ease: [
                  0.16,
                  1,
                  0.3,
                  1,
                ],
              }}
              viewport={{
                margin: "-60px",
                once: true,
              }}
              whileInView={{
                scale: 1,
              }}
            />
            <text
              className="fill-ink font-mono text-[9.5px] uppercase tracking-wide"
              textAnchor="middle"
              x={node.x}
              y={Y + 26}
            >
              {node.label}
            </text>
            <text
              className="fill-ink-faint font-mono text-[8px] tracking-wide"
              textAnchor="middle"
              x={node.x}
              y={Y + 40}
            >
              {node.sub}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
