# Requirements

## User Goal

Use the existing Community UI with real backend data. An API failure, empty result, unauthorized response, or missing post must never be replaced by mock data.

## Confirmed UI Contract

| Frontend field | Backend response | Persisted source | Required |
| --- | --- | --- | --- |
| `SocialPost.id` | `id` | `social_posts.id` | Yes |
| `author.id/name/avatar/email` | `author` | author ID plus approved profile projection/snapshot | `id`, `name` yes; others optional |
| `content`, timestamps | same | `social_posts` | content/created yes |
| `mediaUrls` | ordered URL array | `social_post_media.secure_url` | Optional |
| `likeCount`, `commentCount`, `isLiked` | same | counters/reaction tables and current viewer | counts yes; viewer flag optional |
| `PostComment.parentId` | same, flat list | `social_comments.parent_comment_id` | Optional root-null |
| comment author/content/timestamp/likes | same | comment plus approved profile source | required except viewer flag |

Unused by the present renderers: post `updatedAt`, author email, comment `children`, and persisted `replyToAuthorName`.

## Acceptance Criteria

- Feed returns newest-first page `{items,total,page,size,hasMore}`; `200` plus no items renders EmptyState.
- Detail returns `404` for absent or soft-deleted posts and the UI renders Not Found from structured status.
- Authenticated users can create text-only, image-only, or mixed posts; returned posts prepend directly to the feed.
- Post/comment likes are one-per-user, concurrency-safe, and return `{liked,likeCount}`.
- Replies retain their exact, unlimited logical parent chain. The UI alone clamps visual indentation.
- Delete is enforced server-side for owner and an operationally provisioned admin role.
- Mock repository is selected only by `NEXT_PUBLIC_USE_SOCIAL_POST_MOCK === "true"`; default development and production use the real API.
- Failed feed/comment requests render error, not ErrorState plus EmptyState; failures never render sample posts.

## Out Of Scope

- Reposts/shared-post records, editing, moderation UI, comment deletion UI, profile UI redesign, video UX, and comment pagination redesign.

## Open Questions

- See the five approval blockers in [index.md](index.md).
