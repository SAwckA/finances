# План реализации frontend-приложения (mobile-first + SPA)

## Источники
- OpenAPI: `docs/openapi.json`
- Backend-сервисы: `app/services/*`
- Context7:
  - Next.js App Router: клиентская навигация через `Link` и `useRouter` для SPA-переходов
  - Tailwind CSS: mobile-first подход (базовые классы для mobile, `sm/md/lg` для расширений)

## Ключевые требования
1. **Полностью SPA**
   - Все бизнес-данные загружаются на клиенте через API backend.
   - Переходы между экранами только клиентские (`Link`, `router.push`), без full page reload.
   - Не использовать server actions/SSR как источник бизнес-данных финансового кабинета.
2. **Mobile-first**
   - Сначала UX для 360-430px, затем адаптация на `sm/md/lg`.
   - Основные сценарии (добавить транзакцию, подтвердить список покупок) доступны одной рукой на телефоне.
3. **Единый стандарт импортов**
   - Во всем frontend использовать только alias-импорты через `@/*`.
   - Относительные импорты (`../`, `./`) для внутренних модулей приложения не использовать.

## Текущий статус реализации
- Завершено: **CP0 — Foundation SPA**, **CP1 — Auth и сессия**
- Завершено: миграция импортов на alias `@/*` во всем `frontend/src`
- Завершено: **CP2 — Справочники (счета, категории, валюты)**
- Следующий: **CP3 — Транзакции (ядро учета)**

## Основные страницы (маршруты SPA)

### Публичные
- `/auth/login`
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
- `/auth/register`
  - `POST /api/auth/register`

### Приватные
- `/dashboard`
  - `GET /api/statistics/total`
  - `GET /api/statistics/balance`
  - `GET /api/statistics/summary`
- `/transactions`
  - `GET /api/transactions`
  - `GET /api/transactions/period`
  - `GET /api/transactions/account/{account_id}`
  - `POST /api/transactions`
  - `PATCH /api/transactions/{transaction_id}`
  - `DELETE /api/transactions/{transaction_id}`
- `/accounts`
  - `GET /api/accounts`
  - `POST /api/accounts`
  - `PATCH /api/accounts/{account_id}`
  - `DELETE /api/accounts/{account_id}`
- `/categories`
  - `GET /api/categories`
  - `POST /api/categories`
  - `PATCH /api/categories/{category_id}`
  - `DELETE /api/categories/{category_id}`
- `/shopping-lists`
  - `GET /api/shopping-lists`
  - `POST /api/shopping-lists`
  - `PATCH /api/shopping-lists/{list_id}`
  - `DELETE /api/shopping-lists/{list_id}`
  - `POST /api/shopping-lists/{list_id}/items`
  - `PATCH /api/shopping-lists/{list_id}/items/{item_id}`
  - `DELETE /api/shopping-lists/{list_id}/items/{item_id}`
  - `POST /api/shopping-lists/{list_id}/confirm`
  - `POST /api/shopping-lists/{list_id}/complete`
- `/shopping-templates`
  - `GET /api/shopping-templates`
  - `POST /api/shopping-templates`
  - `PATCH /api/shopping-templates/{template_id}`
  - `DELETE /api/shopping-templates/{template_id}`
  - `POST /api/shopping-templates/{template_id}/items`
  - `PATCH /api/shopping-templates/{template_id}/items/{item_id}`
  - `DELETE /api/shopping-templates/{template_id}/items/{item_id}`
  - `POST /api/shopping-templates/{template_id}/create-list`
- `/recurring`
  - `GET /api/recurring-transactions`
  - `GET /api/recurring-transactions/pending`
  - `POST /api/recurring-transactions`
  - `PATCH /api/recurring-transactions/{recurring_id}`
  - `DELETE /api/recurring-transactions/{recurring_id}`
  - `POST /api/recurring-transactions/{recurring_id}/activate`
  - `POST /api/recurring-transactions/{recurring_id}/deactivate`
  - `POST /api/recurring-transactions/{recurring_id}/execute`
