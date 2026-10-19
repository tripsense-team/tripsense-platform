# Admin System Logs — Specification & Implementation Plan

`STATUS: WAITING_FOR_HUMAN_APPROVAL`

- **Owner Service**: `services/api-gateway` (admin observability BFF; no business-data ownership)
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway`, local/deployment observability configuration
- **Created Date**: 2026-10-16
- **Target PR Boundaries**: Phase 1 safe web route; Phase 2 protected query contract; Phase 3 Loki/collector integration; Phase 4 verification and rollout

---

## 0. Repository Audit & Current Failure

`AdminSidebar` links **System Logs** to `/admin/logs`, but `apps/web/tripsense/src/app/admin/logs/page.tsx` does not exist. Next.js therefore correctly returns 404. No checked-in feature plan, log-query API, centralized log store, or Loki/collector configuration currently backs this navigation item.

The existing `/admin/services` screen is static presentation data and is not a source of logs or real service health. Browser access to Docker/Portainer, service files, actuator internals, or container sockets is prohibited.

---

## 1. Goal & Requirements

### 1.1 Goal

Provide an Admin-only System Logs page that never returns 404, supports bounded operational investigation across TripSense services when observability is configured, and preserves the frontend zero-leak standard.

### 1.2 User Flow

1. An authenticated Admin opens `/admin/logs`.
2. The page loads with service, severity, time-range, and correlation-reference filters.
3. The web app calls the API Gateway only; it never calls Loki, Docker, Portainer, or individual services.
4. The Gateway verifies the JWT and `ROLE_ADMIN`, validates bounded filters, translates them into a server-owned Loki query, and returns only allowlisted structured fields.
5. The Admin can request the next cursor page or refresh. Search never sends arbitrary LogQL.
6. If the observability backend is not configured or unavailable, the route remains usable and shows a localized safe unavailable state rather than 404 or raw provider errors.

### 1.3 In Scope

- Real `/admin/logs` route under the existing Admin guard/layout.
- EN/VI localized loading, empty, unavailable, forbidden, and results states.
- Filters: allowlisted service, `INFO|WARN|ERROR`, preset time range, correlation reference, bounded result limit.
- API Gateway Admin authorization and observability-provider adapter.
- Loki-compatible query integration behind backend-only configuration.
- Structured-field allowlist, defense-in-depth redaction, cursor pagination, timeouts, rate limiting, and access telemetry.
- Optional local Compose `observability` profile for Loki plus a collector; production configuration remains environment/deployment owned.
- Removal or suppression of the dead navigation target until Phase 1 is present in the same PR.

### 1.4 Out of Scope

- Browser access to Docker socket, Portainer API, host files, actuator loggers, or Loki.
- Arbitrary LogQL/full-text regex supplied by the browser.
- Displaying raw stack traces, SQL/JDBC text, request/response bodies, headers, tokens, emails, prompts, provider payloads, or secrets.
- Editing log levels, restarting services, deleting logs, downloading raw archives, or tailing unbounded streams.
- Treating the page as an audit-log or business analytics system.
- A new microservice or cross-service database.

### 1.5 Domain Invariants

1. Public requests go through API Gateway.
2. Only a server-verified `ROLE_ADMIN` may query operational summaries.
3. The client controls filters, never the provider query language.
4. Returned entries contain safe structured metadata only; incompatible legacy/raw lines are dropped, not forwarded.
5. Observability failure never blocks business services and never causes the admin route itself to 404.
6. Log retention is operational configuration, not application persistence.

### 1.6 Acceptance Criteria

- [ ] AC-1: Clicking **System Logs** resolves `/admin/logs` without 404.
- [ ] AC-2: Anonymous users receive `401`; authenticated non-Admins receive `403` from the backend even if they bypass the web guard.
- [ ] AC-3: Admins can filter only by an allowlisted service, severity, preset time range, and correlation reference.
- [ ] AC-4: Query range is at most 24 hours, page size is `1..200`, and pagination uses an opaque signed cursor.
- [ ] AC-5: The browser cannot submit LogQL, regex, filesystem paths, container IDs, or arbitrary label selectors.
- [ ] AC-6: Responses never include stack traces, SQL/JDBC content, secrets, authorization/cookie headers, emails, raw request bodies, or provider payloads.
- [ ] AC-7: Missing/unavailable Loki returns stable `OBSERVABILITY_UNAVAILABLE` with a localized UI state and retry control.
- [ ] AC-8: Timeout is at most 3 seconds; cancellation and stale-response protection prevent older queries replacing newer results.
- [ ] AC-9: Every query records safe access telemetry: actor pseudonymous ID, filter categories, result count, status, and duration; no raw query text.
- [ ] AC-10: EN/VI locale files retain schema parity; all requests use `apiClient`; no raw error is logged in the browser.
- [ ] AC-11: With the local observability profile disabled, all existing application services start normally.
- [ ] AC-12: Tests prove redaction, RBAC, bounds, provider failure handling, cursor integrity, and no cross-service persistence.

---

## 2. Architecture & Service Boundaries

### 2.1 Data Flow

```text
Service stdout (structured safe fields)
  -> deployment collector
  -> Loki-compatible backend (private network, bounded retention)

