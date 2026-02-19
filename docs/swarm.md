# Docker Swarm Layout

## Файлы

- Базовый stack: `infra/swarm/stack.yml`
- Отдельный cron-layer: `infra/swarm/stack.cron.yml`
- Пример переменных: `infra/swarm/.env.example`
- Caddy config: `infra/caddy/Caddyfile`

## Что входит в базовый stack

Сервисы:
- `postgres`
- `redis`
- `backend`
- `frontend`
- `caddy`
- `migrate` (one-shot, по умолчанию `replicas: 0`)

Сети:
- `internal` (overlay)
- `edge` (overlay)

Volumes:
- `postgres_data`
- `redis_data`
- `caddy_data`
- `caddy_config`

Secrets:
- `cloudflare_api_token` (external secret в Swarm)

## Cron-layer (отдельный файл)

`infra/swarm/stack.cron.yml` содержит только scheduler:
- `scheduler` (supercronic)

Расписание:
- `@hourly` — `execute_recurring_transactions.py`
- `10 3 * * *` (UTC) — `collect_exchange_rates.py`

## Обязательный multi-file contract

Для согласованного деплоя всегда использовать оба файла:

```bash
docker stack deploy \
  -c infra/swarm/stack.yml \
  -c infra/swarm/stack.cron.yml \
  finances
```

## Подготовка переменных окружения

1. Скопировать шаблон:

```bash
cp infra/swarm/.env.example infra/swarm/.env
```

2. Заполнить значения:
- `IMAGE_PREFIX` (например, `ghcr.io/<owner>/<repo>`)
- `IMAGE_TAG` (конкретный commit SHA)
- `BASE_DOMAIN` (например, `finances.sawcka.ru`)
- `API_DOMAIN` (например, `api-finances.sawcka.ru`)
- `ACME_EMAIL`
- DB/Redis credentials
- `SECRET_KEY`, `JWT_SECRET_KEY`
- OAuth credentials (если используются)

## Подготовка Cloudflare token secret

```bash
printf '%s' 'your_cloudflare_token' | docker secret create cloudflare_api_token -
```

## Caddy + Cloudflare DNS challenge

Caddy использует DNS challenge через plugin `caddy-dns/cloudflare`.
Токен читается из Docker secret `cloudflare_api_token` и экспортируется в `CLOUDFLARE_API_TOKEN`.

## Валидация конфигов (без rollout)

```bash
docker stack config -c infra/swarm/stack.yml
docker stack config -c infra/swarm/stack.yml -c infra/swarm/stack.cron.yml
```

## Миграции

Сервис `migrate` в `stack.yml` выключен по умолчанию (`replicas: 0`) и запускается вручную при релизе.
