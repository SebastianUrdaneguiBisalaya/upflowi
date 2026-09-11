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
const cxSequence = nodes.map((n) => n.x);

export function ArchitectureFlow() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="mb-11 overflow-x-auto pb-2">
      <svg
        aria-label="A file's path from source through orchestration, scheduling, transport, and provider, to storage"
        className="h-auto w-full min-w-160"
        role="img"
        viewBox="0 0 720 104"
      >
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
          x1={nodes[0].x}
          x2={nodes[nodes.length - 1].x}
          y1={Y}
          y2={Y}
        />

        <motion.circle
          className="fill-ink"
          initial={{
            cx: nodes[0].x,
            cy: Y,
            opacity: 0,
          }}
          r={3.4}
          transition={
            reduceMotion
              ? {
                  duration: 0,
                }
              : {
                  delay: 0.35,
                  duration: 1.9,
                  ease: "linear",
                  repeat: Infinity,
                  repeatDelay: 1.4,
                  times: [
                    0,
                    0.2,
                    0.4,
                    0.6,
                    0.8,
                    1,
                    1,
                  ],
                }
          }
          viewport={{
            margin: "-60px",
            once: true,
          }}
          whileInView={
            reduceMotion
              ? {
                  cx: nodes[nodes.length - 1].x,
                  cy: Y,
                  opacity: 0,
                }
              : {
                  cx: cxSequence,
                  cy: Y,
                  opacity: [
                    0,
                    1,
                    1,
                    1,
                    1,
                    1,
                    0,
                  ],
                }
          }
        />

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
