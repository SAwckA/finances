# План миграции проекта на новый дизайн

## 1) Цель

Полностью перевести frontend на новый визуальный язык из референсов в `docs/design/`:

- `docs/design/main page.png`
- `docs/design/analytics.png`
- `docs/design/transactions.png`
- `docs/design/accounts.png`
- `docs/design/categories.png`
- `docs/design/settings.png`

Сохранить текущую бизнес-логику и API-контракты, а недостающие данные для новых экранов добавить отдельными backend-задачами.

---

## 2) Что есть сейчас (база для миграции)

- App Router + React 19 + Next 16 + Tailwind v4 + HeroUI.
- Текущий shell: `frontend/src/components/app-shell.tsx`.
- Основные экраны: `dashboard`, `transactions`, `accounts`, `categories`, `profile`, `recurring`, `shopping-*`, `settings/currencies`.
- Общие UI-элементы: `screen-header`, `color-picker-field`, `icon-picker-field`, `async-state`.
- Нет отдельного экрана `analytics` и нет `frontend/src/app/(protected)/settings/page.tsx`.

---

## 3) Архитектурный подход миграции

1. **Mobile-first как основа** (референс — мобильный UI), затем desktop-адаптация.
2. **Сначала дизайн-система**, потом экраны (чтобы не дублировать стили).
3. **Инкрементально по маршрутам**: каждый экран переводится в новом стиле и сразу стабилизируется.
4. **Без слома API**: где данных не хватает — добавить endpoint/расширение схемы, а не хардкодить.

---

## 4) Этапы работ

## Чекпоинты (progress checklist)

- [x] CP-0: Подготовка завершена (этап 0)
- [x] CP-1: Дизайн-токены и базовые стили внедрены (этап 1)
- [x] CP-2: Новый App Shell и нижняя навигация внедрены (этап 2)
- [x] CP-3: Библиотека UI-компонентов собрана (этап 3)
- [x] CP-4: Dashboard полностью переведен на новый дизайн (этап 4)
- [x] CP-5: Analytics экран запущен и заполнен данными (этап 5)
- [x] CP-6: Transactions редизайн завершен (этап 6)
- [x] CP-7: Accounts редизайн завершен (этап 7)
- [x] CP-8: Categories редизайн завершен (этап 8)
- [x] CP-9: Settings hub завершен (этап 9)
- [x] CP-10: Нереференсные экраны визуально выровнены (этап 10)
- [ ] CP-11: Нужные backend-доработки закрыты (этап 11)
- [ ] CP-12: QA/perf-проверки пройдены (этап 12)
- [ ] CP-13: PR-пакеты смержены и DoD выполнен (этап 13 + раздел 5)

## Этап 0. Подготовка и декомпозиция

- [x] Чекпоинт этапа: CP-0

- Зафиксировать feature-ветку: `feat/redesign-2026`.
- Составить UI-карту экранов:
  - Covered by reference: dashboard/main, analytics, transactions, accounts, categories, settings.
  - Not covered: recurring, shopping-lists, shopping-templates, auth.
- Разбить на PR-пакеты (см. этап 11).

### Артефакты этапа

- Обновленный `plan.md` (этот файл).
- Чеклист маршрутов и компонентов в задаче/issue tracker.

---

## Этап 1. Дизайн-токены и базовые стили

- [x] Чекпоинт этапа: CP-1

### Что сделать

- В `frontend/src/app/globals.css` добавить CSS variables:
  - Цвета (dark surface, card, accent violet, semantic green/red/orange, muted backgrounds).
  - Радиусы (12/16/20), отступы, тени, border tokens.
  - Типографика (размеры для title/subtitle/body/caption).
- Привести к единому scale spacing и corner radius (под референс).
- Настроить utility-классы/слой компонентов для повторяемых паттернов:
  - `mobile-card`, `section-title`, `chip`, `stat-tile`, `action-tile`, `list-row`.

### Файлы

- `frontend/src/app/globals.css`
- при необходимости: `frontend/tailwind.config.ts`

### Критерии готовности

- Все новые экраны используют токены, а не точечные hex-коды.
- Не больше 1-2 исключений inline-style на экран.

---

## Этап 2. Новый App Shell и навигация

- [x] Чекпоинт этапа: CP-2

### Что сделать

