"use client";

import { PlaceholderCard } from "../../../components/placeholder-card";
import { ScreenHeader } from "../../../components/screen-header";

export default function ShoppingTemplatesPage() {
  return (
    <>
      <ScreenHeader
        title="Шаблоны покупок"
        description="Повторно используемые наборы товаров для быстрых списков."
      />
      <PlaceholderCard
        title="CP5: Шаблоны"
        description="Шаблоны ускорят создание типовых покупок в 1-2 действия."
        nextSteps={[
          "Подключить /api/shopping-templates",
          "Добавить редактирование элементов шаблона",
          "Реализовать create-list из шаблона",
        ]}
      />
    </>
  );
}
