package fu.tripsense.tripservice.repository;

import fu.tripsense.tripservice.entity.TripInvitation;
import fu.tripsense.tripservice.enums.TripInvitationStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TripInvitationRepository extends JpaRepository<TripInvitation, UUID> {

  List<TripInvitation> findByTripId(UUID tripId);

  List<TripInvitation> findByTripIdAndStatus(UUID tripId, TripInvitationStatus status);

  Optional<TripInvitation> findByInvitationToken(String invitationToken);

  Optional<TripInvitation> findByTripIdAndInviteeEmailAndStatus(
      UUID tripId, String inviteeEmail, TripInvitationStatus status);

  boolean existsByTripIdAndInviteeEmailAndStatus(
      UUID tripId, String inviteeEmail, TripInvitationStatus status);

  List<TripInvitation> findByInviteeEmailAndStatus(
      String inviteeEmail, TripInvitationStatus status);

  List<TripInvitation> findByInviteeUserIdAndStatus(
      UUID inviteeUserId, TripInvitationStatus status);
}
