# 01 — Back-End промпты (Policy Engine + Priority Queue + Infra)

> Контекст: держать прикреплённым `00_OVERVIEW_AND_CONTRACTS.md`. Все константы, контракты снапшота,
> audit event, метрики берутся оттуда и **не дублируются** в коде хардкодом — выносятся в конфиг/контракты.
> Каждый эпик самодостаточен и заканчивается **Definition of Done (DoD)**.

---

# ЧАСТЬ A. Policy Engine (control-plane, FastAPI, Python 3.11+)

**Стек сервиса:** FastAPI + Pydantic v2, SQLAlchemy 2.x (async) + asyncpg, Alembic (миграции),
redis-py (async) для кэша/pub-sub, `python-jose`/`authlib` для OIDC, `structlog`, `prometheus-client`,
`pytest` + `httpx` для тестов. Линт: `ruff` + `mypy`.

## Epic PE-1 — Domain & Storage

### PE-1.1 — Схема БД и слой доступа
**Шаги реализации:**
1. Таблицы (Alembic-миграция, все с `id uuid PK`, `created_at`/`updated_at` ISO8601, `ADD COLUMN IF NOT EXISTS`-стиль):
   - `application_profiles(profile_id PK, application_id, scenario, allowed_api_types text[], service_class, workload_form, model, rate_limit_tier nullable, policy_cap jsonb nullable, limits jsonb, enabled bool, created_at, updated_at)`
   - `identity_mappings(id PK, key_fingerprint UNIQUE, application_id, scenario, profile_id FK, tuz nullable, enabled bool, created_at, updated_at)`
   - `policies(id PK, name, kind, body_yaml text, enabled bool, current_version int, created_at, updated_at)`
   - `policy_versions(id PK, policy_id FK, version int, body_yaml text, checksum, author_id, author_role, reason, created_at, UNIQUE(policy_id, version))`
   - `rate_limit_tiers(tier PK, rps_per_key int, burst int, description, created_at, updated_at)`
   - `audit_log(id PK, event jsonb, hmac_sha256, partition_month)` — **партиционирование по месяцам** (`PARTITION BY RANGE`), append-only; включить pgAudit для DDL (через init-скрипт).
2. SQLAlchemy-модели + async-сессии (`async_sessionmaker`), repository-классы на каждую сущность.
3. Health-таблица версий снапшота: `snapshot_state(id=1, snapshot_version int, generated_at, checksum)`.

**DoD:** `alembic upgrade head` создаёт схему; партиция текущего месяца для `audit_log` есть;
repository-слой покрыт unit-тестами (in-memory/контейнерный PG через `testcontainers`).

### PE-1.2 — Pydantic-схемы и инварианты
**Шаги реализации:**
1. Pydantic-модели запросов/ответов 1:1 с контрактами из `00` (ProfileCreate/Update/Response,
   IdentityMappingCreate/Response, PolicyCreate/Update/Response, PolicyVersion, RateLimitTier, ClassificationResult).
2. Инварианты: `service_class ∈ {CRITICAL,HIGH,STANDARD,BATCH}`, `workload_form ∈ {realtime,interactive,async,batch}`,
   `api_type ∈ {chat,embedding,function_call,batch}`; `queue_name` выводится из `service_class` (`queue_<lower>`).
3. PATCH-семантика: только `model_fields_set` (частичные апдейты); `_UNSET` для «не трогать».

**DoD:** валидация невалидных значений → 422 с понятным detail; PATCH меняет только переданные поля.

## Epic PE-2 — Rules Engine + Classifier (эталон)

### PE-2.1 — Chain-of-responsibility + YAML hot-reload
**Шаги реализации:**
1. Загрузка правил из `policies.body_yaml` (kind=`classification`), сборка упорядоченной цепочки по `priority` (desc).
2. Матчинг правила: `when` (application_id, api_type, scenario, опц. контекст — время суток/день недели) → `set` (service_class, workload_form, model?, rate_limit_tier?).
3. Fallback на `defaults` (STANDARD/interactive). **АС не может повысить класс/сменить scenario** через запрос — scenario берётся только из profile/identity_mapping.
4. Hot-reload: пересборка цепочки при изменении policy без рестарта; уведомление Snapshot Publisher (PE-4).

