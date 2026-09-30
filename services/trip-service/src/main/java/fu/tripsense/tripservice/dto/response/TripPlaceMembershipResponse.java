package fu.tripsense.tripservice.dto.response;

import java.util.List;
import java.util.UUID;

public record TripPlaceMembershipResponse(String placeRef, boolean added, List<UUID> tripIds) {}
