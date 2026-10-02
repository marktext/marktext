# LLM Gateway / Orchestration Layer — комплект промптов для реализации

> Источник истины по архитектуре: **Orchestration Layer HLD v2.2-DRAFT**.
> Этот файл — «нулевой» промпт-контекст: его нужно дать Claude Code **первым** и держать
> прикреплённым ко всем последующим сессиям. Он фиксирует решения, раскладку репозитория,
> общие константы и контракты между сервисами, чтобы у Sonnet не было разночтений.

## 0. Зафиксированные решения

| Решение | Значение |
|---|---|
| Язык **Priority Queue** (data-plane) | **Go** (1.22+) |
| Язык **Policy Engine** (control-plane) | **Python 3.11+ / FastAPI** |
| Декомпозиция | 2 сервиса по линии **control-plane / data-plane** |
| Классификация на горячем пути | **локальная**, по кэш-снапшоту правил (горячий путь не зависит от аптайма Policy Engine) |
| Внешние системы (LiteLLM, GPU/DCGM, key-mgmt) | для локалки — **моки**; в проде — за абстракцией-интерфейсом |
| Strict node/deployment placement (S3-выбор HLD) | **за фиче-флагом**, MVP работает на уровне logical model / candidate set |
| Admin UI | CRUD профилей/политик + версии/rollback + audit-viewer + read-only статус (дашборды — в Grafana/Langfuse) |
| Аутентификация фронта | **Keycloak (OIDC)** + опциональная локальная dev-admin учётка |
| Упаковка | монорепо + **umbrella Helm chart** с subcharts; PostgreSQL и Redis — через Helm Dependencies (Bitnami) |
| Сеть/безопасность в чарте | Cilium NetworkPolicies + SecurityContext (pod/container) + PSA `restricted` |

## 1. Раскладка монорепозитория

```
llm-gateway/
├── README.md
├── Makefile                          # dev-таргеты: up, down, seed, test, lint, helm-lint
├── contracts/                        # ЕДИНЫЙ источник общих контрактов
│   ├── openapi/
│   │   ├── policy-engine.openapi.yaml     # генерится из FastAPI, используется фронтом
│   │   └── priority-queue.openapi.yaml    # OpenAI-compatible ingress + admin/health
│   ├── snapshot.schema.json          # формат rule-снапшота (PE → PQ)
│   ├── audit-event.schema.json       # единый формат audit event (оба сервиса)
│   └── constants.md                  # значения из §3 этого файла (single source of truth)
├── services/
│   ├── policy-engine/                # FastAPI
│   └── priority-queue/               # Go
├── mocks/
│   ├── mock-litellm/                 # OpenAI-compatible mock (любой язык; реком. Go/FastAPI)
│   └── mock-gpu-monitor/             # /gpu-state + readiness mock
├── frontend/
│   └── admin-ui/                     # React 18 + Vite 5 + TS
├── deploy/
│   ├── compose/
│   │   ├── docker-compose.yml
│   │   ├── .env.example
│   │   └── seed/                     # SQL + policy YAML + keycloak realm
│   └── helm/
│       └── llm-gateway/              # umbrella chart
│           ├── Chart.yaml            # dependencies: policy-engine, priority-queue, postgresql, redis
│           ├── values.yaml
│           ├── values-dev.yaml
│           ├── values-prod.yaml
│           ├── templates/            # NetworkPolicies, PSA namespace, общие ресурсы
│           └── charts/
│               ├── policy-engine/
│               └── priority-queue/
└── docs/
    └── runbook.md
```

**Принцип работы с контрактами:** `contracts/` — единственный источник истины. Policy Engine
генерирует свой `openapi.yaml` из кода (FastAPI), кладёт в `contracts/openapi/`. Фронт генерирует
типизированный клиент из этого файла. Priority Queue читает `snapshot.schema.json` и
`audit-event.schema.json` как контракт.

## 2. Границы сервисов (как в HLD §3.4 → 2 сервиса)

