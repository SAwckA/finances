"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

type UiPageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function UiPageHeader({ title, description, actions, className }: UiPageHeaderProps) {
  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className={`app-panel mb-4 p-4 ${className ?? ""}`}
      initial={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h1>
          {description ? <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p> : null}
        </div>
        {actions ? <div>{actions}</div> : null}
      </div>
    </motion.section>
  );
}
