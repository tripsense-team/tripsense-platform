# Community Creator Discovery (Suggested Creators) — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `services/social-service`
- **Affected Components**: `services/social-service`, `services/user-service`, `apps/web/tripsense`
- **Created Date**: 2026-09-24
- **Target PR Boundaries**:
  - Phase 1: Backend `social-service` GlobalExceptionHandler fix (`NoResourceFoundException` -> 404) & Public Profile Client integration.
  - Phase 2: Backend `social-service` Suggested Creators API (`GET /api/social/creators/suggested`), Ranking & Selection logic.
  - Phase 3: Web Frontend verification & integration test suite.

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
Currently, when users browse the TripSense Community feed, the sidebar widget **Suggested Creators** attempts to load creator recommendations via `GET /api/social/creators/suggested`.
Because `social-service` has not implemented this endpoint and catches unhandled routes in `GlobalExceptionHandler` as generic `500 INTERNAL_ERROR`, the browser console reports HTTP 500 errors. Although the frontend currently falls back gracefully to a mock repository, users cannot see real community creators, cannot discover active travel writers, and cannot establish real follower relationships from this discovery rail.

The goal of this feature is to provide a real, persistent creator recommendation flow that discovers and ranks active TripSense community members, displays their verified public profiles (name, avatar, travel niche), and allows one-click follow/unfollow interactions directly from the rail.

### 1.2 User Flows & Journey
1. **Discovering Creators**:
   - The user opens `/community` (Community feed).
   - The client calls `GET /api/social/creators/suggested?limit=4`.
   - The backend identifies active creators who have shared public travel posts or itineraries, ranks them by audience size (follower count), filters out the viewer themselves, and prioritizes creators whom the viewer does not currently follow.
   - For each recommended creator, the backend provides `id`, `name`, `avatar`, `niche`, `followerCount`, `isFollowing`, and `tripCount`.
2. **Following a Creator**:
   - The user clicks the **Follow** button on any suggested creator card.
   - The UI optimistically updates to "Following" (emerald badge) and increments the follower counter.
   - The frontend calls `POST /api/social/users/{creatorId}/follow` (or `DELETE` to unfollow).
   - If the request fails, the UI rolls back to the previous state with a non-intrusive toast.
3. **Exploring Creator Profiles**:
   - The user clicks on the creator's avatar or name.
   - The client navigates to `/community/users/{creatorId}`, displaying the creator's public profile, shared trips, and community posts.

### 1.3 Scope Boundaries
- **In-Scope**:
  - `social-service`: Implementation of `GET /api/social/creators/suggested` (with alias `/api/social/creator-suggestions`).
  - `social-service`: Creator ranking query prioritizing active public contributors with highest follower counts, excluding self and ranking un-followed creators first.
  - `social-service`: Integration with `user-service` via internal `UserClient` calling `POST /api/users/public-profiles:batch` to obtain verified `displayName` and `avatarUrl`.
  - `social-service`: Deriving or assigning travel `niche` (e.g., "Trekking & Camping", "Food & Culture", "Photography") based on creator profile bio or predominant post categories.
  - `social-service`: Fixing `GlobalExceptionHandler` so missing routes return `404 NOT_FOUND` instead of `500 INTERNAL_ERROR`.
  - `apps/web/tripsense`: Aligning `real-social-post-api.ts` with the production backend response, preserving offline/mock fallback for network outage resilience.
- **Out-of-Scope**:
  - Weather API (`/api/social/weather`) and Trending Destinations API (`/api/social/destinations/trending`), which belong to subsequent phases of the discovery rail plan.
  - Creator monetization, tipping, or paid subscriptions.
  - Modifying user private profile credentials or contact information.

