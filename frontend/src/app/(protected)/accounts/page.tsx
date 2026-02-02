"use client";

import { PlaceholderCard } from "@/components/placeholder-card";
import { ScreenHeader } from "@/components/screen-header";

export default function AccountsPage() {
  return (
    <>
      <ScreenHeader
        title="Счета"
        description="Карты, наличные и другие источники хранения средств."
      />
      <PlaceholderCard
        title="CP2: Справочники"
        description="Здесь будет CRUD счетов с выбором валюты и быстрым редактированием."
        nextSteps={[
          "Подключить /api/accounts",
          "Добавить формы create/update с валидацией",
          "Синхронизировать валюты через /api/currencies",
        ]}
      />
    </>
  );
}
