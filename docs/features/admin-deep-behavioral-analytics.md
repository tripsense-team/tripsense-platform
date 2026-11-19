# Admin Deep Behavioral & AI Analytics — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Services**: `services/recommendation-service`, `services/context-service`, `services/ai-service`, `services/trip-service` (each querying only its own database)
- **Affected Components**: `apps/web/tripsense`, `services/recommendation-service`, `services/context-service`, `services/ai-service`, `services/trip-service` (no API Gateway route changes required; uses existing `/api/recommendations/**`, `/api/context/**`, `/api/ai/**`, `/api/admin/**` routes)
- **Created Date**: 2026-11-14
- **Target PR Boundaries**: Phase 1 (Backend Admin Behavioral/AI Analytics APIs + Tests), Phase 2 (Frontend Aggregation, Deep Analytics UI, EN/VI i18n & Tests)

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
`admin-platform-analytics` (`STATUS: DONE`) currently provides descriptive platform counts across Trips, Partners, Finance, Users, and Social. While accurate, descriptive counters alone do not demonstrate **analytical depth, algorithmic validation, or decision-support insights** (e.g. Google Analytics-style conversion funnels, Top-K ranking validation, segment comparison, user activation/retention, and planning lead-time seasonality).

Inspection of live Neon databases confirms rich, unused behavioral & AI datasets:
- `tripsense_recommendation`: `325` impressions, `7,578` recommended items, `3,693` feedback events (`IMPRESSION: 3,538`, `CLICK: 133`, `ADD_TO_TRIP: 11`, `SAVE: 8`, `DETAIL_VIEW: 3`) with `position`, `final_score`, `ranking_version`, and `degradation_codes`.
- `tripsense_ai_v2`: `60` AI chats, `176` messages, `21` itinerary proposals.
- `tripsense_context`: `19` onboarding profiles, `137` preference signals (`dimension_code`, `value_code`, `confidence`).
- `tripsense_trip`: `57` trips with `start_date`, `end_date`, `traveler_count`, `budget_amount`, `itinerary_commit_receipts`, and `partner_application` (`submitted_at`, `decided_at`).

The goal is to add **5 deep analytical modules + 1 Travel Lead-Time/Seasonality view** directly into `/admin/analytics`, turning raw operational records into GA-style funnels, segment comparisons, ranking quality proofs, and automated actionable insights.

### 1.2 User Flows & Journey
1. Admin opens `/admin/analytics` and selects period (`7d | 30d | 90d | 1y`).
2. Frontend `fetchAdminUnifiedAnalytics(periodDays)` issues parallel `Promise.allSettled` requests (alongside existing Trip/User/Social stats) to:
   - `GET /api/recommendations/admin/stats?periodDays=...`
   - `GET /api/context/admin/stats?periodDays=...`
   - `GET /api/ai/admin/stats?periodDays=...`
   - Extended `GET /api/admin/analytics/overview?periodDays=...` (deep trip segmentation, repeat-user rate, lead time, partner SLA)
3. `/admin/analytics` renders:
   - **Key Insights & Decision Support Banner** (auto-synthesized from live thresholds across all services).
   - **Recommendation Ranking Quality & Top-K Position Analysis** (4-step GA funnel, overall CTR, Top 1–3 vs Top 4–6 vs Top 7+ CTR comparison, Personalized vs Degraded/Fallback comparison).
   - **AI Planner Funnel & Segment Comparison (AI vs Manual)** (`Chats → Messages → Proposals → AI Trips` funnel + side-by-side comparison of avg duration, avg group size, avg budget + Planning Lead Time & Departure Seasonality).
   - **Traveler Persona & Preference Insights** (Top preference dimensions/values and avg confidence from `context-service`).
   - **User Activation, Repeat Retention & Operational SLA** (`Registered → Onboarded → First Trip → Repeat 2+ Trips` + avg partner approval SLA hours).

### 1.3 Scope Boundaries
- **In-Scope**:
  - Read-only `ROLE_ADMIN` aggregation endpoints in `recommendation-service`, `context-service`, `ai-service`, and `trip-service` (extending existing `AdminPlatformAnalyticsDto` / `AdminPlatformAnalyticsService`).
  - Frontend types, `Promise.allSettled` integration, interactive deep-analytics components on `/admin/analytics`, full EN/VI i18n parity, and backend/frontend unit tests.
- **Out-of-Scope**:
  - Cross-service SQL joins (`hotel_booking` has no `trip_id` and only 2 rows; `partner_business` has no normalized `city` column — excluded to avoid sparse/broken analytics).
  - External Google Analytics Data API integration or new API Gateway request-counter tables.
  - Database schema changes or Flyway migrations (all metrics compute cleanly over existing indexed tables).

