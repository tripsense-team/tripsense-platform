# API

All successful payloads use the existing `ApiResponse<T>` envelope; the frontend API client unwraps `data`.

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/social/posts?page=0&size=10&userId?` | `{items,total,page,size,hasMore}`; newest-first |
| GET | `/api/social/posts/{postId}` | `SocialPost`; 404 when hidden/missing |
| POST | `/api/social/posts` | Requires UUID `Idempotency-Key`; creates or returns the same full `SocialPost` for the same author/key |
| DELETE | `/api/social/posts/{postId}` | 204 owner or `ROLE_ADMIN` |
| POST/DELETE | `/api/social/posts/{postId}/likes` | `{liked,likeCount}`; idempotent |
| GET/POST | `/api/social/posts/{postId}/comments` | flat `PostComment[]` / 201 comment |
| POST/DELETE | `/api/social/posts/{postId}/comments/{commentId}/likes` | `{liked,likeCount}` |
| POST | `/api/social/media/upload-signature` | safe, short-lived Cloudinary upload config |

The nested comment-like path deliberately matches the existing adapter. Share has no API.

## DTOs

`SocialPost` remains UI-compatible: `id`, `author{id,name,avatar?,email?}`, `content`, ordered `mediaUrls?`, `createdAt`, `updatedAt?`, `likeCount`, `commentCount`, `isLiked?`.

Create-post changes from `mediaUrls` to `media?: [{publicId,secureUrl,resourceType,format,width,height,sortOrder}]`; the UI’s preview remains unchanged but uploads before submit. `PostComment` remains flat with `id,postId,parentId,author,content,createdAt,likeCount,isLiked?`.

## Validation and Errors

- Post: trimmed content up to 5,000 characters and at least content or 1–10 verified images.
- Comment: trimmed 1–2,000 characters; parent must be a visible comment in the same post.
- Page must be nonnegative and size 1–100; UUIDs must parse.
- `400 VALIDATION_FAILED`/`INVALID_MEDIA`; `401 UNAUTHENTICATED`; `403 FORBIDDEN`; `404 POST_NOT_FOUND`/`COMMENT_NOT_FOUND`; `429 RATE_LIMITED`; safe `500 INTERNAL_ERROR`.

Frontend must use `ApiError.status`, not message text, and must keep loading, empty, error, not-found, unauthorized, and forbidden mutually exclusive.
