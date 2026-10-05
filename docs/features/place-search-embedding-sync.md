# Tự Động Đồng Bộ Vector Embedding Vào Qdrant Khi Tìm Kiếm (Place Search Embedding Sync) — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `services/recommendation-service` & `services/place-service`
- **Affected Components**: `services/place-service`, `services/recommendation-service`, Qdrant Cloud
- **Created Date**: 2026-09-27
- **Target PR Boundaries**: Phase 1 (`recommendation-service` internal indexing endpoint), Phase 2 (`place-service` async trigger), Phase 3 (End-to-End Verification with Qdrant)

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
Khi người dùng tìm kiếm địa điểm trên web TripSense, các kết quả trả về có thể chứa các từ khóa không liên quan đến du lịch (ví dụ: *"xe múc huế"*, dịch vụ sửa chữa...) và chưa có đầy đủ thông tin chi tiết (mô tả, review, giờ mở cửa).
- **Mục tiêu**: Đặt điểm trigger tự động khi người dùng **xem chi tiết địa điểm (`GET /api/places/{id}`)**: Địa điểm được người dùng thực sự quan tâm và đã được làm giàu dữ liệu trọn vẹn (ảnh, review, mô tả) sẽ được tự động đồng bộ sang `recommendation-service` để tạo vector embedding 1536 chiều và lưu vào Qdrant Cloud. Điều này giúp ngăn chặn các địa điểm rác lọt vào Vector DB và tối ưu quota Gemini API.

### 1.2 User Flows & Journey
1. Người dùng click vào một địa điểm (trên search dropdown, danh sách khám phá, hoặc bản đồ).
2. Web frontend gọi API `GET /api/places/{id}?includePhoto=true` qua API Gateway tới `place-service`.
3. `place-service` tải và làm giàu dữ liệu trọn vẹn (ảnh, đánh giá, giờ mở cửa) và lưu vào MongoDB.
4. Ngay khi dữ liệu chi tiết sẵn sàng, `place-service` kích hoạt một tác vụ chạy ngầm bất đồng bộ (`CompletableFuture.runAsync()`) gửi địa điểm sang `recommendation-service`.
5. `recommendation-service` nhận địa điểm:
   - Kiểm tra `storedContentHash` trên Qdrant:
     - Nếu quán đã có trong Qdrant và nội dung không đổi (`contentHash` trùng khớp): Bỏ qua (không tốn quota Gemini API).
     - Nếu quán mới hoặc nội dung thay đổi: Gọi Google Gemini Embedding API (`gemini-embedding-001`, 1536 chiều), sau đó upsert vào Qdrant Cloud collection `tripsense_places`.
6. Luồng xem chi tiết của người dùng trả về nhanh chóng, không bị block bởi tiến trình embedding.

### 1.3 Scope Boundaries
- **In-Scope**:
  - Endpoint nội bộ tại `recommendation-service` nhận danh sách `PlaceIndexRequestItem` và gọi `PlaceSemanticIndexer.indexIfChanged`.
  - Client bất đồng bộ `RecommendationIndexerClient` tại `place-service` gọi sang `recommendation-service` khi hoàn tất tìm kiếm địa điểm.
  - Cơ chế Graceful Degradation: Nếu Gemini API hoặc Qdrant bận/lỗi, chỉ ghi log cảnh báo và không ảnh hưởng đến kết quả tìm kiếm của người dùng.
  - Tối ưu hóa xử lý song song (`parallelStream`) cho batch indexing.
- **Out-of-Scope**:
  - Không thay đổi thuật toán xếp hạng hay giao diện người dùng.
  - Không sửa đổi database MongoDB của `place-service` hay PostgreSQL của `recommendation-service`.

### 1.4 Acceptance Criteria
- [x] **AC-1**: Khi gọi `GET /api/places/search`, danh sách địa điểm trả về nhanh chóng, không bị chậm trễ do tiến trình embedding.
- [x] **AC-2**: Địa điểm mới xuất hiện từ tìm kiếm được tạo vector 1536 chiều và xuất hiện trong Qdrant Cloud collection `tripsense_places`.
- [x] **AC-3**: Địa điểm đã được index từ trước và không đổi nội dung sẽ không bị gọi Gemini embedding lại (dựa trên SHA-256 `contentHash`).
- [x] **AC-4**: Nếu `recommendation-service` hoặc Qdrant bị tắt/lỗi mạng, `place-service` vẫn trả kết quả tìm kiếm bình thường cho người dùng.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow
```text
[Web Frontend] 
      │ (GET /api/places/{id}?includePhoto=true)
      ▼
[API Gateway :8080]
      │
      ▼
[place-service :8083]
      │ 1. Enrich Details (MongoDB / ZioMap Provider: photos, reviews, hours)
      │ 2. Return rich details to user immediately (<1.2s)
      │
      └─► (Async Fire-and-Forget via CompletableFuture) ──► [recommendation-service :8088]
                                                                    │ 1. Check contentHash via Qdrant
                                                                    │ 2. Call Gemini Embeddings (1536 dim)
                                                                    ▼
                                                            [Qdrant Cloud :6333]
                                                            (tripsense_places)
```

