"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { motion } from "framer-motion";
import { Card, CardBody } from "@heroui/react";

type UiActionTileProps = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  onClick?: () => void;
  href?: string;
};

export function UiActionTile({ label, icon: Icon, iconClassName, onClick, href }: UiActionTileProps) {
  const tileClassName =
    "interactive-hover bg-gradient-to-br from-content2/82 to-content1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_16px_rgba(2,6,23,0.14)]";

  const tileBody = (
    <CardBody className="items-center px-2 py-2.5 text-center">
      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${iconClassName}`}>
        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
      </span>
      <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">{label}</p>
    </CardBody>
  );

  if (href) {
    return (
      <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
        <Card as={Link} className={tileClassName} href={href} isPressable shadow="none">
          {tileBody}
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
      <Card className={tileClassName} isPressable shadow="none" onPress={onClick}>
        {tileBody}
      </Card>
    </motion.div>
  );
}
