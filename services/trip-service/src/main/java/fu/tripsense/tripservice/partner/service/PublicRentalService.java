package fu.tripsense.tripservice.partner.service;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.PublicRentalListingDto;
import fu.tripsense.tripservice.partner.dto.RentalItemDto;
import fu.tripsense.tripservice.partner.entity.PartnerApplication;
import fu.tripsense.tripservice.partner.entity.PartnerBusiness;
import fu.tripsense.tripservice.partner.enums.ApprovalValidity;
import fu.tripsense.tripservice.partner.enums.BusinessKind;
import fu.tripsense.tripservice.partner.enums.PartnerCapability;
import fu.tripsense.tripservice.partner.enums.PublicationState;
import fu.tripsense.tripservice.partner.enums.RentalCategory;
import fu.tripsense.tripservice.partner.enums.SubscriptionStatus;
import fu.tripsense.tripservice.partner.repository.PartnerApplicationRepository;
import fu.tripsense.tripservice.partner.repository.PartnerBusinessCapabilityRepository;
import fu.tripsense.tripservice.partner.repository.PartnerBusinessRepository;
import fu.tripsense.tripservice.partner.repository.PartnerRentalItemRepository;
import fu.tripsense.tripservice.partner.repository.PartnerSubscriptionRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Public catalog and profile lookup service for published rental partners. */
@Slf4j
@Service
@RequiredArgsConstructor
public class PublicRentalService {

  private final PartnerBusinessRepository businessRepository;
  private final PartnerApplicationRepository applicationRepository;
  private final PartnerBusinessCapabilityRepository capabilityRepository;
  private final PartnerRentalItemRepository rentalItemRepository;
  private final PartnerSubscriptionRepository subscriptionRepository;
  private final RentalService rentalService;

  /** Searches published rental partners matching optional place/destination/name/item query. */
  @Transactional(readOnly = true)
  public List<PublicRentalListingDto> searchPublicRentals(String query) {
    return searchPublicRentals(query, null, false);
  }

  /** Searches published rental partners with optional query, item category, and ready-to-book filter. */
  @Transactional(readOnly = true)
  public List<PublicRentalListingDto> searchPublicRentals(
      String query, RentalCategory category, boolean onlyAccepting) {
    String trimmed = query != null && !query.isBlank() ? query.trim() : null;
    Map<UUID, PartnerBusiness> byId = new LinkedHashMap<>();

    if (trimmed != null) {
      businessRepository.findByDisplayNameContainingIgnoreCase(trimmed).stream()
          .filter(
              b ->
                  b.getKind() == BusinessKind.RENTAL_SERVICE
                      && b.getPublicationState() == PublicationState.PUBLISHED)
          .forEach(b -> byId.put(b.getId(), b));
    }

    businessRepository
        .findByKindAndPublicationState(BusinessKind.RENTAL_SERVICE, PublicationState.PUBLISHED)
        .forEach(b -> byId.putIfAbsent(b.getId(), b));

    return byId.values().stream()
        .map(
            b -> {
              try {
                return getPublicRental(b.getId());
              } catch (Exception e) {
                log.warn(
                    "Failed to load public rental listing for business {}: {}",
                    b.getId(),
                    e.getMessage());
                return null;
              }
            })
        .filter(Objects::nonNull)
        .filter(
            listing ->
                trimmed == null
                    || matchesListing(byId.get(listing.id()), listing, trimmed))
        .map(listing -> filterListingCategory(listing, category))
        .filter(Objects::nonNull)
        .filter(
            listing ->
                !onlyAccepting || (listing.acceptingNew() && listing.hasDirectInventory()))
        .sorted(
            Comparator.comparing(PublicRentalListingDto::acceptingNew, Comparator.reverseOrder())
                .thenComparing(
                    PublicRentalListingDto::hasDirectInventory, Comparator.reverseOrder())
                .thenComparing(PublicRentalListingDto::verifiedPartner, Comparator.reverseOrder()))
        .limit(50)
        .toList();
  }

  /** Returns public rental profile and active rental items for a published RENTAL_SERVICE partner. */
  @Transactional(readOnly = true)
  public PublicRentalListingDto getPublicRental(UUID businessId) {
    PartnerBusiness business = businessRepository.findById(businessId)
        .orElseThrow(() -> new TripServiceException(
            "RENTAL_NOT_FOUND", "Rental business not found", HttpStatus.NOT_FOUND));

    if (business.getKind() != BusinessKind.RENTAL_SERVICE) {
      throw new TripServiceException(
          "RENTAL_NOT_FOUND", "Business is not a rental service", HttpStatus.NOT_FOUND);
    }

    boolean hasListingCap = capabilityRepository
        .findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.RENTAL_LISTING)
        .filter(c -> c.getRevokedAt() == null)
        .isPresent();
    if (!hasListingCap && business.getApprovalValidity() == ApprovalValidity.VALID) {
      hasListingCap = true;
    }

    if (!business.isPublicEligible(hasListingCap)) {
      throw new TripServiceException(
          "RENTAL_NOT_FOUND", "Rental business is not public eligible", HttpStatus.NOT_FOUND);
    }

    Map<String, Object> snapshot = resolveProfileSnapshot(business);
    String address = stringVal(snapshot.get("address"));
    String destination = stringVal(snapshot.get("destination"));
    String openingHours = stringVal(snapshot.get("openingHours"));
    String placeId = stringVal(snapshot.get("placeId"));

    String publicEmail = null;
    String publicPhone = null;
    if (business.isPublicContactConsent()) {
      publicEmail = stringVal(snapshot.get("email"));
      publicPhone = firstNonBlank(stringVal(snapshot.get("contactPhone")), stringVal(snapshot.get("phone")));
    }

