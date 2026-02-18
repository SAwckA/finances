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
    <header className="sticky top-0 z-10 rounded-[var(--radius-lg)] bg-[color:color-mix(in_srgb,var(--bg-card)_86%,transparent)] px-3 py-2.5 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="interactive-hover tap-highlight-none inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-b from-content2/85 to-content1 text-[var(--text-secondary)] transition"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h2 className="text-base font-bold text-[var(--text-primary)]">{title}</h2>
        <button
          type={formId ? "submit" : "button"}
          form={formId}
          onClick={onSave}
          className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-primary to-primary-500 px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-70"
          disabled={isSaving}
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </header>
  );
}
