# Domain Names

Подбор свободных доменных имён по описанию проекта. По тексту от пользователя LLM генерирует
20 кандидатов, сервис параллельно проверяет их доступность в выбранных зонах через RDAP/WHOIS,
результаты стримятся в UI через Server-Sent Events.

## Как работает

1. Пользователь вводит описание проекта и отмечает зоны (по умолчанию `.ru` и `.com`).
2. Фронт отправляет `POST /api/suggest` и читает SSE-поток.
3. Сервер:
   - `generateCandidates()` → LangChain + OpenAI-совместимая LLM возвращает 20 брендовых имён
     с рациональным объяснением на русском (structured output через Zod-схему).
   - `checkAllStreaming()` → 12 параллельных воркеров проверяют каждую пару `base.zone`:
     RDAP для `.com/.net/.org/.info/.io/.app/.dev`, WHOIS (TCP 43, `whois.tcinet.ru`) для `.ru`.
   - Каждая проверка шлётся клиенту событием `check`.
4. Клиент копит свободные домены и группирует по зонам.

## События SSE

| Событие      | Данные                                                    |
| ------------ | --------------------------------------------------------- |
| `start`      | `{ description, zones }`                                  |
| `candidates` | `{ candidates: [{ name, rationale }] }`                   |
| `check`      | `{ fqdn, base, zone, available, rationale, checked, total }` |
| `done`       | `{ checked, total }`                                      |
| `error`      | `{ message }`                                             |

## Структура

```
src/
  api/
    zones.ts           # DEFAULT_ZONES (все), INITIAL_ZONES (выбраны по умолчанию), RDAP endpoints
    llm.ts             # generateCandidates() — LangChain + Zod structured output
    availability.ts    # checkAllStreaming() — RDAP/WHOIS с воркер-пулом
  server.ts            # Express + Angular SSR + POST /api/suggest (SSE)
  app/
    app.ts             # shell: <router-outlet />
    app.routes.ts      # '' → SuggestPage
    suggest/
      types.ts
      sse-stream.ts    # readSseEvents() — async-генератор поверх ReadableStream
      suggest.service.ts           # @Injectable, signals + start()
      suggest-page/    # container, инжектит сервис
      description-form/            # форма ввода + чекбоксы зон
      progress-panel/              # прогресс-бар и фазы
      results-list/                # группировка результатов по зонам
```

Все компоненты standalone, `ChangeDetectionStrategy.OnPush`, signal-based `input()`.

## Стек

- Angular 21 + SSR (`@angular/ssr/node`)
- Express 5
- LangChain.js 1 (`@langchain/openai`) + Zod structured output
- RDAP по bootstrap от IANA (hardcoded endpoints)
- WHOIS через `net.createConnection` (только `.ru`)
- Tailwind CSS 4

## Запуск локально

```bash
npm install
cp .env.example .env  # заполнить ключи
npm run build
npm run serve:ssr:domain-names  # собранный prod-бандл, порт 4000
```

Переменные окружения:

| Переменная         | Назначение                                      | Пример                         |
| ------------------ | ----------------------------------------------- | ------------------------------ |
| `OPENAI_API_KEY`   | Ключ OpenAI-совместимого провайдера             | `sk-...`                       |
| `OPENAI_BASE_URL`  | Базовый URL API (опционально)                   | `https://routerai.ru/api/v1`   |
| `OPENAI_MODEL`     | Модель (опционально, по умолчанию `gpt-4o-mini`)| `openai/gpt-4o-mini`           |
| `PORT`             | Порт сервера (по умолчанию 4000)                | `4100`                         |

> `ng serve` (dev mode с Vite) не работает из-за того, что Vite SSR-трансформер спотыкается на
> `import.meta` в бандле LangChain. Для разработки используй собранный бандл через
> `serve:ssr:domain-names` либо `ng build --watch` в другом терминале.

## Деплой на Vercel

В репозитории есть `vercel.json` и `api/index.mjs` (реэкспорт `reqHandler`). Перед деплоем:

1. **Settings → Functions → Fluid Compute** — включить toggle. На Hobby это поднимает лимит
   функции с 10s до 60s (полный поиск занимает 10–30s).
2. **Settings → Environment Variables** — добавить `OPENAI_API_KEY`, `OPENAI_BASE_URL`,
   `OPENAI_MODEL` в Production и Preview.
3. `vercel --prod` либо push в подключённый репозиторий.

Статика (`dist/domain-names/browser/`) раздаётся с CDN, всё остальное маршрутизируется на функцию.
Префрендер `/` отрабатывает на этапе сборки — на рантайме SSR нужен только для динамических роутов.

## Тесты

```bash
npm test
```