### PE-2.2 — Эталонный классификатор
**Шаги реализации:**
1. Функция `classify(application_id, api_type, scenario, profile, context) -> ClassificationResult`.
2. **Reference-семантика:** ровно та же логика будет переписана на Go в PQ-2; вынести тест-векторы в
   `contracts/classification_vectors.json` (вход → ожидаемый ClassificationResult) — общий golden-набор для обоих сервисов.
3. Покрыть весь маппинг из HLD §3.4.3 (callcenter/realtime_prompt→CRITICAL, hr-interview/compliance_check→CRITICAL,
   coding-agents→HIGH + rate_limit_tier=coding_agent, openwebui→STANDARD, procurement/expert_conclusion→BATCH и т.д.).

**DoD:** все golden-векторы проходят; добавление правила через Admin API меняет классификацию без рестарта;
`classification_vectors.json` зафиксирован в `contracts/`.

## Epic PE-3 — Admin API (CRUD + RBAC + версии + rollback + audit)

### PE-3.1 — CRUD эндпоинты
```jsonc
// application_profiles
POST   /admin/profiles                      201 → ProfileResponse
GET    /admin/profiles?application_id=&scenario=&service_class=&enabled=&q=&limit=&offset=
GET    /admin/profiles/{profile_id}
PATCH  /admin/profiles/{profile_id}         (частичный; _UNSET-семантика)
DELETE /admin/profiles/{profile_id}         204 | 409 (есть identity_mappings) | soft-disable
// identity_mappings
POST   /admin/identity-mappings             201 (валидирует существование profile_id)
GET    /admin/identity-mappings?application_id=&enabled=
GET/PATCH/DELETE /admin/identity-mappings/{id}
// policies (правила классификации)
POST   /admin/policies                      201 (валидирует YAML; создаёт version=1)
GET    /admin/policies?kind=&enabled=&q=
GET/PATCH/DELETE /admin/policies/{id}
POST   /admin/policies/{id}/validate        200 (dry-run парсинг YAML + прогон golden-векторов)
// rate_limit_tiers
GET/POST/PATCH/DELETE /admin/rate-limit-tiers[/{tier}]
```
**Шаги реализации:** репозитории + сервис-слой; каждое мутирующее действие → audit event (PE-3.3) +
bump snapshot (PE-4). DELETE профиля при наличии маппингов → `409` либо soft-disable (по умолчанию soft).

### PE-3.2 — Версии политик и rollback
```jsonc
GET   /admin/policies/{id}/versions                 → PolicyVersion[]
GET   /admin/policies/{id}/versions/{version}       → PolicyVersion (body_yaml)
GET   /admin/policies/{id}/diff?from=&to=           → unified diff
POST  /admin/policies/{id}/rollback {to_version}    → создаёт НОВУЮ version-копию старого body (не удаляет историю)
```
**Шаги реализации:** каждая мутация policy создаёт строку в `policy_versions` (version++ , checksum, author, reason);
rollback = создание новой версии с телом целевой; `current_version` обновляется атомарно; audit `policy_change`
с `old_policy_version`/`new_policy_version`/`reason`/`rollback_result`.

**DoD:** история неизменяема (append-only versions); rollback не теряет промежуточные версии; diff корректен.

### PE-3.3 — RBAC + audit-запись
**Шаги реализации:**
1. Роли: `viewer` (GET), `editor` (CRUD профилей/маппингов/политик), `admin` (вкл. rate-tiers + rollback).
   Роль извлекается из OIDC-claim (PE-5).
2. Декоратор/Depends `require_role(...)`; запрет мутаций для viewer → 403.
3. Каждая мутация пишет audit event по схеме из `00` (admin-поля: actor_id, actor_role, change_id, old/new version, reason),
   подпись HMAC-SHA256 (ключ из секрета), запись в `audit_log` (партиция месяца).
4. `GET /admin/audit?actor_id=&action=&trace_id=&from=&to=&limit=&offset=` — пагинированный просмотр (для фронта).

**DoD:** viewer не может мутировать; каждое изменение оставляет подписанный audit-event; audit доступен через API с фильтрами.

