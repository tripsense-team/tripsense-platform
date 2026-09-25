package fu.tripsense.socialservice.service.impl;

import fu.tripsense.socialservice.dto.response.TrendingDestinationResponse;
import fu.tripsense.socialservice.entity.SocialTrendingDestination;
import fu.tripsense.socialservice.exception.SocialException;
import fu.tripsense.socialservice.repository.SocialTrendingDestinationRepository;
import fu.tripsense.socialservice.repository.SocialTripShareRepository;
import fu.tripsense.socialservice.service.SocialDestinationService;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class SocialDestinationServiceImpl implements SocialDestinationService {

  private final SocialTrendingDestinationRepository trendingDestinationRepository;
  private final SocialTripShareRepository tripShareRepository;

  private static final Pattern DIACRITICS_PATTERN =
      Pattern.compile("\\p{InCombiningDiacriticalMarks}+");

  private static final List<SocialTrendingDestination> FALLBACK_CATALOG =
      List.of(
          SocialTrendingDestination.builder()
              .id("trend-dalat")
              .name("Đà Lạt")
              .cityNameKey("destinationDalat")
              .imageUrl(
                  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80")
              .baseShareCount(1420)
              .subtitle("Mùa hoa dã quỳ nở rộ")
              .subtitleKey("trendSubtitleDalat")
              .slug("da-lat")
              .sortOrder((short) 1)
              .isActive(true)
              .build(),
          SocialTrendingDestination.builder()
              .id("trend-phuquoc")
              .name("Phú Quốc")
              .cityNameKey("destinationPhuQuoc")
              .imageUrl(
                  "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=600&auto=format&fit=crop&q=80")
              .baseShareCount(980)
              .subtitle("Hoàng hôn Bãi Sao và lặn biển")
              .subtitleKey("trendSubtitlePhuQuoc")
              .slug("phu-quoc")
              .sortOrder((short) 2)
              .isActive(true)
              .build(),
          SocialTrendingDestination.builder()
              .id("trend-ninhbinh")
              .name("Ninh Bình")
              .cityNameKey("destinationNinhBinh")
              .imageUrl(
                  "https://images.unsplash.com/photo-1528127269322-539801943592?w=600&auto=format&fit=crop&q=80")
              .baseShareCount(760)
              .subtitle("Chèo thuyền sông Ngô Đồng")
              .subtitleKey("trendSubtitleNinhBinh")
              .slug("ninh-binh")
              .sortOrder((short) 3)
              .isActive(true)
              .build(),
          SocialTrendingDestination.builder()
              .id("trend-sapa")
              .name("Sa Pa")
              .cityNameKey("destinationSaPa")
              .imageUrl(
                  "https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=600&auto=format&fit=crop&q=80")
              .baseShareCount(620)
              .subtitle("Săn mây thung lũng Mường Hoa")
              .subtitleKey("trendSubtitleSaPa")
              .slug("sa-pa")
              .sortOrder((short) 4)
              .isActive(true)
              .build(),
          SocialTrendingDestination.builder()
              .id("trend-danang")
              .name("Đà Nẵng")
              .cityNameKey("destinationDaNang")
              .imageUrl(
                  "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=600&auto=format&fit=crop&q=80")
              .baseShareCount(510)
              .subtitle("Cầu Vàng Bà Nà Hills")
              .subtitleKey("trendSubtitleDaNang")
              .slug("da-nang")
              .sortOrder((short) 5)
              .isActive(true)
              .build(),
          SocialTrendingDestination.builder()
              .id("trend-hanoi")
              .name("Hà Nội")
              .cityNameKey("destinationHaNoi")
              .imageUrl(
                  "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=80")
              .baseShareCount(430)
              .subtitle("Thu Hà Nội và Phố cổ")
              .subtitleKey("trendSubtitleHaNoi")
              .slug("ha-noi")
              .sortOrder((short) 6)
              .isActive(true)
              .build());

  @Override
  @Transactional(readOnly = true)
  public List<TrendingDestinationResponse> getTrendingDestinations(int limit) {
    if (limit < 1 || limit > 10) {
      throw new SocialException(
          HttpStatus.BAD_REQUEST, "INVALID_LIMIT", "Limit must be between 1 and 10");
    }

    List<SocialTrendingDestination> catalog =
        trendingDestinationRepository.findByIsActiveTrueOrderBySortOrderAsc();

    if (catalog.isEmpty()) {
      catalog = FALLBACK_CATALOG;
    }

    // 1. Fetch live share counts from public non-removed trip shares
    List<Object[]> shareCounts = tripShareRepository.countPublicTripSharesByDestination();
    Map<String, Long> normalizedShares = new HashMap<>();

    for (Object[] row : shareCounts) {
      if (row.length >= 2 && row[0] != null && row[1] instanceof Number num) {
        String destName = row[0].toString();
        long count = num.longValue();
        normalizedShares.put(normalize(destName), count);
      }
    }

    // 2. Merge seed catalog with live share counts
    List<DestinationWithScore> destinations = new ArrayList<>();
    for (SocialTrendingDestination dest : catalog) {
      String normName = normalize(dest.getName());
      String slugCompact = dest.getSlug().replace("-", "");

      long liveCount = 0;
      for (Map.Entry<String, Long> entry : normalizedShares.entrySet()) {
        String sharedKey = entry.getKey();
        if (sharedKey.contains(normName)
            || sharedKey.replace(" ", "").contains(slugCompact)) {
          liveCount += entry.getValue();
        }
      }

      int totalCount = dest.getBaseShareCount() + (int) liveCount;
      String shareText = formatShareCountText(totalCount);

      destinations.add(
          new DestinationWithScore(
              new TrendingDestinationResponse(
                  dest.getId(),
                  dest.getName(),
                  dest.getCityNameKey(),
                  dest.getImageUrl(),
                  shareText,
                  totalCount,
                  dest.getSubtitle(),
                  dest.getSubtitleKey(),
                  dest.getSlug()),
              totalCount,
              dest.getSortOrder()));
    }

    // 3. Sort by total share count descending, then by seed sortOrder ascending
    return destinations.stream()
        .sorted(
            Comparator.comparingInt(DestinationWithScore::totalCount)
                .reversed()
                .thenComparingInt(DestinationWithScore::sortOrder))
        .limit(limit)
        .map(DestinationWithScore::response)
        .collect(Collectors.toList());
  }

  private String formatShareCountText(int count) {
    if (count >= 1000) {
      double kValue = count / 1000.0;
      return String.format(Locale.US, "%.1fk chia sẻ", kValue);
    }
    return count + " chia sẻ";
  }

  private String normalize(String input) {
    if (input == null || input.isBlank()) {
      return "";
    }
    String normalized =
        Normalizer.normalize(input.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD);
    return DIACRITICS_PATTERN
        .matcher(normalized)
        .replaceAll("")
        .replace("đ", "d")
        .replace("Đ", "d");
  }

  private record DestinationWithScore(
      TrendingDestinationResponse response, int totalCount, short sortOrder) {}
}
