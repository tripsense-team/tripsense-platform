# TripSense Frontend: Error Handling, Sanitization & Logging Standards

> **Tài liệu quy chuẩn xử lý lỗi an toàn và ghi nhật ký (Logging) trên giao diện TripSense (`apps/web/tripsense`)**  
> Áp dụng bắt buộc cho toàn bộ lập trình viên và **AI Coding Agents** (Antigravity, Cursor, Windsurf, Copilot, Claude Code).

---

## 1. Triết lý Cốt lõi: Chính sách "Zero-Leak" (Zero-Leak Policy)

Khi xảy ra lỗi trên hệ thống (đặc biệt là các lỗi từ database, microservices, hoặc crash nội bộ), **tuyệt đối không bao giờ được phép để lộ thông tin kỹ thuật thô ra giao diện người dùng (UI), Toast thông báo, Form alert, hay client-side logs**.

### Các rủi ro nghiêm trọng khi lộ lỗi thô:

1. **Lỗ hổng Tiết lộ Thông tin (CWE-209 / Information Disclosure)**:
   - Câu lệnh SQL, cấu trúc bảng (`users`, `trip_shares`), tên cột (`auth_provider`, `password_hash`) giúp kẻ tấn công dò tìm điểm yếu để khai thác SQL Injection hoặc tấn công leo thang đặc quyền.
2. **Vỡ giao diện & Trải nghiệm tồi tệ (Broken UX)**:
   - Các chuỗi lỗi dài hàng trăm ký tự như `JDBC exception executing SQL [ERROR: column u1_0.auth_provider does not exist Position: 16]` làm vỡ layout, tràn modal, gây hoang mang và mất niềm tin nơi người dùng.
3. **Lộ thông tin nhạy cảm trong Client Logs**:
   - `console.log(response)` chứa JWT Access Token, Refresh Token, mật khẩu hoặc dữ liệu cá nhân có thể bị đọc trộm qua các tiện ích mở rộng trình duyệt (browser extensions) độc hại hoặc tấn công XSS.

---

## 2. Cơ chế Bảo vệ Tự động tại Tầng `apiClient` (Error Sanitization Guardrail)

Để đảm bảo an toàn ngay cả khi lập trình viên hoặc AI Agent vô tình viết `toast.error(error.message)` hoặc `setError(error.message)`, TripSense đã thiết lập **bộ lọc lỗi tự động (Error Sanitizer Interceptor)** tại:

