"use client";

import { EmptyState } from "@/components/async-state";

export default function AnalyticsPage() {
  return (
    <section className="space-y-3">
      <section className="mobile-card p-3">
        <h1 className="section-title text-[1.2rem] text-[var(--text-primary)]">Analytics</h1>
        <p className="section-caption">Comming soon.</p>
      </section>

      <EmptyState message="Comming soon." />
    </section>
  );
}
