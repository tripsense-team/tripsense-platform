/**
 * Smart Chat Title Generation & Generic Title Detection
 *
 * Provides fast, deterministic heuristics to assign clear, destination-aware,
 * or topic-aware titles to AI travel chat conversations without burning LLM quota.
 */

const GENERIC_TITLES = new Set([
  "",
  "new chat",
  "cuộc trò chuyện mới",
  "kế hoạch chuyến đi của bạn",
  "your trip plan",
  "untitled",
  "chuyến đi chưa đặt tên",
  "cuộc trò chuyện du lịch",
  "travel conversation",
  "kế hoạch du lịch",
  "trip plan",
]);

/**
 * Checks if a chat title is a placeholder or generic fallback that should
 * be automatically upgraded when destination or user intent is discovered.
 */
export function isGenericChatTitle(title: string | null | undefined): boolean {
  if (!title) return true;
  const normalized = title.trim().toLowerCase();
  if (GENERIC_TITLES.has(normalized)) return true;
  if (normalized.startsWith("cuộc trò chuyện mới")) return true;
  if (normalized.startsWith("new chat")) return true;
  if (normalized.startsWith("kế hoạch chuyến đi")) return true;
  return false;
}

/**
 * Capitalizes the first letter of each word with full Unicode diacritics support.
 */
export function capitalizeWords(str: string): string {
  return str
    .trim()
    .replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
}

/**
 * Strips HTML comments, Markdown symbols, conversational prefixes, and trailing punctuation.
 */
export function cleanUserPrompt(prompt: string): string {
  let cleaned = prompt
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/[\r\n]+/g, " ")
    .trim();

  // Strip common conversational greeting/filler prefixes iteratively in Vietnamese & English
  const conversationalPrefixes = [
    /^(?:xin\s+chào|chào\s+bạn|chào\s+ai|alo|hey|hello|hi)\s*[,.!?]?\s*/i,
    /^(?:bạn\s+ơi|ai\s+ơi|ad\s+ơi|bot\s+ơi|bạn|ad|bot)\s*[,.!?]?\s*/i,
    /^(?:hãy\s+|vui\s+lòng\s+|làm\s+ơn\s+|please\s+|can\s+you\s+|could\s+you\s+)/i,
    /^(?:gợi\s+ý\s+(?:cho\s+|giúp\s+)?(?:tôi|mình|em)?\s*)/i,
    /^(?:cho\s+(?:tôi|mình|em|xin)\s+|giúp\s+(?:tôi|mình|em)\s+)/i,
    /^(?:tôi\s+muốn\s+|mình\s+muốn\s+|em\s+muốn\s+|tôi\s+đang\s+muốn\s+|tôi\s+cần\s+|mình\s+cần\s+|i\s+want\s+to\s+|i\s+would\s+like\s+to\s+)/i,
  ];

  let prev = "";
  while (prev !== cleaned) {
    prev = cleaned;
    for (const regex of conversationalPrefixes) {
      cleaned = cleaned.replace(regex, "");
    }
  }

  return cleaned.trim();
}

/**
 * Strips trailing filler words (e.g. "nhé", "với", "ạ", "giúp mình", "hộ em")
 */
function stripTrailingFillers(str: string): string {
  return str
    .replace(/[,.?!]+$/g, "")
    .replace(/\s+(?:nhé|nha|với|ạ|nè|giúp\s+mình|giúp\s+tôi|hộ\s+mình|hộ\s+em|đi\s+bạn)$/i, "")
    .trim();
}

/**
 * Cleans destination token by removing leading action verbs and trailing duration, traveler, or filler words.
 */