## Epic PE-4 — Snapshot Publisher (PE → PQ)

### PE-4.1 — Сборка и публикация снапшота
**Шаги реализации:**
1. Сервис `build_snapshot()` собирает объект по `snapshot.schema.json` (профили + identity_mappings +
   rate_limit_tiers + rules + defaults), считает `checksum`, инкрементит `snapshot_version` в `snapshot_state`.
2. Публикация: запись JSON в Redis key `policy:snapshot:current` (+ `policy:snapshot:v{N}` для отката),
   `PUBLISH policy:snapshot:updated {version}` для инвалидации.
3. Триггеры пересборки: любая успешная мутация в PE-3, hot-reload правил (PE-2.1), ручной `POST /admin/snapshot/rebuild`.
4. `GET /admin/snapshot/current` (метаданные: version, generated_at, checksum) для дебага/UI-статуса.

**DoD:** мутация профиля → новый снапшот в Redis + pub-сообщение ≤1 c; снапшот валиден по JSON-схеме;
версия монотонно растёт.

## Epic PE-5 — Auth (Keycloak OIDC) + dev-admin

### PE-5.1 — OIDC-валидация
**Шаги реализации:**
1. Конфиг: `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL` (Keycloak realm). Кэш JWKS.
2. Depends `current_user`: валидирует Bearer JWT (подпись по JWKS, iss/aud/exp), извлекает `sub`, `preferred_username`,
   роли из realm/client roles → маппит на {viewer, editor, admin}.
3. Все `/admin/*` требуют аутентификации; ролевой гейт — PE-3.3.

### PE-5.2 — Dev-admin режим
**Шаги реализации:**
1. Флаг `DEV_ADMIN_ENABLED` (по умолчанию `false`; в `values-prod` — жёстко false).
2. При `true`: дополнительный путь логина `POST /admin/dev-login {username,password}` против локального
   статического креда из секрета → выдаёт короткоживущий JWT с ролью admin. **Запрещён, если флаг false** (404).
3. Чёткое предупреждение в логах при старте, если dev-admin включён.

**DoD:** без валидного OIDC-токена `/admin/*` → 401; роли работают; dev-login доступен только при флаге.

## Epic PE-6 — Observability & Health
**Шаги реализации:**
1. `/healthz` (liveness), `/readyz` (готовность: PG + Redis доступны, снапшот собран).
2. Prometheus `/metrics`: latency/RPS per endpoint, classification cache hit ratio, snapshot version gauge,
   admin-mutations counter.
3. `structlog` JSON-логи с `trace_id`/`request_id`; не логировать секреты/plaintext.
4. SLA-цель: Policy Engine classification p99 < 20 мс (cache hit < 5 мс) — добавить бенч-тест.

**DoD:** `/readyz` отражает реальную готовность зависимостей; `/metrics` отдаёт указанные метрики.

## Epic PE-7 — Packaging
**Шаги реализации:**
1. Multi-stage `Dockerfile` (slim-python, non-root user uid 10001, без компиляторов в финальном слое).
2. `pyproject.toml` (uv/poetry), `uvicorn` с `--workers` из конфига; gunicorn+uvicorn worker для прода.
3. Конфиг через env (pydantic-settings); `.env.example`.
4. OpenAPI экспортируется в `contracts/openapi/policy-engine.openapi.yaml` (скрипт `make openapi-pe`).

**DoD:** образ собирается, запускается non-root; OpenAPI-файл генерится и коммитится.

---

# ЧАСТЬ B. Priority Queue (data-plane, Go 1.22+)

**Стек:** `chi` (HTTP), `go-redis/v9`, `pgx` (если нужен прямой PG — не обязателен; PQ работает в основном с Redis),
`prometheus/client_golang`, OpenTelemetry → Langfuse exporter (async batch), `zerolog`, `testify` + `miniredis`/testcontainers.
Архитектура — чистые пакеты: `internal/interceptor`, `internal/classify`, `internal/queue`, `internal/gpumon`,
`internal/readyset`, `internal/dispatcher`, `internal/starvation`, `internal/response`, `internal/obs`, `internal/snapshot`.

