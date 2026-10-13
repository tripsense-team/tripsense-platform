package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RestaurantReservationDecisionRequest(
    @NotNull Long expectedVersion,
    @NotBlank @Pattern(regexp = "CONFIRM|REJECT|CANCEL") String decision,
    @Size(max = 500) String reason
) {}