### 1.4 Acceptance Criteria
- [ ] AC-1: Every new/extended admin analytics endpoint strictly enforces `ROLE_ADMIN` (`401`/`403` otherwise) and validates `periodDays` in `{7, 30, 90, 365}`.
- [ ] AC-2: Zero cross-service DB queries; each service queries only its own PostgreSQL database.
- [ ] AC-3: `recommendation-service` computes 4-step funnel (`IMPRESSION → CLICK → SAVE/DETAIL_VIEW → ADD_TO_TRIP`), overall CTR %, Top-K position bucket CTR (`1–3`, `4–6`, `7+`), and full-personalized vs degraded (`degradation_codes`) CTR.
- [ ] AC-4: `trip-service` computes AI vs Manual trip segment averages (avg duration days, avg travelers, avg budget), trip duration distribution (`1-2d`, `3-5d`, `6+d`), planning lead-time buckets (`0-7d`, `8-30d`, `>30d`), monthly departure seasonality, repeat-trip user rate (`>=2` trips vs `>=1` trip), and partner approval SLA hours.
- [ ] AC-5: `context-service` computes total onboarding profiles, total preference signals, and top preference dimensions/values with average confidence.
- [ ] AC-6: `ai-service` computes total/period AI chats, messages, avg messages per chat, and itinerary proposals count.
- [ ] AC-7: `/admin/analytics` renders all new analytical sections + automated Key Insights banner gracefully even if one downstream service is offline (`Promise.allSettled`), passes `npm run i18n:check`, `npm run type-check`, ESLint, and unit tests.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow
```text
[Admin Web (/admin/analytics)]
       |  (Promise.allSettled with Bearer JWT)
       +---> GET /api/admin/analytics/overview?periodDays=30    ---> [Gateway] ---> [trip-service]           ---> tripsense_trip
       +---> GET /api/users/admin/stats?periodDays=30           ---> [Gateway] ---> [user-service]           ---> tripsense_user
       +---> GET /api/social/admin/stats?periodDays=30          ---> [Gateway] ---> [social-service]         ---> tripsense_social
       +---> GET /api/recommendations/admin/stats?periodDays=30 ---> [Gateway] ---> [recommendation-service] ---> tripsense_recommendation
       +---> GET /api/context/admin/stats?periodDays=30         ---> [Gateway] ---> [context-service]        ---> tripsense_context
       +---> GET /api/ai/admin/stats?periodDays=30              ---> [Gateway] ---> [ai-service]             ---> tripsense_ai_v2
```

### 2.2 Service Ownership & Communication
| Component | Responsibility | Communication |
| --- | --- | --- |
| `services/recommendation-service` | Funnel (`IMPRESSION`, `CLICK`, `DETAIL_VIEW`, `SAVE`, `ADD_TO_TRIP`), Top-K Position CTR, Personalized vs Degraded CTR | Sync REST (`JdbcTemplate`) |
| `services/context-service` | Onboarding profiles count, preference signals count, top preference dimension/value distribution | Sync REST (`JdbcTemplate`) |
| `services/ai-service` | AI chats, messages, avg messages/chat, proposals counts (`tripsense_ai_v2` schema) | Sync REST (Drizzle / `postgres.js`) |
| `services/trip-service` | AI vs Manual segment averages, trip duration & lead-time buckets, departure seasonality, repeat-trip user rate, partner approval SLA | Sync REST (`JdbcTemplate`) |
| `apps/web/tripsense` | Parallel fetch, Key Insights rule synthesizer, GA-style Funnel/Segment/Persona UI, EN/VI i18n | HTTP REST via API Gateway |

### 2.3 Architecture Guardrails Verification
- [x] Public traffic routes through API Gateway using existing path prefixes.
- [x] Zero cross-service DB queries or cross-service JPA relationships.
- [x] No PII (emails, user names, phone numbers, raw chat contents) returned in aggregate DTOs.
- [x] Zero raw error leakage on frontend (`getSafeErrorMessage`).

---

## 3. API & Event Contracts

### 3.1 REST Endpoints
| Method | Gateway Path | Service | Auth Required | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/api/recommendations/admin/stats?periodDays=30` | `recommendation-service` | `Bearer JWT` (`ROLE_ADMIN`) | Recommendation funnel, Top-K position CTR, personalized vs degraded CTR |
| `GET` | `/api/context/admin/stats?periodDays=30` | `context-service` | `Bearer JWT` (`ROLE_ADMIN`) | Onboarding completion, preference signals & top traveler interest segments |
| `GET` | `/api/ai/admin/stats?periodDays=30` | `ai-service` | `Bearer JWT` (`ROLE_ADMIN`) | AI chat sessions, messages, avg messages/chat, proposals |
| `GET` | `/api/admin/analytics/overview?periodDays=30` | `trip-service` | `Bearer JWT` (`ROLE_ADMIN`) | Extended with `deepTripAnalytics` (AI vs Manual, lead time, seasonality, repeat rate, partner SLA) |

#### Response DTO Shapes (Summary)
```json
// 1. GET /api/recommendations/admin/stats
{
  "periodDays": 30,
  "totalImpressions": 325,
  "totalRecommendedItems": 7578,
  "funnel": {
    "impressions": 3538,
    "clicks": 133,
    "detailViews": 3,
    "saves": 8,
    "addToTrip": 11,
    "ctrPercent": 3.76,
    "conversionRatePercent": 0.54
  },
  "positionBuckets": [
    { "bucket": "TOP_1_3", "impressions": 900, "clicks": 60, "ctrPercent": 6.67 },
    { "bucket": "TOP_4_6", "impressions": 900, "clicks": 40, "ctrPercent": 4.44 },
    { "bucket": "TOP_7_PLUS", "impressions": 1738, "clicks": 33, "ctrPercent": 1.90 }
  ],
  "personalizationComparison": {
    "personalizedImpressions": 300,
    "personalizedCtrPercent": 4.10,
    "degradedImpressions": 25,
    "degradedCtrPercent": 1.80
  }
}

