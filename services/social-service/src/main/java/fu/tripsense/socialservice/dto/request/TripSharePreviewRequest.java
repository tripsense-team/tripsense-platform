package fu.tripsense.socialservice.dto.request;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record TripSharePreviewRequest(@NotNull UUID tripId) {}
