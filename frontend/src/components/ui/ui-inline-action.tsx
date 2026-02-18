"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Button } from "@heroui/react";

type UiInlineActionProps = {
  children: ReactNode;
  onPress?: () => void;
  href?: string;
  className?: string;
};

const baseClassName =
  "interactive-hover min-w-0 rounded-xl bg-gradient-to-r from-content2/84 to-content1 px-3 py-2 text-xs font-semibold text-[var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_16px_rgba(2,6,23,0.16)]";

export function UiInlineAction({ children, onPress, href, className }: UiInlineActionProps) {
  const nextClassName = className ? `${baseClassName} ${className}` : baseClassName;

  if (href) {
    return (
      <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
        <Button as={Link} className={nextClassName} href={href} radius="lg" size="sm" variant="light">
          {children}
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
      <Button className={nextClassName} onPress={onPress} radius="lg" size="sm" variant="light">
        {children}
      </Button>
    </motion.div>
  );
}
