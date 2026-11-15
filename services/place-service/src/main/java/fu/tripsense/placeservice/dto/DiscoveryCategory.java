package fu.tripsense.placeservice.dto;

import java.util.*;
import java.util.regex.Pattern;

/** primaryType-first discovery policy. Raw category order is never primary evidence. */
public enum DiscoveryCategory {
  ATTRACTION(
      List.of(
          "attraction",
          "tourist_attraction",
          "landmark",
          "museum",
          "art_museum",
          "history_museum",
          "temple",
          "buddhist_temple",
          "hindu_temple",
          "church",
          "mosque",
          "synagogue",
          "pagoda",
          "beach",
          "park",
          "national_park",
          "state_park",
          "city_park",
          "botanical_garden",
          "heritage",
          "historical_place",
          "historical_landmark",
          "cultural_landmark",
          "monument",
          "natural_feature",
          "scenic_spot",
          "observation_deck",
          "campground",
          "camping_cabin",
          "amusement_park",
          "water_park",
          "aquarium",
          "zoo",
          "điểm tham quan",
          "bãi biển",
          "bảo tàng")),
  HOMESTAY(List.of("homestay", "home_stay", "home stay")),
  FOOD(
      List.of(
          "food",
          "restaurant",
          "local_food",
          "street_food",
          "meal_takeaway",
          "vietnamese_restaurant",
          "seafood_restaurant",
          "american_restaurant",
          "asian_restaurant",
          "barbecue_restaurant",
          "brazilian_restaurant",
          "breakfast_restaurant",
          "brunch_restaurant",
          "buffet_restaurant",
          "chinese_restaurant",
          "fast_food_restaurant",
          "fine_dining_restaurant",
          "french_restaurant",
          "greek_restaurant",
          "hamburger_restaurant",
          "indian_restaurant",
          "indonesian_restaurant",
          "italian_restaurant",
          "japanese_restaurant",
          "korean_restaurant",
          "lebanese_restaurant",
          "mediterranean_restaurant",
          "mexican_restaurant",
          "middle_eastern_restaurant",
          "pizza_restaurant",
          "ramen_restaurant",
          "sandwich_shop",
          "spanish_restaurant",
          "steak_house",
          "sushi_restaurant",
          "thai_restaurant",
          "turkish_restaurant",
          "vegan_restaurant",
          "vegetarian_restaurant",
          "noodle_shop",
          "bistro",
          "food_court",
          "ẩm thực",
          "nhà hàng",
          "quán ăn")),
  CAFE(
      List.of(
          "cafe",
          "café",
          "coffee",
          "coffee_shop",
          "tea_house",
          "bakery_cafe",
          "cat_cafe",
          "dog_cafe",
          "cà phê",
          "quán cà phê",
          "quán cafe")),
  STAY(
      List.of(
          "hotel",
          "lodging",
          "accommodation",
          "resort",
          "resort_hotel",
          "extended_stay_hotel",
          "homestay",
          "home_stay",
          "home stay",
          "hostel",
          "guest_house",
          "bed_and_breakfast",
          "motel",
          "khách sạn",
          "lưu trú"));
  public static final String POLICY_VERSION = "primary-v1";
  private static final Set<String> GENERIC =
      Set.of("food", "store", "point_of_interest", "establishment", "lodging");
  public static final Pattern HOMESTAY_NAME =
      Pattern.compile("(?i)(?<![\\p{L}\\p{N}])home[ _-]?stay(?![\\p{L}\\p{N}])");
  private static final Map<String, String> VIETNAMESE_PRIMARY_MAP =
      Map.ofEntries(
          Map.entry("địa điểm khám phá", "tourist_attraction"),
          Map.entry("điểm tham quan", "tourist_attraction"),
          Map.entry("du lịch", "tourist_attraction"),
          Map.entry("bãi biển", "beach"),
          Map.entry("bảo tàng", "museum"),
          Map.entry("quán cafe", "cafe"),
          Map.entry("quán cà phê", "cafe"),
          Map.entry("cà phê", "cafe"),
          Map.entry("trà sữa", "cafe"),
          Map.entry("đồ uống", "cafe"),
          Map.entry("nhà hàng", "restaurant"),
          Map.entry("quán ăn", "restaurant"),
          Map.entry("hải sản", "seafood_restaurant"),
          Map.entry("ẩm thực việt", "vietnamese_restaurant"),
          Map.entry("ẩm thực truyền thống", "vietnamese_restaurant"),
          Map.entry("đặc sản đà nẵng", "vietnamese_restaurant"),
          Map.entry("ẩm thực", "restaurant"),
          Map.entry("khách sạn", "hotel"),
          Map.entry("lưu trú", "lodging"),
          Map.entry("home stay", "homestay"),
          Map.entry("home_stay", "homestay"),
          Map.entry("homestay", "homestay"));
  private final Set<String> aliases;
  private final Set<String> primaryCodes;

