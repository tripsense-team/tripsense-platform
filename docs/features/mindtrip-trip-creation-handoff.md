# Mindtrip-Style Trip Creation & AI Planner Handoff — Specification & Implementation Plan

`STATUS: APPROVED`

- **Owner Service**: `services/trip-service`, `services/ai-service`
- **Affected Components**: `apps/web/tripsense`
- **Created Date**: 2026-10-12
- **Related Plans**: `ai-conversational-trip-intake-auto-commit.md`, `chat-to-trip-handoff.md`

---

## 1. Goal & Requirements

### 1.1 Problem Statement
Users want to initiate trip planning directly from the Trips workspace (`/trips` or sidebar "Create a trip") through an intuitive Mindtrip-style intake modal:
1. Free-form text area (up to 2000 characters) with character counter and voice icon.
2. Structured details with clear sub-selectors:
   - **Where**: Destination selection with search and suggestions.
   - **When**: Start and end date range selection with duration presets.
   - **Who**: Sub-dialog breakdown matching Image 3 with counters for Adults (13+), Children (2–12), Infants (<2), and Pets (with service animal note).
   - **Budget**: Tiered budget options (Any, On a budget, Sensibly priced, Upscale, Luxury) or custom amount.
3. Upon clicking **Create**, the trip is created in `trip-service` via `POST /api/trips`, and the user is handed off smoothly to the AI Planner (`/ai-planner?tripId={id}`), with the initial prompt immediately enqueued and processed by the AI.

### 1.2 In-Scope & Out-of-Scope
- **In-Scope**:
  - Modal UI matching Mindtrip.ai (Screenshots 2 and 3).
  - Add trip entry point on `/trips` (`TripSharingWorkspace`) and `/trips/new`.
  - Handoff from `/trips` to `/ai-planner` with `?tripId=` and initial prompt persistence.
  - Automatic prompt submission to the AI in `/ai-planner` when handed off.
  - Localization in English and Vietnamese with 100% key parity.
- **Out-of-Scope**:
  - Modifying backend schemas or creating new database tables (existing `POST /api/trips` and AI chat endpoints cover all fields).
  - Third-party speech-to-text integration for the voice icon (icon remains visual cue for now).

### 1.3 Acceptance Criteria
- [x] **AC-1**: Clicking "+ Add Trip" in `/trips` or visiting `/trips/new` opens the Mindtrip-style creation modal.
- [x] **AC-2**: The modal displays the user's greeting name, prompt textarea (0/2000 chars), Where, When, Who, and Budget rows.
- [x] **AC-3**: Clicking "Who" opens a sub-dialog with Adults, Children, Infants, Pets counters and an "Update" button.
- [x] **AC-4**: Clicking "Budget" allows selecting budget tiers or entering a custom amount.
- [x] **AC-5**: Submitting "Create" calls `POST /api/trips` with `travelerCount`, `budgetAmount`, `budgetCurrency`, and `notes`.
- [x] **AC-6**: After creation, user is redirected to `/ai-planner?tripId={id}` and the prompt is automatically sent to the AI.

---

## 2. Architecture & Service Boundaries

- **`trip-service`**: Authoritative owner of the Trip record. Reuses `POST /api/trips`.
- **`ai-service`**: Orchestrates chat and planning generation once handed off.
- **`apps/web/tripsense`**: Hosts `CreateTripModal`, integrates `WhoModal` & `BudgetModal`, handles `sessionStorage` prompt passing to `ChatShell`.

---

## 3. Data Contracts

Reuses existing `CreateTripRequest`:
```json
{
  "name": "Trip to Tokyo",
  "destinationName": "Tokyo",
  "startDate": "2026-10-15",
  "endDate": "2026-10-20",
  "travelerCount": 2,
  "budgetAmount": 5000000,
  "budgetCurrency": "VND",
  "notes": "5-day Tokyo trip this October"
}
```

---

## 4. Verification Plan
- Unit tests for `CreateTripModal` with Who and Budget sub-dialogs.
- TypeScript type-check and i18n parity check.
