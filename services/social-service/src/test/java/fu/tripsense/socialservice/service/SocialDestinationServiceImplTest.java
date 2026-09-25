package fu.tripsense.socialservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import fu.tripsense.socialservice.dto.response.TrendingDestinationResponse;
import fu.tripsense.socialservice.entity.SocialTrendingDestination;
import fu.tripsense.socialservice.exception.SocialException;
import fu.tripsense.socialservice.repository.SocialTrendingDestinationRepository;
import fu.tripsense.socialservice.repository.SocialTripShareRepository;
import fu.tripsense.socialservice.service.impl.SocialDestinationServiceImpl;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SocialDestinationServiceImplTest {

  private SocialTrendingDestinationRepository trendingRepo;
  private SocialTripShareRepository tripShareRepo;
  private SocialDestinationServiceImpl destinationService;

  @BeforeEach
  void setUp() {
    trendingRepo = mock(SocialTrendingDestinationRepository.class);
    tripShareRepo = mock(SocialTripShareRepository.class);
    destinationService = new SocialDestinationServiceImpl(trendingRepo, tripShareRepo);
  }

  @Test
  void getTrendingDestinations_invalidLimit_throwsBadRequest() {
    assertThatThrownBy(() -> destinationService.getTrendingDestinations(0))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("Limit must be between 1 and 10");

    assertThatThrownBy(() -> destinationService.getTrendingDestinations(11))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("Limit must be between 1 and 10");
  }

  @Test
  void getTrendingDestinations_fallbackCatalog_returnsSortedDefaultDestinations() {
    when(trendingRepo.findByIsActiveTrueOrderBySortOrderAsc())
        .thenReturn(Collections.emptyList());
    when(tripShareRepo.countPublicTripSharesByDestination())
        .thenReturn(Collections.emptyList());

    List<TrendingDestinationResponse> result = destinationService.getTrendingDestinations(4);

    assertThat(result).hasSize(4);
    // Highest base count is Da Lat (1420), then Phu Quoc (980)
    assertThat(result.get(0).id()).isEqualTo("trend-dalat");
    assertThat(result.get(0).shareCount()).isEqualTo(1420);
    assertThat(result.get(0).shareCountText()).isEqualTo("1.4k chia sẻ");
    assertThat(result.get(0).slug()).isEqualTo("da-lat");

    assertThat(result.get(1).id()).isEqualTo("trend-phuquoc");
    assertThat(result.get(1).shareCount()).isEqualTo(980);
    assertThat(result.get(1).shareCountText()).isEqualTo("980 chia sẻ");
  }

  @Test
  void getTrendingDestinations_aggregatesLiveSharesAndReorders() {
    SocialTrendingDestination dalat =
        SocialTrendingDestination.builder()
            .id("trend-dalat")
            .name("Đà Lạt")
            .cityNameKey("destinationDalat")
            .imageUrl("https://img.com/dalat.jpg")
            .baseShareCount(1000)
            .subtitle("Sub Dalat")
            .subtitleKey("subKeyDalat")
            .slug("da-lat")
            .sortOrder((short) 1)
            .isActive(true)
            .build();

    SocialTrendingDestination sapa =
        SocialTrendingDestination.builder()
            .id("trend-sapa")
            .name("Sa Pa")
            .cityNameKey("destinationSaPa")
            .imageUrl("https://img.com/sapa.jpg")
            .baseShareCount(500)
            .subtitle("Sub Sa Pa")
            .subtitleKey("subKeySaPa")
            .slug("sa-pa")
            .sortOrder((short) 2)
            .isActive(true)
            .build();

    when(trendingRepo.findByIsActiveTrueOrderBySortOrderAsc())
        .thenReturn(List.of(dalat, sapa));

    // Live counts: Sa Pa gets 1200 live shares (total: 1700), Da Lat gets 100 live shares (total: 1100)
    // Testing unaccented & case-insensitive matching
    List<Object[]> liveShares =
        List.of(
            new Object[] {"sa pa", 700L},
            new Object[] {"Sapa", 500L},
            new Object[] {"Đà Lạt", 100L});

    when(tripShareRepo.countPublicTripSharesByDestination()).thenReturn(liveShares);

    List<TrendingDestinationResponse> result = destinationService.getTrendingDestinations(2);

    assertThat(result).hasSize(2);

    // Sa Pa (500 + 700 + 500 = 1700) should now be #1
    TrendingDestinationResponse first = result.get(0);
    assertThat(first.id()).isEqualTo("trend-sapa");
    assertThat(first.name()).isEqualTo("Sa Pa");
    assertThat(first.shareCount()).isEqualTo(1700);
    assertThat(first.shareCountText()).isEqualTo("1.7k chia sẻ");

    // Da Lat (1000 + 100 = 1100) should be #2
    TrendingDestinationResponse second = result.get(1);
    assertThat(second.id()).isEqualTo("trend-dalat");
    assertThat(second.name()).isEqualTo("Đà Lạt");
    assertThat(second.shareCount()).isEqualTo(1100);
    assertThat(second.shareCountText()).isEqualTo("1.1k chia sẻ");
  }
}
