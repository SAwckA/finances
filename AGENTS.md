# Project Rules For Codex

These instructions apply to the entire repository.

## Startup Policy (Strict)

- Never start any project component automatically.
- Backend, frontend, infrastructure, scripts, builds, and tests must not trigger app startup on their own.
- Never start backend or frontend applications yourself, even on explicit user request.
- Only provide clear run instructions/commands for the user to execute manually.

## Dependency Management (uv only)

- Use only `uv` for dependency and environment management.
- Keep dependencies in `pyproject.toml` (do not use `requirements.txt`).
- Keep `uv.lock` committed and up to date.
- Python version is defined in `.python-version`.
- Do not edit `uv.lock` manually.
- Do not use `pip install`, `poetry`, or `pipenv`.

## Python Development Rules

Apply these rules when working with Python code.

- Follow PEP 8 and keep code readable and explicit.
- Use SQLAlchemy 2.0 style (`Mapped`, `mapped_column`, typed models).
- Prefer dataclasses and Pydantic models over raw dictionaries.
- Avoid deep nesting (target max depth 3-4).
- Do not suppress linter/type checker warnings (`# noqa`, `# type: ignore`, `# pylint: disable`, `# pyright: ignore`, etc.).
- Fix linting issues in code instead of suppressing them.
- Avoid `hasattr` checks for method existence; rely on explicit interfaces and docs.
- Use docstrings when documentation is needed.

## Formatting

- After Python edits, run formatter with `uv format`.

## FastAPI Architecture Conventions

Target layout:

```text
app/
├── config/
├── auth/
├── api/
│   ├── dependencies/
│   ├── controllers/
│   ├── exception_handlers.py
│   └── router.py
├── services/
├── repositories/
├── models/
└── exceptions.py
migrations/
main.py
pyproject.toml
uv.lock
.python-version
```

### Services

- Services inherit from `BaseService`.
- Declare dependencies as class type annotations (not via `__init__` by default).
- Define service-specific exceptions at the top of the service file, before service class.
- Use transaction context managers (`async with ...`).
- Use module logger pattern (`logging.getLogger(__name__)`).

### Repositories

- Repositories inherit from generic `BaseRepository[Model]`.
- Reuse base CRUD methods where possible.
- If soft-delete is supported by model mixins, preserve soft-delete behavior.
- Use session/context management provided by project infrastructure.

### Models

- Keep ORM model and related Pydantic schemas in one module when consistent with existing project style.
- Preferred schema naming: `{Entity}Base`, `{Entity}Create`, `{Entity}Update`, `{Entity}Response`.
- Prefer modern typing (`list`, `dict`, `|`) instead of legacy `Optional`/`List` forms.

## Frontend UI Rules

- Keep UI colors within HeroUI palette tokens; do not introduce ad-hoc palette values outside project theme variables.
- Do not define standalone custom light/dark hex palettes in `frontend/src/app/globals.css`; map project tokens to HeroUI semantic variables and configure colors via HeroUI theme.
- Use the dashboard quick-action hover style as the global interactive hover pattern (`interactive-hover` / `surface-hover`) for clickable cards and tiles.
- Dashboard payment source cards must remain full-width and use the same primary hover treatment as quick-action tiles.

## Frontend UI Kit v2 Standard

- Используйте только semantic-компоненты `Ui*` из `frontend/src/components/ui/`:
- `UiTopBar`: full-screen шапка для editor/detail (`Back / Title / Action`).
- `UiPageHeader`: заголовок обычной страницы (list/settings/profile).
- `UiSegmentedControl`: единый переключатель режимов и фильтров.
- `UiChip`: короткие статусы, теги, ID/бейджи.
- `UiInlineAction`: вторичное inline-действие в карточках и секциях.
- `UiDateRangeField` и `UiDateTimeField`: все выборы периода/даты.
- `UiActionTile`: быстрые действия на дашборде и entry points.
- `UiBalanceSummaryCard`: сводка баланса на дашборде.
- `UiAccountSelectTile`: выбор счета/источника средств.
- `UiSourceTile`: компактное представление источника средств.
- `UiTransactionTile`: строка/плитка операции в лентах.
- `UiSurfaceCard`: базовая оболочка карточек с общим стилем.

