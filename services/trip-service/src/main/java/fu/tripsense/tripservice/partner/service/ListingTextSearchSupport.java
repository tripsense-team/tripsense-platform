package fu.tripsense.tripservice.partner.service;

import java.text.Normalizer;
import java.util.Locale;

/** Shared Vietnamese-friendly diacritic-folding search helpers for public partner listings. */
final class ListingTextSearchSupport {

  private ListingTextSearchSupport() {}

  static String fold(String raw) {
    if (raw == null) {
      return "";
    }
    return Normalizer.normalize(raw, Normalizer.Form.NFD)
        .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
        .replace('đ', 'd')
        .replace('Đ', 'D')
        .toLowerCase(Locale.ROOT)
        .trim();
  }

  static boolean containsFolded(String value, String foldedQuery) {
    return value != null && !foldedQuery.isEmpty() && fold(value).contains(foldedQuery);
  }
}

