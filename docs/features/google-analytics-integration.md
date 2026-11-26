# Google Analytics 4 (Web & Mobile) Integration — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: Client Telemetry (`apps/web/tripsense`, `apps/mobile/tripsense`) — no backend service changes
- **Affected Components**: `apps/web/tripsense`, `apps/mobile/tripsense`, `env/.env`, `env/.env.example`, `env/.env.prod`, `apps/web/tripsense/.env.local`, `apps/web/tripsense/.env.example`
- **Created Date**: 2026-11-26
- **Target PR Boundaries**: Phase 1 (Web GA4 Integration), Phase 2 (Mobile Flutter Firebase Analytics Integration)

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
TripSense currently has no unified product analytics tracking user journeys across Web (`apps/web/tripsense`) and Mobile (`apps/mobile/tripsense`). Integrating Google Analytics 4 (GA4) into both clients allows the team to measure traffic, screen/page views, and key conversion funnels (place discovery, trip creation, AI planner usage, bookings, PayOS payments) in a single GA4 property.

### 1.2 User Flows & Journey
1. User opens TripSense Web or Mobile app.
2. Client initializes GA4 only if the environment/Firebase configuration is present (safe no-op otherwise).
3. As the user navigates routes/screens, `page_view` (Web) and `screen_view` (Mobile) are recorded automatically.
4. When the user completes key actions (login, place view, AI chat prompt, trip creation, reservation/booking, PayOS payment success), a standardized non-PII custom event is dispatched.

### 1.3 Scope Boundaries
- **In-Scope**:
  - Web GA4 integration using `@next/third-parties/google` (`GoogleAnalytics` component + `sendGAEvent`) in `apps/web/tripsense`.
  - Mobile GA4 integration using `firebase_core` + `firebase_analytics` + `FirebaseAnalyticsObserver` attached to `GoRouter` in `apps/mobile/tripsense`.
  - Shared, non-PII event helper (`analytics.ts` on Web, `AnalyticsService` on Mobile).
  - Environment variable documentation for team sharing (`NEXT_PUBLIC_GA_MEASUREMENT_ID` and Mobile Firebase config files).
- **Out-of-Scope**:
  - Pulling GA4 reporting data back into `/admin/analytics` via Google Analytics Data API.
  - Server-side GA4 Measurement Protocol tracking from Java/Node services.
  - Cookie consent banner / GDPR CMP UI (can be added separately if required).

### 1.4 Acceptance Criteria
- [ ] AC-1: Web app renders GA4 script only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is non-empty, and automatically tracks App Router route transitions.
- [ ] AC-2: Mobile app initializes `Firebase.initializeApp()` safely (does not crash if native Firebase config is missing in local dev) and tracks `GoRouter` screen transitions via `FirebaseAnalyticsObserver`.
- [ ] AC-3: Web and Mobile emit consistent custom event names with zero PII (no email, phone, JWT, password, or raw error messages).
- [ ] AC-4: `npm run type-check`, `npm run lint`, `npm run test` (Web) and `flutter analyze`, `flutter test` (Mobile) pass.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow
```text
[Next.js Web (apps/web/tripsense)]  --(@next/third-parties gtag)--> [Google Analytics 4 Property]
                                                                               ^
[Flutter Mobile (apps/mobile/tripsense)] --(firebase_analytics)----------------+
```

### 2.2 Service Ownership & Communication
| Component | Responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | Load GA4 `gtag.js`, auto-track `page_view`, dispatch Web custom events | Client-side HTTPS (`gtag.js`) |
| `apps/mobile/tripsense` | Initialize Firebase, auto-track `screen_view` via `GoRouter`, dispatch Mobile custom events | Native Firebase SDK (`firebase_analytics`) |
| Backend Services (`services/*`) | No changes; business & financial truth remains in `trip-service` / `recommendation-service` | N/A |

### 2.3 Architecture Guardrails Verification
- [x] No backend database or cross-service JPA changes.
- [x] Zero PII or secrets exposed in client telemetry payloads (aligned with `docs/ERROR_HANDLING_AND_LOGGING_STANDARDS.md`).
- [x] `NEXT_PUBLIC_GA_MEASUREMENT_ID` is a public client Measurement ID (`G-...`), not a secret.

---

## 3. Environment Variables & Event Contracts

### 3.1 Environment Variables & Config Files (Cần chia sẻ với đồng đội)

#### Web (`apps/web/tripsense/.env.local`, `.env.example`, `env/.env`, `env/.env.prod`)
| Variable | Example Value | Required | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `G-XXXXXXXXXX` | Optional (no-op if empty) | GA4 Web Data Stream Measurement ID (public browser identifier) |

