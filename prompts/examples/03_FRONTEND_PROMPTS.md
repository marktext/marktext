# 03 — Front-End промпты (реализация Admin UI по макетам)

> Контекст: держать `00_OVERVIEW_AND_CONTRACTS.md` и `02_UI_MOCKUP_PROMPTS.md`. Реализация — строго по
> макетам из `02`. Источник контракта API — `contracts/openapi/policy-engine.openapi.yaml` (генерится бэком).
>
> **Стек (зафиксирован):** React 18 + Vite 5 + TypeScript + Tailwind v3 + shadcn/ui + TanStack Query (v5) +
> React Router v6. Доп.: `react-hook-form` + `zod` (формы/валидация), `oidc-client-ts` + `react-oidc-context`
> (Keycloak OIDC PKCE), сгенерированный типизированный API-клиент (`openapi-typescript` + `openapi-fetch`),
> `@tanstack/react-table` (таблицы), `sonner` (тосты), тёмная/светлая тема. Тесты: Vitest + Testing Library;
> e2e — Playwright. Линт: ESLint + Prettier + `tsc --noEmit`.

---

## Epic F-UI-0 — Project setup & infrastructure

### T-UI-0.1 — Каркас проекта
**Шаги реализации:**
1. `frontend/admin-ui`: Vite 5 + React 18 + TS (strict). Tailwind v3 (config + base styles). shadcn/ui init
   (нужные компоненты: button, input, select, table, dialog, drawer, badge, tabs, toast/sonner, tooltip,
   form, switch, dropdown-menu, alert, skeleton, command).
2. React Router v6 (data router, `createBrowserRouter`), layout-route + дочерние маршруты по разделам.
3. TanStack Query v5 (QueryClient, devtools в dev, sensible defaults: staleTime, retry-политика).
4. Env через Vite (`VITE_PE_API_URL`, `VITE_OIDC_*`, `VITE_ENV` = dev/stage/prod, `VITE_GRAFANA_URL`,
   `VITE_LANGFUSE_URL`).

### T-UI-0.2 — Генерация API-клиента из OpenAPI
**Шаги реализации:**
1. Скрипт `npm run gen:api`: `openapi-typescript contracts/openapi/policy-engine.openapi.yaml -o src/api/schema.d.ts`.
2. Обёртка `openapi-fetch` с middleware: подстановка `Authorization: Bearer <token>` из auth-контекста,
   обработка 401 (refresh/redirect на login), 403 (тост «недостаточно прав»), сетевых ошибок.
3. Хуки-обёртки над TanStack Query на каждый ресурс (`useProfiles`, `useProfile`, `useCreateProfile`, и т.д.),
   все типизированы из `schema.d.ts`.

**DoD:** клиент полностью типизирован из OpenAPI; смена контракта → перегенерация → ошибки типов там, где сломалось.
`tsc --noEmit` и lint чисты.

---

## Epic F-UI-1 — Auth (Keycloak OIDC + dev-admin + RBAC)

### T-UI-1.1 — OIDC-провайдер (Keycloak, PKCE)
**Шаги реализации:**
1. `react-oidc-context` `AuthProvider` с конфигом из env (authority=issuer, client_id=`admin-ui`,
   redirect_uri, scope, PKCE, silent renew). Хранение токена в памяти (не localStorage для access-токена).
2. `useAuth()` → `{ user, roles, isAuthenticated, login, logout, token }`. Роли парсятся из realm/client roles
   claim → `{viewer, editor, admin}` (старшая роль выигрывает).
3. Колбэк-маршрут `/auth/callback`; сохранение `returnTo` и редирект после входа.

### T-UI-1.2 — Dev-admin путь (Промпт 2)
**Шаги реализации:**
1. На `/login` запросить у бэка флаг `DEV_ADMIN_ENABLED` (публичный health/config-эндпоинт). Блок dev-admin
   рендерится **только** при `true`.
