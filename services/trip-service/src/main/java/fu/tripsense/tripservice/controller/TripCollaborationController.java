package fu.tripsense.tripservice.controller;

import fu.tripsense.tripservice.dto.request.InviteTripMemberRequest;
import fu.tripsense.tripservice.dto.request.UpdateMemberRoleRequest;
import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.dto.response.TripCollaborationSummaryResponse;
import fu.tripsense.tripservice.dto.response.TripInvitationResponse;
import fu.tripsense.tripservice.dto.response.TripMemberResponse;
import fu.tripsense.tripservice.security.CurrentUserProvider;
import fu.tripsense.tripservice.service.TripCollaborationService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/trips")
@RequiredArgsConstructor
public class TripCollaborationController {

  private final TripCollaborationService collaborationService;
  private final CurrentUserProvider currentUserProvider;

  // TF-76: Invite a user to a trip
  @PostMapping("/{tripId}/invitations")
  public ResponseEntity<ApiResponse<TripInvitationResponse>> inviteMember(
      @PathVariable UUID tripId, @Valid @RequestBody InviteTripMemberRequest request) {
    TripInvitationResponse response =
        collaborationService.inviteMember(currentUserProvider.userId(), tripId, request);
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.success("Invitation sent successfully", response));
  }

  // TF-76/79: List invitations for a trip
  @GetMapping("/{tripId}/invitations")
  public ApiResponse<List<TripInvitationResponse>> getTripInvitations(@PathVariable UUID tripId) {
    return ApiResponse.success(
        collaborationService.getTripInvitations(currentUserProvider.userId(), tripId));
  }

  // TF-77/78: Get current user's pending invitations
  @GetMapping("/invitations/pending")
  public ApiResponse<List<TripInvitationResponse>> getMyPendingInvitations(
      @RequestParam(required = false) String email) {
    return ApiResponse.success(
        collaborationService.getMyPendingInvitations(currentUserProvider.userId(), email));
  }

  // TF-77: Accept trip invitation by ID
  @PostMapping("/invitations/{invitationId}/accept")
  public ApiResponse<TripMemberResponse> acceptInvitation(@PathVariable UUID invitationId) {
    return ApiResponse.success(
        "Invitation accepted",
        collaborationService.acceptInvitation(currentUserProvider.userId(), invitationId));
  }

  // TF-77: Accept trip invitation by Token
  @PostMapping("/invitations/token/{token}/accept")
  public ApiResponse<TripMemberResponse> acceptInvitationByToken(@PathVariable String token) {
    return ApiResponse.success(
        "Invitation accepted",
        collaborationService.acceptInvitationByToken(currentUserProvider.userId(), token));
  }

  // TF-78: Decline trip invitation by ID
  @PostMapping("/invitations/{invitationId}/decline")
  public ApiResponse<Void> declineInvitation(@PathVariable UUID invitationId) {
    collaborationService.declineInvitation(currentUserProvider.userId(), invitationId);
    return ApiResponse.success("Invitation declined", null);
  }

  // TF-78: Decline trip invitation by Token
  @PostMapping("/invitations/token/{token}/decline")
  public ApiResponse<Void> declineInvitationByToken(@PathVariable String token) {
    collaborationService.declineInvitationByToken(currentUserProvider.userId(), token);
    return ApiResponse.success("Invitation declined", null);
  }

  // TF-79: View trip members
  @GetMapping("/{tripId}/members")
  public ApiResponse<List<TripMemberResponse>> getTripMembers(@PathVariable UUID tripId) {
    return ApiResponse.success(
        collaborationService.getTripMembers(currentUserProvider.userId(), tripId));
  }

  // TF-79: Get collaboration summary
  @GetMapping("/{tripId}/collaboration")
  public ApiResponse<TripCollaborationSummaryResponse> getCollaborationSummary(
      @PathVariable UUID tripId) {
    return ApiResponse.success(
        collaborationService.getCollaborationSummary(currentUserProvider.userId(), tripId));
  }

  // Update member role (Owner only)
  @PatchMapping("/{tripId}/members/{memberId}")
  public ApiResponse<TripMemberResponse> updateMemberRole(
      @PathVariable UUID tripId,
      @PathVariable UUID memberId,
      @Valid @RequestBody UpdateMemberRoleRequest request) {
    return ApiResponse.success(
        "Member role updated",
        collaborationService.updateMemberRole(
            currentUserProvider.userId(), tripId, memberId, request));
  }

  // TF-80: Remove a member from the trip
  @DeleteMapping("/{tripId}/members/{memberId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void removeMember(@PathVariable UUID tripId, @PathVariable UUID memberId) {
    collaborationService.removeMember(currentUserProvider.userId(), tripId, memberId);
  }

  // TF-81: Leave a shared trip
  @PostMapping("/{tripId}/leave")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void leaveTrip(@PathVariable UUID tripId) {
    collaborationService.leaveTrip(currentUserProvider.userId(), tripId);
  }
}
