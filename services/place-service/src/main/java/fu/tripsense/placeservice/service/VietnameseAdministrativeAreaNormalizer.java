package fu.tripsense.placeservice.service;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import org.springframework.util.StringUtils;

/** Normalizes provider-backed Vietnamese administrative fields without fuzzy name matching. */
public final class VietnameseAdministrativeAreaNormalizer {

  private static final List<String> DA_NANG_DISTRICTS =
      List.of(
          "Hải Châu",
          "Thanh Khê",
          "Sơn Trà",
          "Ngũ Hành Sơn",
          "Liên Chiểu",
          "Cẩm Lệ",
          "Hòa Vang",
          "Hoàng Sa");

  private VietnameseAdministrativeAreaNormalizer() {}

  public static String district(String structuredValue, String formattedAddress) {
    String candidate = stripAdministrativePrefix(structuredValue);
    if (StringUtils.hasText(candidate)) return candidate;
    return exactAddressArea(formattedAddress, DA_NANG_DISTRICTS);
  }

  public static String city(String structuredValue, String formattedAddress) {
    String candidate = stripAdministrativePrefix(structuredValue);
    if (StringUtils.hasText(candidate)) {
      return "da nang".equals(normalize(candidate)) ? "Đà Nẵng" : candidate;
    }
    return exactAddressArea(formattedAddress, List.of("Đà Nẵng"));
  }

  private static String exactAddressArea(String formattedAddress, List<String> knownAreas) {
    if (!StringUtils.hasText(formattedAddress)) return null;
    for (String segment : formattedAddress.split(",")) {
      String normalizedSegment = normalize(stripAdministrativePrefix(segment));
      for (String area : knownAreas) {
        if (normalizedSegment.equals(normalize(area))) return area;
      }
    }
    return null;
  }

  private static String stripAdministrativePrefix(String value) {
    if (!StringUtils.hasText(value)) return null;
    return value.trim()
        .replaceFirst("(?iu)^(?:quận|huyện|thành phố|tp\\.?)\\s+", "")
        .replaceFirst("\\s+\\d{5,6}$", "")
        .trim();
  }

  private static String normalize(String value) {
    if (!StringUtils.hasText(value)) return "";
    return Normalizer.normalize(value, Normalizer.Form.NFD)
        .replaceAll("\\p{M}+", "")
        .replace('đ', 'd')
        .replace('Đ', 'd')
        .toLowerCase(Locale.ROOT)
        .trim();
  }
}
