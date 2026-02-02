"use client";

import { PlaceholderCard } from "../../../components/placeholder-card";
import { ScreenHeader } from "../../../components/screen-header";

export default function CategoriesPage() {
  return (
    <>
      <ScreenHeader
        title="Категории"
        description="Категории доходов и расходов для аналитики и контроля бюджета."
      />
      <PlaceholderCard
        title="CP2: Справочники"
        description="Экран категорий нужен для корректной классификации операций."
        nextSteps={[
          "Подключить /api/categories",
          "Добавить фильтр income/expense",
          "Реализовать CRUD в мобильном формате",
        ]}
      />
    </>
  );
}
