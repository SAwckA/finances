# CI/CD Build Pipeline (GitHub Actions + GHCR)

## Что делает workflow

Workflow: `.github/workflows/build-images.yml`

Триггеры:
- `workflow_dispatch` (ручной запуск)

На каждый запуск workflow:
- собирает образы `backend`, `frontend`, `caddy`, `scheduler`
- пушит их в GHCR
- ставит тег образа, равный SHA коммита (`${{ github.sha }}`)

## Формат имен образов

```text
ghcr.io/<owner>/<repo>/<service>:<commit_sha>
```

Примеры:
- `ghcr.io/acme/finances/backend:abc123...`
- `ghcr.io/acme/finances/frontend:abc123...`
- `ghcr.io/acme/finances/caddy:abc123...`
- `ghcr.io/acme/finances/scheduler:abc123...`

## Права и настройки GitHub

Workflow использует:
- `permissions.contents=read`
- `permissions.packages=write`

Публикация в GHCR выполняется через встроенный `GITHUB_TOKEN`.

Рекомендуется:
- включить доступность пакетов для нужных окружений/организации
- настроить retention policy для старых образов в GHCR

## Примечания

- Тег `latest` не публикуется.
- Сборка не выполняет деплой.
