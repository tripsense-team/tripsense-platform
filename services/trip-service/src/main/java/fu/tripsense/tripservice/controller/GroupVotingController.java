package fu.tripsense.tripservice.controller;

import fu.tripsense.tripservice.dto.request.ProposeDestinationRequest;
import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.dto.response.DestinationOptionResponse;
import fu.tripsense.tripservice.security.CurrentUserProvider;
import fu.tripsense.tripservice.service.GroupVotingService;
import fu.tripsense.tripservice.service.GroupVotingSseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/trips/{tripId}/destinations")
@RequiredArgsConstructor
public class GroupVotingController {

    private final GroupVotingService groupVotingService;
    private final GroupVotingSseService sseService;
    private final CurrentUserProvider currentUserProvider;

    @PostMapping
    public ResponseEntity<ApiResponse<DestinationOptionResponse>> proposeDestination(
            @PathVariable UUID tripId,
            @Valid @RequestBody ProposeDestinationRequest request) {
        DestinationOptionResponse response = groupVotingService.proposeDestination(
                currentUserProvider.userId(), tripId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Destination proposed successfully", response));
    }

    @GetMapping
    public ApiResponse<List<DestinationOptionResponse>> getDestinationOptions(
            @PathVariable UUID tripId) {
        return ApiResponse.success(
                groupVotingService.getDestinationOptions(currentUserProvider.userId(), tripId));
    }

    @PostMapping("/{destinationId}/votes")
    public ApiResponse<DestinationOptionResponse> voteForDestination(
            @PathVariable UUID tripId,
            @PathVariable UUID destinationId) {
        return ApiResponse.success("Vote recorded successfully",
                groupVotingService.voteForDestination(currentUserProvider.userId(), tripId, destinationId));
    }

    @DeleteMapping("/{destinationId}/votes")
    public ApiResponse<DestinationOptionResponse> removeVote(
            @PathVariable UUID tripId,
            @PathVariable UUID destinationId) {
        return ApiResponse.success("Vote removed successfully",
                groupVotingService.removeVote(currentUserProvider.userId(), tripId, destinationId));
    }

    @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamEvents(@PathVariable UUID tripId) {
        return sseService.subscribe(tripId, currentUserProvider.userId());
    }
}
