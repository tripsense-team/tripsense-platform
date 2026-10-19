# Context-owned personalization — Specification & Implementation Plan

`STATUS: DONE`

Human approved implementation on 2026-10-19: “Tiến hành implements”. Implementation and automated verification completed on 2026-10-19; live user acceptance remains a manual handoff step.

- Updated: 2026-10-19.
- Owner của sở thích khai báo: `services/context-service`.
- Code thay đổi dự kiến: `services/recommendation-service`, `services/ai-service`; contract tests của Context.
- Backend-only. Không đổi schema/API User, không thêm cache/frontend, không yêu cầu đo hiệu năng trước.
- Bản này thay thế plan ban đầu: **giữ observed history độc lập**, không xây hệ thống consent mới.

## 1. Goal, scope và hiện trạng

### Mục tiêu

Context là nguồn duy nhất của sở thích người dùng khai báo trong onboarding/cài đặt. Recommendation và AI không đọc `/api/users/me/travel-preferences`, không dùng cờ `personalizationEnabled` ở User để chặn Context. User vẫn phụ trách tài khoản/identity và các nghiệp vụ riêng.

### Bằng chứng source đã kiểm tra

| Thành phần | Hiện trạng |
| --- | --- |
| `RemoteRecommendationContextProvider.resolve` | Cờ User đồng thời gate Context preferences và observed history. |
| `OnboardingController.preferences` | GET có auth, purpose Explore/Trip Planning, trả raw array, lọc STANDARD; Explore nhận thêm EXPLORE_AFFINITY. |
| `JpaPreferenceSignalPublisher` | Sinh signals từ selections; derive affinity từ ghi chú onboarding bằng allowlist, không gửi raw ghi chú qua preferences API. |
| AI `routes/chat.ts::fetchUserProfile` | Gọi User identity và User travel preferences; preferences được đưa vào prompt. Config Context URL đã có. |
| `JdbcRecommendationStore.read` | Sở hữu impression/feedback, seen/saved/added/dislike và affinity; không phải dữ liệu User travel. |
| `ExploreRecommendationCache.profileFingerprint` | Hash nội dung profile/history theo thứ tự ổn định, đã không hash updatedAt. |
| Settings | Đọc/sửa Context onboarding. HOME_CITY, VISITED, WANT_TO_VISIT chưa nằm trong preferences response. |

Lưu ý: User mô tả travel data có vé/phòng/chuyến bay; DTO `TravelPreferenceRequest` trong source hiện thấy là categories, dietary/accessibility/ambience, pace, budget. Chưa xác nhận dữ liệu production từ DTO này. Không cần đọc production để thực hiện quyết định loại bỏ dependency của hai consumer.

### Quyết định đề xuất duyệt

1. Context sở hữu **declared preferences**, không phải mọi tín hiệu recommendation.
2. Giữ lịch sử tương tác do Recommendation sở hữu và cách merge/weight hiện có. Tách việc bật đọc history khỏi legacy User flag bằng cấu hình backend `RECOMMENDATION_OBSERVED_HISTORY_ENABLED`, đề xuất mặc định true. False chỉ tắt đọc/áp dụng history, không xóa dữ liệu hoặc dừng ghi impression.
3. Đây là thay đổi hành vi có chủ đích: người trước đây bị cờ User=false chặn history sẽ được áp dụng history khi cấu hình mới bật. Không mô tả đây là refactor hoàn toàn không đổi kết quả.
4. Giữ lookup tên hiển thị `/api/users/me` cho AI như dữ liệu identity độc lập. Chỉ loại bỏ lookup User travel preferences.
5. Query/category/location và ràng buộc trip hiện tại được ưu tiên hơn sở thích onboarding; preferences là tín hiệu mềm, không tự trở thành filter cứng.

Ngoài phạm vi: xóa field/table/API User; vé/phòng/chuyến bay; thay đổi login/identity; frontend/localStorage/prefetch; Redis Context mới; Kafka mới; mở rộng AI memory; tuning ranking/provider/retrieval/limits; bỏ impression; thiết kế lại consent UI.

## 2. Architecture và service boundaries

```text
Web -> Gateway -> Recommendation
                    |-- Context /preferences: sở thích onboarding
                    |-- Recommendation DB: history/feedback (nếu bật)
                    `-- merge -> retrieval/ranking -> result cache + impression

Web -> Gateway -> AI
                    |-- Context /preferences: sở thích lập kế hoạch
                    |-- User /me: tên hiển thị
                    `-- yêu cầu hiện tại + trip brief + sở thích -> prompt/tools

Settings -> Gateway -> Context /onboarding: giữ nguyên
```