- Пересобрать `frontend/src/components/app-shell.tsx` под новый паттерн:
  - Верхний компактный header (аватар/приветствие/иконки).
  - Нижняя tab-nav с центральной кнопкой Add (как в `main page.png`).
  - Корректный safe area для iOS.
- Обновить набор маршрутов в нижнем меню:
  - Home (`/dashboard`)
  - Analytics (`/analytics`)
  - Add (`/transactions?create=1`)
  - Settings (`/settings`)
  - Profile (`/profile`)

### Критерии готовности

- Навигация визуально и по структуре совпадает с референсом.
- Все переходы работают без full reload.

---

## Этап 3. Библиотека новых UI-компонентов

- [x] Чекпоинт этапа: CP-3

### Что сделать

- Создать слой переиспользуемых компонентов в `frontend/src/components/ui/`:
  - `mobile-header.tsx`
  - `bottom-tabbar.tsx`
  - `balance-hero-card.tsx`
  - `stat-card.tsx`
  - `source-card.tsx`
  - `transaction-row.tsx`
  - `icon-grid-picker.tsx`
  - `color-grid-picker.tsx`
  - `segmented-control.tsx`
- Адаптировать существующие `color-picker-field` и `icon-picker-field` к grid-формату из макетов.

### Критерии готовности

- Новые экраны собираются из UI-блоков, а не из повторяемой разметки.
- Компоненты принимают data-only props (минимум бизнес-логики внутри).

---

## Этап 4. Dashboard (main page) — полный редизайн

- [x] Чекпоинт этапа: CP-4

### Целевой маршрут

- `frontend/src/app/(protected)/dashboard/page.tsx`

### Что сделать

- Перенести в dark-gradient стиль:
  - Hero с Total Balance.
  - Income/Expenses summary tiles.
  - Список payment sources.
  - Быстрые действия (Add/Send/Transfer/Budget).
  - Recent transactions.
- Разделить page на блоки и лениво подгружать тяжелые (списки, графика) через dynamic import там, где оправдано.

### Данные

- Переиспользовать текущие `statistics` и `transactions`.
- Добавить ограниченный запрос последних транзакций (если не хватает в текущем endpoint).

### Критерии готовности

- Визуально: максимально близко к `main page.png`.
- Функционально: баланс/списки/переходы работают как и раньше.

---

## Этап 5. Analytics экран (новый маршрут)

- [x] Чекпоинт этапа: CP-5

### Целевой маршрут

- Новый файл: `frontend/src/app/(protected)/analytics/page.tsx`

### Что сделать

- Собрать экран как в `analytics.png`:
  - Insight card.
  - Donut chart spending overview.
  - Category breakdown list.
  - Monthly trends line chart.
  - Smart predictions card.
- Добавить chart-библиотеку (легковесную) только при необходимости и подключить динамически.

### Backend задачи (если данных нет)

- Расширить API статистики:
  - Тренд по месяцам (доход/расход/нетто).
  - Breakdown по категориям за период в удобном формате для графиков.

### Критерии готовности

- Экран открывается из tabbar.
- Все виджеты заполняются реальными данными API.

---

## Этап 6. Transactions (новый UX добавления)

- [x] Чекпоинт этапа: CP-6

### Целевой маршрут

- `frontend/src/app/(protected)/transactions/page.tsx`

### Что сделать

- Перестроить форму на flow из `transactions.png`:
  - Segmented Expense/Income.
  - Большой amount input.
  - Выбор payment source карточками.
  - Выбор category плитками с иконками.
  - Description optional.
- Оставить edit/delete/list операций, но визуально привести к новой системе.
- Сценарий `?create=1` должен открывать создание сразу.

### Критерии готовности

- Добавление транзакции делается с минимальным числом кликов.
- Валидации и API payload остаются корректными.

---

## Этап 7. Accounts (New Payment Source)

- [x] Чекпоинт этапа: CP-7

### Целевой маршрут

- `frontend/src/app/(protected)/accounts/page.tsx`

### Что сделать

- Пересобрать форму под `accounts.png`:
  - Source Type (Bank/Card/Cash).
  - Source Name.
  - Account Number (optional / masked preview).
  - Initial Balance.
  - Выбор цвета grid’ом.
  - Preview card внизу.
- Добавить mapping Source Type -> icon preset.

### Backend задачи (опционально)

- Если нужен `initial_balance` как отдельное поле, расширить модель/endpoint.
- Иначе документировать, что стартовый баланс создается стартовой транзакцией.

