"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{
        opacity: 0,
        y: 16,
      }}
      transition={{
        delay,
        duration: 0.7,
        ease: [
          0.16,
          1,
          0.3,
          1,
        ],
      }}
      viewport={{
        margin: "-80px",
        once: true,
      }}
      whileInView={{
        opacity: 1,
        y: 0,
      }}
    >
      {children}
    </motion.div>
  );
}
