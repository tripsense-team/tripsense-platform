# Decisions

| Decision | Rationale | Alternatives Rejected |
| --- | --- | --- |
| Propose a new social-service | Clear data ownership and independent scaling | user-service/trip-service persistence |
| Preserve existing adapter routes and response shapes | Avoid UI rewrite | alternate comment-like route |
| Return comments flat | Existing UI builds exact tree and clamps only presentation depth | backend reparenting or nested-only response |
| Direct signed Cloudinary upload | Keeps binary and API secret off normal backend path | browser secret, arbitrary URLs, backend binary proxy |
| Mock only by explicit flag | Required no-fallback behavior | automatic development mock selection |
| Idempotent reaction endpoints | Safe retries and optimistic UI | authoritative toggle endpoint |
| Snapshot author name from JWT email in v1 | Existing identity contract has no profile API; preserves data ownership and gives the UI a required name | cross-service DB access or JPA relationship |
| Public reads with optional JWT | Makes existing share URLs work while preserving viewer-specific like flags | authenticated-only read routes |

## Review Findings

- **MEDIUM:** Complete unpaginated comment trees and unlimited stored depth need a future scale strategy; v1 preserves present UI semantics.
- **MEDIUM:** The user-post screen cannot distinguish an existing zero-post author from an unknown author without a profile response.
- **LOW:** Cloudinary asset cleanup after abandoned browser uploads needs an operational scheduled job; no database transaction is held while uploading.
