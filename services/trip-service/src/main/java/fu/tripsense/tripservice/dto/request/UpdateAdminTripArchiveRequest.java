package fu.tripsense.tripservice.dto.request;

import jakarta.validation.constraints.NotNull;

public record UpdateAdminTripArchiveRequest(@NotNull Boolean archived, Long version) {}

