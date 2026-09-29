package fu.tripsense.placeservice.dto;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.stream.Stream;

/** Stable Explore browse taxonomy owned by place-service. */
public enum PlaceBrowseCategory {
  FOOD(
      "nhà hàng địa phương",
      List.of(
          "restaurant",
          "food",
          "local_food",
          "street_food",
          "meal_takeaway",
          "ẩm thực",
          "nhà hàng",
          "quán ăn")),
  CAFE("quán cà phê", List.of("cafe", "coffee", "cà phê", "café", "bakery", "tea")),
  STAY(
      "khách sạn",
      List.of(
          "hotel",
          "lodging",
          "accommodation",
          "resort",
          "homestay",
          "hostel",
          "guest_house",
          "motel",
          "khách sạn",
          "lưu trú")),
  ATTRACTION(
      "điểm tham quan",
      List.of(
          "attraction",
          "tourist",
          "landmark",
          "museum",
          "beach",
          "park",
          "temple",
          "pagoda",
          "heritage",
          "điểm tham quan",
          "danh lam",
          "bảo tàng",
          "bãi biển"));

  private final String providerQuery;
  private final List<String> aliases;

  PlaceBrowseCategory(String providerQuery, List<String> aliases) {
    this.providerQuery = providerQuery;
    this.aliases = aliases.stream().map(PlaceBrowseCategory::normalize).toList();
  }

  public String providerQuery() {
    return providerQuery;
  }

  public boolean matches(PlaceDto place) {
    Stream<String> values =
        Stream.concat(
            place.getCategories() == null ? Stream.empty() : place.getCategories().stream(),
            Stream.of(place.getName(), place.getDescription()).filter(value -> value != null));
    return values.map(PlaceBrowseCategory::normalize).anyMatch(this::matchesAlias);
  }

  private boolean matchesAlias(String value) {
    return aliases.stream().anyMatch(value::contains);
  }

  public static PlaceBrowseCategory parse(String value) {
    if (value == null || value.isBlank()) return null;
    return Arrays.stream(values())
        .filter(category -> category.name().equalsIgnoreCase(value.trim()))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Unsupported place category"));
  }

  private static String normalize(String value) {
    return Normalizer.normalize(value, Normalizer.Form.NFD)
        .replaceAll("\\p{M}+", "")
        .replace('đ', 'd')
        .replace('Đ', 'D')
        .toLowerCase(Locale.ROOT)
        .trim();
  }
}
