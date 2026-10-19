package fu.tripsense.tripservice.partner.service;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.entity.*;
import fu.tripsense.tripservice.partner.enums.*;
import fu.tripsense.tripservice.partner.repository.*;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RestaurantAvailabilityService {
  private final PartnerBusinessRepository businessRepository;
  private final PartnerBusinessMemberRepository memberRepository;
  private final PartnerBusinessCapabilityRepository capabilityRepository;
  private final RestaurantAvailabilityRepository availabilityRepository;
  private final RestaurantOpeningIntervalRepository intervalRepository;
  private final RestaurantReservationRepository reservationRepository;
  private final RestaurantAvailabilityEngine engine;

  @Transactional(readOnly = true)
  public RestaurantAvailabilityDto getSettings(AuthenticatedUser user, UUID businessId) {
    requirePartner(user, businessId);
    RestaurantAvailability settings = availabilityRepository.findById(businessId).orElseThrow(this::notConfigured);
    return toDto(settings, intervalRepository.findByBusinessIdOrderByDayOfWeekAscOpensAtAsc(businessId));
  }

  @Transactional
  public RestaurantAvailabilityDto updateSettings(
      AuthenticatedUser user, UUID businessId, UpdateRestaurantAvailabilityRequest request) {
    requirePartner(user, businessId);
    validateRequest(request);
    engine.validateIntervals(request.openingIntervals());

    RestaurantAvailability settings = availabilityRepository.lockByBusinessId(businessId).orElse(null);
    if (settings != null && !Objects.equals(settings.getVersion(), request.expectedVersion())) {
      throw new TripServiceException("VERSION_CONFLICT", "Availability settings were modified", HttpStatus.CONFLICT);
    }
    if (settings == null && request.expectedVersion() != null) {
      throw new TripServiceException("VERSION_CONFLICT", "Availability settings do not exist", HttpStatus.CONFLICT);
    }
    engine.validateSettingsUpdateAgainstFutureReservations(
        request, reservationRepository.findFutureActiveReservations(businessId, Instant.now()));

    if (settings == null) settings = RestaurantAvailability.builder().businessId(businessId).build();
    settings.setTimeZone(request.timeZone());
    settings.setCapacityGuests(request.capacityGuests());
    settings.setReservationDurationMinutes(request.reservationDurationMinutes());
    settings.setSlotIntervalMinutes(request.slotIntervalMinutes());
    settings.setMinimumLeadMinutes(request.minimumLeadMinutes());
    settings.setMaximumAdvanceDays(request.maximumAdvanceDays());
    settings.setPendingHoldMinutes(request.pendingHoldMinutes());
    settings = availabilityRepository.saveAndFlush(settings);

    intervalRepository.deleteByBusinessId(businessId);
    List<RestaurantOpeningInterval> intervals = request.openingIntervals().stream()
        .map(item -> RestaurantOpeningInterval.builder()
            .id(UUID.randomUUID()).businessId(businessId).dayOfWeek(item.dayOfWeek())
            .opensAt(item.opensAt()).closesAt(item.closesAt()).build())
        .toList();
    intervalRepository.saveAll(intervals);
    return toDto(settings, intervals);
  }

  @Transactional(readOnly = true)
  public RestaurantAvailabilityResponse getAvailableSlots(UUID businessId, LocalDate date, int partySize) {
    if (date == null || partySize < 1 || partySize > 20) {
      throw new TripServiceException("INVALID_AVAILABILITY_QUERY", "Date and party size are required", HttpStatus.BAD_REQUEST);
    }
    PartnerBusiness business = businessRepository.findById(businessId)
        .filter(item -> item.getKind() == BusinessKind.RESTAURANT && item.getOperationState() == OperationState.ACTIVE)
        .orElseThrow(this::notFound);
    boolean hasListing = capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.RESTAURANT_LISTING)
        .filter(item -> item.getRevokedAt() == null).isPresent();
    if (!business.isPublicEligible(hasListing)) throw notFound();

    RestaurantAvailability settings = availabilityRepository.findById(businessId).orElseThrow(this::notConfigured);
    ZoneId zone = ZoneId.of(settings.getTimeZone());
    Instant from = date.atStartOfDay(zone).toInstant();
    Instant to = date.plusDays(1).atStartOfDay(zone).toInstant();
    Instant now = Instant.now();
    List<RestaurantReservation> active = reservationRepository
        .findActiveOverlappingReservations(businessId, from, to, now);
    List<RestaurantSlotDto> slots = engine.generateAvailableSlots(settings,
        intervalRepository.findByBusinessIdOrderByDayOfWeekAscOpensAtAsc(businessId), date, partySize, now, active);
    return new RestaurantAvailabilityResponse(businessId, date, zone.getId(), partySize, slots);
  }

  private void requirePartner(AuthenticatedUser user, UUID businessId) {
    if (user == null) throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    businessRepository.findById(businessId)
        .filter(item -> item.getKind() == BusinessKind.RESTAURANT).orElseThrow(this::notFound);
    memberRepository.findByIdBusinessIdAndIdUserId(businessId, user.id())
        .filter(item -> item.getState() == MembershipState.ACTIVE
            && Set.of(MembershipRole.OWNER, MembershipRole.MANAGER).contains(item.getRole()))
        .orElseThrow(this::notFound);
  }

  private void validateRequest(UpdateRestaurantAvailabilityRequest request) {
    if (request == null) throw new TripServiceException("INVALID_AVAILABILITY_SETTINGS", "Settings are required", HttpStatus.BAD_REQUEST);
    try { ZoneId.of(request.timeZone()); }
    catch (RuntimeException exception) {
      throw new TripServiceException("INVALID_TIME_ZONE", "Invalid IANA time zone", HttpStatus.BAD_REQUEST);
    }
  }

  private RestaurantAvailabilityDto toDto(RestaurantAvailability settings, List<RestaurantOpeningInterval> intervals) {
    return new RestaurantAvailabilityDto(settings.getBusinessId(), settings.getTimeZone(), settings.getCapacityGuests(),
        settings.getReservationDurationMinutes(), settings.getSlotIntervalMinutes(), settings.getMinimumLeadMinutes(),
        settings.getMaximumAdvanceDays(), settings.getPendingHoldMinutes(), settings.getVersion(), settings.getUpdatedAt(),
        intervals.stream().map(item -> new OpeningIntervalDto(item.getDayOfWeek(), item.getOpensAt(), item.getClosesAt())).toList());
  }

  private TripServiceException notConfigured() {
    return new TripServiceException("RESTAURANT_AVAILABILITY_NOT_CONFIGURED", "Restaurant availability is not configured", HttpStatus.CONFLICT);
  }

  private TripServiceException notFound() {
    return new TripServiceException("RESTAURANT_NOT_FOUND", "Restaurant not found", HttpStatus.NOT_FOUND);
  }
}
