# Finances

Монорепозиторий для финансового приложения (backend + frontend).

## Технологический стек

- Backend: Python, FastAPI, SQLAlchemy 2.0, Alembic, `uv`
- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS v4, HeroUI
- Инфраструктура: Docker Compose

## Структура

- `app/` — backend-код
- `migrations/` — Alembic миграции
- `frontend/` — Next.js приложение

## Быстрый старт

### Backend

```bash
uv sync
uv run python main.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```