### 1.4 Acceptance Criteria
- [ ] **AC-1**: `GET /api/social/creators/suggested` returns HTTP 200 with an allowlisted array of active creators (`id`, `name`, `avatar`, `niche`, `followerCount`, `isFollowing`, `tripCount`).
- [ ] **AC-2**: Authenticated viewers never see themselves in the suggested creators list (`id != viewer.id`).
- [ ] **AC-3**: Un-followed creators are prioritized above creators whom the current user already follows.
- [ ] **AC-4**: Creators are ranked primarily by verified public engagement (follower count and public trip shares).
- [ ] **AC-5**: Anonymous (unauthenticated) viewers receive suggestions with `isFollowing = false` without throwing 401.
- [ ] **AC-6**: One-click follow/unfollow continues to work reliably via existing `POST/DELETE /api/social/users/{creatorId}/follow`.
- [ ] **AC-7**: Unregistered routes in `social-service` return standard HTTP 404 instead of HTTP 500.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow
```text
[Browser / Next.js Web]
       |
       |  GET /api/social/creators/suggested?limit=4 (Bearer JWT optional)
       v
[API Gateway (:8080)]
       |
       |  Routes /api/social/** -> lb://social-service
       v
[social-service (:8086)]
       |
       +---> 1. Query Top Active Creators from social_posts & social_user_follows
       |
       +---> 2. Batch resolve public profiles via REST:
       |        POST http://user-service:8081/api/users/public-profiles:batch
       |        Body: { userIds: [...] }
       |
       v
[user-service (:8081)]
       |
       +---> Returns: List<PublicProfileDto> (userId, displayName, avatarUrl)
       |
[social-service (:8086)]
       |
       +---> Assembles SuggestedCreatorResponse DTOs
       v
[Browser / Next.js Web] -> Renders SuggestedCreatorsWidget
```

### 2.2 Service Ownership & Communication
| Component | Responsibility | Communication Protocol |
| --- | --- | --- |
| `apps/web/tripsense` | Renders `SuggestedCreatorsWidget`, handles optimistic follow toggling | HTTP REST to API Gateway |
| `services/api-gateway` | Proxies `/api/social/**` to `social-service`, forwards JWT claims | Synchronous Spring Cloud Gateway |
| `services/social-service` | Aggregates active creators, calculates follower ranks, manages follow graph | Synchronous Spring Boot Service |
| `services/user-service` | Owns canonical user identities, provides allowlisted `PublicProfileDto` | Internal Synchronous REST (Eureka / RestClient) |

### 2.3 Architecture Guardrails Verification
- [x] **Zero Cross-Service DB Queries**: `social-service` does NOT access `tripsense_user` database. It calls `user-service` via `POST /api/users/public-profiles:batch`.
- [x] **No Cross-Service JPA Relationships**: Entities in `social-service` reference users solely via `UUID authorId` and `UUID followedUserId`.
- [x] **Zero-Leak Logging & Error Sanitization**: Non-existent routes return clean `404 NOT_FOUND` with no raw stack traces or internal server error dumps.
- [x] **Graceful Degradation**: If `user-service` is temporarily unreachable or slow, `social-service` falls back to cached author names stored in `social_posts` rather than failing the whole rail with 500.

---

## 3. API & Event Contracts

### 3.1 Endpoint Specifications

#### `GET /api/social/creators/suggested`
- **Aliases**: `GET /api/social/creator-suggestions`
- **Authentication**: Optional (supports both anonymous guests and authenticated users via Bearer token).
- **Query Parameters**:
  - `limit`: integer, optional, default `4`, min `1`, max `20`.

#### Response Payload (`200 OK`)
```json
{
  "success": true,
  "message": "Suggested creators retrieved successfully",
  "data": [
    {
      "id": "e3b0c442-98fc-1c14-9af7-4c2de9400001",
      "name": "Minh Hằng",
      "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
      "niche": "Trekking & Camping",
      "nicheKey": "nicheTrekking",
      "followerCount": 1240,
      "isFollowing": false,
      "tripCount": 5
    },
    {
      "id": "e3b0c442-98fc-1c14-9af7-4c2de9400002",
      "name": "Hoàng Long",
      "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
      "niche": "Food & Culture",
      "nicheKey": "nicheFood",
      "followerCount": 3890,
      "isFollowing": false,
      "tripCount": 12
    }
  ]
}
```

### 3.2 Error Responses
| Status Code | Code | Condition |
| :--- | :--- | :--- |
| `200 OK` | `SUCCESS` | Successfully retrieved suggestions (or empty list if no active creators). |
| `400 BAD_REQUEST` | `INVALID_LIMIT` | `limit` parameter is non-numeric, `< 1`, or `> 20`. |
| `404 NOT_FOUND` | `RESOURCE_NOT_FOUND` | Unmatched API paths. |
| `500 INTERNAL_ERROR` | `INTERNAL_ERROR` | Unhandled internal exception. |

---

## 4. Database & Persistence