    List<RentalItemDto> items = rentalItemRepository
        .findByBusinessIdAndActiveTrueOrderByNameAsc(businessId)
        .stream()
        .map(rentalService::toDto)
        .toList();

    BigDecimal minPricePerDay = items.stream()
        .map(RentalItemDto::pricePerDay)
        .filter(p -> p != null && p.compareTo(BigDecimal.ZERO) > 0)
        .min(BigDecimal::compareTo)
        .orElse(null);

    boolean verified = subscriptionRepository.findByBusinessId(businessId)
        .filter(s -> s.getStatus() == SubscriptionStatus.ACTIVE
            && s.getValidTo() != null
            && s.getValidTo().isAfter(Instant.now()))
        .isPresent();

    return PublicRentalListingDto.builder()
        .id(businessId)
        .ownerUserId(business.getOwnerUserId())
        .displayName(business.getDisplayName())
        .address(address != null ? address : "")
        .destination(destination != null ? destination : "")
        .openingHours(openingHours != null ? openingHours : "")
        .placeId(placeId)
        .publicEmail(publicEmail)
        .publicPhone(publicPhone)
        .verifiedPartner(verified)
        .acceptingNew(business.isAcceptingNew())
        .badgeLabel(verified ? "Verified Partner" : null)
        .hasDirectInventory(!items.isEmpty())
        .minPricePerDay(minPricePerDay)
        .items(items)
        .build();
  }

  private Map<String, Object> resolveProfileSnapshot(PartnerBusiness business) {
    Map<String, Object> snapshot = null;
    if (business.getApprovedRevisionId() != null) {
      snapshot = applicationRepository.findById(business.getApprovedRevisionId())
          .map(PartnerApplication::getProfileSnapshot)
          .orElse(null);
    }
    if (snapshot == null || snapshot.isEmpty()) {
      snapshot = business.getDraftProfileJson();
    }
    return snapshot != null ? snapshot : Map.of();
  }

  private boolean matchesListing(
      PartnerBusiness business, PublicRentalListingDto listing, String query) {
    if (business != null && matchesQuery(business, query)) {
      return true;
    }
    String normalizedQuery = ListingTextSearchSupport.fold(query);
    if (ListingTextSearchSupport.containsFolded(listing.displayName(), normalizedQuery)
        || ListingTextSearchSupport.containsFolded(listing.destination(), normalizedQuery)
        || ListingTextSearchSupport.containsFolded(listing.address(), normalizedQuery)
        || (listing.placeId() != null && listing.placeId().equalsIgnoreCase(query))) {
      return true;
    }
    if (listing.items() == null) {
      return false;
    }
    return listing.items().stream()
        .anyMatch(
            item ->
                ListingTextSearchSupport.containsFolded(item.name(), normalizedQuery)
                    || ListingTextSearchSupport.containsFolded(item.description(), normalizedQuery)
                    || ListingTextSearchSupport.containsFolded(
                        item.category() != null ? item.category().name() : null,
                        normalizedQuery)
                    || ListingTextSearchSupport.containsFolded(
                        item.subcategory(), normalizedQuery));
  }

  private PublicRentalListingDto filterListingCategory(
      PublicRentalListingDto listing, RentalCategory category) {
    if (category == null) {
      return listing;
    }
    List<RentalItemDto> filtered =
        listing.items() == null
            ? List.of()
            : listing.items().stream().filter(i -> i.category() == category).toList();
    if (filtered.isEmpty()) {
      return null;
    }
    BigDecimal minPrice =
        filtered.stream()
            .map(RentalItemDto::pricePerDay)
            .filter(p -> p != null && p.compareTo(BigDecimal.ZERO) > 0)
            .min(BigDecimal::compareTo)
            .orElse(null);
    return PublicRentalListingDto.builder()
        .id(listing.id())
        .ownerUserId(listing.ownerUserId())
        .displayName(listing.displayName())
        .address(listing.address())
        .destination(listing.destination())
        .openingHours(listing.openingHours())
        .placeId(listing.placeId())
        .publicEmail(listing.publicEmail())
        .publicPhone(listing.publicPhone())
        .verifiedPartner(listing.verifiedPartner())
        .acceptingNew(listing.acceptingNew())
        .badgeLabel(listing.badgeLabel())
        .hasDirectInventory(true)
        .minPricePerDay(minPrice)
        .items(filtered)
        .build();
  }

  private boolean matchesQuery(PartnerBusiness business, String query) {
    String foldedQ = ListingTextSearchSupport.fold(query);
    if (ListingTextSearchSupport.containsFolded(business.getDisplayName(), foldedQ)) {
      return true;
    }
    Map<String, Object> snapshot = resolveProfileSnapshot(business);
    String placeId = stringVal(snapshot.get("placeId"));
    if (placeId != null && placeId.equalsIgnoreCase(query)) {
      return true;
    }
    return ListingTextSearchSupport.containsFolded(stringVal(snapshot.get("placeName")), foldedQ)
        || ListingTextSearchSupport.containsFolded(stringVal(snapshot.get("destination")), foldedQ)
        || ListingTextSearchSupport.containsFolded(stringVal(snapshot.get("address")), foldedQ);
  }

  private static String stringVal(Object value) {
    if (value == null) return null;
    String str = value.toString().trim();
    return str.isEmpty() ? null : str;
  }

  private static String firstNonBlank(String primary, String fallback) {
    return primary != null && !primary.isBlank() ? primary : fallback;
  }
}