#### Mobile (`apps/mobile/tripsense`)
Firebase Analytics on Flutter uses native platform config files (linked to Firebase project `tripsense-642bd` and the same GA4 Property) rather than `.env` variables:
- `apps/mobile/tripsense/android/app/google-services.json` (Android)
- `apps/mobile/tripsense/ios/Runner/GoogleService-Info.plist` (iOS)
- `apps/mobile/tripsense/lib/firebase_options.dart` (generated via `flutterfire configure` if using multi-platform Dart init)

> **Lưu ý khi chia sẻ cho bạn cùng team:** Gửi cho bạn ấy giá trị `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX` (để thêm vào `apps/web/tripsense/.env.local` và `env/.env`) kèm 2 file config Firebase của Mobile (`google-services.json` và `GoogleService-Info.plist`).

### 3.2 Standardized Event Contract (Non-PII)
| Event Name | Trigger | Allowed Parameters |
| --- | --- | --- |
| `login` | Auth login success | `method` (`email` \| `google`) |
| `sign_up` | Auth registration success | `method` (`email` \| `google`) |
| `view_place` | Place detail opened | `place_id`, `category`, `city` |
| `create_trip` | New trip created | `source` (`manual` \| `ai` \| `clone`) |
| `send_ai_prompt` | AI planner prompt sent | `has_trip_context` (`boolean`) |
| `create_booking` | Hotel/restaurant/rental booking created | `booking_type` (`hotel` \| `restaurant` \| `rental`) |
| `payment_success` | PayOS checkout completed | `currency`, `payment_method` (`payos`) |

---

## 4. Data Model & Migrations

N/A — No PostgreSQL, MongoDB, or Redis schema changes.

---

## 5. Security & Trust Boundaries

- **No PII Policy**: Event helpers must only accept whitelisted non-PII parameters. User emails, full names, phone numbers, JWTs, and raw exception strings must never be passed to `sendGAEvent` or `FirebaseAnalytics.logEvent`.
- **No Secrets in Client Env**: Only `NEXT_PUBLIC_GA_MEASUREMENT_ID` (`G-...`) is exposed to the browser; no Google Cloud Service Account keys or Measurement Protocol `api_secret` are stored in frontend or mobile code.
- **Safe Dev Fallback**: If `NEXT_PUBLIC_GA_MEASUREMENT_ID` is empty on Web, or Firebase native config is missing on Mobile, analytics becomes a silent no-op so local development and CI tests never fail.

---

## 6. Devil's Advocate & Technical Tradeoffs

| Risk / Edge Case | Impact | Mitigation / Decision |
| --- | --- | --- |
| Ad-blockers / Safari ITP block `gtag.js` | ~10–25% Web events may be dropped | Accepted for product analytics; critical revenue & booking metrics remain server-authoritative in `trip-service` and `recommendation-service`. |
| Teammate runs Flutter app without `google-services.json` / `GoogleService-Info.plist` | `Firebase.initializeApp()` throws at startup | Wrap `Firebase.initializeApp()` in `try/catch` inside `main.dart` and disable `AnalyticsService` if initialization fails, logging only in debug mode. |
| Duplicate `page_view` on Next.js App Router | Inflated view counts | Use `@next/third-parties/google` `<GoogleAnalytics />` directly in `app/layout.tsx` without manually firing duplicate `page_view` events. |

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: Web GA4 (`apps/web/tripsense`)
1. Add `NEXT_PUBLIC_GA_MEASUREMENT_ID=` to `apps/web/tripsense/.env.example`, `apps/web/tripsense/.env.local`, `env/.env.example`, `env/.env`, and `env/.env.prod`.
2. Install `@next/third-parties` in `apps/web/tripsense`.
3. Conditionally mount `<GoogleAnalytics gaId={gaId} />` in `apps/web/tripsense/src/app/layout.tsx` when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set.
4. Add `apps/web/tripsense/src/lib/analytics.ts` with typed event helpers (`trackEvent`) and unit tests (`src/lib/__tests__/analytics.test.ts`).
5. Wire `trackEvent` into key user flows (auth, places, trip creation, AI chat, bookings, PayOS return).

### Phase 2: Mobile GA4 (`apps/mobile/tripsense`)
1. Add `firebase_core` and `firebase_analytics` to `apps/mobile/tripsense/pubspec.yaml`.
2. Configure Android (`android/app/build.gradle.kts`, `google-services.json`) and iOS (`GoogleService-Info.plist`) for Firebase project `tripsense-642bd`.
3. Initialize Firebase safely in `apps/mobile/tripsense/lib/main.dart`.
4. Add `AnalyticsService` (`lib/core/analytics/analytics_service.dart`) and attach `FirebaseAnalyticsObserver` to `GoRouter` in `lib/app/app_router.dart`.
5. Add unit tests for `AnalyticsService` safe no-op behavior when uninitialized.

### Verification Commands
```bash
# Web
cd apps/web/tripsense && npm run type-check && npm run lint && npm run test

# Mobile
cd apps/mobile/tripsense && flutter analyze && flutter test
```

---

## Human Approval Gate

STATUS: WAITING_FOR_HUMAN_APPROVAL

