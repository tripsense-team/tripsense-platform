# Data Model

## Social follow graph

`social-service` owns a directed relation:

```sql
social_user_follows (
  follower_user_id UUID NOT NULL,
  followed_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_user_id, followed_user_id),
  CHECK (follower_user_id <> followed_user_id)
)
```

Add `(followed_user_id, created_at DESC, follower_user_id)` for follower/count/suggestion reads. There is no User foreign key and no persisted count in the first slice.

## Public author projection

User owns canonical public profile fields. If Social needs a local projection, it is limited to `user_id`, display name, avatar URL, profile revision, source update time, receive time and deactivation marker. It never stores email, social links, location or private profile text. Revision guards protect against out-of-order events.

## Weather cache

Weather belongs to Context, not Social snapshots/posts. A later cache keys a canonical public destination plus provider, forecast bucket and units, records fetched/expiry/error timestamps, and expires quickly. It never stores raw private itinerary coordinates.

## Public-share destination trend

After H supplies an immutable internal canonical public-destination reference, `social-service` owns an aggregate only:

```sql
social_destination_daily_stats (
  activity_date DATE NOT NULL,
  destination_ref UUID NOT NULL,
  distinct_author_count INTEGER NOT NULL,
  eligible_share_count INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (activity_date, destination_ref)
)
```

Add `(activity_date, distinct_author_count DESC, destination_ref)` for top-N reads. The aggregate stores no contributor IDs, trip IDs or coordinates; a query suppresses rows below 5 distinct authors and does not return exact counts. Qualifying signals are only active, `PUBLIC`, non-removed trip shares created on the `Asia/Ho_Chi_Minh` business day. Updates happen in the same Social transaction as a qualifying share mutation, backed by daily reconciliation; retain aggregate rows for 90 days then purge. Actual-travel aggregation is not part of this schema.

## Migrations and safety

New migrations use `VyyyyMMddHHmm__description.sql`; applied files/history are immutable. Use `IF NOT EXISTS` where PostgreSQL supports it, catalog-guard named constraints, and fail a preflight on incompatible existing definitions. Take a logical backup before data-changing migrations. Never delete Flyway history to force a shared environment forward.

## Prohibited patterns check

- No cross-service JPA relationships.
- No direct access to another service database.
