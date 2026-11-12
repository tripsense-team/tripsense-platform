# Admin Platform Analytics — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Services**: `services/trip-service`, `services/user-service`, `services/social-service` (each querying only its own database)
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway`, `services/trip-service`, `services/user-service`, `services/social-service`
- **Created Date**: 2026-11-12
- **Target PR Boundaries**: Phase 1 (Backend Admin Analytics APIs in Trip, User, Social services), Phase 2 (Security & Gateway Routing), Phase 3 (Admin Analytics & Overview Dashboard UI + i18n + Tests)

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
Currently, the Admin Overview Dashboard (`/admin`) and Admin Platform Analytics (`/admin/analytics`) rely on hardcoded mock data (`42,890` travelers, `15,240` AI itineraries, static Mon–Sun bars, static destinations), and the time-range selector (`7d | 30d | 90d | 1y`) does not fetch or update metrics.

Meanwhile, the TripSense platform databases already store rich operational data across 5 core pillars:
1. **Trips, Destinations & AI Planning Efficiency** (`trips`, `itinerary_commit_receipts`, `trip_members`)
2. **Multi-Vertical Partner & Booking Ecosystem** (`partner_business`, `partner_application`, `hotel_booking`, `restaurant_reservation_request`, `rental_booking_order`, `guide_inquiry`, `hotel_voucher_redemption`)
3. **Dual-Stream Platform Monetization & Escrow Cash-Flow** (`hotel_payos_payment`, `financial_ledger_entry`, `partner_subscription`, `partner_subscription_order`)
4. **User Growth, Roles & Authentication Sources** (`users` in `user-service`)
5. **Community Engagement, Place Reviews & Moderation Health** (`social_posts`, `social_comments`, `social_trip_shares`, `place_reviews`, `social_reports` in `social-service`)

The goal is to replace the static mock dashboards on `/admin/analytics` and `/admin` with authoritative, period-aware (`7d / 30d / 90d / 365d`) real-time statistics aggregated safely from each owning service without cross-database coupling.

### 1.2 User Flows & Journey
1. **Admin opens `/admin/analytics`**:
   - The page requests period-filtered analytics (`periodDays = 7 | 30 | 90 | 365`, default `30`) in parallel (`Promise.allSettled`) from:
     - `GET /api/admin/analytics/overview?periodDays=30` (`trip-service`)
     - `GET /api/users/admin/stats?periodDays=30` (`user-service`)
     - `GET /api/social/admin/stats?periodDays=30` (`social-service`)
   - Admin switches between `7d`, `30d`, `90d`, and `1y` (`365d`); KPI cards, growth percentages (comparing current window vs previous equal window), daily trend charts, and breakdowns update dynamically.
   - If one downstream microservice is temporarily offline in local dev, `Promise.allSettled` ensures the remaining pillars still render cleanly with a non-leaking partial status notice.
2. **Admin opens `/admin` (Platform Overview)**:
   - Displays live KPI counts (Total Users, Total Planned Trips & AI Itineraries, Total Platform Revenue & GMV, Partner & Moderation Queue counts) and real recent platform events derived from database activity.

### 1.3 Scope Boundaries
- **In-Scope**:
  - `trip-service` endpoint `GET /api/admin/analytics/overview?periodDays={7|30|90|365}` returning:
    - Pillar 1 (Trips & AI): total trips, period trips, previous-period trips, growth %, AI-committed trips count (`itinerary_commit_receipts`), AI adoption rate %, visibility breakdown (`PUBLIC`, `SHARED`, `PRIVATE`), average collaborators per trip, daily series of trips created vs AI itineraries committed, and top planned destinations (`trips.destination_name`) with share % and period growth.
    - Pillar 2 (Partner & Multi-Vertical Bookings): partner business distribution by kind (`HOTEL`, `RESTAURANT`, `TOUR_GUIDE`, `RENTAL_SERVICE`), partner application funnel (`SUBMITTED`, `APPROVED`, `CHANGES_REQUIRED`, `REJECTED`), multi-vertical booking funnel across Hotel bookings, Restaurant reservations, Rental bookings, and Guide inquiries, plus Hotel Voucher redemption metrics (redemption count & total discount saved).
    - Pillar 3 (Dual-Stream Monetization & Escrow): total paid hotel GMV, escrow holding, completed hotel GMV, 10% platform commission revenue, partner subscription revenue (`partner_subscription_order` where `payment_status='PAID'`), active vs trial vs expired partner subscriptions (`partner_subscription`), pending withdrawal/refund counts, and daily revenue/GMV series.
    - Recent platform events list (latest trips created, AI commits, hotel bookings, partner applications, subscription orders).
  - `user-service` endpoint `GET /api/users/admin/stats?periodDays={7|30|90|365}` returning:
    - Pillar 4 (User Growth & Auth): total users, active vs inactive users, period new users & growth %, role breakdown (`USER`, `PARTNER`, `ADMIN`), auth provider breakdown (`LOCAL` vs `GOOGLE`), and daily new user registrations series.
  - `social-service` endpoint `GET /api/social/admin/stats?periodDays={7|30|90|365}` returning:
    - Pillar 5 (Community, Reviews & Moderation): total active posts, comments, reactions, shared trips (`social_trip_shares`), place reviews count, average platform rating (`1.00–5.00`), 1–5 star rating distribution, and moderation report queue breakdown (`PENDING`, `ACTIONED`, `DISMISSED` and by `target_type`).
  - Frontend overhaul of `/admin/analytics` and `/admin` with interactive charts, visual breakdowns, EN/VI localization parity, and unit/component tests.
- **Out-of-Scope**:
  - Cross-service database queries or new microservices.
  - Modifying existing financial settlement or booking state transitions.
  - Exposing PII (user emails, phone numbers, or raw bank details) in aggregate analytics payloads.

### 1.4 Acceptance Criteria
- [ ] AC-1: All 3 admin stats endpoints enforce `ROLE_ADMIN` authorization (returning `401`/`403` for unauthenticated or non-admin users).
- [ ] AC-2: `periodDays` parameter supports `7`, `30`, `90`, and `365` (clamping or rejecting invalid values safely) and calculates previous-period comparison metrics accurately.
- [ ] AC-3: No service queries another service's database; each service aggregates only from its own PostgreSQL schema.
- [ ] AC-4: `/admin/analytics` renders all 5 statistical pillars with working `7d | 30d | 90d | 1y` selector, interactive daily charts (Trips/AI, Revenue/GMV, User registrations), Top Destinations ranking, Partner & Multi-vertical Booking breakdown, and Community & Review star distribution.
- [ ] AC-5: `/admin` Overview Dashboard displays real metrics and real recent platform events from backend APIs.
- [ ] AC-6: Full EN/VI translation parity (`npm run i18n:check` passes) and zero raw server error leaks (`getSafeErrorMessage`).

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow
```text
[Admin Web (/admin, /admin/analytics)]
       |
       +---> GET /api/admin/analytics/overview?periodDays=30 ---> [API Gateway (:8080)] ---> [trip-service (:8084)]   ---> tripsense_trip DB
       |
       +---> GET /api/users/admin/stats?periodDays=30        ---> [API Gateway (:8080)] ---> [user-service (:8081)]   ---> tripsense_user DB
       |
       +---> GET /api/social/admin/stats?periodDays=30       ---> [API Gateway (:8080)] ---> [social-service (:8086)] ---> tripsense_social DB
