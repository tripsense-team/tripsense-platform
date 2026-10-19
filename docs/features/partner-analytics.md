# Partner Analytics — Specification & Implementation Plan

`STATUS: IMPLEMENTING`

- **Revision**: Scope expansion requested 2026-10-19; replaces the restaurant-only analytics scope approved earlier.
- **Owner Service**: `services/trip-service` (partner businesses, restaurant reservations, hotel bookings, and partner finance ledger)
- **Affected Components**: `services/trip-service`, `services/api-gateway`, `apps/web/tripsense`
- **Related Features**: [Financial Flow & Withdrawals](./financial-flow-and-withdrawals.md), [Restaurant Booking Availability Engine](./restaurant-booking-availability-engine.md), [Partner Services Hub Navigation](./partner-services-hub-navigation.md)

## 1. Goal & Requirements

### 1.1 User Goal

Show one Partner analytics dashboard for all businesses the signed-in partner manages, with a per-business view, trend charts, booking outcomes, expected guests, and trustworthy revenue where the system has an authoritative settlement record. The current page filters to restaurants, so it omits the user's hotel/guesthouse.

### 1.2 User Flows

1. Partner opens `/partner/analytics`; the default selection is **All businesses** and the page includes each active business they own/manage.
2. Partner can select one business to inspect its metrics or keep all businesses selected for a summary.
3. Partner selects 7, 30, or 90 days and sees daily views/bookings and settled partner earnings where supported.
4. Metrics unavailable for a business kind are labeled unavailable, never presented as a misleading zero.

### 1.3 Scope

- **In scope**:
  - Include active businesses where the current user is an active OWNER or MANAGER, including restaurants and hotels.
  - Keep restaurant metrics and definitions already implemented: deduplicated public views; reservation requests; confirmation and cancellation rates; upcoming expected guests.
  - Add daily time-series for views and booking requests/bookings, with a previous-period comparison for summary values.
  - Add revenue as **partner earnings settled**: sum positive `financial_ledger_entry` rows with `entry_type='BOOKING_SETTLEMENT'`, by ledger date. This is the partner's net settlement after the platform commission. Exclude demo settlement events, unpaid bookings, pending escrow, refunds, and withdrawals. Do not call gross booking value or platform revenue “partner revenue.”
  - Add a combined All businesses summary and a per-business breakdown. Rate totals must aggregate raw numerators and denominators, then divide; never average per-business percentages.
  - Show revenue as unavailable for restaurants or other business types without an authoritative settlement ledger. Hotel revenue is zero only when the source has no qualifying settled ledger rows.
  - Exclude user/customer identities and booking-level rows from analytics responses.
- **Out of scope**:
  - Forecasted revenue, gross sales, payment-service aggregation, platform commission revenue, demographic/customer analytics, exports, real-time streaming, and new payment flows.
  - Invented hotel page-view counts: existing public hotel discovery records are not yet linked to partner-business view tracking. Hotel views remain “unavailable” until a separately verified tracking source exists.

### 1.4 Acceptance Criteria

- [ ] AC-1: All businesses are listed only from authenticated active OWNER/MANAGER memberships; the default All businesses view covers exactly those IDs.
- [ ] AC-2: A partner can select a single business or All businesses; one hotel and one restaurant both appear in the user's account.
- [ ] AC-3: Summary cards and charts support 7, 30, and 90 day ranges and return daily points with zero-filled dates only where the metric is supported.
- [ ] AC-4: Restaurant views remain session/day deduplicated. Hotel views are clearly unavailable, not fabricated as zero.
- [ ] AC-5: Restaurant and hotel booking series use each flow's authoritative booking table and documented status/date rules; pending holds are not treated as completed bookings.
- [ ] AC-6: Confirmation/cancellation rates aggregate numerator and denominator across included restaurant requests and are not averaged from percentages.
- [ ] AC-7: Revenue equals qualifying settled partner-ledger credits only; demo settlements, unpaid/held bookings, escrow, refunds, and withdrawals are excluded.
- [ ] AC-8: Businesses with no revenue-capable settlement source display “Unavailable for this business type”; a supported source with no settled records displays zero.
- [ ] AC-9: All business IDs are ownership-checked server-side; responses contain aggregates only and no customer data or booking IDs.
- [ ] AC-10: UI labels distinguish “expected guests” from reservation count and distinguish settled partner earnings from gross sales; VI/EN and safe loading/error states are maintained.

## 2. Architecture & Service Boundaries

```text
[Partner Analytics UI] -- authenticated REST --> API Gateway --> Trip Service --> Trip DB
  all-businesses and per-business summaries/charts
```

Trip Service already owns partner memberships, restaurant reservations, hotel bookings, and the financial ledger. Keep aggregation there; do not call another service database or create a new microservice. Public restaurant view tracking remains a Gateway-routed write. Hotel view analytics are not reported until there is an eligible business-linked public detail tracking contract.

## 3. API & Contracts

### 3.1 Endpoints