- Mỗi service chỉ truy vấn DB của mình, không entity/JPA chéo service, không đọc trực tiếp Redis namespace của service khác.
- HTTP đồng bộ vì consumer cần input cho request hiện tại; timeout hữu hạn, không thêm retry nối tiếp. Giữ timeout Recommendation hiện có; AI Context 1500ms như lookup hiện tại.
- Tách Context client/validator/mapper của AI thành module typed có test, không tiếp tục nhồi logic vào `chat.ts`.
- Không cần executor mới cho source migration. Có thể dùng bounded mechanism hiện hữu nếu song song hóa; không ảnh hưởng executor hybrid retrieval đã có.

## 3. API contracts và mapping

### API giữ nguyên

| Consumer | Request | Auth | Response |
| --- | --- | --- | --- |
| Recommendation Explore | GET `/api/context/preferences?purpose=EXPLORE_RECOMMENDATION` | Bearer của request đã xác thực | `PreferenceSignal[]` |
| Recommendation planning | GET `/api/context/preferences?purpose=TRIP_PLANNING`, theo command hiện có | Bearer | `PreferenceSignal[]` |
| AI chat/itinerary | GET `/api/context/preferences?purpose=TRIP_PLANNING` | Bearer | `PreferenceSignal[]` |
| Settings | GET/PUT `/api/context/onboarding` và complete/delete hiện có | Bearer | Giữ nguyên |

Response preferences là raw array, không có `data` envelope:

```json
[{"dimensionCode":"FOOD_STYLE","valueCode":"CAFE","confidence":1.0,"source":"ONBOARDING","updatedAt":"2026-10-19T00:00:00Z"}]
```

Purpose không hỗ trợ: 400. Không có signals: 200 với `[]`. Không xác thực/không được phép: 401/403 theo security hiện có.

- Context giữ lọc purpose/sensitivity. Consumers chỉ dùng source `ONBOARDING`, `ONBOARDING_DERIVED_V1` và dimension/value được hỗ trợ; không tự nhận source hành vi khác là declared preference.
- Validate shape, kiểu dữ liệu, confidence hữu hạn trong [0,1]; đặt giới hạn body/số signals hữu hạn theo catalog/giới hạn onboarding hiện có, không cắt cụt âm thầm. Deduplicate/sort deterministic. JSON sai kiểu, NaN/Infinity không lọt vào ranking/prompt/cache fingerprint.
- Không thêm endpoint hay envelope, không mở rộng quyền đọc của API.

### Recommendation

- Dùng lại `ExplorePreferenceMapper` cho FOOD_STYLE, ACTIVITY_INTEREST, STAY_STYLE, SPLURGE_CATEGORY, EXPLORE_AFFINITY; không đổi taxonomy/weights.
- Merge declared và observed bằng công thức hiện có; giữ seen/saved/added/negative IDs. Không thay call consent bằng boolean=true rồi bỏ qua trách nhiệm từng nguồn.
- `UserProfileSnapshot.personalizationEnabled` sau migration là trạng thái pipeline cá nhân hóa nội bộ, không còn là bản sao consent User. `available` phản ánh có dữ liệu hữu ích, HTTP 200 rỗng không đồng nghĩa đã cá nhân hóa.
- Giữ shape public response; `personalization.applied` phải phản ánh tín hiệu thuật toán thực sự dùng. Không sửa giá trị legacy field ở User để làm response thành true.

### AI

Thay object User `Record<string, any>` bằng DTO mapper riêng:

```ts
type DeclaredTravelPreferences = {
  travelParty?: string;
  budgetTier?: string;
  stayStyles: string[];
  foodStyles: string[];
  activityInterests: string[];
  splurgeCategories: string[];
};
```

- Chỉ map dimension STANDARD tương ứng và value allowlist khớp onboarding hiện có; unknown/sensitive bị bỏ, không dump mọi fields vào prompt.
- Không chuyển raw freeText/attributes, dietary/accessibility/loyalty data. Prompt coi preferences là dữ liệu tham khảo, không chỉ thị; yêu cầu hiện tại > trip brief > onboarding defaults.
- Failure identity và Context độc lập: lỗi `/users/me` không làm mất preferences hợp lệ; lỗi Context không làm mất tên hợp lệ.
- Không fallback User travel endpoint khi Context lỗi.

### Giới hạn được công khai

HOME_CITY, VISITED, WANT_TO_VISIT hiện chưa nằm trong contract preferences. Đợt này không hứa AI/Recommendation đã dùng chúng, không suy HOME_CITY là GPS hiện tại, không override địa điểm tìm kiếm bằng quê quán. Nếu cần dùng các trường đó, mở rộng Context bằng typed purpose projection ở phạm vi tiếp theo; không đọc nguyên onboarding sang AI cho tiện.

