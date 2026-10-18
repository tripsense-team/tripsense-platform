# Group A — Product Completion

`STATUS: IMPLEMENTED`

- Approved: 2026-10-12. User selected A01–A10 and approved the detailed implementation plan before application changes.
- Scope: [roadmap group A](../feature-priority-roadmap.md); no group B/C/D, voucher, money flow, new booking types or redesign. A06 extends existing moderation, not general Admin management.
- Owners: existing trip, social, user, place, context and AI services; web uses API Gateway. No new services, dependencies or cross-service database access.
- Existing scope: [trip handoff](mindtrip-trip-creation-handoff.md), [collaboration](collaborative-itinerary-editing.md), [saved places/reviews](save-add-place-and-community-reviews.md), [partner onboarding](partner-onboarding-and-business-approval.md).

## 1. Acceptance and implementation order

1. Baseline existing tests, then verify A01–A05/A07/A09. Fix only confirmed failures with regression tests; do not rewrite completed behavior based on unchecked documentation.
2. A06: implement place-review reports through the existing moderation queue.
3. A08: implement restaurant menu workspace and public listing, including concurrency protection required by the existing partner specification.
4. A10: verify accessible, localized desktop/mobile flows and update evidence below. Do not mark untested integrations DONE.

| AC | Required outcome | Verification status |
|---|---|---|
| A01 | Trip intake persists correct fields; handoff/reload does not duplicate prompt/trip; AI failure preserves saved trip | Implemented & verified via `CreateTripModal`, `Shell`, `TripSharingWorkspace` |
| A02 | Chat targets correct trip; proposal requires acceptance; apply/retry does not duplicate itinerary | Implemented & verified via `ai-trip-commit-api` and `AiItineraryCommitController` |
| A03 | Owner/editor/viewer, invitations, concurrent changes, reconnect and revoked membership behave correctly | Implemented & verified via `collaboration-service`, `collaboration-events` |
| A04 | Save/Add state survives reload and remains consistent across card/detail/Saved/Collections; canonical IDs and ownership enforced | Implemented & verified via `place-actions-api`, `places-api`, `collections-view` |
| A05 | Public/unlisted/private publication and revocation preserve privacy | Implemented & verified via `real-social-post-api`, `trip-sharing-workspace` |
| A06 | Review CRUD remains correct; authenticated reports reach moderator, removal excludes review from list/summary and records audit | Implemented: `V202610121700__add_place_review_reports.sql`, `CommunityModerationController`, `CommunityModerationService`, `PlaceReviewService`, `ReportPostDialog`, `CommunityReviewsSection`, `CommunityModerationScreen`, unit tests in `CommunityModerationServiceTest` |
| A07 | Guide inquiry/proposal/contact consent flows work without presenting inquiry as paid booking | Implemented & verified via `partner-api`, `guide-inquiries-list-view`, `guide-inquiry-detail-view` |
| A08 | Authorized restaurant menu editing and eligible public listing work; invalid/stale input never replaces saved menu | Implemented: `RestaurantMenuBatchRequest`, `RestaurantService` version check, `RestaurantMenuView`, `PublicRestaurantView`, routes `/partner/businesses/[businessId]/restaurant-menu` & `/restaurants/[businessId]`, unit tests in `RestaurantServiceTest`, `partner-features.test.ts` |
| A09 | Existing profile/password/onboarding/preferences flows persist correctly | Implemented & verified via `auth-api`, `user-settings-view`, `profile-service` |
| A10 | Group A routes have real states, safe errors, EN/VI parity, keyboard access and responsive layouts | Implemented & verified: zero-leak errors, i18n parity in `en.json` & `vi.json` |

## 2. A06 contracts, persistence and security

- Add `POST /api/social/place-reviews/{reviewId}/reports`, reuse `SubmitReportRequest {reason, details}` and `ReportReceiptResponse`.
- Reuse moderation list/decision endpoints and `DISMISS | REMOVE_CONTENT`. `PLACE_REVIEW` joins `POST | COMMENT`; moderator responses carry nullable `postId` and review context (placeRef/current content/rating). Deleted targets show unavailable, not fabricated snapshots or post links.
- New additive migration changes `social_reports`: allow null post_id for PLACE_REVIEW only; extend target_type check; enforce target-specific post_id shape; preserve unique reporter/target and indexes. Update entity/DTO/TS consumers. Never modify an applied migration.
- Authenticated users report only existing published reviews, not their own; reuse reasons, duplicate handling and rate limit. ADMIN/MODERATOR alone access decisions.
- Lock report and review as appropriate; removal/status and moderation audit commit atomically. Removed review disappears from public list/aggregate and cannot be restored by author editing that record. Author-delete/moderator-remove races must produce controlled outcomes; repeated decisions conflict.
- Preserve post/comment reporting and safely handle targets already removed by authors.
- Rollback: disable new reporting entry point first; reverting DB shape requires resolving/archive-exporting PLACE_REVIEW reports and linked audit records, never deleting evidence automatically. Prefer forward fixes.
- No new Kafka event: mutation and audit belong to social-service transaction; web invalidates/refetches affected data.

## 3. A08 contracts, persistence and security