function cleanDestination(rawDest: string): string {
  let dest = rawDest.trim();
  // Strip leading action verbs, adjectives, or prepositions (e.g. "khám phá Quy Nhơn" -> "Quy Nhơn", "ngon đặc sản ở Hà Nội" -> "Hà Nội")
  let prev = "";
  while (prev !== dest) {
    prev = dest;
    dest = dest.replace(/^(?:khám\s+phá|du\s+lịch|tham\s+quan|check-in|phượt|chuyến\s+đi|tour)\s+(?:đi\s+|đến\s+|tại\s+|ở\s+)?/i, "");
    dest = dest.replace(/^(?:ngắm\s+(?:hoàng\s+hôn|bình\s+minh|cảnh|biển|phố)|sống\s+ảo|check-in)\s+/i, "");
    dest = dest.replace(/^(?:ngon|đặc\s+sản|nổi\s+tiếng|nổi\s+bật|view\s+đẹp|giá\s+rẻ|sang\s+trọng|bình\s+dân|hấp\s+dẫn|đẹp|tốt|lý\s+tưởng)\s+/i, "");
    dest = dest.replace(/^(?:ở\s+|tại\s+|gần\s+|đi\s+|đến\s+)/i, "");
  }
  // Strip trailing duration, traveler, or filler words in Vietnamese & English
  dest = dest.replace(/\s+(?:khoảng\s+)?\d+\s*(?:ngày|đêm|n\d+đ|hôm).*$/i, "");
  dest = dest.replace(/\s+(?:cho|với|cùng)?\s*(?:khoảng\s+)?\d+\s*(?:người|khách|thành viên|bạn).*$/i, "");
  dest = dest.replace(/\s+(?:for\s+)?\d+\s*(?:days?|nights?|hours?).*$/i, "");
  dest = dest.replace(/\s+(?:for|with)\s+(?:about\s+)?\d+\s*(?:people|persons?|travelers?|guests?).*$/i, "");
  dest = dest.replace(/\s+(?:vào\s+)?(?:buổi\s+)?(?:sáng|trưa|chiều|tối|đêm).*$/i, "");
  dest = dest.replace(/\s+(?:tháng\s+\d+|mùa\s+[a-zà-ỹ]+).*$/i, "");
  dest = dest.replace(/\s+(?:thế\s+nào|ra\s+sao|như\s+thế\s+nào|sao|không|chưa).*$/i, "");
  dest = dest.replace(/\s+(?:cho|với|cùng|for|with)\s*$/i, "");
  dest = dest.replace(/\s+(?:tự\s+túc|tiết\s+kiệm|cao\s+cấp|giá\s+(?:rẻ|tốt|hợp\s+lý)|view\s+đẹp|uy\s+tín|chất\s+lượng|nổi\s+tiếng|vui\s+vẻ|cùng\s+gia\s+đình|với\s+bạn).*$/i, "");
  dest = stripTrailingFillers(dest);
  return dest.trim();
}

/**
 * Generates an intelligent, clean chat title based on the user's prompt
 * and optional linked trip destination context.
 */