### Критерии готовности

- Экран совпадает по структуре с `accounts.png`.
- Создание/редактирование счета не ломает старые данные.

---

## Этап 8. Categories (New Category)

- [x] Чекпоинт этапа: CP-8

### Целевой маршрут

- `frontend/src/app/(protected)/categories/page.tsx`

### Что сделать

- Перевести форму в стиль `categories.png`:
  - Segmented Expense/Income.
  - Name input.
  - Icon grid picker (готовые пресеты).
  - Preview row.
- Список существующих категорий стилизовать под новые карточки.

### Критерии готовности

- Создание категории интуитивно и быстро.
- Пикер иконок повторяет референсную сетку.

---

## Этап 9. Settings (Workspace Settings)

- [x] Чекпоинт этапа: CP-9

### Целевой маршрут

- Новый файл: `frontend/src/app/(protected)/settings/page.tsx`

### Что сделать

- Создать hub-экран как в `settings.png`:
  - Workspace hero (название, статус, counters).
  - Пункты: Categories, Payment Sources, API Keys, Budget Settings, Notifications, Data Export, Privacy & Security.
- Настроить маршрутизацию:
  - `Categories` -> `/categories`
  - `Payment Sources` -> `/accounts`
  - `Settings/Currencies` оставить как вложенный раздел.
- Для разделов без реализации — оформить как disabled/coming soon с единым паттерном.

### Критерии готовности

- Экран доступен по `/settings`.
- Переходы на существующие модули работают.

---

## Этап 10. Экраны без референса (приведение к общему стилю)

- [x] Чекпоинт этапа: CP-10

- `frontend/src/app/(protected)/recurring/page.tsx`
- `frontend/src/app/(protected)/shopping-lists/page.tsx`
- `frontend/src/app/(protected)/shopping-templates/page.tsx`
- `frontend/src/app/auth/login/page.tsx`
- `frontend/src/app/auth/register/page.tsx`
- `frontend/src/app/auth/layout.tsx`

### Что сделать

- Привести в новый токенизированный стиль без изменения логики.
- Использовать те же form controls, cards, button hierarchy.

---

## Этап 11. Бэкенд-доработки под новый UI (если потребуются)

- [x] Чекпоинт этапа: CP-11

### Приоритет A (вероятно нужно)

- Endpoint трендов для analytics (по месяцам/неделям).
- Endpoint/параметры для компактного recent transactions блока.

### Приоритет B (опционально)

- Workspace summary для settings header.
- Поддержка initial balance/типа источника в accounts.

### Файлы-кандидаты

- `app/api/controllers/statistics.py`
- `app/services/statistics_service.py`
- `app/repositories/transaction_repository.py`
- `app/models/account.py` (только при расширении модели)
- новые migration-файлы в `migrations/versions/` (если изменяется схема БД)

---

## Этап 12. Качество, доступность, производительность

- [x] Чекпоинт этапа: CP-12

### QA-checklist

- Адаптив: 360px, 390px, 768px, 1024px+.
- keyboard/focus states для кнопок, tabbar, picker’ов.
- Контраст текста на gradient/dark поверхностях.
- Состояния loading/empty/error на каждом экране.
- Проверка safe-area и нижнего меню на iOS/Android.

### Perf-checklist

- Динамический импорт для графиков и тяжелых секций.
- Избегать barrel import для крупных пакетов.
- Не тащить большие зависимости в initial bundle.

---

## Этап 13. План PR-ов (рекомендуемый)

- [x] Чекпоинт этапа: CP-13

1. PR-1: токены + base styles + shell/navigation.
2. PR-2: dashboard + reusable widgets.
3. PR-3: analytics + backend stats extension.
4. PR-4: transactions redesign.
5. PR-5: accounts + categories redesign.
6. PR-6: settings hub + routing cleanup.
7. PR-7: recurring/shopping/auth visual alignment + final polish.

---

## 5) Definition of Done

- Все ключевые маршруты визуально соответствуют референсам из `docs/design/`.
- Нет регрессий CRUD-сценариев (accounts/categories/transactions).
- Новый маршрут `/analytics` и `/settings` полностью рабочие.
- Нет явных UX-разрывов между референсными и нереференсными экранами.
- Код разделен на переиспользуемые компоненты, без копипаста больших кусков разметки.