// 2. GET /api/context/admin/stats
{
  "periodDays": 30,
  "totalOnboardingProfiles": 19,
  "periodOnboardingProfiles": 12,
  "totalPreferenceSignals": 137,
  "topPreferences": [
    { "dimensionCode": "travel_style", "valueCode": "culinary", "count": 14, "avgConfidence": 0.86 }
  ]
}

// 3. GET /api/ai/admin/stats
{
  "periodDays": 30,
  "totalChats": 60,
  "periodChats": 34,
  "totalMessages": 176,
  "avgMessagesPerChat": 2.93,
  "totalProposals": 21,
  "periodProposals": 14
}
```

---

## 4. Database & Persistence

No schema migrations required. All queries are read-only aggregations over existing tables:
- `tripsense_recommendation`: `recommendation_impression`, `recommendation_impression_item`, `recommendation_feedback_event`.
- `tripsense_context`: `onboarding_profiles`, `preference_signals`.
- `tripsense_ai_v2`: `tripsense_ai_v2.chats`, `tripsense_ai_v2.messages`, `tripsense_ai_v2.proposals`.
- `tripsense_trip`: `trips`, `itinerary_commit_receipts`, `partner_application`.

---

## 5. Security & Trust Boundaries

- **`recommendation-service` & `context-service`**: Add `@EnableMethodSecurity` or explicit `.requestMatchers("/api/*/admin/**").hasRole("ADMIN")` in `SecurityConfig` before `.anyRequest().authenticated()`, plus role guard verification in controller/service.
- **`ai-service`**: Verify `Authorization: Bearer <token>` HS256/HS512 signature using `config.jwtAccessSecret` (matching Java services' `JwtTokenProvider`) and assert `ROLE_ADMIN` / `ADMIN` claim; return `401` on missing/invalid token and `403` on non-admin role.
- **`trip-service`**: Already restricts `/api/admin/**` to `hasRole("ADMIN")`.

---

## 6. Devil's Advocate & Trade-offs

| Decision | Alternative Rejected | Rationale |
| --- | --- | --- |
| Per-service REST aggregation via `Promise.allSettled` | Cross-DB SQL joins or new analytics ETL warehouse | Preserves microservice DB isolation; avoids operational overhead and stays resilient if any single service is stopped locally. |
| Exclude `trips -> hotel_booking` join & `partner_business` city matrix | Hardcode heuristic text matching on `address` / `destination_name` | `hotel_booking` has no `trip_id` and only 2 records; excluding prevents brittle/misleading charts during defense. |
| Rule-based Key Insights synthesized on frontend | Calling external LLM on every page load | Deterministic, zero latency/token cost, testable, and cannot hallucinate numbers. |

---

## 7. Implementation Tasks & Test Plan

- [x] 1. **Backend — `recommendation-service`**: Add `AdminRecommendationStatsResponse`, `AdminRecommendationStatsService`, `AdminRecommendationStatsController`, update `SecurityConfig`, add unit tests (`AdminRecommendationStatsServiceTest`).
- [x] 2. **Backend — `context-service`**: Add `AdminContextStatsResponse`, `AdminContextStatsService`, `AdminContextStatsController`, update `SecurityConfig`, add unit tests (`AdminContextStatsServiceTest`).
- [x] 3. **Backend — `ai-service`**: Add `src/routes/admin-stats.ts` with JWT `ROLE_ADMIN` verification (`verifyAdminAuthorization`), mount in `src/index.ts`, add `node --test` unit tests (`src/routes/admin-stats.test.ts`).
- [x] 4. **Backend — `trip-service`**: Extend `AdminPlatformAnalyticsDto` & `AdminPlatformAnalyticsService` with `deepTripAnalytics` (AI vs Manual comparison, duration buckets, lead-time buckets, departure seasonality, repeat-trip user rate, partner approval SLA) and update `AdminPlatformAnalyticsServiceTest`.
- [x] 5. **Frontend — `apps/web/tripsense`**: Extend `admin-analytics.types.ts` & `admin-analytics-api.ts`, build the 5 deep analytical sections + Key Insights banner on `/admin/analytics`, update `en.json` & `vi.json`, verify `i18n:check`, `type-check`, `eslint`, and `vitest`.