Admin Browser
  -> GET /api/ops/logs through API Gateway
  -> Gateway verifies JWT + ROLE_ADMIN
  -> validates allowlisted filters and builds server-owned LogQL
  -> Loki query_range on private network
  -> parse + allowlist + redact + opaque cursor
  -> Admin System Logs UI
```

### 2.2 Ownership

| Component | Responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | Route, filters, pagination, safe states, i18n | REST via Gateway only |
| `services/api-gateway` | Admin authentication/authorization, input bounds, provider query construction, output sanitization, rate limiting | WebFlux REST to private Loki endpoint |
| Loki-compatible backend | Operational log indexing and retention; no business database | Private HTTP |
| Deployment collector | Collect container/service stdout and attach allowlisted labels | One-way push to Loki |
| Existing services | Emit structured, metadata-only logs; no new service-to-service dependency | stdout/collector |

The Gateway acts as an operational BFF because this is a cross-service administrative read boundary. It does not persist logs or query service databases. A new microservice is rejected for this bounded feature.

### 2.3 Availability

Loki and the collector are optional dependencies. Gateway startup and readiness do not depend on them. Provider failures degrade only `/api/ops/logs`; circuit breaking, a 3-second timeout, and a small concurrency limit protect the Gateway.

---

## 3. API Contract

### 3.1 List Safe Log Entries

`GET /api/ops/logs`

Authentication: Bearer JWT; required role: `ROLE_ADMIN`.

Query parameters:

| Field | Type | Rules |
| --- | --- | --- |
| `service` | string | Required; one configured service key or `all` |
| `level` | enum | Optional: `INFO`, `WARN`, `ERROR` |
| `range` | enum | `15m`, `1h`, `6h`, `24h`; default `1h` |
| `correlationRef` | string | Optional, `^[A-Za-z0-9._:-]{1,128}$` |
| `limit` | integer | Default `100`, min `1`, max `200` |
| `cursor` | string | Optional opaque signed cursor, max 512 characters |

The client cannot provide start/end nanoseconds, LogQL, regex, labels, sort expression, or tenant ID.

Success response (`200`):

```json
{
  "success": true,
  "data": {
    "entries": [
      {
        "timestamp": "2026-10-16T03:40:16.702Z",
        "service": "recommendation-service",
        "level": "WARN",
        "eventCode": "DOWNSTREAM_UNAVAILABLE",
        "safeMessage": "A downstream dependency was unavailable",
        "correlationRef": "req_01J..."
      }
    ],
    "nextCursor": "opaque-or-null",
    "truncated": false
  }
}
```

Allowed response fields are exactly `timestamp`, `service`, `level`, `eventCode`, `safeMessage`, and `correlationRef`. Unknown JSON keys and unstructured lines are discarded.

Error contract:

| HTTP | Code | Meaning |
| --- | --- | --- |
| `400` | `INVALID_LOG_FILTER` | Invalid/unsupported filter or cursor |
| `401` | `UNAUTHENTICATED` | Missing/invalid token |
| `403` | `ADMIN_REQUIRED` | Role is not Admin |
| `429` | `LOG_QUERY_RATE_LIMITED` | Bounded Admin query quota exceeded |
| `503` | `OBSERVABILITY_UNAVAILABLE` | Provider disabled, timed out, or unavailable |

No Kafka event is required; this is an immediate bounded read flow.

---

## 4. Data, Retention & Configuration

No application database or Flyway migration is introduced.

Backend-only environment configuration:

```text
OBSERVABILITY_LOGS_ENABLED=false
LOKI_BASE_URL=
LOKI_TENANT_ID=
LOKI_BEARER_TOKEN=
OBSERVABILITY_LOG_RETENTION=7d
OBSERVABILITY_LOG_QUERY_TIMEOUT=3s
```

- Credentials must be injected via environment/secret manager and never returned or logged.
- Local Loki retention defaults to 7 days with bounded disk usage; production retention is deployment-owned and initially capped at 30 days.
- Cursor payload contains provider timestamp/direction/filter fingerprint, is HMAC-signed, short-lived, and contains no token or raw log content.
- The local collector is enabled only through a Compose `observability` profile. Any host/container-log mounts are read-only and documented as development-only; production uses the platform collector.

Rollback disables `OBSERVABILITY_LOGS_ENABLED` and removes the optional profile. The safe `/admin/logs` unavailable state remains, preventing the dead link from returning.

---

## 5. Security & Trust Boundaries

| Risk | Mitigation |
| --- | --- |
| Client-only Admin guard bypass | Gateway validates JWT signature/expiry and requires `ROLE_ADMIN` on every request |
| Arbitrary provider query / expensive regex | Server-owned query templates; enum service/level/range; no client LogQL or regex |
| Secret/PII leakage | Structured-log contract, ingestion redaction, strict response allowlist, secondary sanitizer; raw/unparseable lines dropped |
| IDOR/cross-tenant access | No user-selected tenant; configured TripSense tenant only |
| Query abuse/DoS | Per-Admin rate limit, max 24h range, max 200 results, timeout, concurrency cap, circuit breaker |
| Cursor tampering | HMAC signature, expiry, and filter fingerprint validation |
| Browser leakage | `apiClient`, safe i18n errors, no response dumps or token/error logging |
| Provider compromise | Private-network URL allowlist, TLS in shared environments, response-size cap, no redirects |
| Privileged local collector | Opt-in development profile, read-only minimal mounts; never expose Docker socket to web/Gateway |

Before rollout, existing service logs must be sampled for zero-leak compliance. The page must remain provider-disabled until services emit the allowlisted structured schema reliably.

---

## 6. Devil's Advocate & Trade-offs

| Decision | Risk / Trade-off | Resolution |
| --- | --- | --- |
| Gateway operational BFF | Adds non-routing responsibility | Keep adapter small/read-only; no persistence; avoid a premature microservice |
| Drop raw/unstructured lines | Some debugging detail is unavailable | Security takes priority; engineers use protected infrastructure tooling for raw diagnostics |
| Polling, not live tail/SSE | Up to refresh-interval delay | Initial release uses explicit refresh/30-second optional polling; avoids long-lived resource abuse |
| Optional Loki dependency | Page may show unavailable locally | Route still works; clear setup state; business startup is independent |
| No Docker/Portainer proxy | Cannot instantly reuse local container logs | Reject due to environment coupling and privilege escalation risk |
| No static/mock log rows | Empty demos look less populated | Never misrepresent fixtures as real operational evidence |

---

## 7. Phased Implementation & Verification

### Phase 1 — Safe Route and Navigation

- [ ] Add `src/app/admin/logs/page.tsx` under existing Admin layout.
- [ ] Add localized loading/empty/unavailable/forbidden states and accessible filters.
- [ ] Ensure navigation and direct refresh never return 404.
- [ ] Until backend enablement, render the explicit unavailable/setup state; do not use mock logs.

### Phase 2 — Gateway Contract and Security

- [ ] Add JWT validation and `ROLE_ADMIN` enforcement for `/api/ops/logs`.
- [ ] Add validated DTOs, service allowlist, server-owned provider query builder, timeout/circuit breaker, rate limit, signed cursor, and stable errors.
- [ ] Add strict response parsing/redaction and response-size cap.
- [ ] Add unit/WebFlux tests for RBAC, validation, redaction, timeout, cursor tampering, and provider errors.

### Phase 3 — Observability Integration

- [ ] Add optional local Loki/collector Compose profile with bounded retention.
- [ ] Add backend-only deployment configuration and secret injection documentation.
- [ ] Normalize structured safe fields for participating services; keep provider disabled until compliance checks pass.

### Phase 4 — Web Integration and Verification

- [ ] Add typed `apiClient` service, cancellation, stale-response protection, cursor pagination, and safe retry.
- [ ] Add component tests for all states, filter bounds, RBAC redirect, and no raw error rendering.
- [ ] Run i18n parity, lint/type checks, focused frontend tests, Gateway tests, Compose config validation, and manual Admin/non-Admin flows.

Verification commands:

```bash
cd apps/web/tripsense
npm run i18n:check
npm test -- --run
npm run build

cd ../../..
./mvnw -pl services/api-gateway test
docker compose --env-file env/.env config
docker compose --env-file env/.env --profile observability config
```

---

## Human Approval Gate

```text
STATUS: WAITING_FOR_HUMAN_APPROVAL
```

No application implementation may begin until a human explicitly approves this plan.