## Epic PQ-1 — Foundations
### PQ-1.1 — Каркас сервиса
**Шаги реализации:**
1. `cmd/priority-queue/main.go`: загрузка конфига (env), DI-сборка компонентов, HTTP-сервер,
   graceful shutdown (`context` + `signal.NotifyContext`), запуск фоновых задач (Dispatcher loop, GPU Monitor poll, Starvation Guard).
2. Конфиг: Redis addr, LiteLLM base URL, GPU Monitor URL, key-mgmt URL, `effective_gpu_capacity`,
   reservation %, DRR-веса, starvation thresholds, rate limits, `STRICT_PLACEMENT_ENABLED=false`, t_poll=100ms.
3. `/healthz`, `/readyz` (Redis + снапшот + GPU Monitor reachable), `/metrics`.

**DoD:** сервис стартует/гасится чисто; readiness честный; конфиг полностью из env.

## Epic PQ-2 — Snapshot Consumer + Local Classifier
### PQ-2.1 — Потребление снапшота
**Шаги реализации:**
1. На старте: читает `policy:snapshot:current` из Redis, валидирует checksum/schema, держит в памяти (atomic pointer swap).
2. Подписка на `policy:snapshot:updated`: при сообщении с большей версией — перечитывает и атомарно подменяет.
3. Fallback: если Redis недоступен — продолжает работать на последнем снапшоте в памяти (горячий путь не падает);
   метрика `snapshot_stale_seconds`.

### PQ-2.2 — Локальный классификатор (порт эталона)
**Шаги реализации:**
1. Реализовать ту же chain-of-responsibility логику, что PE-2.2, на Go, поверх снапшота.
2. Прогон `contracts/classification_vectors.json` как табличный тест — **обязан совпадать** с эталоном PE.
3. Выход — `ClassificationResult` с `policy_version` из снапшота.

**DoD:** golden-векторы зелёные (бит-в-бит с PE); подмена снапшота не требует рестарта; stale-режим работает.

## Epic PQ-3 — Request Interceptor (§3.4.1)
### PQ-3.1 — Auth + identity resolution
**Шаги реализации:**
1. Извлечь Bearer token; валидировать через key-mgmt-механизм (интерфейс `KeyValidator`, для локалки — mock,
   см. M-?; OL **не хранит plaintext key**, использует fingerprint/hash).
2. По fingerprint найти `identity_mapping` в снапшоте → `application_id` + закреплённый `scenario` + `profile`.
3. **X-Application-ID не доверенный**: если передан — игнор как override прав (только debug-metadata).
   `X-User-ID` принимается только при наличии validated session-флага.
4. При невалидном ключе/маппинге → 401/403 + audit `reject`.

### PQ-3.2 — Валидация запроса + preliminary class + inject
**Шаги реализации:**
1. Валидировать OpenAI-compatible payload (chat/embedding/...), извлечь `api_type`.
2. Вызвать локальный классификатор → финальный `ClassificationResult`.
3. Инжектировать `trace_id`, `timestamp`; span `llm-gateway-interceptor`.
4. SLA p99 < 5 мс — бенч.

### PQ-3.3 — Rate limiting (Token Bucket)
**Шаги реализации:**
1. Per-class лимиты из `00` (burst/sustained), плюс `rate_limit_tier` per-key (напр. coding_agent 10 RPS/ключ).
2. Реализация: in-memory token bucket per pod **+** Redis-based лимитер для кросс-подной согласованности
   (sliding window / token bucket в Redis, Lua-скрипт для атомарности).
3. Превышение → 429 + Retry-After, **до** попадания в очередь; audit; метрика.
4. **Rate limiting — не starvation mechanism** и применяется только на ingress.

**DoD:** валидный ключ резолвится в правильный профиль; X-Application-ID не повышает права;
лимиты соблюдаются и согласованы между подами; coding_agent ограничен per-key.

## Epic PQ-4 — Priority Queue (§3.4.3)
### PQ-4.1 — 4 очереди на Redis Streams
**Шаги реализации:**
1. 4 стрима: `queue_critical|high|standard|batch`. Enqueue = `XADD` с полями: `trace_id`, `request_id`,
   `payload_ref`, `classification_result`, `enqueued_at`, `original_class`, `current_class`, `model_id`.
   **Payload не хранить в стриме целиком** при больших телах — использовать payload store (Redis key с TTL) + ref.
