package fu.tripsense.tripservice.service.impl;

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
import fu.tripsense.tripservice.exception.NotFoundException;
import fu.tripsense.tripservice.exception.ValidationException;
import fu.tripsense.tripservice.repository.TripInvitationRepository;
import fu.tripsense.tripservice.repository.TripMemberRepository;
import fu.tripsense.tripservice.repository.TripRepository;
import fu.tripsense.tripservice.service.TripCollaborationService;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class TripCollaborationServiceImpl implements TripCollaborationService {

  private static final int INVITATION_EXPIRY_DAYS = 7;

  private final TripRepository tripRepository;
  private final TripMemberRepository tripMemberRepository;
  private final TripInvitationRepository tripInvitationRepository;

  @Override
  @Transactional
  public TripInvitationResponse inviteMember(
      UUID userId, UUID tripId, InviteTripMemberRequest request) {
    Trip trip = getActiveTrip(tripId);
    ensureCanInvite(userId, trip);

    String email = request.email().trim().toLowerCase();

    // Check if user is already a member
    List<TripMember> members = tripMemberRepository.findByTripId(tripId);
    boolean isOwner = trip.getOwnerUserId().equals(userId);

    // Check active pending invite
    Optional<TripInvitation> existingInvite =
        tripInvitationRepository.findByTripIdAndInviteeEmailAndStatus(
            tripId, email, TripInvitationStatus.PENDING);
    if (existingInvite.isPresent()) {
      if (existingInvite.get().getExpiresAt().isAfter(Instant.now())) {
        throw new ConflictException(
            "INVITATION_ALREADY_PENDING",
            "An active invitation has already been sent to " + email);
      } else {
        // Expire previous invite
        existingInvite.get().setStatus(TripInvitationStatus.EXPIRED);
        tripInvitationRepository.save(existingInvite.get());
      }
    }

    TripInvitation invitation =
        TripInvitation.builder()
            .trip(trip)
            .inviterUserId(userId)
            .inviteeEmail(email)
            .role(request.role() != null ? request.role() : TripMemberRole.EDITOR)
            .status(TripInvitationStatus.PENDING)
            .invitationToken(UUID.randomUUID().toString().replace("-", ""))
            .message(request.message() != null ? request.message().trim() : null)
            .expiresAt(Instant.now().plus(INVITATION_EXPIRY_DAYS, ChronoUnit.DAYS))
            .build();

    TripInvitation saved = tripInvitationRepository.save(invitation);
    log.info(
        "Created trip invitation {} for email {} to trip {}",
        saved.getId(),
        email,
        tripId);

    return toInvitationResponse(saved, trip);
  }

  @Override
  @Transactional(readOnly = true)
  public List<TripInvitationResponse> getTripInvitations(UUID userId, UUID tripId) {
    Trip trip = getActiveTrip(tripId);
    ensureHasReadAccess(userId, trip);

    return tripInvitationRepository.findByTripId(tripId).stream()
        .map(inv -> toInvitationResponse(inv, trip))
        .toList();
  }

  @Override
  @Transactional(readOnly = true)
  public List<TripInvitationResponse> getMyPendingInvitations(UUID userId, String userEmail) {
    Instant now = Instant.now();
    Set<TripInvitation> result = new HashSet<>();

    if (userId != null) {
      result.addAll(
          tripInvitationRepository.findByInviteeUserIdAndStatus(
              userId, TripInvitationStatus.PENDING));
    }
    if (userEmail != null && !userEmail.isBlank()) {
      result.addAll(
          tripInvitationRepository.findByInviteeEmailAndStatus(
              userEmail.trim().toLowerCase(), TripInvitationStatus.PENDING));
    }

    return result.stream()
        .filter(inv -> inv.getExpiresAt().isAfter(now))
        .map(inv -> toInvitationResponse(inv, inv.getTrip()))
        .toList();
  }

  @Override
  @Transactional
  @CacheEvict(
      cacheNames = {"trip-detail", "trip-list", "trip-itinerary"},
      allEntries = true)
  public TripMemberResponse acceptInvitation(UUID userId, UUID invitationId) {
    TripInvitation invitation =
        tripInvitationRepository
            .findById(invitationId)
            .orElseThrow(
                () -> new NotFoundException("INVITATION_NOT_FOUND", "Invitation not found"));

    return processAcceptance(userId, invitation);
  }

  @Override
  @Transactional
  @CacheEvict(
      cacheNames = {"trip-detail", "trip-list", "trip-itinerary"},
      allEntries = true)
  public TripMemberResponse acceptInvitationByToken(UUID userId, String token) {
    TripInvitation invitation =
        tripInvitationRepository
            .findByInvitationToken(token)
            .orElseThrow(
                () -> new NotFoundException("INVITATION_NOT_FOUND", "Invitation token invalid"));

    return processAcceptance(userId, invitation);
  }

  @Override
  @Transactional
  public void declineInvitation(UUID userId, UUID invitationId) {
    TripInvitation invitation =
        tripInvitationRepository
            .findById(invitationId)
            .orElseThrow(
                () -> new NotFoundException("INVITATION_NOT_FOUND", "Invitation not found"));

    processDecline(userId, invitation);
  }

  @Override
  @Transactional
  public void declineInvitationByToken(UUID userId, String token) {
    TripInvitation invitation =
        tripInvitationRepository
            .findByInvitationToken(token)
            .orElseThrow(
                () -> new NotFoundException("INVITATION_NOT_FOUND", "Invitation token invalid"));

    processDecline(userId, invitation);
  }

  @Override
  @Transactional
  public List<TripMemberResponse> getTripMembers(UUID userId, UUID tripId) {
    Trip trip = getActiveTrip(tripId);
    ensureHasReadAccess(userId, trip);

    ensureOwnerMembership(trip);

    return tripMemberRepository.findByTripId(tripId).stream()
        .map(this::toMemberResponse)
        .toList();
  }

  @Override
  @Transactional
  public TripCollaborationSummaryResponse getCollaborationSummary(UUID userId, UUID tripId) {
    Trip trip = getActiveTrip(tripId);
    ensureHasReadAccess(userId, trip);

    ensureOwnerMembership(trip);

    List<TripMemberResponse> members =
        tripMemberRepository.findByTripId(tripId).stream().map(this::toMemberResponse).toList();

    List<TripInvitationResponse> pendingInvites =
        tripInvitationRepository
            .findByTripIdAndStatus(tripId, TripInvitationStatus.PENDING)
            .stream()
            .filter(inv -> inv.getExpiresAt().isAfter(Instant.now()))
            .map(inv -> toInvitationResponse(inv, trip))
            .toList();

    String currentRole = resolveUserRole(userId, trip);

    return TripCollaborationSummaryResponse.builder()
        .members(members)
        .pendingInvitations(pendingInvites)
        .currentUserRole(currentRole)
        .build();
  }

  @Override
  @Transactional
  public TripMemberResponse updateMemberRole(
      UUID userId, UUID tripId, UUID memberId, UpdateMemberRoleRequest request) {
    Trip trip = getActiveTrip(tripId);
    ensureOwner(userId, trip);

    TripMember member =
        tripMemberRepository
            .findById(memberId)
            .orElseThrow(() -> new NotFoundException("MEMBER_NOT_FOUND", "Member not found"));

    if (!member.getTrip().getId().equals(tripId)) {
      throw new ValidationException("INVALID_MEMBER", "Member does not belong to this trip");
    }

    if (member.getUserId().equals(trip.getOwnerUserId())) {
      throw new ValidationException(
          "CANNOT_CHANGE_OWNER_ROLE", "Owner role cannot be modified via role update");
    }

    member.setRole(request.role());
    TripMember updated = tripMemberRepository.save(member);
    return toMemberResponse(updated);
  }

  @Override
  @Transactional
  @CacheEvict(
      cacheNames = {"trip-detail", "trip-list", "trip-itinerary"},
      allEntries = true)
  public void removeMember(UUID userId, UUID tripId, UUID memberId) {
    Trip trip = getActiveTrip(tripId);
    ensureOwner(userId, trip);

    TripMember member =
        tripMemberRepository
            .findById(memberId)
            .orElseThrow(() -> new NotFoundException("MEMBER_NOT_FOUND", "Member not found"));

    if (!member.getTrip().getId().equals(tripId)) {
      throw new ValidationException("INVALID_MEMBER", "Member does not belong to this trip");
    }

    if (member.getUserId().equals(trip.getOwnerUserId())) {
      throw new ValidationException("CANNOT_REMOVE_OWNER", "Trip owner cannot be removed");
    }

    tripMemberRepository.delete(member);
    log.info("Removed member {} from trip {}", memberId, tripId);
  }

  @Override
  @Transactional
  @CacheEvict(
      cacheNames = {"trip-detail", "trip-list", "trip-itinerary"},
      allEntries = true)
  public void leaveTrip(UUID userId, UUID tripId) {
    Trip trip = getActiveTrip(tripId);

    if (trip.getOwnerUserId().equals(userId)) {
      throw new ValidationException(
          "OWNER_CANNOT_LEAVE",
          "Owner cannot leave the trip. Please transfer ownership or delete the trip.");
    }

    TripMember member =
        tripMemberRepository
            .findByTripIdAndUserId(tripId, userId)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "MEMBER_NOT_FOUND", "You are not a member of this trip"));

    tripMemberRepository.delete(member);
    log.info("User {} left trip {}", userId, tripId);
  }

  @Override
  public boolean hasReadAccess(UUID userId, UUID tripId) {
    if (userId == null || tripId == null) {
      return false;
    }
    Optional<Trip> tripOpt = tripRepository.findById(tripId);
    if (tripOpt.isEmpty() || tripOpt.get().getStatus() == TripStatus.ARCHIVED) {
      return false;
    }
    Trip trip = tripOpt.get();
    return trip.getOwnerUserId().equals(userId)
        || tripMemberRepository.existsByTripIdAndUserId(tripId, userId);
  }

  @Override
  public boolean hasEditAccess(UUID userId, UUID tripId) {
    if (userId == null || tripId == null) {
      return false;
    }
    Optional<Trip> tripOpt = tripRepository.findById(tripId);
    if (tripOpt.isEmpty() || tripOpt.get().getStatus() == TripStatus.ARCHIVED) {
      return false;
    }
    Trip trip = tripOpt.get();
    if (trip.getOwnerUserId().equals(userId)) {
      return true;
    }
    return tripMemberRepository
        .findByTripIdAndUserId(tripId, userId)
        .map(m -> m.getRole() == TripMemberRole.OWNER || m.getRole() == TripMemberRole.EDITOR)
        .orElse(false);
  }

  private TripMemberResponse processAcceptance(UUID userId, TripInvitation invitation) {
    if (invitation.getStatus() != TripInvitationStatus.PENDING) {
      throw new ConflictException(
          "INVITATION_INACTIVE",
          "Invitation is already " + invitation.getStatus().name().toLowerCase());
    }

    if (invitation.getExpiresAt().isBefore(Instant.now())) {
      invitation.setStatus(TripInvitationStatus.EXPIRED);
      tripInvitationRepository.save(invitation);
      throw new ValidationException("INVITATION_EXPIRED", "This invitation has expired");
    }

    Trip trip = invitation.getTrip();
    if (trip.getStatus() == TripStatus.ARCHIVED || trip.getArchivedAt() != null) {
      throw new NotFoundException("TRIP_NOT_FOUND", "The trip no longer exists");
    }

    Optional<TripMember> existingMember =
        tripMemberRepository.findByTripIdAndUserId(trip.getId(), userId);

    TripMember member;
    if (existingMember.isPresent()) {
      member = existingMember.get();
      if (member.getRole() == TripMemberRole.VIEWER
          && invitation.getRole() == TripMemberRole.EDITOR) {
        member.setRole(TripMemberRole.EDITOR);
        member = tripMemberRepository.save(member);
      }
    } else {
      member =
          TripMember.builder()
              .trip(trip)
              .userId(userId)
              .role(invitation.getRole())
              .joinedAt(Instant.now())
              .build();
      member = tripMemberRepository.save(member);
    }

    invitation.setStatus(TripInvitationStatus.ACCEPTED);
    invitation.setInviteeUserId(userId);
    tripInvitationRepository.save(invitation);

    log.info("User {} accepted invitation {} to trip {}", userId, invitation.getId(), trip.getId());
    return toMemberResponse(member);
  }

  private void processDecline(UUID userId, TripInvitation invitation) {
    if (invitation.getStatus() != TripInvitationStatus.PENDING) {
      throw new ConflictException(
          "INVITATION_INACTIVE",
          "Invitation is already " + invitation.getStatus().name().toLowerCase());
    }

    invitation.setStatus(TripInvitationStatus.DECLINED);
    invitation.setInviteeUserId(userId);
    tripInvitationRepository.save(invitation);
    log.info("User {} declined invitation {}", userId, invitation.getId());
  }

  private Trip getActiveTrip(UUID tripId) {
    Trip trip =
        tripRepository
            .findById(tripId)
            .orElseThrow(() -> new NotFoundException("TRIP_NOT_FOUND", "Trip not found"));
    if (trip.getStatus() == TripStatus.ARCHIVED || trip.getArchivedAt() != null) {
      throw new NotFoundException("TRIP_NOT_FOUND", "Trip not found");
    }
    return trip;
  }

  private void ensureCanInvite(UUID userId, Trip trip) {
    if (trip.getOwnerUserId().equals(userId)) {
      return;
    }
    Optional<TripMember> memberOpt =
        tripMemberRepository.findByTripIdAndUserId(trip.getId(), userId);
    if (memberOpt.isPresent()
        && (memberOpt.get().getRole() == TripMemberRole.OWNER
            || memberOpt.get().getRole() == TripMemberRole.EDITOR)) {
      return;
    }
    throw new ForbiddenException("PERMISSION_DENIED", "You do not have permission to invite members");
  }

  private void ensureOwner(UUID userId, Trip trip) {
    if (trip.getOwnerUserId().equals(userId)) {
      return;
    }
    Optional<TripMember> memberOpt =
        tripMemberRepository.findByTripIdAndUserId(trip.getId(), userId);
    if (memberOpt.isPresent() && memberOpt.get().getRole() == TripMemberRole.OWNER) {
      return;
    }
    throw new ForbiddenException(
        "PERMISSION_DENIED", "Only trip owner can perform this operation");
  }

  private void ensureHasReadAccess(UUID userId, Trip trip) {
    if (trip.getOwnerUserId().equals(userId)) {
      return;
    }
    if (tripMemberRepository.existsByTripIdAndUserId(trip.getId(), userId)) {
      return;
    }
    throw new ForbiddenException("PERMISSION_DENIED", "You do not have access to this trip");
  }

  private void ensureOwnerMembership(Trip trip) {
    if (!tripMemberRepository.existsByTripIdAndUserId(trip.getId(), trip.getOwnerUserId())) {
      TripMember ownerMember =
          TripMember.builder()
              .trip(trip)
              .userId(trip.getOwnerUserId())
              .role(TripMemberRole.OWNER)
              .joinedAt(trip.getCreatedAt())
              .build();
      tripMemberRepository.save(ownerMember);
    }
  }

  private String resolveUserRole(UUID userId, Trip trip) {
    if (trip.getOwnerUserId().equals(userId)) {
      return TripMemberRole.OWNER.name();
    }
    return tripMemberRepository
        .findByTripIdAndUserId(trip.getId(), userId)
        .map(m -> m.getRole().name())
        .orElse("NON_MEMBER");
  }

  private TripMemberResponse toMemberResponse(TripMember member) {
    return TripMemberResponse.builder()
        .id(member.getId())
        .tripId(member.getTrip().getId())
        .userId(member.getUserId())
        .role(member.getRole())
        .joinedAt(member.getJoinedAt())
        .build();
  }

  private TripInvitationResponse toInvitationResponse(TripInvitation inv, Trip trip) {
    return TripInvitationResponse.builder()
        .id(inv.getId())
        .tripId(trip != null ? trip.getId() : inv.getTrip().getId())
        .tripName(trip != null ? trip.getName() : (inv.getTrip() != null ? inv.getTrip().getName() : ""))
        .inviterUserId(inv.getInviterUserId())
        .inviteeEmail(inv.getInviteeEmail())
        .role(inv.getRole())
        .status(inv.getStatus())
        .invitationToken(inv.getInvitationToken())
        .message(inv.getMessage())
        .expiresAt(inv.getExpiresAt())
        .createdAt(inv.getCreatedAt())
        .build();
  }
}
