# TripSense Frontend i18n & Localization Standards

Tài liệu này quy định tiêu chuẩn, kiến trúc phân chia namespace (tab), quy tắc bắt buộc và quy trình kiểm thử tự động cho hệ thống đa ngôn ngữ (i18n) trong ứng dụng TripSense Next.js (`apps/web/tripsense`).

Mọi lập trình viên và **AI Agent** khi tham gia phát triển frontend đều **bắt buộc tuân thủ** các quy chuẩn trong tài liệu này trước khi commit mã nguồn.

---

## 1. Cấu Trúc Thư Mục & Tệp Tin

Toàn bộ tài nguyên i18n được quản lý tập trung tại:

```text
tripsense-platform/
├── .husky/
│   └── pre-commit                  # Git hook toàn repo tự động chạy i18n check trước khi commit
└── apps/web/tripsense/
    ├── src/
    │   ├── locales/                # Chứa toàn bộ file từ điển ngôn ngữ định dạng JSON
    │   │   ├── en.json             # Tiếng Anh (English - Ngôn ngữ mặc định / chuẩn schema)
    │   │   └── vi.json             # Tiếng Việt (Vietnamese)
    │   ├── i18n/
    │   │   ├── config.ts           # Registry cấu hình các ngôn ngữ được hỗ trợ
    │   │   ├── i18n-context.tsx    # React Context & Hook useTranslation()
    │   │   ├── index.ts            # Public exports
    │   │   └── __tests__/
    │   │       └── i18n.test.ts    # Unit test cho i18n engine
    │   └── components/shared/
    │       └── language-switcher.tsx # UI dropdown chuyển đổi ngôn ngữ
    └── scripts/
        ├── check-i18n.mjs          # Script CI/Pre-commit kiểm tra schema parity & sắp xếp A-Z
        └── i18n-utils.mjs          # Hàm tiện ích deep sort & schema compare
```

---

## 2. Nguyên Tắc Phân Vùng Namespace (Domain Tabs)

Từ điển ngôn ngữ được tổ chức thành các **Domain Tabs / Namespaces** rõ ràng, phản ánh các phân hệ nghiệp vụ của hệ thống TripSense:

| Namespace / Tab | Phạm vi & Mục đích                                                                                                                                                            | Ví dụ các trường (Fields)                                                                                                              |
| :-------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| **`common`**    | **Dùng chung toàn hệ thống**: Chứa các nút bấm hành động, trạng thái, nhãn dùng lặp đi lặp lại ở nhiều nơi. **Bắt buộc dùng `common` khi từ vựng bị trùng lặp giữa các tab.** | `save`, `cancel`, `edit`, `delete`, `search`, `loading`, `confirm`, `retry`, `refresh`, `copy`, `copied`, `status`, `active`, `filter` |
| **`auth`**      | Toàn bộ quy trình định danh, đăng nhập, đăng ký, khôi phục mật khẩu, mã OTP, tài khoản Google, điều khoản dịch vụ.                                                            | `login`, `register`, `email`, `password`, `continueGoogle`, `otpCode`, `verifyOtp`, `forgotPassword`, `welcomeTitle`                   |
| **`social`**    | Mạng xã hội du lịch: bài viết cộng đồng, bình luận đa cấp, tương tác thích/chia sẻ, thẻ tags, danh sách feed.                                                                 | `feedTitle`, `createPost`, `postContent`, `likePost`, `commentContent`, `sharesCount`, `deletePostConfirm`                             |
| **`trip`**      | Quản lý hành trình: tạo chuyến đi, các ngày trong lịch trình, hoạt động, ngân sách, mời thành viên, xuất lịch trình.                                                          | `myTrips`, `createTrip`, `destination`, `startDate`, `day`, `budget`, `inviteMember`, `exportItinerary`, `visibility`                  |
| **`places`**    | Địa điểm & Khám phá: thông tin danh lam, bản đồ, địa chỉ, đánh giá sao, giờ mở cửa, lưu địa điểm yêu thích.                                                                   | `placeName`, `address`, `rating`, `reviews`, `openingHours`, `savePlace`, `viewOnMap`, `filterByCategory`                              |
| **`aiPlanner`** | Trợ lý lập kế hoạch AI: form nhập sở thích, phong cách du lịch, gợi ý thông minh, tiến trình AI đang tạo.                                                                     | `prompt`, `travelStyle`, `pace`, `preferences`, `generateItinerary`, `generating`, `smartRecommendations`                              |
| **`nav`**       | Thanh điều hướng (Header, Sidebar, Mobile Bar).                                                                                                                               | `explore`, `trips`, `aiPlanner`, `community`, `places`, `profile`, `admin`                                                             |
| **`errors`**    | Thông điệp lỗi hệ thống, mã lỗi HTTP từ Backend Gateway.                                                                                                                      | `generic`, `network`, `badCredentials`, `unauthorized`, `forbidden`, `notFound`, `serverBusy`, `tooManyRequests`                       |
| **`app`**       | Thông tin thương hiệu ứng dụng (metadata, slogan).                                                                                                                            | `name`, `tagline`, `description`                                                                                                       |