2. Consumer Groups на каждый стрим (для replay/at-least-once); `XACK` после успешного dispatch.
3. Персистентность — конфигурируется на уровне Redis (AOF everysec + RDB) в инфра-части; код полагается на replay из CG.
4. `max queue depth per class = 10 000` → при превышении shed/drop для BATCH (отказ на enqueue).
5. SLA enqueue/dequeue p99 < 10 мс — бенч.

**DoD:** enqueue/dequeue работают через CG; переполнение BATCH отбрасывается; replay после рестарта восстанавливает необработанные.

## Epic PQ-5 — GPU Monitor (§3.4.5)
### PQ-5.1 — Опрос состояния кластера
**Шаги реализации:**
1. Интерфейс `GPUStateProvider`; реализация ходит на mock/DCGM `/gpu-state` каждые 5 c (async, кэш).
2. Snapshot: `{node_id: {utilization, free_gpus, placements:[{placement_id, model_id, model_version, deployment_id, ready_state, heartbeat_age_ms}]}}`.
3. Экспорт `llm_gpu_utilization_ratio{node_id,model}`; агрегат avg(utilization) для shedding stage.
4. Исключать placements в состояниях loading/draining/unloading/unhealthy из ready (используется в ready-set).

**DoD:** `/gpu-state` кэшируется и обновляется каждые 5 c; stale placements исключаются; метрики экспортируются.

## Epic PQ-6 — Ready-Set Index (§3.4.4)
### PQ-6.1 — Производный индекс
**Шаги реализации:**
1. Индекс: `(model_id, model_version, deployment_id, placement_id, routing_candidate_set) -> queue_entry_id`.
2. Обновляется вместе с enqueue/dequeue/promotion и readiness-сигналами; **не источник истины**.
3. `routing_candidate_set` = разрешённые self-hosted deployments для logical model. При `STRICT_PLACEMENT_ENABLED`
   допускается добавление LiteLLM route key (model alias per placement) — **за фиче-флагом**.
4. Восстановление из queue state + deployment/readiness snapshot; stale-записи по TTL/reconciliation.
5. Lookup O(M), M = число ready candidates модели. **Нет head-of-line blocking**: ищем запрос на свободную модель независимо от позиции.

**DoD:** lookup находит обслуживаемый запрос вне зависимости от позиции в очереди; индекс восстановим из source-of-truth; stale чистится.

## Epic PQ-7 — Dispatcher (§3.4.4) — ядро
### PQ-7.1 — Weighted DRR + deficit counters
**Шаги реализации:**
1. DRR-цикл по 4 очередям с весами 1000:500:250:100 и deficit counters; защита от голодания (deficit сохраняется при пропуске).
2. Выбор кандидата очереди по DRR; затем ready-set lookup внутри выбранной очереди/класса.

### PQ-7.2 — Atomic admission/dispatch operation
**Шаги реализации:**
1. **Перед** отправкой в LiteLLM атомарно проверить: ready placement, per-class active slot accounting,
   per-model concurrency, borrowed capacity, возможность reclaim. (Реализовать через Redis Lua-скрипт или
   оптимистическую блокировку, чтобы dispatch был атомарным.)
2. Если capacity/ready placement/route недоступны — запрос **остаётся в очереди**, Dispatcher не блокируется,
   переходит к следующему кандидату/очереди, deficit сохраняется.
3. Если все заняты — non-blocking poll с `t_poll` (100 мс); инкремент `llm_dispatcher_poll_empty_total`.
4. Dispatch — на уровне logical model / candidate set (или strict alias при включённом флаге). **Не** полагаться на X-Target-Node как управляющий заголовок.

### PQ-7.3 — Capacity Reservation + borrowed/reclaim
**Шаги реализации:**
1. Расчёт долей: headroom 20% + schedulable 80%, классы 40/30/20/10% от schedulable; округление вниз; остаток → shared pool.
2. Учёт по `gpu_equivalent_slots`/`placement_gpu_cost` (tensor-parallel = число GPU placement).
3. Borrowed capacity: класс сверх доли = `borrowed_slots`; при появлении under-quota класса — **приостановка новых dispatch**
   для over-quota (без preemption уже запущенного inference).
