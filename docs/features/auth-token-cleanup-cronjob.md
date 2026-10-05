# Auth Token & Session Cleanup Cronjob — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `services/user-service`
- **Affected Components**: `services/user-service`
- **Created Date**: 2026-09-24
- **Target PR Boundaries**: [Phase 1 (Database Migration & Indexes), Phase 2 (Repository, Service & Scheduled Job), Phase 3 (Unit & Integration Tests)]

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
In TripSense, user authentication uses short-lived JWT access tokens (15 minutes) and long-lived refresh tokens (idle timeout 7 days, absolute timeout 30 days) stored in the PostgreSQL database (`refresh_tokens` and `sessions` tables). Each token rotation or session creation generates new rows. 

Over time, expired or revoked refresh tokens and dead sessions accumulate indefinitely, consuming database storage, bloating table indexes (`token_hash` unique index), and gradually degrading authentication query performance.

This feature introduces an automated cleanup process in `user-service`:
1. Runs automatically on **Application Startup (`ApplicationReadyEvent`)** to purge any stale tokens accumulated while the server was offline/restarting.
2. Runs background Spring `@Scheduled` Cronjob daily at **3:00 AM (`0 0 3 * * ?`)** to safely and idempotently purge expired refresh tokens (`expires_at < NOW()`) and expired sessions (`absolute_expires_at < NOW()` or `idle_expires_at < NOW()`).

### 1.2 User Flows & Journey
1. **Startup & Scheduled Execution (Automated)**:
   - When the service starts up (`ApplicationReadyEvent`), an initial cleanup cycle executes immediately.
   - Every day at 3:00 AM (`0 0 3 * * ?`), the `TokenCleanupJob` wakes up and executes.
   - The job determines `now = LocalDateTime.now()`.
   - Step 1: Deletes all expired refresh tokens where `expires_at < now` or `(revoked_at IS NOT NULL AND revoked_at < now)`.
   - Step 2: Deletes all expired sessions where `absolute_expires_at < now` or `idle_expires_at < now`. Due to `ON DELETE CASCADE`, any residual tokens linked to expired sessions are safely removed.
   - Logs metrics with sanitized count: `Token cleanup completed: purged X expired tokens and Y expired sessions`.
2. **End-User Experience**:
   - Active users experiencing valid sessions are completely unaffected.
   - Performance of login, token refresh, and session validation is optimized and stable.

### 1.3 Scope Boundaries
- **In-Scope**:
  - Flyway migration with timestamp prefix (`V202609241555__add_token_cleanup_indexes.sql`) adding database indexes on `expires_at`, `revoked_at`, and `absolute_expires_at`.
  - Spring Scheduling configuration (`@EnableScheduling`) and scheduled cron job in `services/user-service`.
  - Application startup execution hook (`@EventListener(ApplicationReadyEvent.class)`) for immediate cleanup on service launch.
  - Repository delete queries in `RefreshTokenRepository` and `SessionRepository`.
  - Service layer `TokenCleanupService` with transaction management and execution metrics.
  - Configurable cron schedule and startup-cleanup toggle via `application.yaml` with environment variable overrides.
  - Comprehensive unit and integration tests.
- **Out-of-Scope**:
  - Deleting user accounts or personal profiles (only ephemeral auth tokens & sessions are purged).
  - External cron daemon or Kubernetes CronJob (in-process Spring `@Scheduled` is preferred for current architecture).

### 1.4 Acceptance Criteria
- [x] **AC-1**: Flyway migration adds indexes on `refresh_tokens(expires_at)`, `refresh_tokens(revoked_at)`, and `sessions(absolute_expires_at, idle_expires_at)`.
- [x] **AC-2**: Cronjob runs automatically according to the configured schedule (default `0 0 3 * * ?` / 3:00 AM daily).
- [x] **AC-3**: Application startup triggers cleanup cycle automatically upon `ApplicationReadyEvent`.
- [x] **AC-4**: All refresh tokens with `expires_at < now` are deleted.
- [x] **AC-5**: All sessions with `absolute_expires_at < now` or `idle_expires_at < now` are deleted.
- [x] **AC-6**: Valid, active refresh tokens and sessions are strictly preserved.
- [x] **AC-7**: Self-referencing FK (`replaced_token_id`) and foreign keys are safely handled without constraint violations.
- [x] **AC-8**: Execution logs report deleted counts without exposing any sensitive tokens, hashes, or user IDs (Zero-Leak logging).
- [x] **AC-9**: Unit tests verify deletion criteria, boundary conditions, startup trigger, and exception safety.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram
```text
[Spring Scheduling Task Executor]
             │
             │ Cron trigger: 0 0 3 * * ? (3:00 AM daily)
             ▼
    [TokenCleanupJob]
             │
             ▼
    [TokenCleanupService (@Transactional)]
       ├── 1. RefreshTokenRepository.deleteExpiredTokens(now)
       │         └── DELETE FROM refresh_tokens WHERE expires_at < :now OR (revoked_at < :now)
       │
       └── 2. SessionRepository.deleteExpiredSessions(now)
                 └── DELETE FROM sessions WHERE absolute_expires_at < :now OR idle_expires_at < :now
                         └── Cascades ON DELETE CASCADE to linked tokens
```

### 2.2 Service Ownership & Boundaries
| Component | Responsibility | Communication |
| --- | --- | --- |
| `services/user-service` | Owns `refresh_tokens` and `sessions` tables; executes in-service cleanup job | In-process Scheduled Job |
| `PostgreSQL (:5432/tripsense_user)` | Executes indexed bulk deletes under ACID transaction | JDBC / JPA |

