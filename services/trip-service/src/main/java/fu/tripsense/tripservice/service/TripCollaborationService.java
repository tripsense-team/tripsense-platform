package fu.tripsense.tripservice.service;

import fu.tripsense.tripservice.dto.request.InviteTripMemberRequest;
import fu.tripsense.tripservice.dto.request.UpdateMemberRoleRequest;
import fu.tripsense.tripservice.dto.response.TripCollaborationSummaryResponse;
import fu.tripsense.tripservice.dto.response.TripInvitationResponse;
import fu.tripsense.tripservice.dto.response.TripMemberResponse;
import java.util.List;
import java.util.UUID;

public interface TripCollaborationService {

  // TF-76: Invite a user to a trip
  TripInvitationResponse inviteMember(UUID userId, UUID tripId, InviteTripMemberRequest request);

  // TF-76/79: List invitations for a trip
  List<TripInvitationResponse> getTripInvitations(UUID userId, UUID tripId);

  // TF-77/78: Get current user's pending invitations
  List<TripInvitationResponse> getMyPendingInvitations(UUID userId, String userEmail);

  // TF-77: Accept trip invitation
  TripMemberResponse acceptInvitation(UUID userId, String userEmail, UUID invitationId);

  // TF-77 (by token): Accept invitation via public link token
  TripMemberResponse acceptInvitationByToken(UUID userId, String userEmail, String token);

  // TF-78: Decline trip invitation
  void declineInvitation(UUID userId, String userEmail, UUID invitationId);

  // TF-78 (by token): Decline invitation via token
  void declineInvitationByToken(UUID userId, String userEmail, String token);

  // TF-79: View trip members
  List<TripMemberResponse> getTripMembers(UUID userId, UUID tripId);

  // TF-79: Collaboration summary (members + pending invites + current role)
  TripCollaborationSummaryResponse getCollaborationSummary(UUID userId, UUID tripId);

  // Update member role (Owner only)
  TripMemberResponse updateMemberRole(UUID userId, UUID tripId, UUID memberId, UpdateMemberRoleRequest request);

  // TF-80: Remove a member from the trip (Owner only)
  void removeMember(UUID userId, UUID tripId, UUID memberId);

  // TF-81: Leave a shared trip
  void leaveTrip(UUID userId, UUID tripId);

  // Authorization helper
  boolean hasReadAccess(UUID userId, UUID tripId);

  boolean hasEditAccess(UUID userId, UUID tripId);
}
