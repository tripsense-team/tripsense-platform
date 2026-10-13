# Unified Notification Center — Specification & Implementation Plan

`STATUS: IMPLEMENTED`

- **Owner Service**: `apps/web/tripsense`, `services/trip-service`, `services/social-service`
- **Affected Components**: `apps/web/tripsense`, `services/trip-service`, `services/api-gateway`
- **Date**: 2026-10-12
- **Related Plans**: `feature-priority-roadmap.md` (Item B02), `chat-notifications-and-unread-badge.md`, `collaborative-itinerary-editing.md`, `hotel-management-and-booking.md`

---

## 1. Goal & Requirements

### 1.1 Problem Statement
Currently, notifications in TripSense are fragmented across disconnected screens:
1. Trip invitations (`/api/trips/invitations/pending`) are only visible if the user navigates directly to the invitation preview.
2. Hotel reservation updates (`/api/hotels/notifications`) are isolated on `/hotels/notifications`.
3. Partner and business review notices (`/api/partners/notifications`) are confined to the Partner portal.
4. Chat unread summaries (`/api/social/chat/unread-summary`) only appear on the chat navigation item.
5. In the top navbar (`UserHeader`), the notification bell button is static with a hardcoded dot and cannot be clicked to see actual alerts.

The goal of this feature is to deliver a cohesive **Unified Notification Center**:
- Replace the static bell icon with a live interactive popover displaying accurate aggregate unread counts.
- Aggregate alerts across Trips (collaboration invitations), Bookings (hotel holds, payments, cancellations), Partner operations, and Chat.
- Provide inline quick actions (e.g. Accept / Decline a trip invitation directly from the notification item).
- Offer a dedicated full-page view at `/notifications` for history management.
- Provide a single-click "Mark all as read" capability.

### 1.2 In-Scope & Out-of-Scope
- **In-Scope**:
  - Unified data model `UnifiedNotificationItem` and aggregate hook `useUnifiedNotifications`.
  - Adding `POST /api/hotels/notifications/read-all` and `POST /api/partners/notifications/read-all` to `trip-service`.
  - Notification popover component `NotificationCenter` embedded in `UserHeader`.
  - Dedicated `/notifications` page with category filtering (All, Trips, Bookings, System).
  - 100% EN/VI localization.
- **Out-of-Scope**:
  - WebSockets / push notification overhaul (reuses existing background polling and local events).
  - External SMS or email broadcast configuration.

---

## 2. Architecture & Service Boundaries

- **`services/trip-service`**: Owns hotel notifications, trip invitations, and partner notifications.
- **`services/social-service`**: Owns chat message unread summary.
- **`apps/web/tripsense`**: Aggregates the read streams into a normalized notification inbox.

---

## 3. Data Contracts & APIs

- `POST /api/hotels/notifications/read-all`: Marks all hotel notifications as read for current user.
- `POST /api/partners/notifications/read-all`: Marks all partner notifications as read for current user.
- Existing endpoints reused:
  - `GET /api/trips/invitations/pending`
  - `POST /api/trips/invitations/{id}/accept`
  - `POST /api/trips/invitations/{id}/decline`
  - `GET /api/hotels/notifications`
  - `POST /api/hotels/notifications/{id}/read`
  - `GET /api/partners/notifications`
  - `POST /api/partners/notifications/{id}/read`
  - `GET /api/social/chat/unread-summary`

---

## 4. Verification Evidence

- **Backend**:
  - `HotelService.java` & `HotelController.java`: added `/notifications/read-all`.
  - `PartnerNotificationService.java` & `PartnerNotificationController.java`: added `/read-all`.
- **Frontend**:
  - `useUnifiedNotifications.ts`: aggregate hook querying trip invitations, hotel alerts, partner notices, and chat summary with 60s background polling.
  - `NotificationCenter.tsx`: interactive popover with category filtering (All, Trips, Bookings, Messages), unread badge, and quick trip invitation accept/decline actions.
  - `user-header.tsx`: integrated `NotificationCenter` replacing static bell placeholder.
  - `/notifications` page: full-page history and filter view.
  - Unit tests in `notification-center.test.tsx`.
- **Localization**:
  - `notifications` domain namespace added with 100% parity across `en.json` and `vi.json`.

  - `POST /api/partners/notifications/{id}/read`
  - `GET /api/social/chat/unread-summary`

---

## 4. Verification

- Backend tests in `trip-service`.
- Frontend tests in `notification-center.test.tsx`.
- Schema parity and type-check: `npm run i18n:check`, `npm run type-check`.
