package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.PickupOption;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;
import lombok.Builder;

@Builder
public record CreateRentalBookingRequest(
    UUID businessId,
    @NotNull UUID rentalItemId,
    @NotNull @Future Instant pickupAt,
    @NotNull @Future Instant returnAt,
    @Min(1) Integer quantity,
    PickupOption pickupOption,
    String deliveryAddress,
    @NotBlank String customerName,
    @NotBlank String customerPhone,
    String customerEmail,
    String customerNote,
    String specialRequests,
    UUID chatOfferId
) {
  public String effectiveNote() {
    if (customerNote != null && !customerNote.isBlank()) return customerNote;
    if (specialRequests != null && !specialRequests.isBlank()) return specialRequests;
    return null;
  }
}
