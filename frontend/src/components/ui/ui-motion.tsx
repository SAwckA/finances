"use client";

import type { ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

type UiMotionSectionProps = HTMLMotionProps<"section"> & {
  children: ReactNode;
};

export function UiMotionSection({ children, ...props }: UiMotionSectionProps) {
  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      {...props}
    >
      {children}
    </motion.section>
  );
}

type UiMotionListItemProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
  index?: number;
};

export function UiMotionListItem({ children, index = 0, ...props }: UiMotionListItemProps) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: 8 }}
      transition={{ delay: Math.min(index, 8) * 0.03, duration: 0.18, ease: "easeOut" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
