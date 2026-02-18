"use client";

import { ChevronLeft } from "lucide-react";

type EditScreenHeaderProps = {
  title: string;
  onBack: () => void;
  saveLabel?: string;
  formId: string;
  isSaving?: boolean;
};

export function EditScreenHeader({
  title,
  onBack,
  saveLabel = "Save",
  formId,
  isSaving = false,
}: EditScreenHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-[color:color-mix(in_srgb,var(--bg-card)_82%,transparent)] px-3 py-2.5 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="interactive-hover tap-highlight-none inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-b from-content2/85 to-content1 text-[var(--text-secondary)] transition"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-[1.1rem] font-bold text-[var(--text-primary)]">{title}</h1>
        <button
          type="submit"
          form={formId}
          disabled={isSaving}
          className="tap-highlight-none rounded-xl bg-gradient-to-r from-primary to-primary-500 px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSaving ? "Saving..." : saveLabel}
        </button>
      </div>
    </header>
  );
}