4. Метрики: active slots per class, borrowed slots per class, shared pool free.

**DoD:** при всех непустых очередях каждый класс получает ≥ своей доли; свободная capacity распределяется по DRR;
borrowed возвращается без preemption; нет dispatch без одновременно доступных capacity+ready deployment.

## Epic PQ-8 — Starvation Guard (§3.4.6)
### PQ-8.1 — Фоновый aging
**Шаги реализации:**
1. Asyncio-аналог: горутина опрашивает стримы каждые 5 c, считает `max_wait = now - enqueued_at` старейшего по классу.
2. Пороги: CRITICAL=400 мс, HIGH=1.5 c, STANDARD=4 c, BATCH=25 c. Повышение не чаще 1/5 мин на application_id.
3. **Atomic promotion**: сохранить `original_class`, обновить `current_class`, `promoted_from`, `promotion_id`,
   перепривязать активный queue pointer + обновить ready-set одним state transition (без дублирования dispatch).
4. Promoted BATCH→STANDARD: отдельный cap/subqueue, трассируется отдельно от native STANDARD.
5. Метрика `llm_starvation_guard_promotions_total{from_class,to_class}`; audit `priority_elevation`.

**DoD:** запрос старше порога повышается ровно один раз/5 мин; промоушн атомарен (нет дублей dispatch); promoted трафик трассируется отдельно.

## Epic PQ-9 — Response Handler (§3.4.7) + retry budget
### PQ-9.1 — Streaming proxy
**Шаги реализации:**
1. Форвард запроса в LiteLLM (OpenAI-compatible), проксирование **стрима** chunks обратно клиенту
   с поддержкой backpressure (flush по мере чтения) и **client cancellation** (`context` отмена → отмена upstream).
2. Заголовки в LiteLLM: `model`, `X-Service-Class`, `X-Priority-Score`, `X-Application-ID` (audit-only),
   `traceparent`/`X-Trace-ID`; placement-заголовки — только debug-metadata (не routing control без strict flag).
3. Фиксировать `first_token_latency_ms`, `total_latency_ms`, `finish_reason`, `cancelled`; span `llm-gateway-stream`, `litellm-call`.

### PQ-9.2 — Retry/error budget (§10.4)
**Шаги реализации:**
1. Реализовать per-class budget из `00`: CRITICAL 0–1, HIGH ≤2, STANDARD ≤3, BATCH policy-defined.
2. Retry только на другой ready placement/version в рамках admission-check; **внешний fallback запрещён**;
   retry **не обходит** guardrails; идемпотентность по `request_id`/`trace_id`.
3. Downstream guardrails reject (4xx) = финальный reject (не retry). LiteLLM 5xx/503 = техническая ошибка → budget.
4. CRITICAL при rate limit **не retry** → circuit breaker 5 мин на Red + эскалация.

**DoD:** стрим проксируется с backpressure/cancel; budget соблюдается; guardrails-reject не ретраится; LiteLLM 5xx → budget → 503 Retry-After при исчерпании.

## Epic PQ-10 — Backpressure & Shedding (§10)
### PQ-10.1 — State machine стадий
**Шаги реализации:**
1. По avg utilization (из GPU Monitor) вычислять `shedding_level` (0..4) с гистерезисом (чтобы не дёргался на границе).
2. Поведение по классам из таблицы `00` (Yellow/Orange/Red/Black): throttle admission rate, delay/jitter+Retry-After,
   429/503 + Retry-After, circuit breaker на Black.
3. CRITICAL/HIGH на Red — остаются в очередях (non-blocking), не блокируют Dispatcher.
4. Регламентный batch не обходит shedding: следует правилам назначенного service_class + policy cap.
5. Alert-события (cluster overload) в audit + наружу (метрика для Alertmanager).

**DoD:** при переходе порогов стадии меняются с гистерезисом; классы ведут себя по таблице; Black → circuit breaker.

