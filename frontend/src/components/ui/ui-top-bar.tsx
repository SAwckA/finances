"use client";

import { ChevronLeft, Save } from "lucide-react";
import { motion } from "framer-motion";

type UiTopBarProps = {
  title: string;
  onBack: () => void;
  onSave?: () => void;
  onPrimaryAction?: () => void;
  saveLabel?: string;
  isSaving?: boolean;
  isPrimaryLoading?: boolean;
  formId?: string;
  primaryLabel?: string;
  showSaveIcon?: boolean;
  className?: string;
};

export function UiTopBar({
  title,
  onBack,
  onSave,
  onPrimaryAction,
  saveLabel,
  isSaving,
  isPrimaryLoading = false,
  formId,
  primaryLabel = "Сохранить",
  showSaveIcon,
  className,
}: UiTopBarProps) {
  const resolvedLabel = saveLabel ?? primaryLabel;
  const resolvedLoading = isSaving ?? isPrimaryLoading;
  const resolvedAction = onPrimaryAction ?? onSave;
  const shouldRenderSaveIcon = showSaveIcon ?? Boolean(formId || onSave);

  return (
    <motion.header
      animate={{ opacity: 1, y: 0 }}
      className={`nav-shell-surface sticky top-0 z-30 rounded-b-[24px] px-3 py-2.5 ${
        className ?? ""
      }`}
      initial={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          aria-label="Назад"
          className="interactive-hover nav-chip-solid tap-highlight-none inline-flex h-10 w-10 items-center justify-center rounded-2xl transition"
          type="button"
          onClick={onBack}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <h2 className="truncate text-base font-bold text-[var(--text-primary)]">{title}</h2>

        <button
          className="inline-flex min-w-[120px] items-center justify-center gap-1.5 rounded-2xl bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent-primary)_72%,white)_0%,var(--accent-primary)_55%,var(--accent-primary-strong)_100%)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-[0_12px_24px_color-mix(in_srgb,var(--accent-primary)_30%,transparent),inset_0_1px_0_color-mix(in_srgb,white_24%,transparent)] transition hover:brightness-110 disabled:opacity-70"
          disabled={resolvedLoading}
          form={formId}
          type={formId ? "submit" : "button"}
          onClick={resolvedAction}
        >
          {shouldRenderSaveIcon ? <Save className="h-4 w-4" aria-hidden="true" /> : null}
          {resolvedLoading ? "Сохраняем..." : resolvedLabel}
        </button>
      </div>
    </motion.header>
  );
}