export function generateSmartTitle(
  userPrompt: string,
  destinationHint?: string
): string {
  const cleaned = cleanUserPrompt(userPrompt);
  if (!cleaned) {
    if (destinationHint && destinationHint.trim()) {
      return `Lịch trình ${capitalizeWords(destinationHint.trim())}`;
    }
    return "Cuộc trò chuyện mới";
  }

  // 1. Check if user is asking about a specific day (e.g., "Gợi ý lịch trình cho Ngày 1", "Ăn gì ngày 2")
  const dayMatch = cleaned.match(/(?:ngày|day)\s*(\d+)/i);
  if (dayMatch && destinationHint && destinationHint.trim()) {
    return `Lịch trình ${capitalizeWords(destinationHint.trim())}`;
  }
  if (dayMatch && !destinationHint) {
    const dayNum = dayMatch[1];
    if (cleaned.toLowerCase().includes("lịch trình") || cleaned.toLowerCase().includes("gợi ý")) {
      return `Lịch trình Ngày ${dayNum}`;
    }
  }

  // 2. Full Itinerary / Travel Planning (Vietnamese & English)
  const planMatch = cleaned.match(
    /(?:lên\s+lịch\s+trình|lịch\s+trình|kế\s+hoạch|du\s+lịch|khám\s+phá|phượt|chuyến\s+đi|tour)\s+(?:đi\s+|đến\s+|tại\s+|ở\s+)?([A-ZÀ-Ỹa-zà-ỹ0-9\s]+)/i
  );
  if (planMatch && planMatch[1]?.trim()) {
    const dest = cleanDestination(planMatch[1]);
    if (dest.length > 1 && dest.length <= 40) {
      return `Lịch trình ${capitalizeWords(dest)}`;
    }
  }

  // English itinerary pattern
  const enPlanMatch = cleaned.match(
    /(?:plan\s+(?:a\s+)?trip\s+to|itinerary\s+for|travel\s+to|visit)\s+([A-Za-z0-9\s]+)/i
  );
  if (enPlanMatch && enPlanMatch[1]?.trim()) {
    const dest = cleanDestination(enPlanMatch[1]);
    if (dest.length > 1 && dest.length <= 40) {
      return `Trip to ${capitalizeWords(dest)}`;
    }
  }

  // 3. Food & Dining
  const foodMatch = cleaned.match(
    /(?:quán\s+ăn|món\s+ngon|đặc\s+sản|ăn\s+gì|ẩm\s+thực|nhà\s+hàng)\s+(?:ở\s+|tại\s+|gần\s+)?([A-ZÀ-Ỹa-zà-ỹ0-9\s]+)/i
  );
  if (foodMatch && foodMatch[1]?.trim()) {
    const dest = cleanDestination(foodMatch[1]);
    if (dest.length > 1 && dest.length <= 40) {
      return `Ẩm thực ${capitalizeWords(dest)}`;
    }
  }

  // 4. Cafe & Coffee Shops
  const cafeMatch = cleaned.match(
    /(?:quán\s+cafe|cà\s+phê|tiệm\s+cafe|coffee)\s+(?:ở\s+|tại\s+|gần\s+)?([A-ZÀ-Ỹa-zà-ỹ0-9\s]+)/i
  );
  if (cafeMatch && cafeMatch[1]?.trim()) {
    const dest = cleanDestination(cafeMatch[1]);
    if (dest.length > 1 && dest.length <= 40) {
      return `Quán cafe ${capitalizeWords(dest)}`;
    }
  }

  // 5. Hotel & Stays
  const hotelMatch = cleaned.match(
    /(?:khách\s+sạn|homestay|resort|nơi\s+ở|chỗ\s+nghỉ)\s+(?:ở\s+|tại\s+|gần\s+)?([A-ZÀ-Ỹa-zà-ỹ0-9\s]+)/i
  );
  if (hotelMatch && hotelMatch[1]?.trim()) {
    const dest = cleanDestination(hotelMatch[1]);
    if (dest.length > 1 && dest.length <= 40) {
      return `Khách sạn ${capitalizeWords(dest)}`;
    }
  }

  // 6. Sightseeing & Check-in
  const sightMatch = cleaned.match(
    /(?:địa\s+điểm|điểm\s+tham\s+quan|check-in|sống\s+ảo|vui\s+chơi)\s+(?:ở\s+|tại\s+|gần\s+)?([A-ZÀ-Ỹa-zà-ỹ0-9\s]+)/i
  );
  if (sightMatch && sightMatch[1]?.trim()) {
    const dest = cleanDestination(sightMatch[1]);
    if (dest.length > 1 && dest.length <= 40) {
      return `Điểm tham quan ${capitalizeWords(dest)}`;
    }
  }

  // 7. Weather
  const weatherMatch = cleaned.match(
    /(?:thời\s+tiết|khí\s+hậu|nhiệt\s+độ)\s+(?:ở\s+|tại\s+)?([A-ZÀ-Ỹa-zà-ỹ0-9\s]+)/i
  );
  if (weatherMatch && weatherMatch[1]?.trim()) {
    const dest = cleanDestination(weatherMatch[1]);
    if (dest.length > 1 && dest.length <= 40) {
      return `Thời tiết ${capitalizeWords(dest)}`;
    }
  }

  // 8. If destination hint is known from linked trip/brief, fallback to that destination
  if (destinationHint && destinationHint.trim()) {
    return `Lịch trình ${capitalizeWords(destinationHint.trim())}`;
  }

  // 9. General Question / Snippet Fallback
  // Strip trailing punctuation
  const cleanSnippet = stripTrailingFillers(cleaned);
  if (cleanSnippet.length <= 36) {
    return cleanSnippet.charAt(0).toUpperCase() + cleanSnippet.slice(1);
  }

  // Find nearest word boundary before character 34
  const cutIdx = cleanSnippet.lastIndexOf(" ", 34);
  const truncated = cutIdx > 12 ? cleanSnippet.slice(0, cutIdx) : cleanSnippet.slice(0, 32);
  return `${truncated.charAt(0).toUpperCase() + truncated.slice(1)}...`;
}
