# Trip Collaboration & Member Management — Specification & Implementation Plan

`STATUS: APPROVED`

- **Feature Name**: `trip-collaboration`
- **Jira / Linear Tasks**: TF-76, TF-77, TF-78, TF-79, TF-80, TF-81
- **Owner Service**: `services/trip-service`
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway`, `services/trip-service`, `services/user-service` (profile lookups), `services/mail-service` (invitation emails)
- **Target Branch**: `feature/trip-collaboration`
- **Created Date**: 2026-09-24

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
Currently, trips created in TripSense are strictly single-user (owned by `ownerUserId`). Travelers planning vacations with friends, partners, or travel groups need the ability to collaborate in real-time on itineraries. 

This feature enables:
1. Inviting collaborators by email/username with defined roles (`EDITOR`, `VIEWER`).
2. Receiving, accepting, or declining trip invitations.
3. Viewing all trip members with their roles and status.
4. Managing members (Owner/Admin can kick members; non-owners can voluntarily leave).
5. Enforcing role-based access control across all itinerary editing and viewing endpoints.

---

### 1.2 User Flows & Journey

```mermaid
sequenceDiagram
    autonumber
    actor Owner as Trip Owner (Alice)
    actor Invitee as Invitee (Bob)
    participant Web as Web Client (Next.js)
    participant Gateway as API Gateway (:8080)
    participant TripSvc as Trip Service (:8084)
    participant MailSvc as Mail Service (:8082)

    Note over Owner,TripSvc: TF-76: Send Trip Invitation
    Owner->>Web: Clicks "Share & Invite" on Trip Detail
    Owner->>Web: Inputs Bob's email, selects Role (EDITOR/VIEWER), clicks "Send Invite"
    Web->>Gateway: POST /api/trips/{tripId}/invitations
    Gateway->>TripSvc: POST /api/trips/{tripId}/invitations (with X-User-Id)
    TripSvc->>TripSvc: Validate Alice is OWNER; generate Invitation Token
    TripSvc-->>MailSvc: (Async/Sync) Send invitation email with Join link
    TripSvc-->>Web: 201 Created (Invitation DTO)

    Note over Invitee,TripSvc: TF-77 / TF-78: Accept or Decline
    Invitee->>Web: Opens link /trips/join?token=... or In-App Invitation banner
    alt Accepts (TF-77)
        Invitee->>Web: Clicks "Accept Invitation"
        Web->>Gateway: POST /api/trips/invitations/{id}/accept (or by token)
        Gateway->>TripSvc: POST /api/trips/invitations/{id}/accept
        TripSvc->>TripSvc: Add Bob to trip_members with assigned role, mark invitation ACCEPTED
        TripSvc-->>Web: 200 OK (Trip Details & Member role)
        Web->>Invitee: Redirects to collaborative Trip Itinerary view
    else Declines (TF-78)
        Invitee->>Web: Clicks "Decline"
        Web->>Gateway: POST /api/trips/invitations/{id}/decline
        Gateway->>TripSvc: POST /api/trips/invitations/{id}/decline
        TripSvc->>TripSvc: Mark invitation DECLINED
        TripSvc-->>Web: 200 OK
    end

    Note over Owner,TripSvc: TF-79, TF-80, TF-81: Member Management
    Owner->>Web: Views Trip Members Drawer/Dialog (TF-79)
    Web->>Gateway: GET /api/trips/{tripId}/members
    Gateway->>TripSvc: GET /api/trips/{tripId}/members
    TripSvc-->>Web: 200 OK (List of members + Pending invites)

    opt Kick Member (TF-80)
        Owner->>Web: Clicks "Remove Member" on Bob
        Web->>Gateway: DELETE /api/trips/{tripId}/members/{memberId}
        Gateway->>TripSvc: DELETE /api/trips/{tripId}/members/{memberId}
        TripSvc-->>Web: 204 No Content
    end

    opt Leave Trip (TF-81)
        Invitee->>Web: Clicks "Leave Trip" in Trip Settings
        Web->>Gateway: POST /api/trips/{tripId}/leave
        Gateway->>TripSvc: POST /api/trips/{tripId}/leave
        TripSvc-->>Web: 204 No Content
    end
