package fu.tripsense.tripservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import fu.tripsense.tripservice.dto.request.InviteTripMemberRequest;
import fu.tripsense.tripservice.dto.request.UpdateMemberRoleRequest;
import fu.tripsense.tripservice.dto.response.TripCollaborationSummaryResponse;
import fu.tripsense.tripservice.dto.response.TripInvitationResponse;
import fu.tripsense.tripservice.dto.response.TripMemberResponse;
import fu.tripsense.tripservice.entity.Trip;
import fu.tripsense.tripservice.entity.TripInvitation;
import fu.tripsense.tripservice.entity.TripMember;
import fu.tripsense.tripservice.enums.TripInvitationStatus;
import fu.tripsense.tripservice.enums.TripMemberRole;
import fu.tripsense.tripservice.enums.TripStatus;
import fu.tripsense.tripservice.exception.ConflictException;
import fu.tripsense.tripservice.exception.ForbiddenException;
import fu.tripsense.tripservice.exception.ValidationException;
import fu.tripsense.tripservice.repository.TripInvitationRepository;
import fu.tripsense.tripservice.repository.TripMemberRepository;
import fu.tripsense.tripservice.repository.TripRepository;
import fu.tripsense.tripservice.service.impl.TripCollaborationServiceImpl;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class TripCollaborationServiceTest {

  private final UUID ownerId = UUID.randomUUID();
  private final UUID memberUserId = UUID.randomUUID();
  private final UUID strangerUserId = UUID.randomUUID();
  private final UUID tripId = UUID.randomUUID();

  private TripRepository tripRepository;
  private TripMemberRepository tripMemberRepository;
  private TripInvitationRepository tripInvitationRepository;
  private TripCollaborationService collaborationService;

  private Trip sampleTrip;

  @BeforeEach
  void setUp() {
    tripRepository = mock(TripRepository.class);
    tripMemberRepository = mock(TripMemberRepository.class);
    tripInvitationRepository = mock(TripInvitationRepository.class);

    collaborationService =
        new TripCollaborationServiceImpl(
            tripRepository, tripMemberRepository, tripInvitationRepository);

    sampleTrip =
        Trip.builder()
            .id(tripId)
            .ownerUserId(ownerId)
            .name("Collaborative Da Nang Vacation")
            .destinationName("Da Nang")
            .startDate(LocalDate.now().plusDays(10))
            .endDate(LocalDate.now().plusDays(15))
            .status(TripStatus.DRAFT)
            .build();

    when(tripRepository.findById(tripId)).thenReturn(Optional.of(sampleTrip));
  }

  @Test
  void inviteMember_asOwner_createsInvitationSuccessfully_TF76() {
    InviteTripMemberRequest request =
        InviteTripMemberRequest.builder()
            .email("friend@example.com")
            .role(TripMemberRole.EDITOR)
            .message("Join my trip!")
            .build();

    when(tripInvitationRepository.findByTripIdAndInviteeEmailAndStatus(
            tripId, "friend@example.com", TripInvitationStatus.PENDING))
        .thenReturn(Optional.empty());

    when(tripInvitationRepository.save(any(TripInvitation.class)))
        .thenAnswer(
            invocation -> {
              TripInvitation inv = invocation.getArgument(0);
              inv.setId(UUID.randomUUID());
              inv.setCreatedAt(Instant.now());
              return inv;
            });

    TripInvitationResponse response =
        collaborationService.inviteMember(ownerId, tripId, request);

    assertThat(response).isNotNull();
    assertThat(response.tripId()).isEqualTo(tripId);
    assertThat(response.inviteeEmail()).isEqualTo("friend@example.com");
    assertThat(response.role()).isEqualTo(TripMemberRole.EDITOR);
    assertThat(response.status()).isEqualTo(TripInvitationStatus.PENDING);
    assertThat(response.invitationToken()).isNotEmpty();
  }

  @Test
  void inviteMember_withOwnerRole_throwsValidationException() {
    InviteTripMemberRequest request =
        InviteTripMemberRequest.builder()
            .email("co-owner@example.com")
            .role(TripMemberRole.OWNER)
            .build();

    assertThatThrownBy(() -> collaborationService.inviteMember(ownerId, tripId, request))
        .isInstanceOf(ValidationException.class)
        .hasMessageContaining("Cannot invite a member with OWNER role");
  }

  @Test
  void inviteMember_whenPendingInvitationExists_throwsConflict_TF76() {
    InviteTripMemberRequest request =
        InviteTripMemberRequest.builder()
            .email("friend@example.com")
            .role(TripMemberRole.EDITOR)
            .build();

    TripInvitation existing =
        TripInvitation.builder()
            .id(UUID.randomUUID())
            .trip(sampleTrip)
            .inviteeEmail("friend@example.com")
            .status(TripInvitationStatus.PENDING)
            .expiresAt(Instant.now().plus(5, ChronoUnit.DAYS))
            .build();

    when(tripInvitationRepository.findByTripIdAndInviteeEmailAndStatus(
            tripId, "friend@example.com", TripInvitationStatus.PENDING))
        .thenReturn(Optional.of(existing));

    assertThatThrownBy(() -> collaborationService.inviteMember(ownerId, tripId, request))
        .isInstanceOf(ConflictException.class)
        .hasMessageContaining("already been sent");
  }

  @Test
  void acceptInvitation_addsUserToTripMembers_TF77() {
    UUID invitationId = UUID.randomUUID();
    TripInvitation invitation =
        TripInvitation.builder()
            .id(invitationId)
            .trip(sampleTrip)
            .inviterUserId(ownerId)
            .inviteeEmail("friend@example.com")
            .role(TripMemberRole.EDITOR)
            .status(TripInvitationStatus.PENDING)
            .invitationToken("token123")
            .expiresAt(Instant.now().plus(3, ChronoUnit.DAYS))
            .build();

    when(tripInvitationRepository.findById(invitationId)).thenReturn(Optional.of(invitation));
    when(tripMemberRepository.findByTripIdAndUserId(tripId, memberUserId))
        .thenReturn(Optional.empty());

    when(tripMemberRepository.save(any(TripMember.class)))
        .thenAnswer(
            inv -> {
              TripMember m = inv.getArgument(0);
              m.setId(UUID.randomUUID());
              return m;
            });

    TripMemberResponse response =
        collaborationService.acceptInvitation(memberUserId, "friend@example.com", invitationId);

    assertThat(response).isNotNull();
    assertThat(response.tripId()).isEqualTo(tripId);
    assertThat(response.userId()).isEqualTo(memberUserId);
    assertThat(response.role()).isEqualTo(TripMemberRole.EDITOR);
    assertThat(invitation.getStatus()).isEqualTo(TripInvitationStatus.ACCEPTED);
    assertThat(invitation.getInviteeUserId()).isEqualTo(memberUserId);
  }

  @Test
  void acceptInvitation_withMismatchedEmail_throwsForbidden_SecurityGuard() {
    UUID invitationId = UUID.randomUUID();
    TripInvitation invitation =
        TripInvitation.builder()
            .id(invitationId)
            .trip(sampleTrip)
            .inviterUserId(ownerId)
            .inviteeEmail("friend@example.com")
            .role(TripMemberRole.EDITOR)
            .status(TripInvitationStatus.PENDING)
            .invitationToken("token123")
            .expiresAt(Instant.now().plus(3, ChronoUnit.DAYS))
            .build();

    when(tripInvitationRepository.findById(invitationId)).thenReturn(Optional.of(invitation));

    assertThatThrownBy(
            () ->
                collaborationService.acceptInvitation(
                    strangerUserId, "stranger@example.com", invitationId))
        .isInstanceOf(ForbiddenException.class)
        .hasMessageContaining("not sent to your account");
  }

  @Test
  void declineInvitation_marksInvitationDeclined_TF78() {
    UUID invitationId = UUID.randomUUID();
    TripInvitation invitation =
        TripInvitation.builder()
            .id(invitationId)
            .trip(sampleTrip)
            .inviterUserId(ownerId)
            .inviteeEmail("friend@example.com")
            .status(TripInvitationStatus.PENDING)
            .expiresAt(Instant.now().plus(3, ChronoUnit.DAYS))
            .build();

    when(tripInvitationRepository.findById(invitationId)).thenReturn(Optional.of(invitation));

    collaborationService.declineInvitation(memberUserId, "friend@example.com", invitationId);

    assertThat(invitation.getStatus()).isEqualTo(TripInvitationStatus.DECLINED);
    assertThat(invitation.getInviteeUserId()).isEqualTo(memberUserId);
  }

  @Test
  void updateMemberRole_withOwnerRole_throwsValidationException() {
    UUID memberRecordId = UUID.randomUUID();
    TripMember member =
        TripMember.builder()
            .id(memberRecordId)
            .trip(sampleTrip)
            .userId(memberUserId)
            .role(TripMemberRole.VIEWER)
            .joinedAt(Instant.now())
            .build();

    when(tripMemberRepository.findById(memberRecordId)).thenReturn(Optional.of(member));

    assertThatThrownBy(
            () ->
                collaborationService.updateMemberRole(
                    ownerId,
                    tripId,
                    memberRecordId,
                    new UpdateMemberRoleRequest(TripMemberRole.OWNER)))
        .isInstanceOf(ValidationException.class)
        .hasMessageContaining("Cannot assign member with OWNER role");
  }

  @Test
  void getTripMembers_andSummary_returnsAllMembers_TF79() {
    TripMember ownerMember =
        TripMember.builder()
            .id(UUID.randomUUID())
            .trip(sampleTrip)
            .userId(ownerId)
            .role(TripMemberRole.OWNER)
            .joinedAt(Instant.now())
            .build();

    TripMember editorMember =
        TripMember.builder()
            .id(UUID.randomUUID())
            .trip(sampleTrip)
            .userId(memberUserId)
            .role(TripMemberRole.EDITOR)
            .joinedAt(Instant.now())
            .build();

    when(tripMemberRepository.existsByTripIdAndUserId(tripId, ownerId)).thenReturn(true);
    when(tripMemberRepository.findByTripId(tripId))
        .thenReturn(List.of(ownerMember, editorMember));

    List<TripMemberResponse> members = collaborationService.getTripMembers(ownerId, tripId);
    assertThat(members).hasSize(2);

    TripCollaborationSummaryResponse summary =
        collaborationService.getCollaborationSummary(ownerId, tripId);
    assertThat(summary.members()).hasSize(2);
    assertThat(summary.currentUserRole()).isEqualTo("OWNER");
  }

  @Test
  void removeMember_byOwner_deletesMember_TF80() {
    UUID memberRecordId = UUID.randomUUID();
    TripMember member =
        TripMember.builder()
            .id(memberRecordId)
            .trip(sampleTrip)
            .userId(memberUserId)
            .role(TripMemberRole.EDITOR)
            .joinedAt(Instant.now())
            .build();

    when(tripMemberRepository.findById(memberRecordId)).thenReturn(Optional.of(member));

    collaborationService.removeMember(ownerId, tripId, memberRecordId);
    verify(tripMemberRepository).delete(member);
  }

  @Test
  void removeMember_attemptToRemoveOwner_throwsException_TF80() {
    UUID ownerMemberRecordId = UUID.randomUUID();
    TripMember ownerMember =
        TripMember.builder()
            .id(ownerMemberRecordId)
            .trip(sampleTrip)
            .userId(ownerId)
            .role(TripMemberRole.OWNER)
            .joinedAt(Instant.now())
            .build();

    when(tripMemberRepository.findById(ownerMemberRecordId)).thenReturn(Optional.of(ownerMember));

    assertThatThrownBy(
            () -> collaborationService.removeMember(ownerId, tripId, ownerMemberRecordId))
        .isInstanceOf(ValidationException.class)
        .hasMessageContaining("owner cannot be removed");
  }

  @Test
  void leaveTrip_asMember_deletesMembership_TF81() {
    TripMember member =
        TripMember.builder()
            .id(UUID.randomUUID())
            .trip(sampleTrip)
            .userId(memberUserId)
            .role(TripMemberRole.EDITOR)
            .joinedAt(Instant.now())
            .build();

    when(tripMemberRepository.findByTripIdAndUserId(tripId, memberUserId))
        .thenReturn(Optional.of(member));

    collaborationService.leaveTrip(memberUserId, tripId);
    verify(tripMemberRepository).delete(member);
  }

  @Test
  void leaveTrip_attemptByOwner_throwsValidationException_TF81() {
    assertThatThrownBy(() -> collaborationService.leaveTrip(ownerId, tripId))
        .isInstanceOf(ValidationException.class)
        .hasMessageContaining("Owner cannot leave");
  }
}
