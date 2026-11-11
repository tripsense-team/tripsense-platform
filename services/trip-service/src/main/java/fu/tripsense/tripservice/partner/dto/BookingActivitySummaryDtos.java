package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.Builder;

public final class BookingActivitySummaryDtos {

  private BookingActivitySummaryDtos() {}

  @Builder
  public record UserVerticalActivityDto(
      long unreadCount,
      long pendingCount,
      long activeCount,
      long totalCount,
      long attentionCount,
      Instant latestActivityAt
  ) {}

  @Builder
  public record UserReservationActivitySummaryDto(
      long totalAttentionCount,
      long unreadNotificationCount,
      String recommendedTab,
      Map<String, UserVerticalActivityDto> verticals
  ) {}

  public record MarkReservationSeenRequest(@NotBlank String vertical) {}

  @Builder
  public record PartnerBusinessActivityDto(
      UUID businessId,
      String kind,
      long pendingCount,
      long unreadNotificationCount,
      Instant latestPendingAt
  ) {}

  @Builder
  public record PartnerBookingsSummaryDto(
      long pendingTotal,
      long unreadNotificationCount,
      String recommendedDashboardTab,
      Map<String, Long> byServiceType,
      List<PartnerBusinessActivityDto> businesses
  ) {}
}