| Method | Gateway path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/restaurants/{businessId}/views` | Public, rate-limited | Existing idempotent restaurant view capture |
| `GET` | `/api/partners/analytics?periodDays=30` | OWNER/MANAGER | Summary and chart series over all accessible businesses; accepts optional `businessId` for one business |

The current `GET /api/partners/businesses/{id}/analytics` may remain as a compatibility wrapper over the same aggregation service during rollout.

Response shape (abbreviated):

```json
{
  "period": { "days": 30, "from": "2026-09-20", "toExclusive": "2026-10-20" },
  "scope": "ALL",
  "totals": {
    "views": { "available": true, "value": 18 },
    "bookings": 12,
    "expectedGuests": 10,
    "confirmationRate": { "numerator": 5, "denominator": 6, "value": 0.8333 },
    "cancellationRate": { "numerator": 1, "denominator": 5, "value": 0.2 },
    "settledPartnerEarnings": { "available": true, "currency": "VND", "amount": 1250000 }
  },
  "daily": [{ "date": "2026-10-19", "views": 2, "bookings": 1, "settledPartnerEarnings": 0 }],
  "businesses": [{ "businessId": "uuid", "displayName": "...", "kind": "RESTAURANT", "metrics": {} }]
}
```

Use explicit availability metadata for metrics unsupported by a business kind. If the selected set includes a mix of supported and unsupported revenue sources, totals sum only supported values and report coverage (supported business count / accessible business count); per-business rows retain availability. All date buckets use the business timezone, and all-business date buckets use each business's local date before combining the same calendar date.

## 4. Data Model & Query Rules

- No new aggregate table is required for the first release; query existing Trip Service-owned booking, transition, view-dedupe, and financial-ledger data. Add indexes only when query plans show a need.
- Restaurant booking series: requests by `created_at`; expected guests: adults + children for future, unexpired `REQUESTED` and `CONFIRMED` reservations, following the existing 30-day window.
- Hotel booking series: count only persisted bookings that reached `CONFIRMED`, `CHECKED_IN`, or `CHECKED_OUT`, by booking creation time; exclude `HELD` and cancelled bookings from completed/accepted booking count. Expected guests use upcoming confirmed bookings only.
- Settled earnings: `SUM(amount)` for `BOOKING_SETTLEMENT` ledger entries grouped by `created_at` and `business_id`. Explicitly exclude `BOOKING_DEMO_SETTLED`, `BOOKING_SETTLEMENT` is idempotently written only after checkout and a PAID payment in current code.
- The current view dedupe table remains the restaurant view source. No historical backfill is possible; chart starts at deployment.
- Aggregation must be bounded to authorized business IDs and requested periods. Avoid per-business N+1 queries; use bounded grouped queries.

## 5. Security & Trust Boundaries

- Require verified JWT for analytics. Resolve accessible business IDs from active memberships and OWNER/MANAGER roles; never trust a client-supplied list of IDs.
- If optional `businessId` is outside the current user's membership, return not-found semantics.
- Do not expose account details, customer IDs, booking IDs, email, phone, notes, or raw ledger descriptions.
- Use stable safe error codes and the repository's error sanitization rules.
- Public view ingestion remains rate-limited and stores only hashed opaque session keys.

## 6. Trade-offs & Open Points

| Topic | Decision |
|---|---|
| Two different business kinds | Include both. Display per-kind metric availability instead of coercing unlike data or hiding the hotel. |
| Revenue meaning | Use settled partner net earnings from the ledger. Gross paid sales and pending escrow are not partner earnings. |
| Demo records | Exclude demo settlement events even if they appear in a demo booking flow. |
| Mixed all-business revenue | Sum only settlement-capable businesses and show coverage so a partial total is not mistaken for all-business revenue. |
| Hotel views | Not available from current linked tracking data; keep unavailable until linkage is implemented and verified. |
| “10 expected guests” | Current data query finds 5 confirmed reservations totaling 10 guests for the next 30 days; it is not 10 pending reservation requests. The value is database-derived, not hardcoded. No matching seed insert exists in the repository; database provenance cannot prove whether an operator manually entered demo bookings. |

## 7. Implementation & Verification Tasks

1. [x] Confirm revised metric semantics and mixed-source revenue coverage.
2. [x] Add authenticated all-business/per-business summary and daily-series API in Trip Service, using existing view, reservation, hotel booking, and settlement ledger sources.
3. [x] Confirm the API Gateway's existing `/api/partners/**` route covers the dashboard endpoint; no additional route or security exception is needed.
4. [x] Update Partner Analytics UI with All businesses and per-business selection, business breakdown, trend charts, revenue coverage, unavailable labels, and EN/VI parity.
5. [ ] Add unit/integration tests for authorization, aggregation, empty dates, hotel/restaurant status rules, and demo settlement exclusion.
6. [ ] Compile backend and complete architecture, database, security, and PR reviews before marking DONE. Frontend type-check and i18n checks pass; backend compilation could not run because this environment has no Java Runtime.

## Human Approval Gate

The revised multi-business scope was explicitly approved by the user on 2026-10-19.

```text
STATUS: IMPLEMENTING
```