### Policy Engine (control-plane, FastAPI)
- Policy Store (PostgreSQL): `policies`, `policy_versions`, `application_profiles`,
  `identity_mappings`, `rate_limit_tiers`, `audit_log`.
- Rules Engine (chain-of-responsibility, YAML, hot-reload) + Classifier (эталонная реализация).
- Admin API: CRUD + RBAC + аудит + версии + rollback.
- Snapshot Publisher: собирает версионированный снапшот правил/профилей/маппингов и публикует
  в Redis (+ pub/sub-инвалидация) для data-plane.
- OIDC-валидация (Keycloak) для Admin API; dev-admin флаг.

### Priority Queue (data-plane, Go)
Включает подкомпоненты HLD §3.4.1, 3.4.3–3.4.8:
- **Request Interceptor** (§3.4.1): Bearer-auth через key-mgmt-механизм, резолв identity по
  `identity_mappings` (из снапшота), валидация OpenAI-запроса, rate limiting.
- **Local Classifier**: вычисляет финальный `ClassificationResult` локально по кэш-снапшоту
  (эталон — из Policy Engine; та же логика, реализованная на Go).
- **Priority Queue** (§3.4.3): 4 очереди Redis Streams.
- **GPU Monitor** (§3.4.5): опрос mock/DCGM, readiness/heartbeat, `/gpu-state`.
- **Ready-Set Index** (§3.4.4): производный индекс.
- **Dispatcher** (§3.4.4): Weighted DRR + admission/dispatch + capacity reservation.
- **Starvation Guard** (§3.4.6): фоновый aging.
- **Response Handler** (§3.4.7): streaming-прокси к LiteLLM, backpressure, cancellation, retry budget.
- **Queue Observability** (§3.4.8): Prometheus-метрики + Langfuse spans + audit events.

**Контракт между сервисами:** PQ **не вызывает** PE синхронно на запрос. PE публикует снапшот
(см. §4), PQ держит его в памяти + Redis-кэш (TTL 60 c, инвалидация по pub/sub). Падение PE
не влияет на горячий путь — PQ продолжает классифицировать по последнему валидному снапшоту.

## 3. Общие константы (single source of truth → `contracts/constants.md`)

**Service classes / очереди / DRR-веса / резервы / SLA queue-wait:**

| service_class | queue | DRR-вес | min GPU доля (от schedulable) | p95 queue wait | p99 queue wait |
|---|---|---|---|---|---|
| CRITICAL | `queue_critical` | 1000 | 40% | < 500 мс | < 1000 мс |
| HIGH | `queue_high` | 500 | 30% | < 2000 мс | < 5000 мс |
| STANDARD | `queue_standard` | 250 | 20% | < 5000 мс | < 15000 мс |
| BATCH | `queue_batch` | 100 | 10% | < 30000 мс | < 120000 мс |

**workload_form:** `realtime` | `interactive` | `async` | `batch` (влияет на retry/backpressure,
**не** создаёт отдельную очередь и не меняет DRR-вес без смены `service_class`).

**api_type:** `chat` | `embedding` | `function_call` | `batch`.

**Capacity math:**
- `operational_headroom` = 20% от `effective_gpu_capacity` (вне обычного DRR-dispatch, буфер burst/failover).
- `schedulable_gpu_capacity` = 80% от `effective_gpu_capacity`.
- Резервы классов = 40/30/20/10% от `schedulable_gpu_capacity` (в сумме 100%).
- Округление слотов — **вниз** до целого; остаток → shared/flexible pool.
- Учёт ведётся по `gpu_equivalent_slots` / `placement_gpu_cost` (для tensor-parallel = число GPU placement).
- `effective_gpu_capacity` численно **не фиксируется** до подтверждения владельцами платформы → берётся из конфига.

**Starvation Guard thresholds** (≈80% от p95 queue SLA): CRITICAL=400 мс, HIGH=1.5 c, STANDARD=4 c, BATCH=25 c.
Aging: не чаще **1 повышения на application_id раз в 5 минут**. Промоушн BATCH→STANDARD трассируется
отдельно (отдельный cap/subqueue), не считается native STANDARD demand.