```

---

### 1.3 Scope Boundaries

- **In-Scope (Tasks TF-76 to TF-81)**:
  - **TF-76**: Invite a user to a trip (by email, with role `EDITOR` or `VIEWER`).
  - **TF-77**: Accept a trip invitation (adds user to `trip_members`).
  - **TF-78**: Decline a trip invitation (marks invitation status as `DECLINED`).
  - **TF-79**: View trip members and pending invitations list.
  - **TF-80**: Remove a member from the trip (Owner only; cannot remove Owner).
  - **TF-81**: Leave a shared trip (Member only; Owner cannot leave without transferring or deleting).
  - **Authorization**: Update `trip-service` security checks so `EDITOR` can edit itinerary items, `VIEWER` can view itinerary, and `OWNER` can manage membership.
  - **Frontend UI**: "Share & Invite" dialog, member list avatar badges, accept/decline join page.

- **Out-of-Scope**:
  - Live cursor presence / WebSocket live diffing (future phase).
  - Fine-grained activity-by-activity permissions (role applies at trip level).

---

### 1.4 Acceptance Criteria

- [ ] **AC-76.1**: Owner or Editor can send an invitation by email.
- [ ] **AC-76.2**: An invitation cannot be sent to an existing member or if an active `PENDING` invitation already exists for that email.
- [ ] **AC-77.1**: Authenticated invitee can accept an invitation via API/token.
- [ ] **AC-77.2**: Accepting adds the user to `trip_members` with correct role (`EDITOR`/`VIEWER`).
- [ ] **AC-78.1**: Invitee can decline an invitation; status becomes `DECLINED`.
- [ ] **AC-79.1**: Any trip member (`OWNER`, `EDITOR`, `VIEWER`) can view the member list and their roles.
- [ ] **AC-80.1**: Only `OWNER` can remove other members from the trip.
- [ ] **AC-80.2**: Attempting to remove the `OWNER` returns `400 Bad Request`.
- [ ] **AC-81.1**: Any non-owner member can leave a trip; their `trip_members` record is removed.
- [ ] **AC-81.2**: If the `OWNER` tries to leave, system returns `400 Bad Request` requiring ownership transfer or trip deletion.

---

## 2. Architecture & Service Boundaries

### 2.1 Service Ownership
| Component | Responsibility | Communication |
| :--- | :--- | :--- |
| `services/trip-service` | Owns `trips`, `trip_members`, `trip_invitations`, membership validation, permissions | Sync Spring Boot REST |
| `services/api-gateway` | Proxies `/api/trips/**` to `trip-service` via Eureka load balancer | Spring Cloud Gateway |
| `services/mail-service` | Sends invitation email notification to invitees | HTTP / Client call |
| `apps/web/tripsense` | Trip header Share/Invite modal, Member list drawer, `/trips/join` acceptance route | Next.js App Router |

### 2.2 Security Guardrails
- **Zero Cross-DB Access**: `trip-service` owns its PostgreSQL database and persists member `user_id` as UUID references.
- **Anti-IDOR Access Control**: Every trip read/write endpoint validates caller membership via `TripMemberRepository` / `CurrentUserProvider`.

---

## 3. API & Contract Specifications

### 3.1 REST Endpoints

| Method | Endpoint | Auth | Description | Task |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/trips/{tripId}/invitations` | `Bearer JWT` | Create & send trip invitation | TF-76 |
| `GET` | `/api/trips/{tripId}/invitations` | `Bearer JWT` | List pending invitations for trip | TF-76/79 |
| `POST` | `/api/trips/invitations/{invitationId}/accept` | `Bearer JWT` | Accept invitation | TF-77 |
| `POST` | `/api/trips/invitations/{invitationId}/decline` | `Bearer JWT` | Decline invitation | TF-78 |
| `GET` | `/api/trips/invitations/pending` | `Bearer JWT` | Get user's incoming invitations | TF-77/78 |
| `GET` | `/api/trips/{tripId}/members` | `Bearer JWT` | Get list of trip members | TF-79 |
| `DELETE` | `/api/trips/{tripId}/members/{memberId}` | `Bearer JWT` | Remove member from trip (Owner only) | TF-80 |
| `POST` | `/api/trips/{tripId}/leave` | `Bearer JWT` | Leave trip (Non-owners only) | TF-81 |

### 3.2 Request / Response Schemas

#### POST `/api/trips/{tripId}/invitations` (Request)
```json
{
  "inviteeEmail": "friend@example.com",
  "role": "EDITOR",
  "message": "Hey! Join me in planning our trip to Da Nang!"
}
```

#### Response DTO (`TripMemberResponse`)
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "tripId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "userId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "email": "friend@example.com",
  "displayName": "Alex Tran",
  "avatarUrl": "https://example.com/avatar.jpg",
  "role": "EDITOR",
  "joinedAt": "2026-09-24T15:30:00Z"
}
```

---

## 4. Data Model & Flyway Migrations

### 4.1 Schema Definition (`services/trip-service/src/main/resources/db/migration/V202609242300__create_trip_collaboration_tables.sql`)

```sql
-- 1. Create Trip Members table
CREATE TABLE IF NOT EXISTS trip_members (
    id UUID PRIMARY KEY,
    trip_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'VIEWER',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_trip_members_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    CONSTRAINT uk_trip_members_trip_user UNIQUE (trip_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_members_user_id ON trip_members(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_trip_id ON trip_members(trip_id);

-- 2. Create Trip Invitations table
CREATE TABLE IF NOT EXISTS trip_invitations (
    id UUID PRIMARY KEY,
    trip_id UUID NOT NULL,
    inviter_user_id UUID NOT NULL,
    invitee_email VARCHAR(255) NOT NULL,
    invitee_user_id UUID,
    role VARCHAR(32) NOT NULL DEFAULT 'EDITOR',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    invitation_token VARCHAR(255) NOT NULL UNIQUE,
    message TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_trip_invitations_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trip_invitations_email_status ON trip_invitations(invitee_email, status);
CREATE INDEX IF NOT EXISTS idx_trip_invitations_trip_id ON trip_invitations(trip_id);
```

---

## 5. Security & Permission Matrix

| Action | OWNER | EDITOR | VIEWER | NON-MEMBER |
| :--- | :---: | :---: | :---: | :---: |
| **View Trip & Itinerary** | ✅ | ✅ | ✅ | ❌ |
| **Edit Itinerary Days/Items** | ✅ | ✅ | ❌ | ❌ |
| **Send Invitation (TF-76)** | ✅ | ✅ | ❌ | ❌ |
| **View Members (TF-79)** | ✅ | ✅ | ✅ | ❌ |
| **Remove Member (TF-80)** | ✅ | ❌ | ❌ | ❌ |
| **Leave Trip (TF-81)** | ❌ (Must transfer) | ✅ | ✅ | ❌ |
| **Delete/Archive Trip** | ✅ | ❌ | ❌ | ❌ |

---

## 6. Implementation Plan & Tasks

### Phase 1: Database & Entities (`trip-service`)
- [ ] Create Flyway migration script `V202609242300__create_trip_collaboration_tables.sql`.
- [ ] Create Entities: `TripMember`, `TripInvitation`, and Enums `TripMemberRole`, `TripInvitationStatus`.
- [ ] Create Repositories: `TripMemberRepository`, `TripInvitationRepository`.

### Phase 2: Service Logic & Access Control (`trip-service`)
- [ ] Implement `TripCollaborationService` with business logic for TF-76, TF-77, TF-78, TF-79, TF-80, TF-81.
- [ ] Update `TripService` / `TripController` authorization checks so members can access trips according to permission matrix.
- [ ] Add Controller endpoints under `TripCollaborationController`.

### Phase 3: Frontend Web Client (`apps/web/tripsense`)
- [ ] Add TypeScript types & API client functions in `features/trip-management/services/collaboration-service.ts`.
- [ ] Implement UI:
  - "Share & Invite" Modal (invite by email + role selector).
  - Trip Detail Header "Avatar Stack" & "Members List Dialog".
  - Accept/Decline Banner / `/trips/join` verification screen.
  - Action buttons: "Remove member" (for Owner), "Leave trip" (for Members).
- [ ] Add i18n keys for English and Vietnamese in `src/i18n/locales/`.

---

## Human Approval Gate

```text
STATUS: WAITING_FOR_HUMAN_APPROVAL
```
> Kế hoạch kỹ thuật chi tiết cho 6 task **TF-76 đến TF-81** đã hoàn thành và sẵn sàng được kiểm tra. 
> Phản hồi **`Approved`**, **`Implement`** hoặc **`Tiến hành code`** để bắt đầu triển khai các giai đoạn trên nhánh `feature/trip-collaboration`.
