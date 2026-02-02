"use client";

import { PlaceholderCard } from "../../../components/placeholder-card";
import { ScreenHeader } from "../../../components/screen-header";
import { useAuth } from "../../../features/auth/auth-context";

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <>
      <ScreenHeader
        title="Профиль"
        description="Управление данными текущего пользователя."
      />
      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">Текущий пользователь</p>
        <p className="mt-1 text-base font-semibold text-slate-900">{user?.name}</p>
        <p className="text-sm text-slate-700">{user?.email}</p>
      </section>
      <PlaceholderCard
        title="CP1/CP7: Профиль"
        description="Добавим редактирование через /api/users/me и UX-улучшения."
        nextSteps={[
          "Подключить PUT /api/users/me",
          "Добавить форму изменения имени",
          "Показать уведомления о результате сохранения",
        ]}
      />
    </>
  );
}
