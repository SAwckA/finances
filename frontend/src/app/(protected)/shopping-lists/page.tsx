"use client";

import { PlaceholderCard } from "../../../components/placeholder-card";
import { ScreenHeader } from "../../../components/screen-header";

export default function ShoppingListsPage() {
  return (
    <>
      <ScreenHeader
        title="Списки покупок"
        description="Черновики, подтверждение и завершение покупок с фиксацией финансового эффекта."
      />
      <PlaceholderCard
        title="CP5: Списки покупок"
        description="Экран для повседневных покупок, оптимизированный под мобильное использование."
        nextSteps={[
          "Подключить /api/shopping-lists и статусы draft/confirmed/completed",
          "Добавить управление позициями списка",
          "Реализовать confirm и complete действия",
        ]}
      />
    </>
  );
}
