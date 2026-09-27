package fu.tripsense.tripservice.dto.response;

import java.util.List;
import java.util.UUID;
import lombok.Builder;

@Builder
public record DestinationOptionResponse(
    UUID id,
    UUID tripId,
    UUID placeId,
    String name,
    UUID createdByUserId,
    int voteCount,
    boolean hasVoted,
    List<UUID> voterUserIds
) {}
