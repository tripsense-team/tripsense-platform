# Community Destination Weather — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `services/social-service`
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway`, `services/social-service`
- **Created Date**: 2026-09-24
- **Target PR Boundaries**: [Phase 1 (Backend DTO, Weather Client & In-Memory Cache), Phase 2 (Controller & Gateway Routing Test), Phase 3 (Web i18n & E2E Verification)]

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
Hiện tại widget "Thời tiết theo điểm đến" (`DestinationWeatherWidget`) trên trang Community Feed của Web frontend (`apps/web/tripsense`) đang gọi API `GET /api/social/weather?cityId={cityId}` nhưng backend chưa có endpoint này (gây lỗi 404 hoặc buộc frontend phải catch error và dùng mock repo).

Mục tiêu: Cung cấp endpoint thời tiết trực tiếp từ backend `social-service`, lấy dữ liệu thời tiết thực tế (nhiệt độ, độ ẩm, biên độ ngày, tình trạng mây/mưa/nắng) cho các địa điểm du lịch phổ biến của TripSense tại Việt Nam (Đà Lạt, Phú Quốc, Đà Nẵng, Hà Nội, Sa Pa, Ninh Bình) bằng dịch vụ thời tiết mở **Open-Meteo API**, kết hợp bộ nhớ đệm (in-memory cache 30 phút) và cơ chế tự phục hồi (resilient fallback presets) để widget luôn tải tức thì (< 50ms từ cache), không tốn chi phí và không bao giờ bị đứt đoạn kể cả khi mạng bên ngoài gặp sự cố.

### 1.2 User Flows & Journey
1. Người dùng truy cập trang Community Feed (`/social` hoặc `/explore`).
2. Widget bên phải hiển thị thời tiết hiện tại của điểm đến mặc định (Đà Lạt: nhiệt độ, biên độ ngày, độ ẩm, icon thời tiết, mẹo du lịch phù hợp).
3. Người dùng chọn điểm đến khác từ dropdown (ví dụ: Phú Quốc, Đà Nẵng, Sa Pa, Hà Nội, Ninh Bình).
4. Web gửi request `GET /api/social/weather?cityId={cityId}` qua API Gateway (`:8080`).
5. `social-service` kiểm tra cache:
   - Nếu đã có trong cache (< 30 phút): trả về ngay lập tức.
   - Nếu chưa có hoặc hết hạn: gọi Open-Meteo API theo toạ độ GPS (lat, lon), chuẩn hoá WMO weather code sang giao diện TripSense, lưu cache và trả về.
   - Nếu Open-Meteo bị timeout/lỗi kết nối: tự động fallback về preset dữ liệu mùa chuẩn với HTTP 200 OK (không bắn 500 ra UI).
6. Frontend cập nhật widget mượt mà với thông tin thời tiết chuẩn đa ngôn ngữ (EN/VI).

### 1.3 Scope Boundaries
- **In-Scope**:
  - Endpoint `GET /api/social/weather` nhận query param `cityId` (mặc định `dalat`).
  - Hỗ trợ 6 điểm đến trọng tâm: `dalat`, `phuquoc`, `danang`, `hanoi`, `sapa`, `ninhbinh`.
  - Tích hợp Open-Meteo REST API (hoàn toàn miễn phí, không cần API Key, không giới hạn phi thương mại).
  - Ánh xạ mã thời tiết WMO (World Meteorological Organization) sang condition text, condition key (`weatherConditionSunny`, `weatherConditionPartlyCloudy`, `weatherConditionCloudy`, `weatherConditionRainy`, `weatherConditionCool`), và icon type (`sunny`, `partlyCloudy`, `rainy`, `cool`, `cloudy`).
  - Cache in-memory TTL 30 phút (tránh spam outbound network requests).
  - Tự động fallback về dữ liệu preset nếu kết nối ngoại vi lỗi.
  - Bổ sung translation keys còn thiếu (`weatherConditionCloudy`, `weatherConditionRainy`) vào `locales/en.json` và `locales/vi.json`.
- **Out-of-Scope**:
  - Quản lý cảnh báo thiên tai khẩn cấp (disaster alerts push).
  - Dự báo theo từng giờ cho 7 ngày tiếp theo (widget hiện tại chỉ cần thời tiết hiện tại và min/max ngày).
  - Viết bảng DB riêng cho thời tiết (thời tiết biến thiên theo thời gian thực nên lưu cache RAM hiệu quả hơn nhiều so với ghi I/O PostgreSQL).

### 1.4 Acceptance Criteria
- [ ] AC-1: Gọi `GET /api/social/weather?cityId=dalat` trả về HTTP 200 `ApiResponse<DestinationWeatherResponse>` với cấu trúc khớp 100% kiểu `DestinationWeather` của frontend.
- [ ] AC-2: Nhiệt độ, độ ẩm và biên độ ngày (`tempRange`) phản ánh dữ liệu thực từ Open-Meteo (hoặc fallback khi offline).
- [ ] AC-3: Request lần thứ 2 với cùng `cityId` trong vòng 30 phút được phục vụ từ cache tức thì (< 10ms) mà không gọi lại mạng ngoài.
- [ ] AC-4: Khi Open-Meteo API ngắt kết nối hoặc timeout, service trả về fallback preset hợp lệ với HTTP 200 OK thay vì ném 500.
- [ ] AC-5: Hỗ trợ tìm kiếm không phân biệt chữ hoa chữ thường (`Dalat`, `DALAT`, `daLat` đều map về `dalat`). Nếu truyền `cityId` không tồn tại, tự động fallback về `dalat` an toàn.
- [ ] AC-6: Endpoint là public GET, không yêu cầu Bearer token (người dùng chưa đăng nhập vẫn xem được thời tiết cộng đồng).
- [ ] AC-7: Tuân thủ `ERROR_HANDLING_AND_LOGGING_STANDARDS.md`, không rò rỉ stack trace hoặc internal IP ra ngoài.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow
```text
[Browser / Next.js Web]
         |
         | 1. GET /api/social/weather?cityId=phuquoc
         v
