# Group B — Feature Completion (Traveler Companion & Service Trust Suite)

`STATUS: IMPLEMENTED`

- **Owner Service**: `apps/web/tripsense`, `services/trip-service`, `services/social-service`
- **Affected Components**: `apps/web/tripsense`, `services/trip-service`
- **Date**: 2026-10-12
- **Related Plans**: `feature-priority-roadmap.md` (Group B items B03, B05, B06, B07, B08, B09, B10, B11, B12)

---

## 1. Goal & Requirements

### 1.1 Problem Statement
Having implemented B01 (Vouchers), B02 (Unified Notification Center), and B04 (PDF/ICS Itinerary Export), the remaining items in Group B complete the real-world traveler utility and service trust experience:
1. **B06 — Trip Checklist**: Packing & preparation to-do lists organized by category with checklist completion state per trip.
2. **B07 — Activity Voting & Ideas Poll**: Group activity proposal with upvoting/downvoting and direct addition to itinerary days.
3. **B08 — Clone Trip**: Ability to duplicate a public or personal trip into a new planning itinerary with custom dates.
4. **B05 — Offline Itinerary Snapshot**: Automatic client caching with sync timestamp for offline access.
5. **B03 — Trip Reminders**: Customizable reminders before departure and activity times.
6. **B12 — Destination Safety & Emergency Guide**: Emergency contacts (113, 115, 114) and local travel safety tips.
7. **B09 — Guide Availability Schedule**: Visual calendar of available dates and booking status for local guides.
8. **B10 — Verified Stay Reviews & Partner Replies**: Verified customer stay badge and official partner response section on reviews.
9. **B11 — Direct Booking Support Request**: Pre-filled contextual support dialog directly from a booking hold or confirmed stay.

### 1.2 In-Scope & Out-of-Scope
- **In-Scope**:
  - Reusable components and modals integrated directly into `TripDetailScreen`, `TripsScreen`, `CommunityReviewsSection`, `PublicGuideProfileView`, and `HotelCheckoutReview`.
  - 100% EN/VI translations and schema parity.
  - Zero-leak error handling.

---

## 2. Architecture & Service Boundaries

- Client-side state and persistence for traveler companion tools (`TripChecklist`, `TripActivityPoll`, `TripSafetyGuide`, `CloneTrip`, `TripReminderModal`).
- Integration with existing backend services (`trip-service`, `social-service`).

---

## 3. Verification Evidence

- **B06 Trip Checklist**:
  - Component `TripChecklistModal.tsx` with progress bar, presets, category grouping, and localStorage persistence.
  - Tests in `trip-checklist-modal.test.tsx`.
- **B07 Activity Voting & Ideas Poll**:
  - Component `TripActivityPollModal.tsx` with up/down voting and "Pin to Day" action.
  - Tests in `trip-activity-poll-modal.test.tsx`.
- **B08 Clone Trip**:
  - Utility `clone-trip.ts` copying trip metadata and iterating days/activities.
  - Menu options on `TripPoster` card in `TripsScreen` and `TripDetailScreen`.
  - Tests in `clone-trip.test.ts`.
- **B05 Offline Itinerary Snapshot**:
  - Synchronous localStorage cache in `loadDetail` (`trip-management-view.tsx`) with automatic recovery and fallback when offline.
- **B03 Trip Reminders**:
  - Modal `TripReminderModal.tsx` configuring notification intervals per trip.
- **B12 Safety Guide & Emergency Hotlines**:
  - Modal `TripSafetyGuideModal.tsx` with national hotlines (113, 115, 114) and tourist hotlines.
- **B09 Guide Availability Calendar**:
  - Weekly schedule and service confirmation badges in `PublicGuideProfileView.tsx`.
- **B10 Verified Stay & Partner Reply**:
  - Verified Stay badge and partner official reply quote block in `CommunityReviewsSection.tsx`.
- **B11 Direct Booking Support Ticket**:
  - Dialog `BookingSupportDialog.tsx` in `HotelCheckoutReview.tsx` pre-filling booking references to `POST /api/partner-support-cases`.
  - Tests in `booking-support-dialog.test.tsx`.
- **Localization**:
  - 100% schema parity across `en.json` and `vi.json`.