```

### 2.2 Service Ownership & Communication
| Component | Responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | Admin Analytics & Overview UI, parallel aggregation via `Promise.allSettled`, EN/VI i18n | HTTP REST via API Gateway |
| `services/api-gateway` | Routes `/api/admin/**` to `trip-service`, `/api/users/**` to `user-service`, `/api/social/**` to `social-service` | Spring Cloud Gateway |
| `services/trip-service` | Owns Pillar 1 (Trips/AI), Pillar 2 (Partners/Bookings/Vouchers), Pillar 3 (Finance/Subscriptions) | Synchronous Spring Boot + `JdbcTemplate` |
| `services/user-service` | Owns Pillar 4 (Users, Roles, Auth Providers, Registration trend) | Synchronous Spring Boot + `JdbcTemplate` |
| `services/social-service` | Owns Pillar 5 (Posts, Comments, Trip Shares, Place Reviews 1-5 stars, Moderation Reports) | Synchronous Spring Boot + `JdbcTemplate` |

### 2.3 Architecture Guardrails Verification
- [x] Public traffic goes through API Gateway.
- [x] Each service queries only its own database; zero cross-service DB queries.
- [x] Zero cross-service JPA relationships.
- [x] Zero raw error leakage on frontend (`getSafeErrorMessage`).

---

## 3. API & Event Contracts

### 3.1 REST Endpoints
| Method | Gateway Path | Service | Auth Required | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/api/admin/analytics/overview?periodDays=30` | `trip-service` | `Bearer JWT` (`ROLE_ADMIN`) | Trips, AI itineraries, Destinations, Partners, Bookings, Vouchers, Subscriptions & Escrow Revenue |
| `GET` | `/api/users/admin/stats?periodDays=30` | `user-service` | `Bearer JWT` (`ROLE_ADMIN`) | User growth, role distribution, OAuth vs Local, daily registrations |
| `GET` | `/api/social/admin/stats?periodDays=30` | `social-service` | `Bearer JWT` (`ROLE_ADMIN`) | Posts, comments, trip shares, place review star distribution, moderation report status |

---

## 4. Data Model & Queries

No new tables or destructive schema migrations are required. Queries use existing indexed columns on:
- `tripsense_trip`: `trips`, `itinerary_commit_receipts`, `trip_members`, `partner_business`, `partner_application`, `hotel_booking`, `hotel_payos_payment`, `hotel_voucher_redemption`, `restaurant_reservation_request`, `rental_booking_order`, `guide_inquiry`, `partner_subscription`, `partner_subscription_order`, `financial_ledger_entry`, `partner_wallet`, `partner_withdrawal_request`, `customer_refund_request`.
- `tripsense_user`: `users`.
- `tripsense_social`: `social_posts`, `social_comments`, `social_reactions`, `social_trip_shares`, `place_reviews`, `social_reports`.

---

## 5. Security & Trust Boundaries

| Risk Area | Mitigation Strategy |
| --- | --- |
| **Authentication & RBAC** | `trip-service` enforces `.requestMatchers("/api/admin/**").hasRole("ADMIN")`; `user-service` enforces `@PreAuthorize("hasRole('ADMIN')")` on `/api/users/admin/stats`; `social-service` `SecurityConfig` explicitly places `.requestMatchers("/api/social/admin/**").hasRole("ADMIN")` **before** the public GET rule `.requestMatchers(HttpMethod.GET, "/api/social/**").permitAll()`. |
| **Data Privacy / Zero PII Leak** | Analytics responses return only counts, sums, percentages, destination names, and anonymized activity references (no customer emails, phone numbers, or bank account numbers). |
| **Input Validation** | `periodDays` is validated and normalized to allowed buckets (`7`, `30`, `90`, `365`) using parameterized SQL queries (`PreparedStatement` via `JdbcTemplate`). |

---

## 6. Devil's Advocate & Technical Trade-offs

| Aspect | Risk / Challenge | Solution & Trade-off |
| --- | --- | --- |
| **Partial Service Outage in Local Dev** | Developer may run `trip-service` and `user-service` without `social-service` | Frontend uses `Promise.allSettled` so available sections render immediately while unavailable sections show a graceful fallback state. |
| **Empty / Sparse Date Series** | New local DBs may have days with 0 events | Backend generates a continuous zero-filled daily series in Java (`LocalDate` loop for the last `N` days) and merges SQL `GROUP BY` date counts so charts always render a complete timeline. |
| **Social Service Public GET Rule** | `social-service` permits `GET /api/social/**` by default | Explicitly guard `/api/social/admin/**` with `.hasRole("ADMIN")` before the generic GET matcher in `social-service/SecurityConfig.java`. |

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: Backend Admin Statistics Endpoints
- [x] Task 1.1: Implement `AdminPlatformAnalyticsController` & `AdminPlatformAnalyticsService` in `services/trip-service` (`GET /api/admin/analytics/overview`).
- [x] Task 1.2: Implement `AdminUserStatsController` & `AdminUserStatsService` in `services/user-service` (`GET /api/users/admin/stats`).
- [x] Task 1.3: Implement `AdminSocialStatsController` & `AdminSocialStatsService` and update `SecurityConfig` in `services/social-service` (`GET /api/social/admin/stats`).

### Phase 2: Frontend Admin Analytics & Overview UI + i18n
- [x] Task 2.1: Create `src/features/admin/api/admin-analytics-api.ts` and TypeScript interfaces.
- [x] Task 2.2: Upgrade `/admin/analytics/page.tsx` with the 5 statistical pillars, time-range filter (`7d | 30d | 90d | 1y`), interactive charts, and breakdowns.
- [x] Task 2.3: Upgrade `/admin/page.tsx` (Overview Dashboard) to display live platform metrics and real recent platform activities.
- [x] Task 2.4: Add EN & VI translations in `src/locales/en.json` and `src/locales/vi.json` and run `npm run i18n:sort` & `npm run i18n:check`.

### Phase 3: Automated Tests & Verification
- [x] Task 3.1: Add backend unit tests for `AdminPlatformAnalyticsService`, `AdminUserStatsService`, and `AdminSocialStatsService`.
- [x] Task 3.2: Run frontend `npm run type-check`, `npm run i18n:check`, and `npm test`.

---

## Human Approval Gate

Explicitly approved by the user on 2026-11-12 ("5 cái thông kê ở phần 2 khá hay tôi đồng ý. Bạn có thể làm mấy phần này cho tôi").

```text
STATUS: APPROVED
```
