# API

All routes are authenticated and Gateway-routed.

```http
GET   /api/context/onboarding
PUT   /api/context/onboarding                 # optimistic version required
POST  /api/context/onboarding/complete         # idempotency key
DELETE /api/context/onboarding                 # answers and derived signals
GET   /api/context/preferences?purpose=TRIP_PLANNING
PUT   /api/users/profile                       # basic display name/avatar only
GET   /api/users/me/onboarding-gate            # authenticated eligibility flag only
POST  /api/users/me/onboarding-gate/complete   # idempotent internal/browser completion acknowledgement
```

`OnboardingProfile` has `version`, `schemaVersion`, `status`, `completedAt`, and typed groups: `places`, `travelStyle`, `stay`, `food`, `activities`, `freeTextNote?`, and explicit `consents`. There is no voice/personality field. Important locations are a distinct encrypted resource and are not returned by the normal AI preference endpoint.

Validation: max 20 destinations per list, max 20 activity/food/stay selections per group, max 2,000 characters of free text, valid enum values, canonical destination references only, and an `If-Match`/version conflict returns `409`.

`GET /api/context/onboarding` is a read-only status endpoint for the gate and must not create a profile. `POST /api/context/onboarding/start` creates `IN_PROGRESS` only for a gate-eligible authenticated account. Individual question skips are submitted as absent values; there is no “skip onboarding” completion endpoint.

The AI endpoint returns only values allowed for the requested purpose plus metadata `{source, confidence, updatedAt}`. It never returns raw interview text, exact locations, consent history, OAuth tokens or loyalty identifiers.
