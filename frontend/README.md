# Frontend

Фронтенд часть проекта финансов.

## Стек

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- HeroUI (`@heroui/react` + `@heroui/theme`)

## Запуск

```bash
npm install
npm run dev
```

Откройте `http://localhost:3000`.

## Где что лежит

- `src/app/layout.tsx` — корневой layout и провайдеры
- `src/app/page.tsx` — главная страница приложения
- `src/components/finance-workbench.tsx` — рабочее пространство для вызова всех endpoint из OpenAPI
- `public/openapi.json` — копия backend OpenAPI спецификации для фронтенда
