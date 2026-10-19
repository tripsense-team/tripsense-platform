# Partner Approved Profile Update — Specification & Implementation Plan

`STATUS: IMPLEMENTING`

- **Owner Service**: `services/trip-service` (partner business profile and approval workflow)
- **Affected Components**: `apps/web/tripsense`, existing `services/trip-service`, existing `services/api-gateway`
- **Created Date**: 2026-10-19
- **Target PR Boundaries**: Phase 1 (Web profile editing and workflow), Phase 2 (backend contract completion only if existing contracts are insufficient)

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
Partner owners cannot currently update an approved business profile through the Partner Center. For hotels, an incorrect approved `destination` (for example, a street address entered as the city) makes the hotel fail destination searches. The owner needs a safe way to edit the profile, submit the change for review, and synchronize the approved profile into the hotel property.

### 1.2 User Flows & Journey
1. Owner opens `/partner`, chooses a business, and selects **Cập nhật hồ sơ**.
2. The form loads the current business draft and clearly separates city/destination from detailed street address. For a location correction, the owner selects the approved material-change reason/type and explains the change.
3. Web saves with `expectedVersion`, declares the material change, and submits a new application/reverification revision using existing Partner APIs and checklist/capability requirements.
4. Backend hides the listing, pauses new intake, and blocks new transactions while reverification is pending. Existing fulfilment and history remain accessible.
5. After Admin approval, the owner opens **Quản lý khách sạn → Thông tin cơ sở → Đồng bộ hồ sơ cơ sở đã duyệt**. The property then uses the approved destination/address. The owner separately configures room type and date inventory.

### 1.3 Scope Boundaries
- **In-Scope**:
  - Add an owner-only profile update entry and form to the existing Partner Center; reuse `PartnerWizardModal` fields/location autocomplete where practical.
  - Support updates to display name and typed `draftProfile`; preserve immutable business kind and existing evidence/capability validation.
  - Require HOTEL/RESTAURANT submissions to select a suggested place with a resolved city; city is stored as destination, separate from the detailed address.
  - Provide the same update entry from both the Partner Center card and hotel property workspace.
  - Support material location changes through the existing material-change/reverification process, including reason and optimistic version.
  - Show pending review/reverification status and explain that the live listing/intake is paused until Admin approval.
  - Reuse the existing hotel profile sync action after approval.
- **Out-of-Scope**:
  - Bypassing Admin review or editing the approved public snapshot directly.
  - Changing hotel room types, prices, availability, photos, or booking policy.
  - Changing business ownership, kind, or membership.

### 1.4 Acceptance Criteria
- [ ] AC-1: An Owner can open and edit their existing business profile; non-owners cannot edit or submit it.
- [ ] AC-2: Destination and detailed address are distinct fields; hotel destination is the city/area used by traveller search.
- [ ] AC-3: Save uses `expectedVersion`; conflict produces a safe, actionable reload message.
- [ ] AC-4: A material location change invokes the existing reverification contract and cannot remain publicly bookable while pending.
- [ ] AC-5: Approved revisions become the canonical profile; the owner can sync them to the hotel property and see the resulting destination.
- [ ] AC-6: Existing hotel room/inventory prerequisites are stated when a property still does not appear in bookable search.
- [ ] AC-7: UI text is localized and errors follow TripSense sanitization standards.
- [ ] AC-8: A HOTEL/RESTAURANT profile cannot be created or submitted for review unless the user selects a location result with a non-empty city.
- [ ] AC-9: Owner can open profile update directly from the hotel workspace and see when review is pending.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow
```text
[Partner Owner / Next.js]
  -> API Gateway -> Trip Service: PATCH business draft (expectedVersion)
  -> API Gateway -> Trip Service: declare material change
  -> API Gateway -> Trip Service: submit application/reverification
  <- Admin decision via existing review workflow
  -> API Gateway -> Trip Service hotel property update using approved snapshot
```

### 2.2 Service Ownership & Communication
| Component | Responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | Owner profile editing, validation feedback, review state, existing hotel sync | HTTP through `apiClient` |
| `services/api-gateway` | Existing authenticated routing | Spring Cloud Gateway |
| `services/trip-service` | Business draft, application revisions, material-change gate, approved snapshot and hotel property | Existing synchronous REST contracts |

### 2.3 Architecture Guardrails Verification
- [x] All browser requests use API Gateway.
- [x] `trip-service` remains the owner of partner business and hotel property state.
- [x] No cross-service database access or new service is proposed.
- [x] No event is needed for this synchronous owner review workflow; preserve existing notification behavior if already emitted by submission/review.

