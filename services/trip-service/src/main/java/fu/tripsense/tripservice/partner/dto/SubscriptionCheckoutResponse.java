package fu.tripsense.tripservice.partner.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record SubscriptionCheckoutResponse(
    UUID orderId,
    Long orderCode,
    String planId,
    String planName,
    BigDecimal amount,
    String qrCode,
    String paymentUrl,
    String paymentStatus
) {}