- Обязательные layout-паттерны:
- `List`: `UiPageHeader` или верхний `app-panel`, далее список карточек в `motion-stagger`.
- `Editor`: только full-screen (`fixed inset-0`) + `UiTopBar` + scroll-контент.
- `Detail`: full-screen или page-layout, но шапка всегда `UiTopBar`/`UiPageHeader` и единые карточки.
- `Auth`: hero-блок + карточка формы в токенах темы, без ad-hoc цветов.

- Цвета и токены:
- Палитра только slate/cyan через тему HeroUI в `frontend/tailwind.config.ts`.
- В `frontend/src/app/globals.css` разрешен только token-mapping и общие utility-классы.
- Нельзя добавлять ad-hoc hex/rgba в page-компоненты, если есть эквивалент через токены/semantic цвета.
- Любые theme-sensitive поверхности (шапка, нижняя навигация, hero-блоки) должны иметь явные стили для `light` и `dark` (через токены или `dark:`-варианты), без неявной деградации.

- Светлая/тёмная тема (обязательно):
- Никогда не хардкодить `text-white`/`text-white/*` для текста на страницах; используйте `var(--text-primary)` и `var(--text-secondary)`.
- Для акцентного текста используйте semantic-цвета (`text-cyan-*`, `text-success-*`, `text-danger-*`) с проверкой контраста в обеих темах.
- Не использовать полупрозрачные nav-подложки для основных chrome-элементов (`top bar`, `bottom nav`): фон должен быть визуально плотным (opaque), чтобы UI под ним не «просвечивал».
- Не использовать белые бордеры в интерактивных полях/карточках; границы и разделители только через `--border-soft`/semantic divider.
- `dark-hero` обязан иметь корректный light-override (контрастный текст и фон), если используется вне тёмной темы.

- Навигация и шапка:
- Нижняя навигация должна визуально выделяться, но не быть прозрачной; активные состояния читаемы в light/dark.
- Верхняя editor-шапка (`UiTopBar`) оформляется в том же визуальном языке, что и нижняя навигация.
- Для `UiTopBar`/нижней навигации запрещены случайные ad-hoc стили по страницам; изменения вносятся централизованно в `UiTopBar`, `AppShell`, `globals.css`.

- Проверка перед PR (UI):
- Проверять минимум в двух темах (`light`, `dark`) экраны: dashboard, transactions (list/create/detail), accounts, categories, recurring, shopping-lists list/detail, settings, profile.
- Проверять отсутствие артефактов: прозрачные наложения, белый текст на светлом фоне, белые рамки у input/select, несогласованный стиль кнопок.
- Обязательно приложить before/after скриншоты для ключевых экранов при изменении глобальных UI-стилей.

- Motion и интерактив:
- Используйте `framer-motion` для page-enter, hover/press микро-анимаций и раскрывающихся блоков.
- Для списков/сеток применяйте stagger (`motion-stagger` или motion-элементы).
- Обязательно сохраняйте fallback для `prefers-reduced-motion`.

- Запрещено:
- Любые новые `Hero*`-компоненты/импорты и legacy-обертки.
- Новые header API старого типа (`ScreenHeader`, `EditScreenHeader`, `TransactionEditorHeader`).
- Локальные UI-стили вне общей системы токенов и `Ui*` компонентов.

- Правила выбора компонентов для новых страниц:
- Если есть выбор сущности (счет/источник) используйте `UiAccountSelectTile` или `UiSourceTile`.
- Если есть лента операций, используйте `UiTransactionTile`.
- Если есть режимы/фильтры типа, используйте `UiSegmentedControl`.
- Если экран редактирует данные, используйте full-screen `UiTopBar` + секции `app-panel`.
- Если нужен новый визуальный паттерн, сначала расширяйте `Ui*`-кит, потом применяйте на страницах.
