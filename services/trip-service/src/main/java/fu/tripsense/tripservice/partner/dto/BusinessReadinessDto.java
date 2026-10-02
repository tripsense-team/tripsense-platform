package fu.tripsense.tripservice.partner.dto;

import java.util.List;
import java.util.UUID;

public record BusinessReadinessDto(
    UUID businessId,
    boolean canPublish,
    boolean canAcceptNew,
    List<String> missingRequirements
) {}