**Rate limiting per class (Request Interceptor, Token Bucket):**

| service_class | burst | sustained | window |
|---|---|---|---|
| CRITICAL | 1000 | 500 RPS | 1 c |
| HIGH | 500 | 200 RPS | 1 c |
| STANDARD | 300 | 100 RPS | 1 c |
| BATCH | 100 | 50 RPS | 1 c |

`rate_limit_tier` (доп. ограничение per-profile, напр. `coding_agent` = 10 RPS/ключ) — отдельное
поле в `ClassificationResult`, **не меняет** базовый service_class.

**Backpressure / shedding stages** (по avg utilization кластера):

| stage | триггер | CRITICAL | HIGH | STANDARD | BATCH |
|---|---|---|---|---|---|
| Normal | < 70% | обрабатывается | обрабатывается | обрабатывается | обрабатывается |
| Yellow | 70–85% | приоритет | приоритет | throttle (admission rate) | delay/jitter + Retry-After: 30 |
| Orange | 85–95% | обрабатывается | обрабатывается | Retry-After: 15 | **429 Rejected** |
| Red | 95–100% | ждёт в очереди (non-blocking) | ждёт в очереди | **503 Rejected** | **503 Rejected** |
| Black | кластер недоступен | **503 + circuit breaker** | **503 + circuit breaker** | 503 | 503 |
`shedding_level` ∈ {0..4} (0=Normal … 4=Black).

**Client-side retry budget (владелец — OL):**

| service_class | retry budget | поведение при исчерпании |
|---|---|---|
| CRITICAL | 0–1 быстрая попытка (только на другой ready placement той же model/deployment group, в рамках latency budget) | controlled error + incident/audit; **без retry при rate limit**, вместо этого circuit breaker 5 мин на Red |
| HIGH | до 2 попыток, короткий backoff | 503 Retry-After / controlled error |
| STANDARD | до 3 попыток, backoff + повторный admission-check | 503 Retry-After |
| BATCH | policy-defined (дольше, вкл. переочередь) | async retry или 503 Retry-After |
Инварианты: внешний fallback не используется; retry не обходит downstream guardrails; каждая попытка
проходит admission/dispatch проверку; идемпотентность — по `request_id`/`trace_id` + audit log.

**NFR (целевые):** Target 500 RPS / Peak 800 RPS; max queue depth per class 10 000; Gateway overhead OL
p95 < 45 мс (STANDARD < 65 мс); pod resources normal: 2 vCPU / 4 GB; max GPU util sustained 80% / peak 95%.

**Availability:** CRITICAL/HIGH 99.9%, STANDARD/BATCH 99.5%; RTO CRITICAL ≤5 мин, HIGH ≤15 мин,
STANDARD/BATCH ≤60 мин; RPO audit ≤1 мин, конфиги ≤5 мин, очереди — потеря при Redis failure допустима.

## 4. Контракт снапшота правил (PE → PQ), `contracts/snapshot.schema.json`

```jsonc
{
  "snapshot_version": 142,                 // монотонно растёт; PQ применяет только больший
  "generated_at": "2026-05-03T10:15:00Z",
  "checksum": "sha256:...",                // целостность
  "service_classes": ["CRITICAL","HIGH","STANDARD","BATCH"],
  "application_profiles": [
    {
      "profile_id": "callcenter-realtime",
      "application_id": "callcenter",
      "scenario": "realtime_prompt",
      "allowed_api_types": ["chat"],
      "service_class": "CRITICAL",
      "workload_form": "realtime",
      "model": "llama-3.1-70b",
      "rate_limit_tier": null,
      "policy_cap": null,
      "limits": { "max_tokens": 4096 }
    }
    // ...
  ],
  "identity_mappings": [
    { "key_fingerprint": "sha256:ab..", "application_id": "callcenter",
      "scenario": "realtime_prompt", "profile_id": "callcenter-realtime", "tuz": null }
  ],
  "rate_limit_tiers": [
    { "tier": "coding_agent", "rps_per_key": 10, "burst": 20 }
  ],
  "rules": [                               // chain-of-responsibility, упорядочено
    { "id": "r-001", "priority": 100, "when": { "application_id": "callcenter",
      "api_type": "chat", "scenario": "realtime_prompt" },
      "set": { "service_class": "CRITICAL", "workload_form": "realtime" } }
    // ...
  ],
  "defaults": { "service_class": "STANDARD", "workload_form": "interactive" }
}
```
**ClassificationResult** (выход локального классификатора PQ и эталонного — PE):
`{ service_class, workload_form, model, queue_name, rate_limit_tier, api_type, scenario, policy_version }`.

