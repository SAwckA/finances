"use client";

import { EmptyState } from "@/components/async-state";
import { UiPageHeader } from "@/components/ui/ui-page-header";

export default function AnalyticsPage() {
  return (
    <section className="space-y-3">
      <UiPageHeader title="Аналитика" description="Раздел находится в активной разработке." />

      <EmptyState message="Скоро здесь появятся детальные отчеты и тренды." />
    </section>
  );
}