## Epic PQ-11 — Observability (§3.4.8)
### PQ-11.1 — Метрики + spans + audit
**Шаги реализации:**
1. Все Prometheus-метрики из `00 §6` с правильными labels/типами.
2. Langfuse spans из `00 §7` через OTel, **async batching** (вне critical path); контроль кардинальности —
   без plaintext prompt/payload.
3. Audit events по `audit-event.schema.json` для: overload, starvation/priority_elevation, guardrails violation/unavailable,
   routing mismatch/placement unavailable, stream complete/cancel; HMAC-подпись; доставка в АС СВОИ — за интерфейсом (для локалки stdout/файл).

**DoD:** метрики и spans присутствуют для happy path и всех error path из §4 HLD; audit-события подписаны и соответствуют схеме.

## Epic PQ-12 — Packaging
**Шаги реализации:**
1. Multi-stage Dockerfile → **distroless/static**, non-root uid 10001, `readOnlyRootFilesystem`-совместим (без записи в /).
2. `go vet` + `golangci-lint` чисто; race-detector в тестах.
3. Конфиг из env; `.env.example`.

**DoD:** статический бинарь, distroless-образ, non-root, запускается с read-only FS.

---

# ЧАСТЬ C. Mocks (для локальной разработки)

## Epic M-1 — mock-litellm
**Промпт:** Реализуй mock LiteLLM Proxy (OpenAI-compatible), `POST /v1/chat/completions` (+ embeddings),
порт 4000. Возможности через query/headers/конфиг:
- обычный JSON-ответ и **SSE-стрим** (chunked, с настраиваемой first-token задержкой и инкрементальными токенами);
- управляемые сценарии: `200` happy, `400/422` guardrails violation (с `violation details`), `503` placement unavailable, `5xx` + таймаут;
- эхо заголовков (`X-Service-Class`, `X-Trace-ID`) в ответ для проверки трассировки;
- эндпоинт `/__config` для смены поведения в рантайме (для e2e-тестов).
**DoD:** PQ может пройти happy path, guardrails-reject path, 503/5xx path, streaming + cancellation против мока.

## Epic M-2 — mock-gpu-monitor
**Промпт:** Реализуй mock GPU Monitor, `GET /gpu-state` (формат из `00 §контракт GPU snapshot`), порт 9105.
- конфигурируемые узлы/placements/utilization/ready_state/heartbeat_age (через `/__config` или YAML);
- сценарии: свободный кластер, частично занятый, >95% overload, placement в loading/draining;
- (опц.) эндпоинт в стиле Prometheus query API для проверки PromQL-пути.
**DoD:** PQ строит ready-set и проходит admission против разных состояний кластера; overload включает shedding.

---

# ЧАСТЬ D. docker-compose (локальное развёртывание)