## 5. Контракт audit event, `contracts/audit-event.schema.json`

```jsonc
{
  "trace_id": "...", "request_id": "...",
  "application_id": "callcenter", "user_id": null,        // user_id только при validated session
  "service_class": "CRITICAL", "workload_form": "realtime",
  "model_id": "llama-3.1-70b", "deployment_id": "llama-3.1-70b-v1",
  "routing_candidate_set": ["node-01","node-03"],
  "strict_route_key": null,                                // заполняется только при S3 strict placement
  "policy_version": 142,
  "guardrails_status": null,                               // downstream-значение при наличии
  "action": "dispatch",                                    // dispatch|reject|priority_elevation|overload|policy_change|stream_complete|stream_cancel
  "status": "ok",
  "shedding_level": 0,
  "latency_breakdown": { "interceptor_ms": 3, "policy_ms": 12, "queue_ms": 8,
                         "dispatch_ms": 5, "first_token_ms": 120, "llm_ms": 420 },
  "content_hash": "sha256:...",                            // без plaintext prompt
  "timestamp": "2026-05-03T10:15:42.123+03:00",
  "hmac_sha256": "..."                                     // подпись
}
// admin/policy-события дополнительно:
// actor_id, actor_role, change_id, old_policy_version, new_policy_version, reason, rollback_result
```
Append-only (PostgreSQL, партиции по месяцам), pgAudit для DDL, retention 7 лет
(1 год в PG → архив в АС СВОИ). В labels/spans **не** передаются plaintext prompt / полный payload /
high-cardinality значения.

## 6. Prometheus-метрики (обязательный набор, §3.4.8)

`llm_queue_depth_total{service_class}` (gauge), `llm_queue_wait_time_seconds{service_class,model}` (hist),
`llm_queue_max_wait_time_ms{service_class}` (gauge), `llm_starvation_guard_promotions_total{from_class,to_class}` (counter),
`llm_gpu_utilization_ratio{node_id,model}` (gauge), `llm_dispatcher_poll_empty_total` (counter),
`llm_stream_first_token_latency_seconds{service_class,model}` (hist),
`llm_stream_total_latency_seconds{service_class,model,finish_reason}` (hist),
`llm_stream_cancelled_total{service_class,source}` (counter).
Плюс служебные: RPS/latency per endpoint, admission decisions, borrowed slots per class.

## 7. Langfuse spans (§3.4.8)

`llm-gateway-interceptor`, `llm-gateway-policy`, `llm-gateway-queue-wait`, `llm-gateway-dispatch`,
`llm-gateway-stream`, `litellm-call`. Экспорт **асинхронный, batching** (не в request critical path).

## 8. Как пользоваться комплектом

1. `00` (этот файл) — всегда в контексте.
2. `01_BACKEND_PROMPTS.md` — по эпикам PE-* и PQ-*, затем mocks, docker compose, Helm.
3. `02_UI_MOCKUP_PROMPTS.md` — макеты экранов Admin UI (дизайн).
4. `03_FRONTEND_PROMPTS.md` — реализация фронта по макетам.

Порядок сборки: contracts → Policy Engine → mocks → Priority Queue → docker compose →
Helm → frontend mockups → frontend impl. Каждый эпик заканчивается **Definition of Done**.