2. Форма username+password → `POST /admin/dev-login` → JWT с ролью admin → положить в тот же auth-контекст.
3. Жёлтое предупреждение «только для dev», визуально вторичная подача (по макету Промпт 2).

### T-UI-1.3 — Route guards + RBAC
**Шаги реализации:**
1. `RequireAuth` (редирект на `/login` с `returnTo`) и `RequireRole(minRole)` для маршрутов/действий.
2. Хелпер `can(action)` / компонент `<Can role="editor">` для скрытия/disable кнопок мутаций с тултипом.
3. `prod-guard`: при `VITE_ENV=prod` влияющие действия требуют доп. подтверждения (см. F-UI-11).

**API endpoints used:** OIDC (Keycloak), `GET /healthz|/config` (флаг dev-admin), `POST /admin/dev-login`.
**DoD:** неаутентифицированный → `/login`; роли управляют видимостью действий; dev-admin доступен только при флаге;
access-токен не лежит в localStorage.

---

## Epic F-UI-2 — App Shell / Layout (Промпт 1)

### T-UI-2.1 — Каркас и навигация
**Шаги реализации:**
1. Layout-route: сайдбар (пункты Status/Profiles/Identity Mappings/Policies/Versions/Rate Tiers/Audit/Service Classes,
   видимость по роли) + топбар (user + role badge, env badge, snapshot indicator, theme toggle, logout).
2. **Snapshot indicator**: хук `useSnapshotState` (`GET /admin/snapshot/current`, poll каждые ~15 c) →
   «v{N}, обновлён T назад», цвет зелёный/жёлтый (stale). Обновляется после мутаций (invalidate).
3. **Env badge**: dev/stage серый, **prod — красный, заметный**.
4. Тема (light/dark) с сохранением выбора (cookie/memory — без чувствительных данных).

**API endpoints used:** `GET /admin/snapshot/current`.
**DoD:** активный пункт подсвечен; роль/окружение/версия снапшота видны; prod-бейдж выделен; тема переключается.

---

## Epic F-UI-3 — Status (Промпт 3)

### T-UI-3.1 — Read-only обзор
**Шаги реализации:**
1. Хук `useSystemStatus`: дёргает доступные read-only эндпоинты — здоровье PE/PQ (`/readyz` обоих, если проксируется
   через PE-агрегатор; иначе отдельный status-эндпоинт), снапшот-версия. Очереди/shedding/GPU util —
   из read-only статус-эндпоинта PQ (если экспонирован) либо из Prometheus-прокси; если недоступно — graceful degrade
   с пометкой «детали в Grafana».
2. 4 карточки очередей (depth + max wait vs threshold с цвето-индикатором по `00`), карточка shedding_level + avg util.
3. Кнопки-ссылки в Grafana/Langfuse (`VITE_GRAFANA_URL`/`VITE_LANGFUSE_URL`).

**DoD:** экран отражает текущее состояние без графиков; пороги starvation/shedding визуально подсвечены;
при отсутствии метрик — корректный degrade со ссылками наружу.

---

## Epic F-UI-4 — Application Profiles (Промпт 4)

### T-UI-4.1 — Список профилей
**Шаги реализации:**
1. Роут `/profiles`; таблица (@tanstack/react-table) с колонками и цветными бейджами service_class.
2. Фильтры (application_id, service_class, scenario, enabled) + поиск `q` + пагинация (server-side через query-параметры).
3. Кнопка «Создать» (editor+), переход `/profiles/new`.

**API endpoints used:** `GET /admin/profiles`.