### 2.3 Architecture Guardrails Verification
- [x] Dedicated service ownership: only `user-service` touches its own auth tables.
- [x] Zero cross-service calls: token cleanup is purely internal persistence maintenance.
- [x] Foreign key safety: respects `ON DELETE CASCADE` on `session_id` and `ON DELETE SET NULL` on `replaced_token_id`.
- [x] Zero-Leak logging: only aggregated record counts are logged, no tokens or user credentials.

---

## 3. Configuration & Scheduling Contracts

### 3.1 `application.yaml` Configuration
```yaml
auth:
  cleanup:
    enabled: ${AUTH_CLEANUP_ENABLED:true}
    cron: ${AUTH_CLEANUP_CRON:0 0 3 * * ?} # 3:00 AM daily
```

### 3.2 Method Signature
```java
public interface TokenCleanupService {
  CleanupResult cleanupExpiredTokensAndSessions(LocalDateTime now);
}

public record CleanupResult(int purgedTokens, int purgedSessions) {}
```

---

## 4. Database & Persistence

### 4.1 Migration Script: `V202609241555__add_token_cleanup_indexes.sql`
```sql
-- Indexes to optimize cronjob DELETE queries on refresh_tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at
    ON refresh_tokens (expires_at);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked_at
    ON refresh_tokens (revoked_at)
    WHERE revoked_at IS NOT NULL;

-- Indexes to optimize cronjob DELETE queries on sessions
CREATE INDEX IF NOT EXISTS idx_sessions_absolute_expires_at
    ON sessions (absolute_expires_at);

CREATE INDEX IF NOT EXISTS idx_sessions_idle_expires_at
    ON sessions (idle_expires_at);
```

### 4.2 Bulk Delete Queries
In `RefreshTokenRepository.java`:
```java
@Modifying(clearAutomatically = true)
@Query("DELETE FROM RefreshToken rt WHERE rt.expiresAt < :now OR (rt.revokedAt IS NOT NULL AND rt.revokedAt < :now)")
int deleteExpiredOrRevokedTokens(@Param("now") LocalDateTime now);
```

In `SessionRepository.java`:
```java
@Modifying(clearAutomatically = true)
@Query("DELETE FROM Session s WHERE s.absoluteExpiresAt < :now OR s.idleExpiresAt < :now")
int deleteExpiredSessions(@Param("now") LocalDateTime now);
```

---

## 5. Security & Trust Boundaries

| Risk Area | Mitigation Strategy |
| --- | --- |
| **Accidental Deletion of Valid Tokens** | Queries use strict `< :now` comparisons on `expires_at` and `absolute_expires_at`. Active tokens (`expires_at > now`) are never touched. |
| **Log Leakage** | Logs only output integer counts of deleted rows. Never log token strings, hashes, or user identifiers. |
| **Database Contention** | Scheduled at 3:00 AM when system usage is at its lowest daily nadir. Indexed deletes complete in milliseconds. |

---

## 6. Devil's Advocate & Technical Trade-offs

| Khía cạnh | Thách thức / Rủi ro | Giải pháp & Đánh đổi |
| --- | --- | --- |
| **Foreign Key Cycle on `replaced_token_id`** | Refresh tokens reference other refresh tokens via `replaced_token_id` | Table definition already specifies `ON DELETE SET NULL`. To prevent FK deadlocks during bulk delete, deleting expired tokens first nullifies replaced references automatically in PostgreSQL. |
| **Single Huge Transaction vs Batching** | Deleting tens of thousands of rows at once might lock tables | With indexes on `expires_at` and daily execution frequency, the daily volume of expired tokens is small (< few thousand), allowing fast single-transaction execution without complex cursor paging. |
| **Multi-instance Execution** | If multiple `user-service` pods run simultaneously, both might trigger cleanup | Deletion queries are completely idempotent (`DELETE WHERE expires_at < :now`). If two instances run simultaneously, the second simply deletes 0 rows with no conflict. |

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: Database Migration & Repository Queries
- [x] Task 1.1: Create Flyway migration `V202609241555__add_token_cleanup_indexes.sql` with indexes.
- [x] Task 1.2: Add `@Modifying` delete queries in `RefreshTokenRepository` and `SessionRepository`.

### Phase 2: Service & Scheduled Cronjob
- [x] Task 2.1: Create `TokenCleanupService` and implementation `TokenCleanupServiceImpl`.
- [x] Task 2.2: Create `TokenCleanupJob` with `@Scheduled(cron = "${auth.cleanup.cron:0 0 3 * * ?}")` and `@EventListener(ApplicationReadyEvent.class)`.
- [x] Task 2.3: Enable `@EnableScheduling` in `UserServiceApplication`.
- [x] Task 2.4: Add configuration properties in `application.yaml`.

### Phase 3: Unit Testing & Verification
- [x] Task 3.1: Write unit tests `TokenCleanupServiceTest.java` and `TokenCleanupJobTest.java`.
- [x] Task 3.2: Run test suite: `mvn -pl services/user-service test` (all 37 tests passed).

### Verification Commands
```bash
# Compile & Run user-service tests (37/37 passed)
mvn -pl services/user-service test
```

---

## Status

```text
STATUS: DONE
```
> Tính năng **Auth Token & Session Cleanup Cronjob** đã được triển khai hoàn chỉnh:
> - Tự động dọn dẹp ngay khi khởi động ứng dụng (`ApplicationReadyEvent`).
> - Tự động dọn dẹp định kỳ mỗi ngày lúc 3:00 sáng (`0 0 3 * * ?`).
> - Pass 100% bộ kiểm thử và đã xác minh migration thành công trên cơ sở dữ liệu.
