package fu.tripsense.tripservice.service.impl;

import fu.tripsense.tripservice.dto.request.ProposeDestinationRequest;
import fu.tripsense.tripservice.dto.response.DestinationOptionResponse;
import fu.tripsense.tripservice.entity.Trip;
import fu.tripsense.tripservice.entity.TripDestinationOption;
import fu.tripsense.tripservice.entity.TripDestinationVote;
import fu.tripsense.tripservice.enums.TripStatus;
import fu.tripsense.tripservice.exception.ConflictException;
import fu.tripsense.tripservice.exception.ForbiddenException;
import fu.tripsense.tripservice.exception.NotFoundException;
import fu.tripsense.tripservice.repository.TripDestinationOptionRepository;
import fu.tripsense.tripservice.repository.TripDestinationVoteRepository;
import fu.tripsense.tripservice.repository.TripRepository;
import fu.tripsense.tripservice.service.GroupVotingService;
import fu.tripsense.tripservice.service.GroupVotingSseService;
import fu.tripsense.tripservice.service.TripCollaborationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class GroupVotingServiceImpl implements GroupVotingService {

    private final TripRepository tripRepository;
    private final TripDestinationOptionRepository optionRepository;
    private final TripDestinationVoteRepository voteRepository;
    private final TripCollaborationService tripCollaborationService;
    private final GroupVotingSseService sseService;

    @Override
    @Transactional
    public DestinationOptionResponse proposeDestination(UUID userId, UUID tripId, ProposeDestinationRequest request) {
        Trip trip = getActiveTrip(tripId);
        
        if (!tripCollaborationService.hasEditAccess(userId, tripId)) {
            throw new ForbiddenException("PERMISSION_DENIED", "You must be an OWNER or EDITOR to propose a destination");
        }

        TripDestinationOption option = TripDestinationOption.builder()
                .trip(trip)
                .placeId(request.placeId())
                .name(request.name().trim())
                .createdByUserId(userId)
                .build();

        option = optionRepository.save(option);
        log.info("User {} proposed destination {} for trip {}", userId, option.getId(), tripId);
        
        DestinationOptionResponse res = toResponse(option, userId);
        sseService.publishVoteUpdate(tripId, res);
        return res;
    }

    @Override
    @Transactional(readOnly = true)
    public List<DestinationOptionResponse> getDestinationOptions(UUID userId, UUID tripId) {
        if (!tripCollaborationService.hasReadAccess(userId, tripId)) {
            throw new ForbiddenException("PERMISSION_DENIED", "You do not have access to view this trip's voting");
        }

        return optionRepository.findByTripIdOrderByCreatedAtAsc(tripId).stream()
                .map(option -> toResponse(option, userId))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public DestinationOptionResponse voteForDestination(UUID userId, UUID tripId, UUID optionId) {
        if (!tripCollaborationService.hasReadAccess(userId, tripId)) {
            throw new ForbiddenException("PERMISSION_DENIED", "You do not have access to vote in this trip");
        }

        TripDestinationOption option = optionRepository.findById(optionId)
                .orElseThrow(() -> new NotFoundException("OPTION_NOT_FOUND", "Destination option not found"));

        if (!option.getTrip().getId().equals(tripId)) {
            throw new NotFoundException("OPTION_NOT_FOUND", "Destination option does not belong to this trip");
        }

        if (voteRepository.existsByTripDestinationOptionIdAndUserId(optionId, userId)) {
            throw new ConflictException("ALREADY_VOTED", "You have already voted for this destination");
        }

        TripDestinationVote vote = TripDestinationVote.builder()
                .tripDestinationOption(option)
                .userId(userId)
                .build();

        voteRepository.save(vote);
        log.info("User {} voted for destination {} in trip {}", userId, optionId, tripId);

        DestinationOptionResponse res = toResponse(option, userId);
        sseService.publishVoteUpdate(tripId, res);
        return res;
    }

    @Override
    @Transactional
    public DestinationOptionResponse removeVote(UUID userId, UUID tripId, UUID optionId) {
        if (!tripCollaborationService.hasReadAccess(userId, tripId)) {
            throw new ForbiddenException("PERMISSION_DENIED", "You do not have access to this trip");
        }

        TripDestinationOption option = optionRepository.findById(optionId)
                .orElseThrow(() -> new NotFoundException("OPTION_NOT_FOUND", "Destination option not found"));

        if (!option.getTrip().getId().equals(tripId)) {
            throw new NotFoundException("OPTION_NOT_FOUND", "Destination option does not belong to this trip");
        }

        Optional<TripDestinationVote> existingVote = voteRepository.findByTripDestinationOptionIdAndUserId(optionId, userId);
        if (existingVote.isEmpty()) {
            throw new NotFoundException("VOTE_NOT_FOUND", "You have not voted for this destination");
        }

        voteRepository.delete(existingVote.get());
        log.info("User {} removed vote for destination {} in trip {}", userId, optionId, tripId);

        DestinationOptionResponse res = toResponse(option, userId);
        sseService.publishVoteUpdate(tripId, res);
        return res;
    }

    private DestinationOptionResponse toResponse(TripDestinationOption option, UUID currentUserId) {
        List<TripDestinationVote> votes = voteRepository.findByTripDestinationOptionId(option.getId());
        List<UUID> voterIds = votes.stream().map(TripDestinationVote::getUserId).collect(Collectors.toList());
        boolean hasVoted = voterIds.contains(currentUserId);

        return DestinationOptionResponse.builder()
                .id(option.getId())
                .tripId(option.getTrip().getId())
                .placeId(option.getPlaceId())
                .name(option.getName())
                .createdByUserId(option.getCreatedByUserId())
                .voteCount(votes.size())
                .hasVoted(hasVoted)
                .voterUserIds(voterIds)
                .build();
    }

    private Trip getActiveTrip(UUID tripId) {
        Trip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new NotFoundException("TRIP_NOT_FOUND", "Trip not found"));
        if (trip.getStatus() == TripStatus.ARCHIVED || trip.getArchivedAt() != null) {
            throw new NotFoundException("TRIP_NOT_FOUND", "Trip not found");
        }
        return trip;
    }
}