### 2.2 Service Ownership & Communication
| Component | Trách nhiệm | Phương thức giao tiếp |
| --- | --- | --- |
| `services/place-service` | Sở hữu dữ liệu địa điểm, tìm kiếm ZioMap, lưu MongoDB | REST API đồng bộ với Client; Async HTTP gọi recommendation-service |
| `services/recommendation-service` | Sở hữu mô hình AI Embedding (Gemini) và Vector DB (Qdrant) | Nhận REST endpoint nội bộ `/api/recommendations/internal/places/index` |
| `Qdrant Cloud` | Lưu trữ vector 1536 chiều và payload tìm kiếm tương đồng | HTTP REST qua QdrantVectorSearchClient |

### 2.3 Architecture Guardrails Verification
- [x] Mỗi service tự quản lý dữ liệu riêng: `place-service` sở hữu MongoDB, `recommendation-service` sở hữu Qdrant và PostgreSQL.
- [x] Không có truy vấn trực tiếp chéo database.
- [x] Sử dụng giao thức REST contract với DTO tường minh giữa 2 microservices.
- [x] Tác vụ tính toán embedding và đẩy vào Qdrant được phân tách bất đồng bộ (`CompletableFuture.runAsync()`), đảm bảo zero-impact đến SLA tìm kiếm của người dùng.

---

## 3. API & Event Contracts

### 3.1 REST Endpoints

#### Endpoint nội bộ trên `recommendation-service`:
- **Method**: `POST`
- **Internal Path**: `/api/recommendations/internal/places/index`
- **Auth**: Service-to-service internal (được cấu hình permit trong `SecurityConfig.java`)
- **Description**: Nhận danh sách địa điểm và lập chỉ mục vào Qdrant nếu có thay đổi.

#### Request DTO (`List<PlaceIndexRequestItem>`):
```json
[
  {
    "id": "6ab90ea63d665f2e6a37081e",
    "name": "Bánh mì Madame Thanh",
    "categories": ["đặc sản đà nẵng", "ẩm thực truyền thống"],
    "description": "Quán bánh mì ngon",
    "address": "294/42 Điện Biên Phủ, Thanh Khê, Đà Nẵng",
    "city": "Da Nang",
    "lat": 16.0667,
    "lng": 108.1941,
    "rating": 4.5,
    "userRatingCount": 120
  }
]
```

#### Response DTO (`ApiResponse<PlaceIndexResponse>`):
```json
{
  "success": true,
  "data": {
    "submitted": 19,
    "indexed": 19,
    "skipped": 0,
    "semanticEnabled": true
  }
}
```

---

## 4. Security & Trust Boundaries

| Vùng rủi ro | Chiến lược kiểm soát |
| --- | --- |
| **API Rate Limit / Quota** | Gemini Embedding API có giới hạn RPM. `PlaceSemanticIndexer` kiểm tra `storedContentHash` trước khi gọi embedding, chỉ những quán thực sự mới hoặc bị đổi thông tin mới tiêu thụ quota. |
| **Circuit Breaking / Failure Isolation** | Cuộc gọi từ `place-service` sang `recommendation-service` chạy trong thread pool riêng (async) với timeout 60s. Lỗi kết nối không được phép throw ra ngoài làm gián đoạn response tìm kiếm. |
| **Secrets Protection** | Khóa bí mật Gemini `EMBEDDING_API_KEY` và `QDRANT_API_KEY` chỉ nằm tại `recommendation-service`, không để lộ sang `place-service` hay frontend. |

---

## 5. Technical Trade-offs

