import test from "node:test";
import assert from "node:assert/strict";
import {
  isGenericChatTitle,
  capitalizeWords,
  cleanUserPrompt,
  generateSmartTitle,
} from "./chat-title.js";

test("isGenericChatTitle accurately flags default and empty titles", () => {
  assert.equal(isGenericChatTitle(""), true);
  assert.equal(isGenericChatTitle(null), true);
  assert.equal(isGenericChatTitle(undefined), true);
  assert.equal(isGenericChatTitle("   "), true);
  assert.equal(isGenericChatTitle("Cuộc trò chuyện mới"), true);
  assert.equal(isGenericChatTitle("New chat"), true);
  assert.equal(isGenericChatTitle("Kế hoạch chuyến đi của bạn"), true);
  assert.equal(isGenericChatTitle("Your trip plan"), true);
  assert.equal(isGenericChatTitle("cuộc trò chuyện mới 1"), true);
  assert.equal(isGenericChatTitle("kế hoạch chuyến đi"), true);

  // Custom user titles should NOT be flagged as generic
  assert.equal(isGenericChatTitle("Lịch trình Đà Nẵng"), false);
  assert.equal(isGenericChatTitle("Ẩm thực Hà Nội"), false);
  assert.equal(isGenericChatTitle("Du lịch cùng gia đình"), false);
  assert.equal(isGenericChatTitle("Chuyến đi mùa hè 2026"), false);
});

test("capitalizeWords preserves Vietnamese diacritics", () => {
  assert.equal(capitalizeWords("đà nẵng"), "Đà Nẵng");
  assert.equal(capitalizeWords("hà nội"), "Hà Nội");
  assert.equal(capitalizeWords("phú quốc"), "Phú Quốc");
  assert.equal(capitalizeWords("quy nhơn"), "Quy Nhơn");
  assert.equal(capitalizeWords("tp hồ chí minh"), "Tp Hồ Chí Minh");
});

test("cleanUserPrompt removes comments, greetings and filler phrases", () => {
  const prompt = "<!-- note --> Xin chào bạn, hãy gợi ý cho mình lịch trình đi Đà Nẵng 3 ngày";
  assert.equal(cleanUserPrompt(prompt), "lịch trình đi Đà Nẵng 3 ngày");

  const prompt2 = "Bạn ơi, cho xin danh sách quán ăn ngon ở Huế nhé!";
  assert.equal(cleanUserPrompt(prompt2), "danh sách quán ăn ngon ở Huế nhé!");
});

test("generateSmartTitle extracts destination and category accurately", () => {
  // Itinerary planning
  assert.equal(
    generateSmartTitle("Lên kế hoạch đi Đà Nẵng 3 ngày 2 đêm"),
    "Lịch trình Đà Nẵng"
  );
  assert.equal(
    generateSmartTitle("Tôi muốn du lịch Phú Quốc khoảng 4 ngày tự túc"),
    "Lịch trình Phú Quốc"
  );
  assert.equal(
    generateSmartTitle("Gợi ý tour khám phá Quy Nhơn cho 2 người"),
    "Lịch trình Quy Nhơn"
  );

  // English itinerary
  assert.equal(
    generateSmartTitle("Plan a trip to Da Nang for 3 days"),
    "Trip to Da Nang"
  );

  // Contextual follow-up with destinationHint
  assert.equal(
    generateSmartTitle("Gợi ý lịch trình cho Ngày 1", "Đà Nẵng"),
    "Lịch trình Đà Nẵng"
  );
  assert.equal(
    generateSmartTitle("Gợi ý lịch trình cho Ngày 1"),
    "Lịch trình Ngày 1"
  );

  // Food & Dining
  assert.equal(
    generateSmartTitle("Quán ăn ngon đặc sản ở Hà Nội"),
    "Ẩm thực Hà Nội"
  );
  assert.equal(
    generateSmartTitle("Ăn gì ở Sapa buổi tối?"),
    "Ẩm thực Sapa"
  );

  // Cafe & Drinks
  assert.equal(
    generateSmartTitle("Top quán cafe view đẹp ngắm hoàng hôn ở Phú Quốc"),
    "Quán cafe Phú Quốc"
  );

  // Hotel & Stay
  assert.equal(
    generateSmartTitle("Khách sạn gần biển Mỹ Khê giá tốt"),
    "Khách sạn Biển Mỹ Khê"
  );

  // Sightseeing
  assert.equal(
    generateSmartTitle("Điểm tham quan nổi tiếng ở Huế"),
    "Điểm tham quan Huế"
  );

  // Weather
  assert.equal(
    generateSmartTitle("Thời tiết Đà Lạt tháng 11 thế nào?"),
    "Thời tiết Đà Lạt"
  );

  // General fallback with destinationHint
  assert.equal(
    generateSmartTitle("Nên mang theo những đồ dùng gì?", "Nha Trang"),
    "Lịch trình Nha Trang"
  );

  // General fallback without destinationHint
  const snippet = generateSmartTitle("Làm thế nào để đổi mật khẩu tài khoản?");
  assert.equal(snippet.includes("Làm thế nào"), true);
});
