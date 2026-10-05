# Implementation Plan

Implementation may start only when the feature status is `APPROVED`.

## Tasks

1. Reproduce P0 with a disposable authenticated account; record Gateway/Trip/Social status and correlation-safe logs.
2. Repair P0 error separation/retry/pagination and exact downstream error mapping; add browser/integration regression tests.
3. Add User Community display-name/avatar contract and migration. Generate a non-email handle for legacy accounts without a display name.
4. Repair Community author output so it does not derive a public identity from stored email/private profile data.
5. Add Social follow graph/API/UI, explicit authenticated route matchers, actor-based rate limits and deterministic cursor-paginated suggestions.
6. Implement/approve the Place public-destination contract, including an immutable internal public destination reference and label/image projection.
7. Add the Social public-share daily aggregate, threshold suppression, reconciliation, trend endpoint and rail UI labelled “Được cộng đồng chia sẻ nhiều hôm nay”.
8. Build Context weather provider/cache/API and only then replace the rail unavailable state with live data.
9. Do not implement actual-visit trends without a separately approved opt-in Trip event and Context aggregate plan.

## Sequencing

P0 -> E -> F -> H -> I -> J. Each slice has an independent Gateway/integration release gate. Do not start later slices early merely to make the rail look complete.

## Likely files affected

- `apps/web/tripsense/src/features/social-post/**`
- `apps/web/tripsense/src/features/trip-management/**`
- `services/social-service/**`, `services/user-service/**`, `services/api-gateway/**`
- Later: `services/place-service/**` and new/approved `services/context-service/**`

## Stop conditions

Stop and request a planning revision if the chosen public profile fields, destination semantics, Context-service ownership, blocking policy, or a new service/API contract changes.
