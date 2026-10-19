# Partner Hotel Check-in AM/PM — Specification & Implementation Plan

`STATUS: IMPLEMENTING`

- **Owner Service**: `apps/web/tripsense` (presentation only; hotel data remains owned by `services/trip-service`)
- **Affected Components**: `apps/web/tripsense`, existing hotel property APIs
- **Created Date**: 2026-10-19
- **Target PR Boundaries**: One web-only change

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal

The partner hotel property form currently uses native `input[type=time]`, which is rendered as 24-hour time in the user's browser. The partner wants check-in and check-out times to be entered and understood in AM/PM format.

### 1.2 User Flow

1. Partner opens the existing hotel property form.
2. Partner scrolls/selects check-in and check-out in one native time picker displaying AM/PM.
3. The form converts the choice to the existing `HH:mm` value before submitting.
4. Existing property details and booking displays format the stored value as a localized 12-hour time with AM/PM.

### 1.3 Scope Boundaries

- **In-Scope**:
  - Use one native time picker per field, with `en-US` rendering for the 12-hour AM/PM display and scroll selection.
  - Format displayed property check-in/out times consistently as AM/PM.
  - Reuse one shared formatter/control for the existing hotel workspace rather than duplicate conversion logic.
  - Keep the property time zone and existing `HH:mm` API/storage contract.
- **Out-of-Scope**:
  - Changing booking date/time semantics, hotel time-zone rules, database schema, API DTOs, or stored values.
  - Changing customer date selection or unrelated time controls.

### 1.4 Acceptance Criteria

- [ ] AC-1: Partner can scroll/select check-in/out in one native field displaying `h:mm AM/PM`.
- [ ] AC-2: `12:00 AM` maps to `00:00`, `12:00 PM` maps to `12:00`, and other values convert correctly to/from `HH:mm`.
- [ ] AC-3: Submitting and reloading a property preserves the same time and renders it in AM/PM format.
- [ ] AC-4: Existing API payloads and persisted values remain `HH:mm`; no backend or migration changes are needed.
- [ ] AC-5: The control is keyboard accessible and has Vietnamese and English labels.

## 2. Architecture & Service Boundaries

The change is presentation-only in the existing partner hotel web flow. The web app continues calling the existing API Gateway and Trip Service contracts. Trip Service remains the source of truth for property check-in/out times. No service boundary or asynchronous integration changes.

## 3. API & Event Contracts

No API or event changes. Existing create/update requests continue sending `checkInTime` and `checkOutTime` as `HH:mm` strings, for example `14:00` and `11:00`.

## 4. Data Model & Migrations

No schema, migration, or stored-value changes. Conversion occurs at the UI boundary only.

## 5. Security & Trust Boundaries

Existing authenticated partner routes and server-side business ownership/capability checks remain unchanged. The client-side time control does not grant or change access.

## 6. Devil's Advocate & Technical Tradeoffs

- Keep canonical `HH:mm` values to avoid changing APIs, booking behavior, or historical property records.
- Set the time input language to `en-US` so the native picker presents AM/PM while retaining its canonical `HH:mm` value.
- Handle noon and midnight explicitly; add conversion tests to avoid AM/PM boundary errors.
- Format using the property's existing time-only value; do not convert it through a JavaScript `Date`, which could shift the hour by time zone.

## 7. Implementation Tasks & Verification

1. Add a shared, typed conversion/formatting helper and reusable accessible 12-hour control in the existing hotel feature.
2. Integrate it into the partner hotel property creation/edit presentation and the existing property time summary.
3. Add unit tests for conversion boundaries and UI tests for selecting AM/PM and preserving the `HH:mm` request value.
4. Add bilingual i18n labels with English/Vietnamese key parity.
5. Verify with focused hotel tests, `npm run i18n:check`, `npx tsc --noEmit`, and lint in `apps/web/tripsense`.

### Implementation Record — 2026-10-19

- Added one shared native time picker field with AM/PM display in the web hotel feature; both partner hotel registration flows now use it.
- Requests and stored property times remain `HH:mm`; no API, service, or database changes.
- Type-check passed. Targeted lint completed with zero errors and existing warnings in `partner-hotel-workspace.tsx`.
- `npm run i18n:check` is currently blocked because both locale files are not globally sorted. The added AM/PM labels are present in both locales.
- Unit/UI tests were not added or run in this pass.

`STATUS: IMPLEMENTING`
