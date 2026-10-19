# Restaurant Menu Dish Photos — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `services/trip-service` (menu data and partner-scoped upload authorization)
- **Affected Components**: `apps/web/tripsense`, `services/trip-service`, `services/api-gateway`, Cloudinary configuration
- **Created Date**: 2026-10-19
- **Related Features**: [Restaurant Menu AI Extraction & Reservation Integration](./restaurant-menu-ai-extraction-and-reservation-integration.md), [Partner Onboarding & Business Approval](./partner-onboarding-and-business-approval.md), [Social Post Management](./social-post-management/index.md)

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal

Partners can currently save a dish name, description, price and tags, but cannot attach a photo to an individual dish. Add/edit menu-item forms should let a Partner select and preview a dish photo; public restaurant pages should show that photo beside the dish. Reuse the current restaurant-menu form and upload/preview behavior where safe, and avoid a parallel menu editor or duplicated upload implementation.

### 1.2 User Flow

1. An authorized restaurant Partner opens the existing restaurant menu page and adds or edits a dish.
2. The existing dialog provides an optional image picker, preview, replace and remove actions. The image uploads to the business-scoped Trip Service endpoint, which enforces size/type limits before storing it with the configured image provider.
3. The existing batch menu save sends the dish metadata and provider asset reference to `trip-service`; the normal version check remains in force.
4. Existing GET menu and public restaurant listing responses include the persisted image reference/derived HTTPS image URL. Public menu cards render the image with a stable fallback when no photo exists or loading fails.
5. The menu screenshot-to-AI extraction flow remains separate: its uploaded image is an OCR input and is not silently assigned as every dish's photo.

### 1.3 Scope Boundaries

**In scope**

- Extend the existing add/edit dialog and menu item card; do not create another CRUD form or menu route.
- Persist one optional image per menu item and expose it to the existing public restaurant listing.
- Reuse/extract shared frontend image validation and preview behavior so menu dish photos and AI menu scans do not maintain duplicate image-picker code.
- Use a Partner-owned, business-scoped upload endpoint in `trip-service`; retain Cloudinary secrets on the server and enforce image format and byte limits before provider upload.
- Keep the existing AI menu image upload, extraction endpoint, and existing menu API endpoints; extend their DTOs compatibly with an optional image reference.
- Add localized labels/errors in Vietnamese and English, and preserve safe error handling.

**Out of scope**

- Multiple photos, galleries, variants, image editing, AI dish recognition, moderation workflows, payment, or new menu CRUD screens.
- Reusing `/api/social/media/upload-signature` for Partner uploads: that endpoint is Social-owned and user-folder-scoped, so it does not enforce business ownership.
- Storing raw base64, accepting arbitrary image URLs, or serving a menu screenshot as an item's dish photo.

### 1.4 Acceptance Criteria

- [x] AC-1: Add/edit in the existing menu dialog supports choosing, previewing, replacing and removing one optional dish photo.
- [x] AC-2: Existing menu form and batch save continue to be the only dish CRUD flow; image selection does not add a duplicate API client or editor.
- [x] AC-3: Only authenticated OWNER/MANAGER members with `RESTAURANT_MENU` can upload images for that business; malformed type, oversized images, and unauthorized business IDs are rejected.
- [x] AC-4: Menu DTOs persist and return an optional provider asset reference; backend only accepts references inside the server-issued business namespace and derives public HTTPS URLs from trusted provider configuration.
- [x] AC-5: The existing public restaurant page shows saved dish photos, supports alt text based on the dish name, and has an accessible fallback for missing/failed images.
- [x] AC-6: Existing menu items, AI extraction, menu ordering, availability, optimistic concurrency, and reservation pre-order behavior continue working when image reference is absent.
- [x] AC-7: en/vi translations, safe errors, file size/type validation, upload failure compensation and replaced-image cleanup behavior are covered.

## 2. Architecture & Service Boundaries

### 2.1 Data Flow

```text
Existing menu dialog (apps/web)
  -> POST /api/partners/businesses/{businessId}/restaurant-menu/images (multipart file)
  -> trip-service validates membership, MIME/magic bytes, 5 MB limit and uploads to
     tripsense/partners/{businessId}/restaurant-menu
  <- trusted imagePublicId and imageUrl
  -> existing PUT /api/partners/businesses/{businessId}/restaurant-menu
       { items: [..., imagePublicId?], expectedVersion }
  -> trip-service stores imagePublicId on restaurant_menu_item
  -> existing public restaurant listing returns derived imageUrl
  -> existing public restaurant page renders the dish photo
```

