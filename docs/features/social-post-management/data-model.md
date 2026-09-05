# Data Model

## Owning Service

Proposed `social-service`, database `tripsense_social`, Flyway, and `ddl-auto: validate`.

## Schema

- `social_posts`: UUID ID, external `author_id`, approved author snapshot/projection fields, content, nonnegative `like_count`/`comment_count`, `idempotency_key`, created/updated/deleted fields. A partial unique index on `(author_id, idempotency_key)` makes create retries race-safe.
- `social_post_media`: UUID ID, local post FK, Cloudinary public ID, secure URL, resource type/format/dimensions, `sort_order`; unique `(post_id, sort_order)` and `(post_id, public_id)`.
- `social_post_likes`: local post FK, user ID, timestamp; primary key `(post_id,user_id)`.
- `social_comments`: UUID ID, local post FK, nullable self `parent_comment_id`, external author ID/projection, content, nonnegative like count, timestamps and tombstone fields.
- `social_comment_likes`: local comment FK, user ID, timestamp; primary key `(comment_id,user_id)`.

There are no foreign keys to user-service or Cloudinary.

## Indexes

- Visible feed: `(created_at DESC, id DESC)` partial on active posts.
- Visible user posts: `(author_id, created_at DESC, id DESC)` partial on active posts.
- Comments: `(post_id, created_at, id)` and `(post_id, parent_comment_id, created_at, id)`.

## Transactions

- Create post and media in one transaction after Cloudinary verification.
- Soft-delete posts transactionally; filters make deleted posts 404.
- Conditional like insert/delete and counter changes are atomic and idempotent.
- Comment creation validates parent/post and increments the post counter atomically.

Comment deletion, when UI supports it, tombstones the comment without deleting descendants. Network Cloudinary work never occurs in a DB transaction.