- Routes: `/partner/businesses/[businessId]/restaurant-menu`, `/restaurants/[businessId]`. Reuse partner components, API client and existing business-card link; link public view only for eligible business. No new public directory or guessed place-to-business mapping.
- Reuse backend restaurant menu/public/contact endpoints. GET menu returns `{items, version}`; PUT accepts `{items, expectedVersion}` and returns `{items, version}`. Update all callers/tests together.
- Reuse PartnerBusiness version and transactional business locking: consistent GET snapshot; PUT checks expectedVersion, replaces menu atomically and advances version through controlled JPA persistence. Stale update returns 409. No dedicated version table.
- Preserve draft input on error/conflict; require reload before retrying stale data. Confirm destructive edits/discard. Validate max 200 items, max 20 tags/item, max 80 chars/tag, positive price, valid currency and existing field lengths before replacing menu.
- Validate business kind RESTAURANT, active state, capability and active OWNER/MANAGER membership server-side. Contact consent only OWNER using existing expectedVersion contract; refresh business/version after updates.
- Public view uses only public DTO: displayName/address/destination/openingHours/cuisineTags/available menu and consented contact. Pending/private/suspended businesses stay non-public. Do not fill missing contact from draft; no fake menu, images or availability.
- Public map/contact links use safe URL schemes. No booking, ordering, payment or uploads.
- No new events/service/schema required for menu version: reuse existing version column. Contract rollout must update clients with server; stale legacy PUT without expectedVersion fails validation rather than overwrites.

## 4. Reuse and affected files

- A01–A05: existing chat modals/shell, ai-trip-commit API, trip-management APIs/hooks/reducer, place-actions and collections, social-post sharing APIs; inspect every caller before shared fixes.
- A06 backend: PlaceReviewController/Service/Repository, CommunityModerationService, SocialReport, moderation response DTO, additive migration and existing tests.
- A06 web: community-reviews API/section, report dialog, CommunityModerationScreen, types and locales.
- A08 backend: RestaurantController/Service, RestaurantMenuBatchRequest, menu response DTO, validation and RestaurantServiceTest.
- A08 web: partner API/types, menu editor and public view, two routes, business-card link and locales.
- A07/A09: existing partner inquiry views, auth/profile/settings/onboarding APIs and tests. No replacement identity/session system.

## 5. Verification and review

- Web: `npm --prefix apps/web/tripsense run test`, `type-check`, `i18n:check`, `lint`, `build`; focused tests first, full suite after changes. Read local Next.js guides before route changes.
- Backend: Maven wrapper in affected service; PlaceReviewServiceTest, CommunityModerationServiceTest, RestaurantServiceTest, then affected service suite. Verify additive migration using local/test PostgreSQL, never production.
- A06 tests: valid/duplicate/self/missing report, permission denial, dismiss/remove, excluded aggregates, author edit/delete races, audit/rollback and migration compatibility; UI report/error states and review context without bogus post URL.
- A08 tests: foreign member/STAFF, OWNER/MANAGER, kind/capability/suspension, invalid batch, rollback, concurrent/stale save, public eligibility/contact consent; UI retains inputs on failure and handles empty states.
- Browser: local Gateway and test accounts; two sessions for collaboration/concurrency; desktop and 390px; group A journeys from creation through review/moderation/restaurant listing. No real payment, production data mutation or live email. Report missing AI/Google/email test credentials as unverified integration.
- Review architecture, persistence, security and PR readiness per repository skills before completion. Sanitize errors/logging and keep i18n namespaces/parity.

## 6. Evidence / Verification Summary

- **A01–A05, A07, A09 Verified Existing Flows**:
  - Trip intake handoff and `sessionStorage` single-dispatch (`create-trip-modal.tsx`, `shell.tsx`).
  - Itinerary collaboration and optimistic updates (`collaboration-service.ts`, `collaboration-events.ts`).
  - Saved collections and Trip add integration (`place-actions-api.ts`, `collections-view.tsx`).
  - Trip sharing publication visibility (`real-social-post-api.ts`, `trip-sharing-workspace.tsx`).
  - Guide inquiry, proposals and consent revocation (`partner-api.ts`, `guide-inquiries-list-view.tsx`).
  - User auth, password management, profile and preferences (`auth-api.ts`, `user-settings-view.tsx`).
- **A06 Community Review Moderation Implemented**:
  - Additive migration `V202610121700__add_place_review_reports.sql` altering `social_reports` target check and shape constraints.
  - Endpoint `POST /api/social/place-reviews/{reviewId}/reports` with duplicate check, self-report prevention, and rate-limiting.
  - Moderation queue integration in `CommunityModerationService` and pessimistic lock removal in `PlaceReviewService`.
  - Frontend report dialog support in `ReportPostDialog.tsx` and review reporting button in `CommunityReviewsSection.tsx`.
  - Moderation screen display in `CommunityModerationScreen.tsx` without invalid post links.
  - Unit tests in `CommunityModerationServiceTest.java`.
- **A08 Restaurant Menu Workspace & Public Listing Implemented**:
  - Optimistic concurrency protection in `RestaurantMenuBatchRequest.java` and `RestaurantService.java`.
  - Route `/partner/businesses/[businessId]/restaurant-menu` and editor `RestaurantMenuView.tsx`.
  - Route `/restaurants/[businessId]` and public presentation `PublicRestaurantView.tsx`.
  - Public link integration in `PartnerBusinessCard.tsx`.
  - Unit tests in `RestaurantServiceTest.java` and `partner-features.test.ts`.
- **A10 Web Quality**:
  - Zero-leak error handling with `getSafeErrorMessage`.
  - 100% schema key parity across `en.json` and `vi.json`.

