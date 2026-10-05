package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotNull;
import java.util.Map;

public record UpdateBusinessDraftRequest(
    @NotNull Long expectedVersion,
    String displayName,
    Map<String, Object> draftProfile
) {}