Không thêm event. Existing outbox `PreferenceProfileChanged.v1` chưa chứng minh Kafka publication/consumer invalidation end-to-end; phase này không phụ thuộc vào giả định đó.

## 4. Failure handling, cache và consistency

| Tình huống | Recommendation | AI |
| --- | --- | --- |
| Context có signals | Declared + history nếu bật | Structured preferences cho request hiện tại |
| Context rỗng/chưa hoàn tất onboarding | Không declared; giữ history hợp lệ nếu bật | Tiếp tục không sở thích mặc định |
| Context timeout/5xx/schema error | Không User fallback; giữ history hợp lệ, nếu không có thì neutral | Tiếp tục bằng query/brief/trip |
| History tắt/lỗi | Context vẫn hoạt động; lỗi nguồn history được cô lập | Không liên quan |
| Request/trip không có quyền | Giữ cơ chế chặn authorization hiện có | Giữ cơ chế chặn authorization hiện có |

Downstream Context 401/403: không retry bằng account khác, không dùng snapshot cá nhân cũ; đánh dấu source unavailable và fallback. Không nuốt lỗi auth của request chính hoặc quyền trip. Empty và unavailable phân biệt trong diagnostics, không log values/tokens/body.

### Existing Explore cache

1. Không thêm cache Context, không yêu cầu một đợt đo mới. Resolve effective profile trước lookup kết quả như hiện tại.
2. Giữ fingerprint deterministic, user/query/destination/algorithm isolation; không đưa `Instant.now()` vào identity profile.
3. Bump fresh và LKG policy namespace, ví dụ `rec:explore:v2:`, để không dùng kết quả dưới gate cũ. Không global Redis flush; giữ serialize-once/pipeline đã tối ưu.
4. Mapped preferences đổi/xóa phải đổi effective fingerprint. LKG không vượt qua user/profile/policy boundary. Fallback thiếu Context không ghi dưới key của profile đầy đủ.
5. History có thể làm fingerprint thay đổi sau tương tác như thiết kế hiện có; không hứa mọi request sau đều cache hit, không tuning history/cache cadence trong PR này.
6. Request đang chạy có thể dùng snapshot trước một lần save đồng thời. Request bắt đầu sau save commit phải đọc signals mới. Không có cache Context mới nên không cần Kafka invalidation để đạt mức nhất quán này.

### Browser

Không đổi frontend. Settings tiếp tục tải khi mở, không thêm localStorage hay preload toàn site. Browser không phải nguồn Context đáng tin cậy cho backend. Cache bộ nhớ UI chỉ cân nhắc trong một nhu cầu frontend riêng.

## 5. Persistence, security và rollout

- Không migration/table/index/backfill; không copy Context vào User, không truy vấn DB chéo service. Giữ impression storage/batch insert nguyên trạng.
- Giữ tất cả API/fields User cho consumer khác; chỉ gỡ method/DTO/config thật sự hết dùng trong đúng consumer. AI vẫn cần User URL cho identity.
- Context owner lấy từ JWT principal, không userId do client tùy ý truyền. Không log raw preference data hoặc upstream error cho UI.
- Không dựng hệ thống consent mới cho các sở thích onboarding cơ bản, không coi `consentRevision`/memory toggle là quyền sử dụng mọi dữ liệu.
- Rà UI nào còn mô tả legacy flag sẽ tắt các luồng này; báo cáo nếu có mâu thuẫn, không tự sửa UI ngoài scope. Không biến việc này thành yêu cầu xây privacy platform mới.
- Kiểm tra local/prod Context URL 8087. Chỉ sửa wiring scripts/Compose khi thực sự thiếu/sai; không thay CD/secrets ngoài scope.
- Giữ diagnostics hiện có, bỏ ý nghĩa `user_consent` trong luồng mới, thêm source status/counts vừa đủ; không thêm dashboard/monitoring project.
- Rollback bằng revision trước và cache policy namespace tương ứng; không duy trì hai nguồn User/Context lâu dài chỉ để rollback. Chỉ restart/redeploy service có code đổi một lần sau verification.

## 6. Phases, tasks và acceptance criteria

### A. Recommendation

- [x] Regression tests cho gate cũ/Context contract trước khi sửa.
- [x] Loại bỏ User consent/travel call, tách Context declared khỏi observed reader; thêm observed-history config default true như đề xuất.
- [x] Giữ mapper/merge/weights/impression; cô lập lỗi nguồn; sửa semantics empty/available/applied.
- [x] Bump cache policy namespace và test cả fresh/LKG.