- [`src/services/api-client.ts`](file:///Users/lebao/Working/TeamProject/tripsense-platform/apps/web/tripsense/src/services/api-client.ts)
- [`src/services/error-sanitizer.ts`](file:///Users/lebao/Working/TeamProject/tripsense-platform/apps/web/tripsense/src/services/error-sanitizer.ts)

### Cách thức hoạt động:

```
Backend Response (HTTP 4xx / 5xx)
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ apiClient Interceptor                                       │
│ 1. Phát hiện: HTTP >= 500 hoặc chứa mẫu kỹ thuật:           │
│    (JDBC, SQL, Hibernate, PSQLException, Spring trace...)    │
│ 2. Sinh mã sự cố ngắn: e.g. "ERR-A8F2K4"                    │
│ 3. Dọn dẹp dữ liệu (Scrub stackTrace, sql, query khỏi data) │
│ 4. Thay message bằng câu lịch sự, thân thiện UI/UX           │
└─────────────────────────────┬───────────────────────────────┘
                              │ Ném ra ApiError đã được lọc sạch
                              ▼
UI / Component / Toast (An toàn 100%, không lộ dữ liệu)
```

1. **Mọi `ApiError` ném ra đều có `message` an toàn**:
   - Khi có lỗi 5xx hoặc chứa SQL/Hibernate: `error.message` tự động trở thành:  
     `"Hệ thống đang bận hoặc gián đoạn kết nối. Vui lòng thử lại sau. (Mã tham chiếu: ERR-XXXXXX)"`.
   - Các lỗi nhập liệu 4xx hợp lệ (ví dụ: `"Mật khẩu phải có ít nhất 8 ký tự"`, `"Email đã tồn tại"`) vẫn được giữ nguyên để hướng dẫn người dùng.
2. **Loại bỏ triệt để trường dữ liệu nhạy cảm trong `error.data`**:
   - Các thuộc tính `stackTrace`, `trace`, `exception`, `cause`, `sql`, `query` được đệ quy gỡ bỏ trước khi đính vào đối tượng `ApiError`.
3. **Hỗ trợ Debug an toàn trong môi trường Development**:
   - Khi chạy ở môi trường phát triển (`NODE_ENV === 'development'`), hệ thống sẽ in cảnh báo:  
     `[TripSense Dev Guard] Intercepted and sanitized sensitive server error (...)`  
     giúp lập trình viên tra cứu nguyên nhân lỗi trong DevTools mà không hiển thị ra UI.

---

## 3. Quy chuẩn Logging trên Frontend (`console.log` / `console.error`)

### ❌ Những điều NGHIÊM CẤM (Strictly Prohibited):

- **Cấm log Token & Credentials**: Tuyệt đối không `console.log(token)`, `console.log(headers)`, hoặc `console.log(authStore.getState())`.
- **Cấm log mật khẩu / OTP**: Không in giá trị các ô input mật khẩu, mã xác thực email ra console.
- **Cấm log raw server dump trong Production code**: Không để lại các đoạn code như `console.log("DEBUG RESPONSE:", res)` khi commit code lên git.

### ✅ Những điều ĐƯỢC PHÉP & KHUYẾN KHÍCH:

- **Log có điều kiện môi trường**:
  ```ts
  if (process.env.NODE_ENV === "development") {
    console.debug("[TripFeature] Action executed:", { tripId: id });
  }
  ```
- **Chỉ log metadata không nhạy cảm**: ID thực thể công khai (`postId`, `tripId`), mã tham chiếu lỗi (`incidentRef`), trạng thái luồng (`"fetch_start"`, `"fetch_success"`).

---

## 4. Bảng Đối chiếu: Được phép hiển thị vs Nghiêm cấm hiển thị

| Lỗi gốc từ Backend / Hệ thống                                                                                               | ❌ CẤM hiển thị lên UI / Toast            | ✅ Chuẩn UI/UX TripSense                                                                               |
| :-------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------- | :----------------------------------------------------------------------------------------------------- |
| `JDBC exception executing SQL [ERROR: column u1_0.auth_provider does not exist Position: 16]`                               | Toàn bộ chuỗi SQL / JDBC                  | `"Hệ thống đang bận hoặc gián đoạn kết nối. Vui lòng thử lại sau. (Mã tham chiếu: ERR-XXXXXX)"`        |
| `org.springframework.dao.DataIntegrityViolationException: duplicate key value violates unique constraint "users_email_key"` | Toàn bộ tên exception và tên ràng buộc DB | `"Email này đã được sử dụng bởi một tài khoản khác."` (409) hoặc thông báo chung nếu không bắt được mã |
| `java.lang.NullPointerException at com.tripsense.trip.service.TripService.create(TripService.java:104)`                     | Stack trace Java                          | `"Không thể tạo chuyến đi lúc này. Vui lòng thử lại sau."`                                             |
| `HTTP error! status: 502 Bad Gateway / 504 Gateway Timeout`                                                                 | `HTTP 502 / 504`                          | `"Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền và thử lại."`                          |
| Form đăng nhập sai mật khẩu                                                                                                 | `"Password does not match bcrypt hash"`   | `"Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại."`                                        |

---

## 5. Code Templates mẫu cho Lập trình viên & AI Agents

### Template 1: Gọi API trong React Component (Try / Catch + Safe Feedback)

```tsx
import React, { useState } from "react";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { useTranslation } from "@/i18n";

export function SaveTripButton({
  tripId,
  data,
}: {
  tripId: string;
  data: TripData;
}) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { t } = useTranslation();

  const handleSave = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      await updateTripApi(tripId, data);
      // Feedback thành công (chỉ khi UI chưa tự giải thích)
    } catch (error) {
      // ✅ SỬ DỤNG HÀM getSafeErrorMessage ĐỂ LỌC LỖI TUYỆT ĐỐI AN TOÀN
      const safeMsg = getSafeErrorMessage(error, t("common.unexpectedError"));
      setErrorMessage(safeMsg);

      // Log an toàn chỉ trong dev
      if (process.env.NODE_ENV === "development") {
        console.warn("[SaveTripButton] Failed to save trip:", {
          tripId,
          error,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleSave} disabled={loading}>
        {loading ? t("common.saving") : t("common.save")}
      </button>
      {errorMessage && (
        <p className="text-xs text-destructive mt-1">{errorMessage}</p>
      )}
    </div>
  );
}
```

### Template 2: Custom Hook Mutation (Optimistic Update + Rollback an toàn)

```tsx
export function useLikePost(postId: string, initialLikes: number) {
  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(false);

  const toggleLike = async () => {
    // 1. Optimistic update
    const prevLiked = isLiked;
    const prevLikes = likes;
    setIsLiked(!prevLiked);
    setLikes(prevLiked ? likes - 1 : likes + 1);

    try {
      await apiClient(`/api/posts/${postId}/like`, { method: "POST" });
    } catch (error) {
      // 2. Rollback khi lỗi
      setIsLiked(prevLiked);
      setLikes(prevLikes);

      // 3. Log dev an toàn
      if (process.env.NODE_ENV === "development") {
        console.warn("[useLikePost] Like failed, rolled back:", {
          postId,
          error,
        });
      }
    }
  };

  return { likes, isLiked, toggleLike };
}
```

---

## 6. Chỉ thị Bắt buộc Dành Riêng cho AI Coding Agents

Mọi AI Coding Agent khi tạo mới hoặc cập nhật tính năng frontend trên TripSense **BẮT BUỘC** tuân thủ 7 điều sau:

1. **Tuyệt đối không gán `error.stack`, `error.response.data`, hoặc raw error string vào JSX hoặc Toasts**.
2. **Luôn sử dụng `getSafeErrorMessage(err)` hoặc `err.message` từ `ApiError`**: Vì `apiClient` đã tích hợp sẵn bộ lọc `error-sanitizer.ts`.
3. **Đối với form nhập liệu**: Luôn hiển thị thông báo lỗi inline dưới ô nhập liệu tương ứng, dùng thông điệp ngắn gọn, văn minh, không đổ lỗi người dùng.
4. **Đối với thao tác thất bại**: Thông báo lỗi phải mang tính xây dựng (ví dụ: _"Không thể tải ảnh. Vui lòng kiểm tra dung lượng và thử lại"_ thay vì _"Lỗi 500"_).
5. **Không in token / password ra console**: Bất kỳ đoạn mã nào sinh ra `console.log` chứa đối tượng nhạy cảm sẽ bị từ chối trong khâu PR review.
6. **Mọi chuỗi thông báo lỗi phải được quản lý qua i18n**: Đặt trong namespace tương ứng (`auth`, `social`, `trip`, `common`) ở cả `en.json` và `vi.json`.
7. **Luôn chạy kiểm tra trước khi hoàn thành**:
   - `npm run i18n:check`
   - `npm test`
