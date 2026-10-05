package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CommunityPublicationRequest(
    @NotNull Long expectedVersion,
    @NotNull UUID expectedRevisionId,
    boolean enabled
) {}
