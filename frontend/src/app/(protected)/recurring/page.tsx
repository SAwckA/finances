"use client";

import { PlaceholderCard } from "@/components/placeholder-card";
import { ScreenHeader } from "@/components/screen-header";

export default function RecurringPage() {
  return (
    <>
      <ScreenHeader
        title="Повторяемые операции"
        description="Автоматизация регулярных доходов и расходов."
      />
      <PlaceholderCard
        title="CP6: Recurring"
        description="Настроим расписания daily/weekly/monthly и ручной execute."
        nextSteps={[
          "Подключить /api/recurring-transactions",
          "Добавить activate/deactivate и pending",
          "Сделать форму частоты с day_of_week/day_of_month",
        ]}
      />
    </>
  );
}
