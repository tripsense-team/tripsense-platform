package fu.tripsense.tripservice.partner.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class AdminFinanceDtos {

  private AdminFinanceDtos() {}

  public record SubscriptionOrderItemDto(
      UUID id,
      long orderCode,
      UUID businessId,
      String businessName,
      String businessKind,
      String planId,
      String planName,
      int durationDays,
      BigDecimal amount,
      String paymentStatus,
      Instant paidAt,
      Instant createdAt) {}

  public record SubscriptionOrderPageDto(
      List<SubscriptionOrderItemDto> items,
      int page,
      int size,
      long totalElements,
      int totalPages) {}
}