### 2.2 Ownership & Reuse

| Component | Responsibility |
| --- | --- |
| `apps/web/tripsense` | Add photo controls to existing dialog/cards, reuse shared upload validation/preview behavior, call gateway contract, render existing public menu photos. |
| `services/api-gateway` | Route the new authenticated Partner menu image endpoint to `trip-service` and enforce request-body limits; no storage or menu ownership. |
| `services/trip-service` | Own menu image reference, verify membership/capability, validate and proxy uploads into a business-specific folder, validate image references on menu save, return trusted public URLs. |
| Cloudinary | Store and deliver the image asset; API credentials remain backend-side. |

Reuse the existing menu DTOs, `getRestaurantMenu` / `updateRestaurantMenu`, `RestaurantMenuView`, menu item dialog, and `PublicRestaurantView`. Extract common file validation and preview URL lifecycle into a shared helper used by the existing AI menu upload modal and Partner menu form; the Partner menu sends the selected `File` to its trip-service endpoint. Keep Social post's existing signature and direct-upload contract unchanged. Reuse the AI upload modal's image selection/validation/preview interaction, not its OCR API as permanent dish storage.

The existing social signature endpoint is not reused as a Partner authorization endpoint: it scopes media under a user's Social folder. The existing trip-service promotion-media upload-intent lifecycle currently returns a `mock-upload` URL and is not a working persistent storage adapter. Do not treat that mock endpoint as a completed uploader. Implement a small real trip-service upload adapter and keep its namespace separate from guide-promotion media. The upload endpoint proxies the bounded file so trip-service can enforce actual bytes before persisting, rather than trusting browser-reported size or a client-provided URL.

### 2.3 Boundaries

- All client service traffic uses API Gateway.
- `trip-service` remains the sole owner of menu rows and authorization. It does not read Social Service data or database.
- Upload is synchronous because the user needs the image immediately for preview and menu save. No Kafka event is required.
- Cloudinary configuration (cloud name, API key, API secret and partner folder prefix) is read only by `trip-service`; no secret is exposed to the browser.

## 3. API & Contracts

### 3.1 New Partner Image Upload Contract

`POST /api/partners/businesses/{businessId}/restaurant-menu/images`

- **Auth**: Bearer JWT; OWNER or MANAGER membership and active `RESTAURANT_MENU` capability for this business.
- **Request**: `multipart/form-data`, field `file`; allow JPEG, PNG and WebP up to 5 MB.
- **Response**: `{ "imagePublicId": "tripsense/partners/{businessId}/restaurant-menu/{assetId}", "imageUrl": "https://res.cloudinary.com/..." }`.
- Validate actual request size, declared MIME and file magic bytes in trip-service; reject unsupported or mismatched files before calling Cloudinary. Upload to a server-constructed business folder and return the provider response only after validating the asset ID and HTTPS delivery URL.
- Gateway routes this exact path to trip-service; do not expose an internal service URL.

### 3.2 Existing Menu APIs (Backward-Compatible Extension)

Keep `GET` and `PUT /api/partners/businesses/{businessId}/restaurant-menu`. Add optional `imagePublicId` to `RestaurantMenuItemDto` and persist/return it. On PUT, validate every non-empty `imagePublicId` matches the configured Cloudinary cloud and exact business menu folder. Do not accept a client-supplied `imageUrl` as authoritative. Existing requests without the field remain valid.

The public restaurant listing adds optional `imageUrl`, derived server-side from the validated `imagePublicId` using the configured cloud name and a fixed image delivery transformation. Public endpoint only returns menu items already eligible under existing listing rules.

### 3.3 Events

No Kafka event. Image upload and menu save are user-driven synchronous operations.

## 4. Data Model & Migration

Add a nullable `image_public_id varchar(255)` column to `restaurant_menu_item` in a new trip-service Flyway migration. No new image table is needed for one image per menu row. Existing rows remain null and migration rollback drops only this nullable column. No cross-service relationship is introduced.

Keep the provider's canonical public URL derived from `image_public_id` rather than persisting arbitrary user input. If provider delivery requires a separate immutable asset version, include that version in a bounded reference or add a field only after confirming the Cloudinary response contract during implementation.

## 5. Security & Trust Boundaries

