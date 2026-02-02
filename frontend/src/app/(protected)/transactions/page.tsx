"use client";

import { PlaceholderCard } from "../../../components/placeholder-card";
import { ScreenHeader } from "../../../components/screen-header";

export default function TransactionsPage() {
  return (
    <>
      <ScreenHeader
        title="Операции"
        description="Журнал транзакций: доходы, расходы и переводы между счетами."
      />
      <PlaceholderCard
        title="CP3: Транзакции"
        description="Этот экран станет ядром ежедневного учета с быстрым мобильным вводом."
        nextSteps={[
          "Подключить список /api/transactions с пагинацией",
          "Добавить фильтры по периоду, типу, счету",
          "Реализовать create/edit/delete через modal sheet",
        ]}
      />
    </>
  );
}