| Khía cạnh | Thách thức / Rủi ro | Giải pháp & Đánh đổi |
| --- | --- | --- |
| **Tốc độ phản hồi tìm kiếm** | Tạo embedding cho 20 quán có thể mất 3-10s nếu chạy tuần tự. | Chạy **Asynchronous (Fire-and-forget)** tại `place-service` và dùng **parallelStream** tại `recommendation-service`. Người dùng nhận kết quả tìm kiếm ngay lập tức (<50ms), trong khi 20 quán được embed song song chỉ mất ~3.1 giây. |
| **Trùng lặp & Quota Gemini** | Nếu người dùng tìm kiếm cùng một từ khóa nhiều lần, Gemini có thể bị gọi lại liên tục. | Dùng SHA-256 hash nội dung lưu kèm trong payload Qdrant. Nếu hash đã tồn tại, bỏ qua ngay lập tức mà không gọi Gemini API. |

---

## 6. Phased Implementation Tasks & Verification

### Phase 1: Endpoint lập chỉ mục nội bộ trên `recommendation-service`
- [x] Task 1.1: Tạo DTO `PlaceIndexRequestItem` và `PlaceIndexResponse`.
- [x] Task 1.2: Tạo Controller `InternalPlaceIndexingController` với endpoint `POST /api/recommendations/internal/places/index`.
- [x] Task 1.3: Tích hợp với `PlaceSemanticIndexer.indexIfChanged(PlaceSnapshot place)` và tối ưu xử lý song song với `parallelStream`.
- [x] Task 1.4: Viết unit test & live integration test (`PlaceIndexingServiceTest`, `PlaceSemanticIndexerTest`, `SemanticCloudIntegrationTest`).

### Phase 2: Client kích hoạt bất đồng bộ trên `place-service`
- [x] Task 2.1: Tạo `RecommendationIndexerClient` sử dụng `RestClient` trong `place-service` trỏ tới `recommendation-service:8088`.
- [x] Task 2.2: Tích hợp vào `PlaceSearchServiceImpl.searchPlaces(...)` (kể cả kết quả local, provider, và cache): kích hoạt async indexing.
- [x] Task 2.3: Bọc try/catch và log cảnh báo lỗi nhẹ nhàng, không gây ảnh hưởng đến search flow.

### Phase 3: Kiểm thử End-to-End
- [x] Task 3.1: Chạy `mvn test` trên cả `place-service` (28/28 tests passed) và `recommendation-service` (47/47 tests passed).
- [x] Task 3.2: Gửi request tìm kiếm thực tế (`GET /api/places/search?q=banh%20mi`) và kiểm tra Qdrant Cloud API: 42 điểm (points) đã được lưu thành công với vector 1536 chiều và payload hoàn chỉnh.

---

## 7. Verification Evidence & Test Summary

### 7.1 Automated Unit & Integration Tests
- **`recommendation-service`**:
  - `PlaceIndexingServiceTest`: 5/5 tests passed (skip disabled, index changed, skip unchanged, exception handling, null check).
  - `PlaceSemanticIndexerTest`: 3/3 tests passed (new place, unchanged content hash, updated content hash).
  - `SemanticCloudIntegrationTest`: Live integration test passed with Gemini OpenAI-compatible API and Qdrant Cloud.
  - Tổng số test: **47/47 tests PASSED**.
- **`place-service`**:
  - `RecommendationIndexerClientTest`: 2/2 tests passed (null handling, failure isolation).
  - `PlaceSearchServiceTest`: 6/6 tests passed.
  - `PlaceDetailsServiceTest`: 6/6 tests passed.
  - Tổng số test: **28/28 tests PASSED**.

### 7.2 End-to-End Live Verification
1. **Search Request**: `GET http://localhost:8083/api/places/search?q=banh%20mi`
   - Phản hồi: HTTP 200 OK với 19 địa điểm bánh mì tại Đà Nẵng trong ~40ms.
2. **Recommendation-Service Indexing**:
   - Log ghi nhận: `Place indexing completed: submitted=19, indexed=19, skipped=0` trong 3.198s.
3. **Qdrant Cloud Verification**:
   - Truy vấn `GET https://...qdrant.io:6333/collections/tripsense_places`:
   - `points_count`: Tăng từ 23 lên **42 points**.
   - Vector dimension: **1536** (Cosine distance).
4. **Deduplication Verification (Lần tìm kiếm thứ 2)**:
   - Gọi lại `GET http://localhost:8083/api/places/search?q=banh%20mi`.
   - Log ghi nhận: `Place indexing completed: submitted=19, indexed=0, skipped=19` trong 200ms. Không tốn bất kỳ quota Gemini embedding nào!
