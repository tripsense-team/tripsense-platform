# Security

## Authentication and Authorization

Each service verifies bearer ACCESS JWTs independently using the established shared secret and claims. Request bodies never determine author identity. Mutations and upload signatures require a principal; post deletion is owner or `ROLE_ADMIN`; comment/post ownership is verified against stored author IDs.

## Media Security

Cloudinary secrets live only in social-service configuration: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. The signature response exposes only safe upload parameters, scoped to `tripsense/social/{userId}`, with a short expiry, fixed image types/formats, count/size/dimension limits, and no secret.

The server validates submitted public ID, Cloudinary host/folder, resource type, dimensions, ordering, and ownership; it rejects `data:` URLs. Orphaned direct uploads require a scheduled cleanup/retention policy. Cloudinary delete/retry is outside database transactions.

## Abuse and IDOR

- Rate-limit write/signature requests at the gateway using the existing trusted-proxy IP mechanism plus actor-aware limits where available.
- Reject cross-post parent comments and route/comment mismatches.
- Unique reaction keys and atomic mutations handle retry/concurrency safely.
- Do not log token values, content, or secrets. Use safe error codes and correlation IDs.

## Pending Decision

Public read is proposed but must be approved. Invalid submitted tokens must receive 401; they must not silently become anonymous reads.