### B. AI

- [x] Typed Context client/validator/mapper; replace User travel call, giữ identity độc lập.
- [x] Prompt precedence và schema tests; giữ tools/trip lifecycle nguyên trạng.
- [x] Đưa tests mới vào npm test: script hiện liệt kê explicit từng file nên chỉ thêm file chưa đủ để CI chạy.

### C. Contract/regression verification và handoff

- [x] Context purpose/source/sensitivity và save/complete/delete tests; draft không tự thành completed.
- [x] Chạy offline Recommendation suite, Context tests, AI build/tests; không chạy cloud integration mutate Qdrant/provider.
- [x] Kiểm tra wiring, sanitization và docs; handoff một đợt manual test ngắn, không nhiều vòng restart/log-copy.

| AC | Kiểm thử bắt buộc |
| --- | --- |
| AC1: User dependency removed | Stub travel endpoint true/false/500 đều không nhận call; cùng Context/history thì effective profile giống nhau bất kể User flag. User API/schema nguyên trạng. |
| AC2: Correct Context | Đúng purpose, raw-array parsing, source/dimension/value allowlist; malformed/unknown/invalid confidence không làm lỗi luồng chính. |
| AC3: History độc lập | Context rỗng/lỗi vẫn dùng history khi bật; history tắt/lỗi vẫn dùng Context; flag false không gọi history reader nhưng impression vẫn lưu. |
| AC4: Graceful fallback | Cả hai nguồn mất => neutral; identity/Context AI lỗi độc lập; không fallback User travel hoặc stale cross-profile cache. |
| AC5: Cache correctness | Profile giống => hash giống; mapped prefs đổi/xóa => hash đổi; v2 không đọc v1; LKG không vượt user/profile/policy. |
| AC6: Security | Chủ thể A không đọc Context B, auth/trip errors giữ nguyên, không log token/profile/body. |
| AC7: AI applies Context | Prompt có mapped Context, không User travel payload; yêu cầu hiện tại/brief ưu tiên onboarding; Context rỗng vẫn chat được. |
| AC8: No regressions | Giữ hybrid retrieval, local/provider policy, explicit geo/category constraints, batch impression và Redis pipeline. |
| AC9: Settings lifecycle | COMPLETED save thay signals; draft không publish sớm; delete xóa declared; request sau commit không tái dùng declared cũ. |

Verification dự kiến từ root, dùng JDK21 trên máy để tránh Lombok/JDK25:

```bash
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home mvn -o -B -ntp -pl services/context-service -am test -DargLine=-javaagent:/Users/lebao/.m2/repository/org/mockito/mockito-core/5.23.0/mockito-core-5.23.0.jar
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home mvn -o -B -ntp -pl services/recommendation-service -am test '-Dtest=*,!SemanticCloudIntegrationTest' -Dsurefire.failIfNoSpecifiedTests=false -DargLine=-javaagent:/Users/lebao/.m2/repository/org/mockito/mockito-core/5.23.0/mockito-core-5.23.0.jar
npm --prefix services/ai-service test
git diff --check
```

Kết quả chạy thực tế được ghi ở phần Completion bên dưới; các lệnh trên dùng để tái kiểm thử.

Manual acceptance sau triển khai: đổi FOOD_STYLE/ACTIVITY_INTEREST trong Settings của tài khoản đã onboarding; request Explore tiếp theo dùng declared mới; chat mới nhận Context; legacy User flag không ảnh hưởng hai luồng. Không hứa kết quả cụ thể tăng cafe nếu candidate DB không có đủ cafe.

## 7. Review synthesis và trade-offs

- Product: một nguồn khai báo sở thích; giữ history hữu ích, nhưng công khai việc có thể kích hoạt history cho tài khoản trước đây bị legacy gate chặn.
- Architecture: reuse Context API thay vì thêm service/snapshot/cache/Kafka không cần thiết. Backend consumers không phụ thuộc browser storage.
- API: migration từ User preference object sang Context signal array phải có mapper/test, không chỉ đổi URL.
- Database: zero migration/destructive cleanup, giữ ownership và impression pipeline.
- Security: giữ auth/purpose allowlists; không mở rộng sang sensitive dimensions/AI memory; không suy Context service chứa gì cũng an toàn.
- Trade-off: không dùng HOME_CITY/wishlist ngay vì API chưa phục vụ; không lấy nguyên onboarding để tránh scope creep. Nếu cần, thiết kế typed projection riêng sau.
- Failure trade-off: chấp nhận giảm cá nhân hóa tạm thời khi Context mất, không quay về nguồn User đã loại bỏ. Không tune latency/ranking/cache TTL trong cùng đợt.