  DiscoveryCategory(List<String> aliases) {
    this.aliases = Set.copyOf(aliases);
    // Enum constructors run before static field initialization.
    this.primaryCodes =
        aliases.stream()
            .filter(v -> normalizePrimaryType(v) != null)
            .filter(
                v ->
                    !Set.of("food", "store", "point_of_interest", "establishment", "lodging")
                        .contains(v))
            .collect(java.util.stream.Collectors.toUnmodifiableSet());
  }

  public Set<String> primaryTypes() {
    return primaryCodes;
  }

  public Set<String> legacyTypes() {
    return aliases.stream()
        .filter(v -> !GENERIC.contains(v) || (this == STAY && v.equals("lodging")))
        .collect(java.util.stream.Collectors.toUnmodifiableSet());
  }

  public static String normalizePrimaryType(String value) {
    if (value == null) return null;
    String code = value.trim().toLowerCase(Locale.ROOT);
    return code.matches("[a-z][a-z0-9_]{0,79}") ? code : null;
  }

  private static String normalizedLabel(String value) {
    return java.text.Normalizer.normalize(value.trim(), java.text.Normalizer.Form.NFC)
        .toLowerCase(Locale.ROOT);
  }

  public static DiscoveryCategory owner(List<String> categories, String name, String primaryType) {
    String primary = normalizePrimaryType(primaryType);
    if (primary != null && !GENERIC.contains(primary)) {
      for (var category : List.of(HOMESTAY, CAFE, FOOD, ATTRACTION, STAY))
        if (category.primaryTypes().contains(primary)) return category;
      return null; // Unsupported specific primary type cannot be overridden by amenities.
    }
    Set<DiscoveryCategory> groups = EnumSet.noneOf(DiscoveryCategory.class);
    for (String value : categories == null ? List.<String>of() : categories) {
      if (value == null) continue;
      String code = normalizedLabel(value);
      if (GENERIC.contains(code) && !code.equals("lodging")) continue;
      for (var category : values()) {
        if (category.aliases.contains(code)) groups.add(category);
      }
    }
    if (name != null && HOMESTAY_NAME.matcher(name).find()) groups.add(HOMESTAY);
    if (groups.contains(HOMESTAY)) groups.remove(STAY);
    return groups.size() == 1 ? groups.iterator().next() : null;
  }

  public boolean matches(List<String> categories, String name) {
    return matches(categories, name, null);
  }

  public boolean matches(List<String> categories, String name, String primaryType) {
    var owner = owner(categories, name, primaryType);
    if (this != STAY) return owner == this;
    if (owner == STAY || owner == HOMESTAY) return true;
    // Preserve broad lodging lookup for legacy conflicting data only.
    if (normalizePrimaryType(primaryType) != null
        && !GENERIC.contains(normalizePrimaryType(primaryType))) return false;
    return categories != null
        && categories.stream()
            .filter(Objects::nonNull)
            .map(DiscoveryCategory::normalizedLabel)
            .anyMatch(STAY.aliases::contains);
  }

  /**
   * Deterministically derives a missing primaryType from stored category labels without making
   * external provider or AI calls. Skips generic Google noise tags such as establishment and
   * point_of_interest whenever a more specific type is available.
   */
  public static String derivePrimaryTypeFromCategories(List<String> categories, String name) {
    if (categories == null || categories.isEmpty()) return null;

    List<String> normalizedCodes = new ArrayList<>();
    boolean hasStayIndicator = false;
    for (String raw : categories) {
      if (raw == null || raw.isBlank()) continue;
      String label = normalizedLabel(raw);
      if (STAY.aliases.contains(label) || HOMESTAY.aliases.contains(label)) {
        hasStayIndicator = true;
      }
      String mapped = VIETNAMESE_PRIMARY_MAP.get(label);
      if (mapped == null) {
        mapped = normalizePrimaryType(raw);
      }
      if (mapped != null && !"point_of_interest".equals(mapped) && !"establishment".equals(mapped)) {
        normalizedCodes.add(mapped);
      }
    }

    if (hasStayIndicator && name != null && HOMESTAY_NAME.matcher(name).find()) {
      return "homestay";
    }

    for (String code : normalizedCodes) {
      if (!GENERIC.contains(code)) {
        return code;
      }
    }

    if (normalizedCodes.contains("lodging")) return "lodging";
    if (normalizedCodes.contains("food")) return "food";
    if (normalizedCodes.contains("store")) return "store";
    return null;
  }

  public static List<DiscoveryCategory> preview() {
    return List.of(ATTRACTION, HOMESTAY, FOOD, CAFE);
  }
}