## Epic D-1 — compose-стек
**Промпт:** Собери `deploy/compose/docker-compose.yml` со службами:
`postgres` (15, healthcheck, init-скрипт: pgAudit + создание партиции audit_log текущего месяца),
`redis` (7, AOF everysec + RDB, healthcheck),
`keycloak` (импорт realm из `seed/keycloak-realm.json` с client'ом `admin-ui` и тестовыми ролями viewer/editor/admin),
`policy-engine` (build из services/policy-engine; env: PG/Redis/OIDC; запускает alembic upgrade на старте),
`priority-queue` (build из services/priority-queue; env: Redis/LiteLLM/GPU Monitor/key-mgmt URLs),
`mock-litellm`, `mock-gpu-monitor`,
(опц.) `prometheus` + `grafana` (provisioned datasource + базовый dashboard),
(опц.) `admin-ui` (Vite dev server).
Добавь:
- `depends_on` с `condition: service_healthy`;
- сидинг: `make seed` — заливает demo `application_profiles`, `identity_mappings`, `policies` (весь маппинг §3.4.3) и тестовые ключи в mock key-mgmt;
- `.env.example` со всеми переменными;
- `make up` / `make down` / `make logs` / `make e2e`.
**DoD:** `make up` поднимает весь стек здоровым; e2e happy-path запрос проходит АС→PQ→mock-LiteLLM→стрим;
изменение профиля через Admin API обновляет снапшот, который подхватывает PQ без рестарта.

---

# ЧАСТЬ E. Helm (umbrella chart + security)

## Epic H-1 — Umbrella chart + Dependencies
**Промпт:** Создай `deploy/helm/llm-gateway` (umbrella). `Chart.yaml` dependencies:
- subchart `policy-engine` (local), subchart `priority-queue` (local),
- `postgresql` (Bitnami) и `redis` (Bitnami) — **через Helm Dependencies** (`condition:` для вкл/выкл в проде, если внешние).
`values.yaml` + `values-dev.yaml` + `values-prod.yaml`: образы/теги, реплики, ресурсы (normal: 2 vCPU/4 GB),
env, секреты (через `existingSecret`), включение/выключение PG/Redis-зависимостей, OIDC-параметры,
`effective_gpu_capacity` и reservation %, `STRICT_PLACEMENT_ENABLED=false`, `DEV_ADMIN_ENABLED=false` (prod).
**DoD:** `helm dependency build` тянет PG/Redis; `helm template` и `helm lint` чисто; prod-values отключают dev-admin.

## Epic H-2 — Deployments + HPA + probes
**Промпт:** Для обоих сервисов: Deployment, Service, ConfigMap, Secret-refs, ServiceAccount.
HPA по §7.1 HLD:
- Request Interceptor/PQ: min 3–4, max 20, CPU>70% или RPS>1000/pod (для PQ — также по длине очереди >100, через external/custom metric).
- Policy Engine: min 3, max 15, CPU>70%.
Probes: `/healthz` liveness, `/readyz` readiness; `preStop` + `terminationGracePeriodSeconds` для graceful drain
(особенно PQ — дослать активные стримы/ack).
**DoD:** `helm template` рендерит HPA с верными порогами; probes указывают на реальные эндпоинты.

## Epic H-3 — Security: SecurityContext + PSA restricted
**Промпт:** Применить ко всем подам/контейнерам:
- **pod-level:** `runAsNonRoot: true`, `runAsUser: 10001`, `runAsGroup: 10001`, `fsGroup: 10001`,
  `seccompProfile: {type: RuntimeDefault}`.
- **container-level:** `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`,
  `capabilities: {drop: [ALL]}`, `privileged: false`. Для read-only FS добавить `emptyDir` для tmp/кэша.
- **Namespace PSA:** лейблы `pod-security.kubernetes.io/enforce: restricted` (+ `audit`/`warn: restricted`)
  на namespace-шаблоне чарта.
- Образы — pinned by digest; non-root проверяется.
**DoD:** поды соответствуют PSA `restricted` (проверка `kubectl`/kyverno/conftest в CI); контейнеры с read-only FS стартуют.

## Epic H-4 — Cilium NetworkPolicies
**Промпт:** Создай `CiliumNetworkPolicy` (default-deny + явные allow) для namespace:
- `policy-engine`: ingress от `admin-ui` и от ingress-controller (KubeSphere) на admin-порт; egress к PostgreSQL и Redis; egress к Keycloak (JWKS/OIDC).
- `priority-queue`: ingress от ingress-controller (OpenAI-compatible порт) и от OpenWebUI/АС; egress к Redis, к LiteLLM Proxy, к GPU Monitor, к key-mgmt; egress для метрик/трейсинга (Prometheus scrape — ingress на /metrics).
- Запретить прямой ingress снаружи к Policy Engine, минуя ingress-controller.
- DNS egress (kube-dns) разрешить явно.
Параметризовать селекторы/порты через values; dev-вариант мягче (для compose-параллели не нужен, только k8s).
**DoD:** default-deny активен; разрешён только перечисленный трафик; межсервисный путь PQ↔Redis↔PE-snapshot работает;
внешний доступ к PE напрямую заблокирован.

---

## Порядок реализации back-end
contracts (§00) → PE-1 → PE-2 → PE-3 → PE-4 → PE-5 → PE-6 → PE-7 →
M-1, M-2 → PQ-1 → PQ-2 → PQ-3 → PQ-4 → PQ-5 → PQ-6 → PQ-7 → PQ-8 → PQ-9 → PQ-10 → PQ-11 → PQ-12 →
D-1 (docker compose, e2e) → H-1 → H-2 → H-3 → H-4.