### 4.1 Data Sources in `tripsense_social`
No new database tables are required. The feature leverages existing indexed tables in `social-service`:
1. `social_posts`:
   - `author_id` (UUID): Used to aggregate active creators and count public publications (`deleted_at IS NULL`).
   - `author_display_name` (VARCHAR): Fallback display name if public profile resolution is in flight.
2. `social_user_follows`:
   - `followed_user_id` (UUID): Used to calculate `COUNT(*)` followers per creator.
   - `follower_user_id` (UUID): Used to check if viewer already follows the creator (`isFollowing`).

### 4.2 Query Strategy
```sql
-- 1. Identify distinct active creators with public posts
SELECT p.author_id, COUNT(p.id) AS public_post_count
FROM social_posts p
WHERE p.deleted_at IS NULL
  AND (:viewerId IS NULL OR p.author_id != :viewerId)
GROUP BY p.author_id
ORDER BY public_post_count DESC
LIMIT 50;

-- 2. Follower counts and following state resolved in memory / repository batch methods:
-- countByIdFollowedUserId(UUID) and findByIdFollowerUserIdAndIdFollowedUserIdIn(UUID, Collection<UUID>)
```

---

## 5. Security & Trust Boundaries

- **Public Identity Protection**: The response strictly filters out private profile fields (email, phone number, password hash, role, security credentials). Only `userId`, `displayName`, and `avatarUrl` are returned.
- **Anti-IDOR & Self-Follow Prevention**:
  - The suggested creators query explicitly filters out the viewer (`author_id != viewer.id`).
  - Follow actions enforce `currentUser.id() != targetUserId` (preventing self-follow abuse).
- **Network Timeout & Circuit Breaker**:
  - Calls from `social-service` to `user-service` are guarded with a 3-second HTTP timeout.
  - If `user-service` fails, `social-service` falls back to stored `author_display_name` and placeholder avatar, ensuring the page never fails to render.

---

## 6. Failure Modes, Trade-offs & Devil's Advocate

| Scenario / Risk | Consequence | Mitigation Strategy |
| :--- | :--- | :--- |
| **New Platform / Cold Start** | Very few users have created public posts. | Return all active contributors; if fewer than `limit`, return available active creators without throwing errors. Frontend gracefully accepts small lists. |
| **User Service Outage** | `social-service` cannot fetch avatars via REST. | Use graceful degradation: render author display name from `social_posts` with initials-based fallback avatar. |
| **Rapid Follow/Unfollow Spams** | User rapidly toggles follow on creator card. | Frontend implements optimistic lock (`pendingFollowRef` prevents double-clicks). Backend follow endpoints are idempotent (`existsById` check). |
| **Route Typos Return 500** | Missing routes currently throw `NoResourceFoundException` -> caught as 500. | Explicit `@ExceptionHandler(NoResourceFoundException.class)` returns HTTP 404 with standard ErrorResponse. |

---

## 7. Implementation & Testing Plan

### Phase 1: Backend Exception Handling & User Client
1. Update `GlobalExceptionHandler.java` in `services/social-service` to catch `NoResourceFoundException` and return HTTP 404.
2. Configure `UserPublicProfileClient` in `social-service` using Spring `RestClient` to call `POST /api/users/public-profiles:batch`.

### Phase 2: Creator Discovery Endpoint in `social-service`
1. Create `SuggestedCreatorResponse` DTO.
2. Create `SocialCreatorService` and `SocialCreatorServiceImpl`:
   - Query top creators with public posts/shares.
   - Batch resolve follower counts via `SocialUserFollowRepository`.
   - Batch resolve `isFollowing` status for the authenticated viewer.
   - Enrich with avatars via `UserPublicProfileClient`.
3. Create `SocialCreatorController` mapping `GET /api/social/creators/suggested` and `GET /api/social/creator-suggestions`.
4. Add controller and service unit tests (`SocialCreatorControllerTest`, `SocialCreatorServiceTest`).

### Phase 3: Frontend Web Verification & Cleanup
1. Verify `real-social-post-api.ts` seamlessly consumes the real API response without hitting the mock fallback.
2. Confirm the browser console shows 0 HTTP 500 errors when browsing `/community`.
3. Run `npm test` and `npm run type-check` in `apps/web/tripsense` to ensure zero regressions.

---

`STATUS: WAITING_FOR_HUMAN_APPROVAL`
