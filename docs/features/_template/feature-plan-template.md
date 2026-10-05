# [Feature Name] — Specification & Implementation Plan

`STATUS: WAITING_FOR_HUMAN_APPROVAL`

- **Owner Service**: `services/<owning-service>`
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway`, `services/<service-name>`
- **Created Date**: YYYY-MM-DD
- **Target PR Boundaries**: [Phase 1 (Backend Contract), Phase 2 (Data & Business Logic), Phase 3 (Frontend / Web Integration)]

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
<!-- Mô tả ngắn gọn vấn đề cần giải quyết, giá trị mang lại cho người dùng cuối hoặc hệ thống. -->

### 1.2 User Flows & Journey
<!-- Luồng tương tác từng bước của người dùng. -->
1. Người dùng làm gì...
2. Hệ thống xử lý gì...
3. Kết quả hiển thị ra sao...

### 1.3 Scope Boundaries
- **In-Scope**:
  - ...
- **Out-of-Scope**:
  - ...

### 1.4 Acceptance Criteria
- [ ] AC-1: ...
- [ ] AC-2: ...
- [ ] AC-3: ...

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow
```text
[User / Next.js Web] -> (REST / SSE) -> [API Gateway (:8080)] -> (REST) -> [Owning Service]
                                                                        |
                                                                        v (Async Event)
                                                                    [Kafka Topic]
```

### 2.2 Service Ownership & Communication
| Component | Responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | Giao diện người dùng, gọi Gateway | HTTP REST / SSE |
| `services/api-gateway` | Routing, JWT verification, rate limiting | Spring Cloud Gateway |
| `services/<service-name>` | Sở hữu nghiệp vụ và cơ sở dữ liệu chính | Synchronous Spring Boot |
| `<other-service>` | Tiêu thụ event bất đồng bộ (nếu có) | Kafka Consumer |

### 2.3 Architecture Guardrails Verification
- [x] Public traffic đi qua API Gateway.
- [x] Mỗi service tự quản lý database riêng, **tuyệt đối không query chéo DB**.
- [x] **Không tạo JPA Entity relationship chéo microservice** (chỉ lưu ID hoặc Snapshot DTO).
- [x] Sử dụng Kafka cho đồng bộ bất đồng bộ; chỉ dùng REST đồng bộ khi luồng người dùng cần dữ liệu tức thời.

---

## 3. API & Event Contracts

### 3.1 REST Endpoints (API Gateway / Service)
| Method | Gateway Path | Service Internal Path | Auth Required | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/...` | `/api/v1/...` | `Bearer JWT` | Tạo mới resource |
| `GET` | `/api/v1/.../{id}`| `/api/v1/.../{id}` | `Bearer JWT` / `Public` | Lấy chi tiết |

#### Request & Response DTOs
```json
// POST /api/v1/... Request DTO
{
  "title": "string",
  "metadata": {}
}

// Response DTO (200 OK)
{
  "id": "uuid",
  "title": "string",
  "createdAt": "2026-09-17T00:00:00Z"
}
```

### 3.2 Kafka Event Specifications (nếu có)
- **Topic**: `tripsense.<domain>.<event-name>.v1`
- **Partition Key**: `<resourceId>` hoặc `<userId>`
- **Payload Schema**:
```json
{
  "eventId": "uuid",
  "eventType": "RESOURCE_CREATED",
  "timestamp": 1726588800000,
  "payload": {
    "resourceId": "uuid",
    "userId": "uuid"
  }
}
```

---

## 4. Data Model & Migrations

### 4.1 Schema Definition
<!-- Bảng SQL (PostgreSQL/MySQL) hoặc MongoDB Collections -->
```sql
CREATE TABLE IF NOT EXISTS example_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_example_user_id ON example_table(user_id);
CREATE INDEX IF NOT EXISTS idx_example_status ON example_table(status);
```

### 4.2 Migration Strategy
- **Migration tool**: Flyway (`V...__create_example_table.sql`)
- **Rollback strategy**: Script hoàn tác hoặc backward-compatible schema changes (Add column nullable, deprecate old columns).

---

## 5. Security & Trust Boundaries

| Risk Area | Mitigation Strategy |
| --- | --- |
| **Authentication** | JWT Validation tại Gateway và trích xuất `X-User-Id` / Bearer token ở downstream service. |
| **Authorization / IDOR** | Service LUÔN kiểm tra `resource.userId == currentUserId` trước khi thực hiện CRUD, không tin cậy client params. |
| **Input Validation** | Sử dụng `@Valid`, Bean Validation constraints (`@NotBlank`, `@Size`, regex) và escape HTML/XSS. |
| **Secrets Management** | Toàn bộ API keys, JWT secrets lưu ở biến môi trường backend, không bao giờ gửi về client web. |

---

## 6. Devil's Advocate & Technical Trade-offs

| Khía cạnh | Thách thức / Rủi ro | Giải pháp & Đánh đổi (Trade-off) |
| --- | --- | --- |
| **Concurrency** | 2 requests cùng sửa 1 resource cùng lúc | Áp dụng Optimistic Locking (`@Version` column) hoặc database unique constraint. |
| **Eventual Consistency** | Độ trễ khi sync qua Kafka | UI hiển thị trạng thái `OPTIMISTIC UPDATE` hoặc `PENDING`, hỗ trợ fallback refresh. |
| **Alternative Rejected** | Lý do không chọn giải pháp khác | Ghi rõ lý do tại sao không chọn cách tiếp cận khác để tránh tranh cãi sau này. |

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: Database & Core Service Domain
- [ ] Task 1.1: Viết migration script Flyway.
- [ ] Task 1.2: Tạo Entity, Repository, DTOs, Service logic.
- [ ] Task 1.3: Viết Unit tests cho Business Rules.

### Phase 2: Controllers & Gateway Routing
- [ ] Task 2.1: Implement REST Controller & Error Handling.
- [ ] Task 2.2: Cấu hình API Gateway routing.
- [ ] Task 2.3: Integration tests với Testcontainers/MockMvc.

### Phase 3: Web Frontend & End-to-End Verification
- [ ] Task 3.1: Thêm API client, React query / hooks, UI components.
- [ ] Task 3.2: Manual flow verification & E2E sanity check.

### Verification Commands
```bash
# Backend Test
./mvnw clean test -pl services/<service-name>

# Frontend Lint & Build
cd apps/web/tripsense && npm run build
```

---

## Human Approval Gate

```text
STATUS: WAITING_FOR_HUMAN_APPROVAL
```
> Kế hoạch kỹ thuật đã sẵn sàng để kiểm tra. Người duyệt vui lòng kiểm tra các mục trên. 
> Phản hồi `Approved`, `Implement` hoặc `Proceed` để bắt đầu triển khai code.