### T-UI-4.2 — Создание/редактирование
**Шаги реализации:**
1. Роут `/profiles/:profileId` и `/profiles/new`; форма на `react-hook-form` + `zod`-схема, отражающая инварианты
   (`service_class`/`workload_form`/`api_types` enum'ы, обязательные поля).
2. Поля по макету (allowed_api_types мультиселект, policy_cap JSON-редактор, limits, rate_limit_tier select из
   `useRateLimitTiers`).
3. **Confirm-диалог при смене `service_class`/`workload_form`**: показать «изменит классификацию для application_id=…,
   опубликует снапшот vN+1, затронет N identity_mappings» (получить число затронутых маппингов запросом).
4. На submit — `POST`/`PATCH`; при успехе invalidate `profiles` + snapshot indicator + тост.

**API endpoints used:** `GET/POST/PATCH/DELETE /admin/profiles[/{id}]`, `GET /admin/identity-mappings?profile_id=`,
`GET /admin/rate-limit-tiers`.
**DoD:** PATCH шлёт только изменённые поля; смена класса требует подтверждения с последствиями; после сохранения
снапшот-индикатор обновляется; viewer не видит кнопок мутаций.

---

## Epic F-UI-5 — Identity Mappings (Промпт 5)

### T-UI-5.1 — Список и форма
**Шаги реализации:**
1. Роут `/identity-mappings`; таблица (fingerprint усечён + copy, application_id, scenario, profile-ссылка, tuz, enabled),
   фильтры, поиск.
2. Create/Edit форма (react-hook-form+zod): fingerprint (подсказка «не plaintext key»), application_id, scenario,
   `profile_id` (select из `useProfiles`, валидация соответствия), tuz, enabled.
3. Инфо-блок про доверенную identity (X-Application-ID не переопределяет). Confirm при disable/delete.

**API endpoints used:** `GET/POST/PATCH/DELETE /admin/identity-mappings[/{id}]`, `GET /admin/profiles`.
**DoD:** маппинг создаётся с валидным профилем; отключение требует подтверждения; снапшот обновляется.

---

## Epic F-UI-6 — Policies / Rules editor (Промпт 6)

### T-UI-6.1 — Список политик
**Шаги реализации:** роут `/policies`; таблица (name, kind, enabled, current_version, updated_at); «Создать».
**API:** `GET /admin/policies`.

### T-UI-6.2 — Двухпанельный YAML-редактор + валидация
**Шаги реализации:**
1. Роут `/policies/:id`; слева YAML-редактор (CodeMirror/Monaco-lite, подсветка YAML, номера строк).
2. Справа — панель: кнопка **Validate** → `POST /admin/policies/{id}/validate` (dry-run): показать ошибки парсинга +
   результат прогона golden-векторов (вход→service_class).
3. Тест-инпут внизу: application_id/api_type/scenario → отрисовать вычисленный ClassificationResult (через тот же
   validate-эндпоинт с тестовым входом).
4. Save (editor+) **заблокирован, пока есть ошибки валидации**; требует `reason`; предупреждает про version N+1 + снапшот.

**API endpoints used:** `GET/POST/PATCH /admin/policies[/{id}]`, `POST /admin/policies/{id}/validate`.
**DoD:** Save недоступен при ошибках; preview классификации работает до сохранения; reason обязателен; снапшот обновляется.

---

## Epic F-UI-7 — Policy Versions + Diff + Rollback (Промпт 7)

### T-UI-7.1 — Версии и diff
**Шаги реализации:**
1. Роут `/policies/:id/versions`; таблица версий (version, author, role, reason, created_at, checksum, бейдж current).
2. Выбор двух версий → unified-diff просмотр (`GET /admin/policies/{id}/diff?from=&to=`), читаемый, с подсветкой.

### T-UI-7.2 — Rollback
**Шаги реализации:**
1. Действие **Rollback** (только admin) → confirm-диалог «создаст новую версию N+1 с телом версии K, история сохранится»,
   обязательный `reason`, показать кого затронет.
2. `POST /admin/policies/{id}/rollback {to_version, reason}`; при успехе — invalidate versions + policy + snapshot + тост.

**API endpoints used:** `GET /admin/policies/{id}/versions[/{v}]`, `GET .../diff`, `POST .../rollback`.
**DoD:** diff корректен; rollback forward-only (история цела); только admin; снапшот обновляется.

---

## Epic F-UI-8 — Rate Limit Tiers (Промпт 8)

### T-UI-8.1 — CRUD тиров (admin)
**Шаги реализации:** роут `/rate-limit-tiers`; таблица (tier, rps_per_key, burst, description, кол-во потребителей);
Create/Edit форма; при удалении используемого тира — предупреждение со списком профилей-потребителей.
**API:** `GET/POST/PATCH/DELETE /admin/rate-limit-tiers[/{tier}]`, `GET /admin/profiles?rate_limit_tier=`.
**DoD:** тир создаётся/редактируется; удаление используемого блокируется/предупреждается; доступно только admin.

---

## Epic F-UI-9 — Audit Log Viewer (Промпт 9)

### T-UI-9.1 — Журнал + фильтры + детальная панель
**Шаги реализации:**
1. Роут `/audit`; таблица событий (timestamp, actor/application_id, action, service_class, status, trace_id+copy+Langfuse-ссылка, policy_version).
2. Фильтры: actor_id, action, trace_id, application_id, период, service_class; пагинация (server-side).
3. Drawer детали: безопасный JSON (content_hash вместо prompt), latency_breakdown, для policy-событий — old/new version,
   change_id, reason, rollback_result, признак verified HMAC.

**API endpoints used:** `GET /admin/audit?...`.
**DoD:** фильтр по trace_id/actor работает; plaintext никогда не показывается; детали раскрываются в drawer.

---

## Epic F-UI-10 — Service Classes reference (Промпт 10)

### T-UI-10.1 — Read-only справочник
**Шаги реализации:** роут `/service-classes`; статические карточки/таблица 4 классов с параметрами из `00`
(DRR-вес, GPU доля, SLA p95/p99, starvation threshold, rate limits, поведение на shedding-стадиях) + пояснение
service_class vs workload_form. Без мутаций.
**DoD:** данные соответствуют `00`; страница доступна всем ролям.

---

## Epic F-UI-11 — Сквозные элементы и качество

### T-UI-11.1 — Confirm/тосты/состояния/доступность
**Шаги реализации:**
1. Переиспользуемый `ConfirmDialog` (с обязательным `reason`, где нужно) и хук `useConfirm`.
2. Унифицированные Loading (skeleton), Empty, Error состояния для всех таблиц/форм; тосты через `sonner`
   (успех/ошибка), с обновлением snapshot indicator после мутаций.
3. **prod-guard**: при `VITE_ENV=prod` влияющие действия (смена класса, disable маппинга, rollback, удаление)
   требуют доп. подтверждения с красным акцентом.
4. Глобальный обработчик ошибок API (401→login, 403→тост, 5xx→тост + retry-кнопка).
5. Доступность: фокус-менеджмент в диалогах/drawer, aria-labels, навигация с клавиатуры; контраст бейджей в обеих темах.

### T-UI-11.2 — Тесты
**Шаги реализации:** Vitest+TL на ключевые формы/гейты (RBAC скрывает мутации, PATCH шлёт только изменённое,
Save блокируется при ошибке валидации, confirm на смене класса). Playwright e2e на happy-path:
login (dev-admin) → создать профиль → увидеть обновление снапшота → правка политики с валидацией → rollback.

**DoD:** все состояния покрыты; prod-guard работает; e2e happy-path зелёный; `tsc --noEmit`/ESLint чисты; базовая a11y соблюдена.

---

## Порядок реализации front-end
F-UI-0 → F-UI-1 → F-UI-2 → F-UI-3 → F-UI-4 → F-UI-5 → F-UI-6 → F-UI-7 → F-UI-8 → F-UI-9 → F-UI-10 → F-UI-11.

## Связь с back-end
Все эндпоинты — из Admin API Policy Engine (`/admin/*`), контракт — `contracts/openapi/policy-engine.openapi.yaml`.
Аутентификация — Keycloak (тот же realm, что в docker compose, client `admin-ui`). Read-only статус очередей/GPU —
из status-эндпоинта Priority Queue или Grafana-ссылок (graceful degrade, если PQ-status не экспонирован).
