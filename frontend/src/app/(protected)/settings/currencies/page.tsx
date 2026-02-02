"use client";

import { PlaceholderCard } from "../../../../components/placeholder-card";
import { ScreenHeader } from "../../../../components/screen-header";

export default function CurrenciesSettingsPage() {
  return (
    <>
      <ScreenHeader
        title="Валюты"
        description="Справочник валют для счетов и отображения финансовых сумм."
      />
      <PlaceholderCard
        title="CP2: Валютный справочник"
        description="Экран используется в первую очередь как источник данных для форм счетов."
        nextSteps={[
          "Подключить GET /api/currencies",
          "Добавить быстрый поиск по коду",
          "Подготовить UI для будущего admin-режима",
        ]}
      />
    </>
  );
}