[API Gateway (:8080)]
         |
         | 2. lb://social-service (Forward public GET)
         v
[Social Service (:8086)]
         |
         +---> [In-Memory Cache (TTL 30m)] ----(Cache Hit)----> [Return Cached Weather DTO]
         |
         | (Cache Miss / Expired)
         v
[Open-Meteo REST API] (https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...)
         |
         +---> (Success) ---> Parse WMO Code & Daily Min/Max ---> Update Cache ---> [Return 200 OK]
         |
         +---> (Timeout / 5xx) ---> Log Warn ---> Fallback to Climate Preset ---> [Return 200 OK]
```

### 2.2 Service Ownership & Communication
| Component | Responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | `DestinationWeatherWidget` hiển thị thời tiết & dropdown chọn điểm đến | HTTP REST client |
| `services/api-gateway` | Định tuyến `/api/social/**` tới `social-service` | Spring Cloud Gateway |
| `services/social-service` | Sở hữu `SocialWeatherController`, `SocialWeatherService`, in-memory cache, Open-Meteo client & fallback presets | Synchronous REST / Spring RestClient |
| Open-Meteo External API | Nguồn cấp dự báo thời tiết mở toàn cầu theo tọa độ GPS | Outbound HTTPS GET |

### 2.3 Architecture Guardrails Verification
- [x] Public traffic đi qua API Gateway (`/api/social/weather`).
- [x] Không vi phạm ranh giới dịch vụ: Không query DB của service khác, không tạo JPA chéo.
- [x] Stateless & Lightweight: Dữ liệu thời tiết là transient data (dữ liệu biến thiên theo thời gian thực), sử dụng cache TTL thay vì lưu trữ vĩnh viễn trong CSDL, giảm tải I/O tối đa cho PostgreSQL.
- [x] Tách biệt cấu hình: URL Open-Meteo và connect/read timeout cấu hình qua `application.yaml`.

---

## 3. API & Event Contracts

### 3.1 REST Endpoints
| Method | Gateway Path | Service Internal Path | Auth Required | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/api/social/weather` | `/api/social/weather` | Public (No Auth) | Lấy thông tin thời tiết của điểm đến theo `cityId` |

#### Query Parameters
- `cityId` (optional, string, default: `"dalat"`): Mã điểm đến (`dalat`, `phuquoc`, `danang`, `hanoi`, `sapa`, `ninhbinh`).

#### Response DTO (200 OK)
Khớp hoàn toàn với TypeScript interface `DestinationWeather` trong [apps/web/tripsense/src/features/social-post/types/discovery.ts](file:///Users/lebao/Working/TeamProject/tripsense-platform/apps/web/tripsense/src/features/social-post/types/discovery.ts):

```json
{
  "status": 200,
  "message": "Success",
  "data": {
    "id": "dalat",
    "cityName": "Đà Lạt",
    "cityKey": "destinationDalat",
    "temperature": 19,
    "condition": "Mây nhẹ",
    "conditionKey": "weatherConditionPartlyCloudy",
    "tempRange": "14° – 22°",
    "humidity": 75,
    "iconType": "partlyCloudy",
    "travelTip": "Thời tiết se lạnh lý tưởng để săn mây và đi cà phê",
    "travelTipKey": "weatherTipDalat",
    "updatedAt": "10 phút trước"
  }
}
```

### 3.2 Java DTO Definition
```java
package fu.tripsense.socialservice.dto.response;

public record DestinationWeatherResponse(
    String id,
    String cityName,
    String cityKey,
    Integer temperature,
    String condition,
    String conditionKey,
    String tempRange,
    Integer humidity,
    String updatedAt,
    String iconType,
    String travelTip,
    String travelTipKey
) {}
```

### 3.3 Destination GPS & Preset Registry
Tọa độ địa lý chuẩn của 6 điểm đến:
| ID | Tên thành phố | City Key | Latitude | Longitude | Travel Tip Key | Mẹo du lịch (Default) |
| --- | --- | --- | --- | --- | --- | --- |
| `dalat` | Đà Lạt | `destinationDalat` | `11.9404` | `108.4583` | `weatherTipDalat` | Thời tiết se lạnh lý tưởng để săn mây và đi cà phê |
| `phuquoc` | Phú Quốc | `destinationPhuQuoc` | `10.2289` | `103.9572` | `weatherTipPhuQuoc` | Biển êm sóng nhẹ, rất thích hợp lặn ngắm san hô |
| `danang` | Đà Nẵng | `destinationDaNang` | `16.0544` | `108.2022` | `weatherTipDaNang` | Thời tiết hoàn hảo cho tắm biển Mỹ Khê và lên Bán đảo Sơn Trà |
| `hanoi` | Hà Nội | `destinationHaNoi` | `21.0285` | `105.8542` | `weatherTipHaNoi` | Gió mát nhẹ thích hợp dạo quanh Hồ Tây và Phố Cổ |
| `sapa` | Sa Pa | `destinationSaPa` | `22.3364` | `103.8438` | `weatherTipSaPa` | Nên chuẩn bị áo ấm khi lên đỉnh Fansipan |
| `ninhbinh` | Ninh Bình | `destinationNinhBinh` | `20.2506` | `105.9745` | `weatherTipNinhBinh` | Rất đẹp để chèo thuyền Tràng An và Tam Cốc |

### 3.4 WMO Weather Code Mapping Table
Open-Meteo trả về `weather_code` chuẩn quốc tế WMO:
| WMO Code | Điều kiện tiếng Việt | Condition Key | Icon Type |
| --- | --- | --- | --- |
| `0` | Trời quang đãng | `weatherConditionSunny` | `sunny` |
| `1`, `2` | Mây rải rác | `weatherConditionPartlyCloudy` | `partlyCloudy` |
| `3` | Nhiều mây | `weatherConditionCloudy` | `cloudy` |
| `45`, `48` | Sương mù dịu mát | `weatherConditionCool` | `cool` |
| `51`, `53`, `55` | Mưa phùn nhẹ | `weatherConditionRainy` | `rainy` |
| `61`, `63`, `65` | Có mưa rào | `weatherConditionRainy` | `rainy` |
| `80`, `81`, `82` | Mưa rải rác | `weatherConditionRainy` | `rainy` |
| `95`, `96`, `99` | Có giông sét | `weatherConditionRainy` | `rainy` |
| *Mặc định khác* | Dịu mát | `weatherConditionCool` | `cool` |

*(Lưu ý: Nếu nhiệt độ <= 18°C và không mưa bão, ưu tiên hiển thị iconType `cool` để làm nổi bật đặc trưng khí hậu ôn đới/vùng cao như Sa Pa hay Đà Lạt).*

---

## 4. Data Model & Persistence

### 4.1 Persistence Strategy
- **Không cần bảng CSDL mới**:
  - Dữ liệu thời tiết biến đổi liên tục và mang tính nhất thời (transient).
  - Toàn bộ toạ độ địa lý và thông tin điểm đến được khai báo cố định trong Enum/Record registry (`DestinationConfig`).
  - Dữ liệu thời tiết tải về được lưu trong bộ nhớ đệm `ConcurrentHashMap` hoặc Caffeine cache với TTL 30 phút.
  - Sau 30 phút, request tiếp theo sẽ trigger tải mới ngầm hoặc đồng bộ, bảo đảm dữ liệu luôn tươi mới mà không gây quá tải mạng ngoài.

---

## 5. Security & Trust Boundaries

| Risk Area | Mitigation Strategy |
| --- | --- |
| **Authentication & Authorization** | Endpoint `GET /api/social/weather` là public đọc dữ liệu chung, cấu hình trong `SecurityConfig` bằng `.requestMatchers(HttpMethod.GET, "/api/social/**").permitAll()`. Không xử lý dữ liệu người dùng cá nhân. |
| **Denial of Service / External API Rate Limit** | Cache 30 phút đảm bảo 1 triệu lượt xem trang community feed mỗi ngày chỉ phát sinh tối đa `6 thành phố * 2 lần/giờ * 24 giờ = 288 requests/ngày` đến Open-Meteo (thấp hơn 0.003% giới hạn miễn phí 10,000 req/ngày của Open-Meteo). |
| **SSRF (Server-Side Request Forgery)** | Service không nhận URL từ client. Query param `cityId` được chuẩn hoá nghiêm ngặt qua danh sách Enum an toàn (whitelisted cities); không thể inject toạ độ hoặc URL bên ngoài. |
| **External Dependency Outage / Circuit Breaker** | Sử dụng HTTP client có connect timeout (2000ms) và read timeout (3000ms). Bọc `try-catch` bắt mọi ngoại lệ mạng (`ResourceAccessException`, `RestClientException`, `HttpServerErrorException`) để tự động trả về Fallback Preset với HTTP 200 OK. Tuyệt đối không bao giờ trả lỗi 500 hoặc rò rỉ network trace ra UI. |

---

## 6. Devil's Advocate & Technical Trade-offs

| Khía cạnh | Thách thức / Rủi ro | Giải pháp & Đánh đổi (Trade-off) |
| --- | --- | --- |
| **External API Latency** | Gọi Open-Meteo có thể mất 150ms - 500ms cho lần đầu tiên gọi | **Giải pháp**: Cache 30 phút. Lần gọi đầu chỉ 1 client chịu độ trễ nhỏ, toàn bộ các request tiếp theo được trả về trong 1ms từ RAM. |
| **Mất kết nối Internet của Server** | Server backend mất kết nối tới Open-Meteo (DNS failure, firewall, Open-Meteo downtime) | **Giải pháp**: Fallback Preset ngay lập tức. User vẫn thấy thời tiết chuẩn mùa của Đà Lạt, Sa Pa, Phú Quốc mà không hay biết hệ thống đang ngắt mạng ngoài. |
| **Lựa chọn Open-Meteo vs OpenWeatherMap** | OpenWeatherMap phổ biến hơn nhưng yêu cầu API Key đăng ký thẻ, giới hạn gắt gao | **Đánh đổi**: Open-Meteo không cần đăng ký API Key, mã nguồn mở, độ trễ châu Á cực thấp (~150ms), hoàn toàn miễn phí phi thương mại. |
| **Định dạng thời gian cập nhật** | Trả về ISO timestamp hay "Vừa cập nhật" / "10 phút trước"? | **Giải pháp**: Trả về chuỗi thân thiện "Vừa cập nhật" hoặc định dạng tương đối ("10 phút trước") khớp với format hiển thị mà `DestinationWeatherWidget` mong đợi. |

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: Service Models, Open-Meteo Client & In-Memory Cache
- [x] Task 1.1: Tạo DTO `DestinationWeatherResponse` trong `services/social-service/src/main/java/fu/tripsense/socialservice/dto/response/DestinationWeatherResponse.java`.
- [x] Task 1.2: Định nghĩa `DestinationCity` enum/record chứa thông tin GPS, cityKey, travelTipKey, fallback presets cho 6 thành phố.
- [x] Task 1.3: Cấu hình `RestClient` bean với timeout trong `services/social-service`.
- [x] Task 1.4: Triển khai `SocialWeatherService` với logic:
  - Cache lookup (TTL 30 phút).
  - Open-Meteo REST call & response parser.
  - Fallback handling khi ngoại lệ xảy ra.
- [x] Task 1.5: Viết Unit tests cho `SocialWeatherService` (kiểm tra parse WMO code, cache hit/miss, fallback khi lỗi mạng).

### Phase 2: Controller & Gateway Verification
- [x] Task 2.1: Triển khai `SocialWeatherController` với endpoint `GET /api/social/weather?cityId=...`.
- [x] Task 2.2: Viết `MockMvc` tests cho `SocialWeatherController` xác thực HTTP 200 và response contract.
- [x] Task 2.3: Chạy `mvn test -pl services/social-service` đảm bảo 100% test pass (73/73 tests passed).
- [x] Task 2.4: Khởi động lại `social-service` và test thực tế qua Gateway `http://localhost:8080/api/social/weather?cityId=dalat`.

### Phase 3: Web Frontend Translation & Integration
- [x] Task 3.1: Bổ sung `weatherConditionCloudy` ("Nhiều mây" / "Cloudy") và `weatherConditionRainy` ("Có mưa" / "Rainy") vào `apps/web/tripsense/src/locales/vi.json` và `en.json`.
- [x] Task 3.2: Chạy kiểm tra test frontend: `npm test` trong `apps/web/tripsense` (25/25 test files, 120/120 tests passed).
- [x] Task 3.3: Xác nhận widget thời tiết hiển thị trơn tru, không lỗi 500/404 cho mọi thành phố.

### Verification Results
```bash
# 1. Backend tests: 73/73 passed
mvn test -pl services/social-service

# 2. Frontend tests: 120/120 passed
npm test (apps/web/tripsense)

# 3. Live API Gateway verification:
curl -s "http://localhost:8080/api/social/weather?cityId=dalat"
# Output: {"success":true,"message":"Success","data":{"id":"dalat","cityName":"Đà Lạt","temperature":18,"condition":"Mưa phùn nhẹ","conditionKey":"weatherConditionRainy","tempRange":"18° – 19°","humidity":99,...}}

curl -s "http://localhost:8080/api/social/weather?cityId=phuquoc"
# Output: {"success":true,"message":"Success","data":{"id":"phuquoc","cityName":"Phú Quốc","temperature":25,"humidity":94,...}}
```

---

## Status

```text
STATUS: DONE
```
> Tính năng đã hoàn thành triển khai, kiểm thử tự động, tích hợp qua API Gateway và đối chiếu giao diện frontend thành công.
