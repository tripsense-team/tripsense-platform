# AI Proposal Suggested Places Carousel & Trip Ideas Integration — Specification

`STATUS: DONE`

- **Human Approval**: Approved by user on 2026-11-25 (`"Oke giờ bạn tiến hành implements miễn sao tốt nhất tối ưu nhất là được"`).
- **Completed**: 2026-11-25.
- **Owner Services**:
  - `services/ai-service`: Zero-latency complementary `suggestedPlaces` extraction in `createTripProposal` from `PlaceGroundingStore`.
  - `apps/web/tripsense`: Render complementary `PlaceCards` carousel below proposals, wire `+` action to Trip Ideas (`PUT/DELETE /api/trips/{tripId}/places/{placeRef}`), and display/manage live Trip Ideas (`GET /api/trips/{tripId}/places`) across `MindtripItineraryView`, `TripDetailPanel`, `TripDetailScreen`, and `AddItemDialog`.
  - `services/trip-service`: Reuses existing `TripPlaceController` (`PUT/DELETE /api/trips/{tripId}/places/{placeRef}`, `GET /api/trips/{tripId}/places`, `POST /api/trips/place-memberships:batch`) with zero backend schema/endpoint changes required.

---

## 1. Requirements & Acceptance Criteria
1. Every `createTripProposal` response with grounded candidates in `PlaceGroundingStore` returns up to 8 complementary `suggestedPlaces` (strictly excluding all places already included in the itinerary `days`, balanced across categories with verified photos/ratings) with **0ms additional latency** and **0 extra LLM calls**.
2. `PreviewMessage` renders `suggestedPlaces` as a horizontal `PlaceCards` carousel at the bottom of the proposal message (below `ItineraryPreview`, practical tips, and quick refinement chips).
3. Clicking `+` on any card in `PlaceCards` saves/removes the place in the trip's **Ideas pool** (`PUT /api/trips/{tripId}/places/{placeRef}` / `DELETE /api/trips/{tripId}/places/{placeRef}`) instead of inserting directly into an itinerary day, highlights the currently active linked trip at the top of the trip selector, hydrates saved membership state, and dispatches `tripsense:trip-ideas-updated`.
4. `MindtripItineraryView`, `TripDetailPanel` (`Ý tưởng` tab), `TripDetailScreen`, and `AddItemDialog` (`Gợi ý` tab) display live Trip Ideas via `listTripPlaces(tripId)` with hydrated photos, allow promoting an idea into any itinerary day (`createItineraryItem`), and allow removing an idea (`removePlaceFromTrip`).

## 2. Implementation Tasks
- [x] **1. `services/ai-service`**: Added `selectComplementarySuggestedPlaces` in `place-grounding.ts`, attached `suggestedPlaces` to `createTripProposal` output & persisted payload, added unit tests (**72/72 passed**).
- [x] **2. `apps/web/tripsense` (Chat & Carousel)**: Updated `TripProposal` type, rendered `suggestedPlaces` carousel in `message.tsx`, passed `activeTrip` from `shell.tsx` → `messages.tsx` → `message.tsx` → `place-cards.tsx`, switched `PlaceCards` `+` action to `addPlaceToTrip`/`removePlaceFromTrip` + `tripsense:trip-ideas-updated`.
- [x] **3. `apps/web/tripsense` (Trip Ideas UI)**: Added `useTripIdeas` hook, wired live Ideas strip in `MindtripItineraryView`, live `Ý tưởng` tab in `TripDetailPanel`, live Ideas integration in `TripDetailScreen`, and Trip Ideas priority section in `AddItemDialog`.
- [x] **4. Verification**: EN/VI `i18n:check` passed, `type-check` passed, `eslint` 0 errors, Vitest **30/30 files (145/145 tests)** passed, `next build` passed (48/48 routes).
