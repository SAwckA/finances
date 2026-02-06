"use client";

import { ChevronLeft, Save } from "lucide-react";

type TransactionEditorHeaderProps = {
  title: string;
  onBack: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  formId?: string;
};

export function TransactionEditorHeader({
  title,
  onBack,
  onSave,
  isSaving = false,
  formId,
}: TransactionEditorHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-[color:var(--border-soft)] bg-[color:rgba(243,246,252,0.86)] px-3 py-2.5 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="surface-hover tap-highlight-none inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-secondary)] transition"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-base font-bold text-[var(--text-primary)]">{title}</h2>
        <button
          type={formId ? "submit" : "button"}
          form={formId}
          onClick={onSave}
          className="inline-flex items-center gap-1 rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-70"
          disabled={isSaving}
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </header>
  );
}
