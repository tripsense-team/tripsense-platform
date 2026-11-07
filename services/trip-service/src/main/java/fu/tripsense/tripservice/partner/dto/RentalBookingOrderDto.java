package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.PickupOption;
import fu.tripsense.tripservice.partner.enums.RentalBookingStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Builder;

@Builder
public record RentalBookingOrderDto(
    UUID id,
    String bookingCode,
    UUID businessId,
    String businessName,
    UUID rentalItemId,
    String rentalItemName,
    String rentalItemCategory,
    UUID customerId,
    String customerName,
    String customerPhone,
    String customerEmail,
    Instant pickupAt,
    Instant returnAt,
    int quantity,
    PickupOption pickupOption,
    String deliveryAddress,
    BigDecimal rentalPrice,
    BigDecimal deliveryFee,
    BigDecimal depositAmount,
    BigDecimal totalAmount,
    String currency,
    RentalBookingStatus status,
    Instant handoverAt,
    Instant returnedAt,
    BigDecimal overdueFee,
    String customerNote,
    String partnerNote,
    String rejectionReason,
    UUID chatOfferId,
    Long version,
    Instant createdAt,
    Instant updatedAt
) {}