- Verify JWT, business membership, `OWNER`/`MANAGER`, and `RESTAURANT_MENU` capability for every upload and menu write; never trust a client business ID or role assertion.
- Enforce request byte limit at Gateway and trip-service; validate MIME plus magic bytes and reject SVG, HTML, malformed MIME, and unsupported content before provider upload.
- Cloudinary API secret remains in trip-service environment configuration; the browser receives no secret or provider signature.
- Never accept arbitrary remote image URLs; require a server-owned Cloudinary cloud and business folder reference, then derive the public URL on the server.
- Keep draft form previews local with object URLs and revoke them on replace, remove, dialog close and unmount. Do not log images, credentials or raw provider responses.
- Uploads completed before menu save can become orphans if the Partner cancels or the browser disconnects. The UI uploads only during the existing Save action, calls the authorized discard endpoint if the menu update fails, and the backend deletes replaced assets after commit. The discard endpoint rechecks menu references and refuses to delete an image that has been saved. A timed provider-folder sweeper is deferred; an abrupt disconnect between upload and menu update can leave an unused provider asset.
- Existing public listing eligibility and menu capability checks remain unchanged. No personal/private partner media is exposed.

## 6. Devil's Advocate & Trade-offs

| Risk / option | Decision |
| --- | --- |
| Reuse Social's upload-signature API directly | Rejected: its authorization and folder are user/Social scoped, not business scoped; using it would weaken ownership isolation. Reuse shared client file-picker behavior instead. |
| Persist arbitrary URL from browser | Rejected: permits untrusted hosts, tracking links and malformed public output. Persist only a provider asset ID in the server-issued business namespace. |
| Reuse promotion-media `mock-upload` endpoint | Rejected as-is: current endpoint is a placeholder and promotion-specific. It cannot store/retrieve real dish images. |
| Upload image and menu in one multipart request | Rejected for MVP: duplicates upload handling and complicates existing versioned batch menu API. Keep media upload separate and menu save backward-compatible. |
| Orphan image after cancel/failure | Upload only as part of Save, then compensate with the authorized discard endpoint if menu update fails. Backend refuses to delete referenced assets and removes replaced ones after commit. A timed provider-folder sweeper remains follow-up work for abrupt disconnects. |

## 7. Implementation & Verification Plan

1. **Backend contracts and storage upload**: add trip-service Cloudinary config and bounded multipart upload endpoint; gateway route/body limits; authorization, file validation, provider failure and upload tests.
2. **Menu persistence and public DTO**: nullable migration and entity/DTO mapping; validate references on batch update; derive public URL; test existing null-image rows and version behavior.
3. **Shared web image selection**: extract common file validation and preview URL lifecycle into a reusable helper; update the existing AI menu picker and Partner menu form to use it without changing AI OCR or Social upload contracts.
4. **Existing Partner menu UI**: extend the existing add/edit dialog and menu cards with optional photo preview/replace/remove, uploading state, localized errors, and the shared image-picker helper. Preserve AI menu OCR behavior and existing menu API methods.
5. **Public rendering**: extend current public restaurant DTO/view to display dish images with dish-name alt text and fallback; no new public page.
6. **Cleanup and documentation**: document provider config/deployment requirements; compensate failed menu saves and clean replaced assets after commit. A scheduled provider-folder sweeper is deferred and should be added before high-volume production use.
7. **Verification**: trip-service unit/integration tests for auth, business folder and reference validation, migration/schema checks; web tests for shared upload utility, add/edit, preview/removal, failure, and public image rendering; `npm run type-check`, `npm run i18n:check`, targeted lint and relevant backend test suite.

## Human Approval Gate

Human approval received on 2026-10-19. Implementation completed within the approved scope. Current menu DTOs now persist one optional image reference and trip-service owns the business-scoped upload contract; the existing promotion media mock endpoint remains unchanged.

## Implementation & Verification Record

- Existing add/edit menu dialog now selects and previews an optional dish image; images upload during the existing Save action. The public restaurant page displays saved photos with dish-name alt text and a fallback.
- Shared image validation and object URL lifecycle are reused by the Partner menu and AI menu upload modal. Social upload behavior is unchanged.
- Trip Service validates owner/manager membership, capability, MIME, file signature and 5 MB size; Cloudinary secrets stay server-side. Replaced images are deleted after commit; failed menu updates trigger an authorized best-effort discard. A timed orphan sweeper remains deferred for abrupt client disconnects.
- Deployment needs `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` in the environment used by `trip-service`; the folder prefix defaults to `tripsense/partners` and can be overridden with `CLOUDINARY_PARTNER_FOLDER`.
- Verification passed: web type-check; partner/service frontend tests (30); i18n schema check; targeted ESLint (0 errors; existing warnings remain); Trip Service tests (`RestaurantServiceTest`, `RestaurantMenuImageStorageTest`: 15 passed); API Gateway compile; `git diff --check`.
