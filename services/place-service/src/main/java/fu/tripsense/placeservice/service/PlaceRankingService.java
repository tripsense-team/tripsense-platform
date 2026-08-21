package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.dto.PlaceDto;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class PlaceRankingService {

    /**
     * Deterministically ranks a list of PlaceDto items based on:
     * 1. Text relevance match (if query provided)
     * 2. Distance from target location (if lat/lng provided)
     * 3. Rating (0.0 - 5.0)
     * 4. User review count (logarithmic boost)
     */
    public List<PlaceDto> rank(List<PlaceDto> places, String query, Double targetLat, Double targetLng) {
        if (places == null || places.isEmpty()) {
            return new ArrayList<>();
        }

        String normalizedQuery = query != null ? query.toLowerCase().trim() : "";
        boolean isSpecificQuery = StringUtils.hasText(normalizedQuery) &&
                !normalizedQuery.equals("đà nẵng") &&
                !normalizedQuery.equals("da nang") &&
                !normalizedQuery.equals("tất cả") &&
                !normalizedQuery.equals("địa điểm nổi tiếng ở đà nẵng");

        List<PlaceDto> filtered = new ArrayList<>();
        for (PlaceDto p : places) {
            double textScore = computeTextMatchScore(p, normalizedQuery);
            if (isSpecificQuery && textScore <= 0.0) {
                // If user searched a specific name/keyword and this place has 0 match, skip it completely!
                continue;
            }
            filtered.add(p);
        }

        filtered.sort(Comparator.comparingDouble((PlaceDto p) -> computeScore(p, normalizedQuery, targetLat, targetLng)).reversed());

        return filtered;
    }

    private static final java.util.Set<String> GENERIC_STOP_WORDS = java.util.Set.of(
            "quan", "tiem", "nha", "hang", "an", "uong", "shop", "cua", "cafe", "ca", "phe", "coffee",
            "bar", "pub", "hotel", "khach", "san", "diem", "du", "lich", "va", "tai", "la", "o", "co",
            "cho", "duoc", "tu", "den", "ve", "voi", "trong", "ngoai", "tren", "duoi", "so", "duong",
            "phuong", "huyen", "xa", "thanh", "pho", "da", "nang", "tp"
    );

    public double computeTextMatchScore(PlaceDto place, String query) {
        if (!StringUtils.hasText(query) || place == null) {
            return 1.0;
        }

        String queryLower = query.toLowerCase().trim();
        String queryStripped = stripAccents(queryLower);

        String name = place.getName() != null ? place.getName().toLowerCase() : "";
        String nameStripped = stripAccents(name);

        String address = place.getAddress() != null ? place.getAddress().toLowerCase() : "";
        String addressStripped = stripAccents(address);

        String categories = (place.getCategories() != null) ? String.join(" ", place.getCategories()).toLowerCase() : "";
        String categoriesStripped = stripAccents(categories);

        // Exact / Substring matches
        if (name.equals(queryLower) || nameStripped.equals(queryStripped)) {
            return 50.0;
        }
        if (name.startsWith(queryLower) || nameStripped.startsWith(queryStripped)) {
            return 40.0;
        }
        if (name.contains(queryLower) || nameStripped.contains(queryStripped)) {
            return 30.0;
        }
        if (address.contains(queryLower) || addressStripped.contains(queryStripped)) {
            return 20.0;
        }
        if (categories.contains(queryLower) || categoriesStripped.contains(queryStripped)) {
            return 15.0;
        }

        // Tokenize query words
        String[] queryWords = queryStripped.split("[\\s,\\-_/.]+");
        List<String> distinguishingWords = new ArrayList<>();
        List<String> allMeaningfulWords = new ArrayList<>();

        for (String w : queryWords) {
            if (w.length() >= 2) {
                allMeaningfulWords.add(w);
                if (!GENERIC_STOP_WORDS.contains(w)) {
                    distinguishingWords.add(w);
                }
            }
        }

        if (allMeaningfulWords.isEmpty()) {
            return 1.0;
        }

        // If the query contains distinguishing keywords (e.g. "khong", "ton", "123456", "hawa", "bep", "cuon"),
        // the place MUST match at least 1 distinguishing keyword (or >= 40% for longer queries)
        if (!distinguishingWords.isEmpty()) {
            int matchedDistinguishing = 0;
            for (String dw : distinguishingWords) {
                if (isWordContainedIn(nameStripped, dw) || isWordContainedIn(addressStripped, dw) || isWordContainedIn(categoriesStripped, dw)) {
                    matchedDistinguishing++;
                }
            }

            double ratio = (double) matchedDistinguishing / distinguishingWords.size();
            if (matchedDistinguishing == 0 || (distinguishingWords.size() > 2 && ratio < 0.40)) {
                return 0.0;
            }
            return 20.0 + (30.0 * ratio);
        }

        // For generic category queries (e.g. "quán cà phê", "nhà hàng hải sản")
        int matchedWords = 0;
        for (String w : allMeaningfulWords) {
            if (isWordContainedIn(nameStripped, w) || isWordContainedIn(addressStripped, w) || isWordContainedIn(categoriesStripped, w)) {
                matchedWords++;
            }
        }

        if (matchedWords == 0) {
            return 0.0;
        }

        return (25.0 * matchedWords) / allMeaningfulWords.size();
    }

    private boolean isWordContainedIn(String text, String word) {
        if (!StringUtils.hasText(text) || !StringUtils.hasText(word)) return false;
        String[] tokens = text.split("[\\s,\\-_/.]+");
        for (String t : tokens) {
            if (t.equals(word) || (word.length() >= 4 && (t.startsWith(word) || word.startsWith(t)))) {
                return true;
            }
        }
        return false;
    }

    private double computeScore(PlaceDto place, String query, Double targetLat, Double targetLng) {
        double score = 0.0;

        // 1. Text match relevance (max 50 points)
        score += computeTextMatchScore(place, query);

        // 2. Rating score (max 30 points for 5.0 rating)
        if (place.getRating() != null && place.getRating() > 0) {
            score += (place.getRating() / 5.0) * 30.0;
        }

        // 3. Review count boost (logarithmic scale, max 20 points)
        if (place.getUserRatingCount() != null && place.getUserRatingCount() > 0) {
            double reviewScore = Math.min(20.0, Math.log10(place.getUserRatingCount() + 1) * 6.0);
            score += reviewScore;
        }

        // 4. Distance proximity bonus / penalty (if target coordinates given)
        if (targetLat != null && targetLng != null && place.getLocation() != null) {
            double distKm = haversineDistanceKm(targetLat, targetLng, place.getLocation().getLat(), place.getLocation().getLng());
            if (distKm <= 1.0) {
                score += 15.0;
            } else if (distKm <= 5.0) {
                score += 10.0;
            } else if (distKm <= 15.0) {
                score += 5.0;
            } else {
                score -= Math.min(20.0, (distKm - 15.0) * 0.5);
            }
        }

        return score;
    }

    private double haversineDistanceKm(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371; // Radius of Earth in kilometers
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private static String stripAccents(String s) {
        if (s == null) return "";
        String normalized = java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD);
        String withoutAccents = normalized.replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        return withoutAccents.replace('đ', 'd').replace('Đ', 'd').toLowerCase().trim();
    }
}