### Quy Tắc Chống Trùng Lặp (Deduplication Rule):

> [!IMPORTANT]
> Khi cần nhãn cho các hành động cơ bản như **Lưu**, **Hủy**, **Xóa**, **Sửa**, **Tìm kiếm**, **Đang tải**, **Thử lại**... **KHÔNG ĐƯỢC** tự ý tạo riêng khóa trong `auth`, `trip` hay `social`. Hãy sử dụng `common.<action>` (ví dụ: `common.save`, `common.cancel`).
> Chỉ đặt vào tab domain nếu hành động mang ngữ nghĩa đặc thù riêng biệt (ví dụ: `trip.exportItinerary`, `social.likePost`).

---

## 3. Quy Tắc Bắt Buộc Cho AI Agent & Lập Trình Viên

Mọi AI Agent khi nhận yêu cầu thêm tính năng mới hoặc chỉnh sửa giao diện **phải thực hiện nghiêm ngặt 5 bước sau**:

### Quy Tắc 1: Luôn cập nhật 100% Cặp Ngôn Ngữ (Parity)

Khi thêm bất kỳ khóa dịch mới nào vào `en.json`, **bắt buộc** phải thêm khóa tương ứng với bản dịch tiếng Việt vào `vi.json` (và các ngôn ngữ khác nếu có). Nếu một bên thiếu khóa, hệ thống CI/Git hook sẽ từ chối commit.

### Quy Tắc 2: Sắp Xếp Bảng Chữ Cái A → Z (Alphabetical Sorting)

Tất cả các object cấp cao (tabs) và các keys lồng nhau bên trong file JSON **phải được sắp xếp theo thứ tự A → Z**.

- Sau khi thêm/sửa khóa, chạy lệnh tự động sắp xếp:
  ```bash
  npm run i18n:sort
  ```
- Hoặc kiểm tra:
  ```bash
  npm run i18n:check
  ```

### Quy Tắc 3: Cú Pháp Biến Nội Suy (Interpolation)

Sử dụng cặp ngoặc nhọn kép `{{variableName}}`:

```json
{
  "auth": {
    "verificationCodeSent": "We sent a 6-digit verification code to {{email}}"
  },
  "trip": {
    "day": "Day {{number}}"
  }
}
```

### Quy Tắc 4: Không Hardcode Text trong Component

Mọi chuỗi hiển thị cho người dùng (User-facing text) trong React component đều phải được lấy qua hook `useTranslation()`:

```tsx
import { useTranslation } from "@/i18n";

export function TripCard({ trip }: TripCardProps) {
  const { t } = useTranslation();

  return (
    <div className="trip-card">
      <h3>{trip.title}</h3>
      <p>
        {t("trip.estimatedCost")}: {trip.cost}
      </p>
      <button>{t("common.edit")}</button>
      <button>{t("common.delete")}</button>
    </div>
  );
}
```

### Quy Tắc 5: Cơ Chế Fallback An Toàn

Engine i18n được thiết kế an toàn:

1. Nếu chuỗi dịch tại ngôn ngữ hiện tại (`vi`) chưa có, hệ thống tự động fallback sang tiếng Anh (`en`).
2. Nếu cả 2 đều không có, hệ thống in ra chính `key` (ví dụ `"trip.unknownKey"`) thay vì làm crash giao diện.

---

## 4. Quy Trình Thêm Ngôn Ngữ Mới (Ví dụ: Tiếng Nhật `ja.json`)

Khi dự án mở rộng hỗ trợ ngôn ngữ mới:

1. Tạo file `apps/web/tripsense/src/locales/ja.json` với cấu trúc tabs y hệt `en.json`.
2. Khai báo mã ngôn ngữ vào `apps/web/tripsense/src/i18n/config.ts`:
   ```typescript
   export const SUPPORTED_LOCALES = ["en", "vi", "ja"] as const;
   export const LOCALE_NAMES: Record<SupportedLocale, string> = {
     en: "English",
     vi: "Tiếng Việt",
     ja: "日本語",
   };
   ```
3. Chạy lệnh kiểm tra schema:
   ```bash
   npm run i18n:sort
   npm run i18n:check
   ```
   _Script sẽ tự động phát hiện tất cả các file trong `src/locales/_.json` và so khớp tính đồng bộ.\*

---

## 5. Danh Sách Lệnh Thường Dùng (Cheatsheet)

| Lệnh                  | Vị trí chạy          | Mục đích                                                |
| :-------------------- | :------------------- | :------------------------------------------------------ |
| `npm run i18n:check`  | `apps/web/tripsense` | Kiểm tra tính nhất quán và thứ tự A-Z giữa các ngôn ngữ |
| `npm run i18n:sort`   | `apps/web/tripsense` | Tự động format và sắp xếp lại toàn bộ file JSON A-Z     |
| `npm test`            | `apps/web/tripsense` | Chạy toàn bộ unit test (bao gồm cả `i18n.test.ts`)      |
| `git commit -m "..."` | Root repository      | Tự động kích hoạt Husky pre-commit hook để check i18n   |