- `/profile`
  - `GET /api/users/me`
  - `PUT /api/users/me`
- `/settings/currencies`
  - `GET /api/currencies`
  - `GET /api/currencies/code/{code}`

## Архитектурный каркас SPA
- `frontend/src/app/auth/*` (публичные auth-страницы) и `frontend/src/app/(protected)/*` (приватные экраны) как клиентские маршруты.
- Глобальный `AppShell`: верхняя панель + bottom navigation (mobile-first).
- API-слой: typed client по OpenAPI + централизованный auth refresh + единый error handler.
- Состояние:
  - auth/session
  - справочники (счета, категории, валюты)
  - экранные данные (транзакции, статистика, списки покупок)
- Все формы в модальных/slide-over сценариях, оптимизированных под мобильный viewport.

## Чекпоинты (с четкими критериями)

### CP0 — Foundation SPA
**Результат:** каркас приложения и навигации готов.
- [x] Настроены маршруты `auth/*` и `(protected)/*`.
- [x] Client-side навигация работает без full reload.
- [x] Реализован route guard для приватных страниц.
- [x] Есть AppShell с mobile bottom-nav.
**DoD:** пользователь может войти и перейти по основным разделам только клиентскими переходами.

### CP1 — Auth и сессия
**Результат:** стабильная авторизация.
- [x] Login/Register формы и валидация.
- [x] Access/refresh токены, авто-refresh.
- [x] Logout с полной очисткой сессии.
**DoD:** после истечения access токена приложение продолжает работать без ручного перелогина.

### CP2 — Справочники (счета, категории, валюты)
**Результат:** базовые сущности для учета готовы.
- [x] CRUD экран для счетов.
- [x] CRUD экран для категорий.
- [x] Подключен справочник валют в формах счетов.
**DoD:** можно полностью подготовить данные для ввода транзакций через UI.

### CP3 — Транзакции (ядро учета)
**Результат:** полноценный журнал операций.
- [ ] CRUD транзакций (income/expense/transfer).
- [ ] Фильтры по периоду, типу, счету.
- [ ] Пагинация и быстрые действия в мобильной таблице/списке.
**DoD:** пользователь ведет ежедневный учет без обращения к БД/админке.

### CP4 — Dashboard и аналитика
**Результат:** прозрачная картина финансов.
- [ ] Общий баланс и балансы по счетам.
- [ ] Статистика доход/расход за период.
- [ ] Категорийные breakdown-блоки.
**DoD:** после добавления транзакции виджеты обновляются корректно.

### CP5 — Списки покупок и шаблоны
**Результат:** планирование покупок в рабочем процессе.
- [ ] CRUD shopping lists + items.
- [ ] Статусы `draft -> confirmed -> completed`.
- [ ] CRUD шаблонов + создание списка из шаблона.
**DoD:** пользователь может создать список из шаблона и завершить его через UI.

### CP6 — Регулярные транзакции
**Результат:** автоматизация повторяющихся операций.
- [ ] CRUD recurring-транзакций.
- [ ] Activate/deactivate/execute.
- [ ] Экран pending операций.
**DoD:** ежемесячные/еженедельные операции настраиваются и исполняются без ручного ввода каждой транзакции.

### CP7 — Mobile-first hardening и релизная готовность
**Результат:** production-ready UX на телефонах.
- [ ] Все ключевые сценарии проверены на 360px, 390px, 430px.
- [ ] Пустые состояния, loaders, единая обработка ошибок.
- [ ] Оптимизация: устранены waterfall-запросы, lazy для тяжелых блоков.
- [ ] Smoke E2E: `login -> account/category -> transaction -> dashboard -> shopping list -> recurring`.
**DoD:** MVP стабилен на mobile и desktop, без критических UX блокеров.

## Критерии готовности MVP
- Пользователь регистрируется/логинится и не теряет сессию.
- Все основные сценарии учета личных финансов закрыты в SPA-интерфейсе.
- Мобильный UX является основным: все критические действия доступны и удобны на телефоне.
- Данные UI согласованы с backend API и корректно обновляются после CRUD-операций.
