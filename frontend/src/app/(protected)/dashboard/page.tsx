"use client";

import { PlaceholderCard } from "../../../components/placeholder-card";
import { ScreenHeader } from "../../../components/screen-header";

export default function DashboardPage() {
  return (
    <>
      <ScreenHeader
        title="Обзор финансов"
        description="Mobile-first экран со сводкой баланса, доходов, расходов и аналитики по категориям."
      />
      <PlaceholderCard
        title="CP4: Dashboard и аналитика"
        description="На этом этапе добавим карточки баланса и графики по данным /api/statistics/*."
        nextSteps={[
          "Подключить /api/statistics/total и /api/statistics/balance",
          "Добавить переключение периода и /api/statistics/summary",
          "Сделать компактные карточки и графики для мобильного экрана",
        ]}
      />
    </>
  );
}