---

## 3. API & Event Contracts

### 3.1 REST Endpoints
Reuse current endpoints unless code inspection during approved implementation finds a contract gap:

| Method | Gateway Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/partners/businesses/{id}` | Owner/member JWT | Load business and current version |
| `PATCH` | `/api/partners/businesses/{id}` | Owner JWT | Save editable draft with `expectedVersion` |
| `POST` | `/api/partners/businesses/{id}/material-changes` | Owner JWT | Declare `LOCATION`/other supported material change and reason |
| `POST` | `/api/partners/businesses/{id}/applications` | Owner JWT | Submit an immutable review revision |
| `GET` | `/api/partners/businesses/{id}/applications` | Member JWT | Read application/review state and approved revision |
| `PUT` | Existing hotel property path | Owner JWT | Sync the latest approved profile into the hotel property |

Draft request follows existing `UpdateBusinessDraftRequest`:
```json
{
  "expectedVersion": 12,
  "displayName": "Nhà nghỉ Cây Phượng",
  "draftProfile": {
    "destination": "Đà Nẵng",
    "address": "35 Nguyễn Phúc, ..."
  }
}
```

Material-change request follows existing `MaterialChangeRequest`:
```json
{
  "expectedVersion": 13,
  "kind": "LOCATION",
  "reason": "Sửa điểm đến thành thành phố Đà Nẵng; địa chỉ chi tiết được giữ riêng"
}
```

Application submission uses existing checklist ID/version, requested capabilities, and immutable `profileSnapshot`; no new public contract is intended.

### 3.2 Kafka Event Specifications
No new event. Reuse any existing application submission/review notifications.

---

## 4. Data Model & Migrations

No new table or migration is expected. Existing `partner_business` draft/version fields and immutable `partner_application` snapshots/revisions own this workflow. Reconfirm against current service implementation before coding; any schema gap requires revising this plan and approval.

---

## 5. Security & Trust Boundaries

| Risk Area | Mitigation Strategy |
| --- | --- |
| Authentication | Use existing JWT/API Gateway flow. |
| Authorization / IDOR | Backend verifies active membership and OWNER role for draft, material change, and application submission; client-supplied business ID is never authorization. |
| Approval integrity | Do not edit approved snapshots. Submission creates immutable revision; Admin decision is required for material location changes. |
| Concurrency | Send `expectedVersion`; surface 409 conflict and reload authoritative data. |
| Input validation | Reuse typed profile validation, bounded fields, and location autocomplete; keep destination separate from street address. |
| Error handling | Use `apiClient`, `getSafeErrorMessage`, and localized safe copy; never display raw server internals. |

---

## 6. Devil's Advocate & Technical Trade-offs

| Khía cạnh | Thách thức / Rủi ro | Giải pháp & Đánh đổi |
| --- | --- | --- |
| Search consistency | Draft update alone must not change public search; approved snapshot is canonical. | Keep draft and approved revision separate; sync hotel property only after approval. |
| Material change availability | A location correction may temporarily remove the hotel from search. | Follow existing `LOCATION` reverification gate: hide/pause new intake until Admin approves; do not silently publish unreviewed data. |
| Room inventory | Correcting destination does not make an unbookable property appear. | UI states that room type plus date inventory must exist; retain existing availability checks. |
| Reuse | Duplicating onboarding UI risks validation/schema drift. | Reuse existing wizard location fields and partner API helpers, extracting shared form behavior only if needed. |

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: Web Profile Update Workflow
- [x] Add owner-only update entry on existing business card.
- [x] Reuse onboarding profile fields/location autocomplete in edit mode, populated from current draft and preserving profile data not shown in the form.
- [x] Wire existing `PATCH`, material-change, application submission, and status APIs with expected-version handling.
- [x] Show review/reverification state and next steps; maintain i18n parity and safe error handling.
- [x] Confirm the existing approved hotel sync action is available to apply approved destination/address changes.

### Phase 2: Backend Contract Gap (only if required)
- [x] Verify existing backend owner checks, material change locking, immutable application snapshot, and `LOCATION` reverification behavior by source inspection.
- [x] No backend contract or schema changes were needed.

### Verification Commands
```bash
cd apps/web/tripsense && npm run i18n:check
cd apps/web/tripsense && npx tsc --noEmit
```
Manual verification still needed in the running environment: Owner edits destination/address, submits reverification, public search remains gated pending review, Admin approves, Owner syncs the hotel property, and search is checked after room/date inventory is configured. Backend must reject non-owner and stale-version requests.

---

## Human Approval Gate

```text
STATUS: APPROVED
```
