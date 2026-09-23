# Data Model

## Owner

`context-service` owns onboarding and preference data in its own PostgreSQL database. `user-service` owns identity, display name and consent records. Exact important locations, if approved, are encrypted User-owned data and not Context rows.

## Schema

- `onboarding_profiles`: `user_id` external UUID, `version`, `status` (`IN_PROGRESS`, `COMPLETED`), completion timestamps, `schema_version` and consent revision. Absence represents `NOT_STARTED`; this is the optimistic-lock aggregate root.
- `preference_dimensions`: a versioned catalog of backend-owned stable codes, cardinality and sensitivity class (for example `TRAVEL_PARTY`, `DIETARY_RESTRICTION`, `BUDGET_TIER`). New fields are introduced by adding a catalog code, not by altering existing answers.
- `onboarding_selections`: `profile_id`, `dimension_code`, `value_code`, optional `source`, timestamps; unique `(profile_id, dimension_code, value_code)`. It holds enumerated/multi-select answers and has no voice dimension.
- `onboarding_attributes`: `profile_id`, `attribute_code`, validated JSON value, `value_schema_version`, sensitivity class and timestamps; unique `(profile_id, attribute_code)`. It is reserved for bounded scalar/structured fields that cannot be an enum, never arbitrary client JSON.
- `onboarding_places`: `profile_id`, canonical `place_ref`, `intent` (`VISITED`, `WANT_TO_VISIT`), timestamps; unique `(profile_id, place_ref, intent)`.
- `preference_signals`: `user_id`, dimension/value, confidence, source (`ONBOARDING`, later `OBSERVED`), source version, expiry/review timestamp. This is the only normal input to AI.
- `onboarding_free_text`: encrypted optional text, encryption key reference, purpose consent and retention deadline; no full-text index.
- `outbox_events`: transactional versioned `PreferenceProfileChanged` events.

Indexes: `(user_id)` unique profile lookup; `(profile_id, dimension)` selections; `(user_id, dimension, updated_at DESC)` signals; destination/intent lookup. No foreign keys cross services.

## Retention

Typed preferences persist until edited/deleted. New dimensions/attributes are additive and old codes remain readable for backward compatibility. Raw free text expires under the approved retention setting. Event payloads contain only user ID, profile version and changed dimensions.

`user_profiles.onboarding_required` is no longer authoritative for access. A rollout migration may set it to `true` for observability/backward compatibility, but the Context lifecycle is the gate: absence is `NOT_STARTED`, not an exemption. All local and Google accounts must create or resume Context onboarding before accessing main routes.