## Human approval gate

Đề nghị duyệt A–C: Recommendation + AI dùng Context cho sở thích khai báo; giữ observed history độc lập với legacy User flag (default bật), giữ User identity và impression; không thêm API/schema/cache/frontend. Không còn câu hỏi bắt buộc ngoài việc duyệt phạm vi này. Nếu muốn tắt history, sửa quyết định đó trước implementation.

`STATUS: DONE`

## 8. Completion — 2026-10-19

### Delivered

- Recommendation không còn User travel/consent HTTP call, User DTO hay downstream User URL config. Context luôn được resolve theo purpose, history có flag độc lập default true và graceful fallback.
- Context consumer kiểm tra raw-array, tối đa 200 signals/64 KiB response, nguồn onboarding, cặp dimension/value hợp lệ, confidence hữu hạn; duplicate không tự tăng confidence. Chỉ log source status/counts và loại exception.
- AI dùng module `src/personalization/context-preferences.ts`, typed allowlist mapping và timeout 1500ms; identity/Context fail độc lập, không shared Context cache, không User travel fallback. Prompt có thứ tự ưu tiên yêu cầu hiện tại/brief/onboarding; không đổi AI tools.
- Fresh/LKG namespace `rec:explore:v2:`. Fingerprint vẫn ổn định theo nội dung, bổ sung disliked categories để không đụng key khi effective dislikes khác; không hash timestamp. Giữ pipeline/serialize-once.
- Compose thêm Context/User identity URL và startup dependencies cho AI, chuyển Recommendation khỏi dependency User, passthrough observed-history flag. Local script sẵn dùng port 8087 và npm dev; không cần sửa script.
- Không đổi application code Context, User, frontend, schema hoặc migration. Context chỉ bổ sung regression/contract tests.

### Verification results

| Check | Result |
| --- | --- |
| Recommendation offline suite, excluding SemanticCloudIntegrationTest | 162 passed, 0 failed |
| Context suite | 15 passed, 0 failed |
| AI npm test (includes tsc build and new Context tests) | 19 passed, 0 failed |
| Scoped Java Spotless formatting | Passed |
| `docker compose -f deploy/docker-compose.prod.yml config --no-interpolate --quiet` | Passed; syntax/model validation only, not deployment |
| `bash -n scripts/start.sh` | Passed |
| `git diff --check` | Passed |

No production/cloud vector integration tests, provider writes, real account preference changes, service restarts or live LLM calls were performed for verification. Existing unrelated worktree edits were preserved.

### Required implementation self-review

- Architecture: approved boundaries retained, configured Context HTTP and local history only, public routes unchanged. No blockers found.
- Database: no migration/cross-service DB access or persistence changes; history reads use existing owner adapter. No blockers found.
- Security: JWT principal ownership covered by Context MVC contract tests, unknown/sensitive preference inputs filtered, payload bounds/timeouts, type-only failure logging; existing auth/trip checks retained. No blockers found. MVC tests are not an end-to-end JWT/deployment audit.
- PR review: dead User preference call/config removed; new AI tests included in explicit npm script; cache policy isolated; backend suites green. No blockers found for this scoped implementation.
- Legacy UI audit: no `personalizationEnabled` or `travel-preferences` references found in current web source; onboarding/settings remain Context-based. No UI modifications performed.

### One-round manual handoff

1. Restart only Recommendation (:8088) to load Java/config changes. With `scripts/start.sh`, stop its existing terminal process then rerun the script; already-running services are skipped. AI uses `npm run dev`/tsx watch and normally reloads automatically; restart only AI if not using watch or changes were not loaded. Context/Gateway/User do not require a restart for this feature.
2. In an already-onboarded account, edit FOOD_STYLE/ACTIVITY_INTEREST in Settings and save; return to Explore. Result metadata should reflect effective personalization; source diagnostics use `context_preferences_status` and `context_preference_signals`, not `user_consent`.
3. Send a new AI message to check recommendations respect preferences but follow explicit request constraints. Model output remains probabilistic; automated prompt tests verify the supplied Context input, not a guaranteed wording/place list.
4. Optional controlled check: set `RECOMMENDATION_OBSERVED_HISTORY_ENABLED=false` before starting Recommendation to use Context without history. This does not stop impression recording. Default is true; no env change is required for normal use.

Known limit remains: HOME_CITY/VISITED/WANT_TO_VISIT are not yet projected into the preferences API; no claim that this implementation uses them.
