package fu.tripsense.tripservice.dto.response;

import java.util.List;
import lombok.Builder;

@Builder
public record TripCollaborationSummaryResponse(
    List<TripMemberResponse> members,
    List<TripInvitationResponse> pendingInvitations,
    String currentUserRole
) {}
