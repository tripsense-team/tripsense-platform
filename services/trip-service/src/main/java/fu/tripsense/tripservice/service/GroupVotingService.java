package fu.tripsense.tripservice.service;

import fu.tripsense.tripservice.dto.request.ProposeDestinationRequest;
import fu.tripsense.tripservice.dto.response.DestinationOptionResponse;

import java.util.List;
import java.util.UUID;

public interface GroupVotingService {
    DestinationOptionResponse proposeDestination(UUID userId, UUID tripId, ProposeDestinationRequest request);
    List<DestinationOptionResponse> getDestinationOptions(UUID userId, UUID tripId);
    DestinationOptionResponse voteForDestination(UUID userId, UUID tripId, UUID optionId);
    DestinationOptionResponse removeVote(UUID userId, UUID tripId, UUID optionId);
}
