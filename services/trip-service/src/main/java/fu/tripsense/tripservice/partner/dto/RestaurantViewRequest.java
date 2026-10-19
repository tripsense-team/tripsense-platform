package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record RestaurantViewRequest(@NotNull UUID sessionKey) {}
