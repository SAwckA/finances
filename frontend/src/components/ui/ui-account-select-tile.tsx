"use client";

import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { getIconOption } from "@/lib/icon-catalog";
import type { AccountResponse } from "@/lib/types";
import { UiChip } from "@/components/ui/ui-chip";

type UiAccountSelectTileProps = {
  account: AccountResponse;
  balanceLabel: string;
  selected?: boolean;
  onPress?: () => void;
};

function selectedGradientStyle(color: string): CSSProperties {
  return {
    backgroundImage: `radial-gradient(circle at 10% 0%, ${color}3f 0%, transparent 48%), linear-gradient(135deg, ${color}30 0%, ${color}16 52%, transparent 100%), linear-gradient(135deg, color-mix(in srgb, var(--heroui-content2) 80%, transparent) 0%, color-mix(in srgb, var(--heroui-content1) 100%, transparent) 100%)`,
    boxShadow: `0 0 0 2px ${color}66, 0 12px 24px rgba(2, 6, 23, 0.24)`,
  };
}

function shortAccountBadge(account: AccountResponse): string | null {
  if (!account.short_identifier) {
    return null;
  }

  return account.short_identifier;
}

export function UiAccountSelectTile({
  account,
  balanceLabel,
  selected = false,
  onPress,
}: UiAccountSelectTileProps) {
  const Icon = getIconOption(account.icon).icon;
  const badge = shortAccountBadge(account);

  return (
    <motion.button
      className={`interactive-hover flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left transition ${
        selected
          ? "text-[var(--text-primary)]"
          : "bg-gradient-to-br from-content2/80 to-content1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_22px_rgba(2,6,23,0.18)]"
      }`}
      style={selected ? selectedGradientStyle(account.color) : undefined}
      type="button"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.985 }}
      onClick={onPress}
    >
      <span
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${account.color}22`, color: account.color }}
      >
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-semibold text-[var(--text-primary)]">{account.name}</span>
          {badge ? <UiChip tone={account.color}>{badge}</UiChip> : <span className="text-xs text-[var(--text-secondary)]">Нет ID</span>}
        </div>
        <span className="mt-1 block text-xs text-[var(--text-secondary)]">{balanceLabel}</span>
      </div>
    </motion.button>
  );
}
