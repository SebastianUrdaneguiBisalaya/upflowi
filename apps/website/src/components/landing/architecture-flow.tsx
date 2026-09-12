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

// The comet is a fixed-width glowing shape that glides along the line, so
// it needs to travel a bit past both ends of the path to fully enter/exit.
const COMET_WIDTH = 64;
// Matches the connecting line's strokeWidth exactly, so the comet's tips
// never poke out above/below the line it rides on.
const COMET_HEIGHT = 1;
const COMET_HALF_WIDTH = COMET_WIDTH / 2;
// A flattened rhombus: pointed left/right tips sitting on the line, widening
// to COMET_HEIGHT only at its horizontal midpoint. The line's own Y is baked
// into the points (polygon has no native y attribute to translate instead).
const COMET_POINTS = `0,${Y} ${COMET_HALF_WIDTH},${Y - COMET_HEIGHT / 2} ${COMET_WIDTH},${Y} ${COMET_HALF_WIDTH},${Y + COMET_HEIGHT / 2}`;
const TRAVEL_START = PATH_START - COMET_WIDTH;
const TRAVEL_END = PATH_END + COMET_WIDTH;
const TRAVEL_SPAN = TRAVEL_END - TRAVEL_START;

// One color per node the comet changes to as it arrives, bookended by the
// off-screen start/end keyframes (which just repeat the nearest node color).
const stepColors = [
  "#f8fafc",
  "#22c55e",
  "#ef4444",
  "#ec4899",
  "#f97316",
  "#8b5cf6",
];
const colorKeyframes = [
  stepColors[0],
  ...stepColors,
  stepColors[stepColors.length - 1],
];
const xKeyframes = [
  TRAVEL_START,
  ...nodes.map((node) => node.x - COMET_WIDTH / 2),
  TRAVEL_END,
];
const opacityKeyframes = [
  0,
  1,
  1,
  1,
  1,
  1,
  1,
  0,
];
const timeKeyframes = [
  0,
  ...nodes.map((node) => (node.x - TRAVEL_START) / TRAVEL_SPAN),
  1,
];

const cometTransition = {
  delay: 0.6,
  duration: 5.2,
  ease: "linear" as const,
  repeat: Infinity,
  repeatDelay: 0.6,
  times: timeKeyframes,
};

// `currentColor` in a gradient's <stop> resolves against the CSS `color`
// of the gradient element itself (not the shape referencing it), so the
// color has to be animated on the gradient — a standard, reliably tweened
// style property — rather than on the comet rect.
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
                    color: colorKeyframes,
                  }
            }
            id="architecture-flow-comet-color"
            initial={{
              color: stepColors[0],
            }}
            transition={
              reduceMotion
                ? {
                    duration: 0,
                  }
                : cometTransition
            }
          >
            <stop
              offset="0%"
              stopColor="currentColor"
              stopOpacity={0}
            />
            <stop
              offset="45%"
              stopColor="currentColor"
              stopOpacity={1}
            />
            <stop
              offset="55%"
              stopColor="currentColor"
              stopOpacity={1}
            />
            <stop
              offset="100%"
              stopColor="currentColor"
              stopOpacity={0}
            />
          </MotionLinearGradient>
          <filter
            height="600%"
            id="architecture-flow-comet-glow"
            width="200%"
            x="-50%"
            y="-250%"
          >
            <feGaussianBlur
              result="blur"
              stdDeviation="2.4"
            />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
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
          <motion.polygon
            fill="url(#architecture-flow-comet-color)"
            filter="url(#architecture-flow-comet-glow)"
            initial={{
              opacity: 0,
              x: TRAVEL_START,
            }}
            points={COMET_POINTS}
            style={{
              transformOrigin: "0px 0px",
            }}
            transition={cometTransition}
            viewport={{
              margin: "-60px",
              once: true,
            }}
            whileInView={{
              opacity: opacityKeyframes,
              x: xKeyframes,
            }}
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
