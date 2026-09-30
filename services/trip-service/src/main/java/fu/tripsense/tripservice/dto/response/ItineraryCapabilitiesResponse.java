package fu.tripsense.tripservice.dto.response;

import java.io.Serializable;

public record ItineraryCapabilitiesResponse(
    boolean canView, boolean canEdit, boolean canManageMembers) implements Serializable {}
