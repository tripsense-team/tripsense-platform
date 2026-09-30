package fu.tripsense.tripservice.service;

import fu.tripsense.tripservice.client.PlaceClient;
import fu.tripsense.tripservice.client.PlaceSnapshot;
import fu.tripsense.tripservice.dto.response.*;
import fu.tripsense.tripservice.entity.Trip;
import fu.tripsense.tripservice.entity.TripPlace;
import fu.tripsense.tripservice.enums.TripStatus;
import fu.tripsense.tripservice.exception.NotFoundException;
import fu.tripsense.tripservice.exception.ValidationException;
import fu.tripsense.tripservice.repository.TripPlaceRepository;
import fu.tripsense.tripservice.repository.TripRepository;
import java.util.*;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TripPlaceService {
  private final TripRepository trips;
  private final TripPlaceRepository tripPlaces;
  private final PlaceClient placeClient;

  @Transactional
  public TripPlaceResponse add(UUID ownerId, UUID tripId, String placeRef) {
    Trip trip = requireOwnedTrip(ownerId, tripId);
    if (trip.getStatus() == TripStatus.ARCHIVED || trip.getStatus() == TripStatus.CANCELLED) {
      throw new ValidationException("TRIP_NOT_EDITABLE", "Trip cannot be changed");
    }
    Optional<TripPlace> existing = tripPlaces.findByTripIdAndPlaceRef(tripId, placeRef);
    if (existing.isPresent()) return toResponse(existing.get());

    PlaceSnapshot place = placeClient.requireCanonicalPlace(placeRef);
    TripPlace candidate =
        TripPlace.builder()
            .tripId(tripId)
            .placeRef(place.id())
            .placeNameSnapshot(place.name())
            .placeAddressSnapshot(place.address())
            .latSnapshot(place.latitude())
            .lngSnapshot(place.longitude())
            .addedByUserId(ownerId)
            .build();
    try {
      return toResponse(tripPlaces.saveAndFlush(candidate));
    } catch (DataIntegrityViolationException exception) {
      return tripPlaces
          .findByTripIdAndPlaceRef(tripId, placeRef)
          .map(this::toResponse)
          .orElseThrow(() -> exception);
    }
  }

  @Transactional
  public void remove(UUID ownerId, UUID tripId, String placeRef) {
    requireOwnedTrip(ownerId, tripId);
    tripPlaces.deleteByTripIdAndPlaceRef(tripId, placeRef);
  }

  @Transactional(readOnly = true)
  public TripPlaceMembershipBatchResponse memberships(UUID ownerId, List<String> requestedRefs) {
    List<String> refs =
        requestedRefs.stream().map(String::trim).filter(value -> !value.isEmpty()).distinct().toList();
    List<UUID> tripIds =
        trips.findAllByOwnerUserIdAndArchivedAtIsNull(ownerId).stream()
            .filter(trip -> trip.getStatus() != TripStatus.CANCELLED && trip.getStatus() != TripStatus.ARCHIVED)
            .map(Trip::getId)
            .toList();
    Map<String, List<UUID>> memberships =
        tripIds.isEmpty()
            ? Map.of()
            : tripPlaces.findByTripIdInAndPlaceRefIn(tripIds, refs).stream()
                .collect(
                    Collectors.groupingBy(
                        TripPlace::getPlaceRef,
                        Collectors.mapping(TripPlace::getTripId, Collectors.toList())));
    return new TripPlaceMembershipBatchResponse(
        refs.stream()
            .map(ref -> new TripPlaceMembershipResponse(ref, memberships.containsKey(ref), memberships.getOrDefault(ref, List.of())))
            .toList());
  }

  @Transactional(readOnly = true)
  public TripPlacePageResponse list(UUID ownerId, UUID tripId, int page, int size) {
    requireOwnedTrip(ownerId, tripId);
    if (page < 0 || size < 1 || size > 100) {
      throw new ValidationException("INVALID_PAGE", "Invalid pagination");
    }
    var result = tripPlaces.findByTripIdOrderByCreatedAtDesc(tripId, PageRequest.of(page, size));
    return new TripPlacePageResponse(
        result.getContent().stream().map(this::toResponse).toList(),
        result.getTotalElements(),
        result.getTotalPages(),
        size,
        page);
  }

  private Trip requireOwnedTrip(UUID ownerId, UUID tripId) {
    return trips
        .findByIdAndOwnerUserIdAndArchivedAtIsNull(tripId, ownerId)
        .orElseThrow(() -> new NotFoundException("TRIP_NOT_FOUND", "Trip not found"));
  }

  private TripPlaceResponse toResponse(TripPlace value) {
    return new TripPlaceResponse(
        value.getId(),
        value.getTripId(),
        value.getPlaceRef(),
        value.getPlaceNameSnapshot(),
        value.getPlaceAddressSnapshot(),
        value.getLatSnapshot(),
        value.getLngSnapshot(),
        value.getCreatedAt(),
        value.getVersion());
  }
}
