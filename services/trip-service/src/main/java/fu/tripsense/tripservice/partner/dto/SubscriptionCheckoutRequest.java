package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotBlank;

public record SubscriptionCheckoutRequest(
    @NotBlank(message = "planId is required")
    String planId,
    String returnUrl,
    String cancelUrl
) {}
