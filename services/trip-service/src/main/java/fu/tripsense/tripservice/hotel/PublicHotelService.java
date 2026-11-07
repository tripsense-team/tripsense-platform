package fu.tripsense.tripservice.hotel;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.PublicHotelListingDto;
import fu.tripsense.tripservice.partner.entity.PartnerApplication;
import fu.tripsense.tripservice.partner.entity.PartnerBusiness;
import fu.tripsense.tripservice.partner.enums.BusinessKind;
import fu.tripsense.tripservice.partner.enums.PublicationState;
import fu.tripsense.tripservice.partner.enums.SubscriptionStatus;
import fu.tripsense.tripservice.partner.repository.PartnerApplicationRepository;
import fu.tripsense.tripservice.partner.repository.PartnerBusinessRepository;
import fu.tripsense.tripservice.partner.repository.PartnerSubscriptionRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class PublicHotelService {

  private final PartnerBusinessRepository businessRepository;
  private final PartnerApplicationRepository applicationRepository;
  private final PartnerSubscriptionRepository subscriptionRepository;
  private final JdbcTemplate db;

  @Transactional
  public List<PublicHotelListingDto> searchPublicHotels(String query) {
    List<PartnerBusiness> businesses;
    if (query != null && !query.isBlank()) {
      String trimmed = query.trim();
      businesses = businessRepository.findByDisplayNameContainingIgnoreCase(trimmed).stream()
          .filter(b -> b.getKind() == BusinessKind.HOTEL && b.getPublicationState() == PublicationState.PUBLISHED)
          .toList();

      if (businesses.isEmpty()) {
        businesses = businessRepository.findByKindAndPublicationState(BusinessKind.HOTEL, PublicationState.PUBLISHED).stream()
            .filter(b -> matchesQuery(b, trimmed))
            .toList();
      }
    } else {
      businesses = businessRepository.findByKindAndPublicationState(BusinessKind.HOTEL, PublicationState.PUBLISHED);
    }

    return businesses.stream()
        .map(b -> {
          try {
            return getPublicHotel(b.getId());
          } catch (Exception e) {
            log.warn("Failed to load public hotel listing for business {}: {}", b.getId(), e.getMessage());
            return null;
          }
        })
        .filter(Objects::nonNull)
        .sorted((a, b) -> Boolean.compare(b.verifiedPartner(), a.verifiedPartner()))
        .limit(50)
        .toList();
  }

  @Transactional
  public PublicHotelListingDto getPublicHotel(UUID businessId) {
    PartnerBusiness business = businessRepository.findById(businessId)
        .orElseThrow(() -> new TripServiceException("HOTEL_NOT_FOUND", "Partner business not found", HttpStatus.NOT_FOUND));

    if (business.getKind() != BusinessKind.HOTEL) {
      throw new TripServiceException("HOTEL_NOT_FOUND", "Business is not a hotel", HttpStatus.NOT_FOUND);
    }

    if (business.getPublicationState() != PublicationState.PUBLISHED) {
      throw new TripServiceException("HOTEL_NOT_FOUND", "Hotel is not published", HttpStatus.NOT_FOUND);
    }

    Map<String, Object> snapshot = Map.of();
    if (business.getApprovedRevisionId() != null) {
      snapshot = applicationRepository.findById(business.getApprovedRevisionId())
          .map(PartnerApplication::getProfileSnapshot)
          .orElse(Map.of());
    }
    if (snapshot == null || snapshot.isEmpty()) {
      snapshot = business.getDraftProfileJson() != null ? business.getDraftProfileJson() : Map.of();
    }

    String destination = (String) snapshot.getOrDefault("destination", "Đà Nẵng");
    String address = (String) snapshot.getOrDefault("address", business.getDisplayName());
    String email = (String) snapshot.getOrDefault("email", "partner@tripsense.vn");

    // Auto-provision or retrieve hotel_property
    UUID propertyId = ensureHotelProperty(business, destination, address, email);

    // Check min price and room inventory
    BigDecimal minPrice = null;
    try {
      minPrice = db.queryForObject("""
          SELECT MIN(i.nightly_price)
          FROM hotel_property p
          JOIN hotel_room_type rt ON rt.property_id = p.id
          JOIN hotel_inventory i ON i.room_type_id = rt.id
          WHERE p.business_id = ?
            AND i.stay_date >= CURRENT_DATE
            AND i.stop_sell = false
            AND i.held + i.booked < i.allocation
          """, BigDecimal.class, businessId);
    } catch (Exception ignored) {}

    String checkInTime = "14:00";
    String checkOutTime = "11:00";
    try {
      var propRow = db.queryForMap("SELECT check_in_time, check_out_time FROM hotel_property WHERE id = ?", propertyId);
      if (propRow.get("check_in_time") != null) checkInTime = propRow.get("check_in_time").toString();
      if (propRow.get("check_out_time") != null) checkOutTime = propRow.get("check_out_time").toString();
    } catch (Exception ignored) {}

    String publicEmail = null;
    String publicPhone = null;
    if (business.isPublicContactConsent()) {
      publicEmail = (String) snapshot.get("email");
      publicPhone = (String) snapshot.get("phone");
    }

    boolean verified = subscriptionRepository.findByBusinessId(businessId)
        .filter(s -> s.getStatus() == SubscriptionStatus.ACTIVE
            && s.getValidTo() != null
            && s.getValidTo().isAfter(Instant.now()))
        .isPresent();

    return PublicHotelListingDto.builder()
        .id(businessId)
        .ownerUserId(business.getOwnerUserId())
        .displayName(business.getDisplayName())
        .address(address)
        .destination(destination)
        .checkInTime(checkInTime)
        .checkOutTime(checkOutTime)
        .publicEmail(publicEmail)
        .publicPhone(publicPhone)
        .verifiedPartner(verified)
        .acceptingNew(business.isAcceptingNew())
        .badgeLabel(verified ? "Verified Partner" : null)
        .propertyId(propertyId)
        .hasDirectInventory(minPrice != null)
        .minPricePerNight(minPrice)
        .build();
  }

  private UUID ensureHotelProperty(PartnerBusiness b, String destination, String address, String email) {
    List<UUID> existing = db.query("SELECT id FROM hotel_property WHERE business_id = ?",
        (rs, rowNum) -> (UUID) rs.getObject("id"), b.getId());
    if (!existing.isEmpty()) {
      return existing.get(0);
    }

    UUID propId = UUID.randomUUID();
    db.update("""
        INSERT INTO hotel_property (
            id, business_id, owner_id, owner_email, name, destination, address,
            time_zone, check_in_time, check_out_time, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Asia/Ho_Chi_Minh', '14:00', '11:00', 'ACTIVE', clock_timestamp())
        ON CONFLICT (business_id) DO UPDATE SET status = 'ACTIVE'
        """,
        propId, b.getId(), b.getOwnerUserId(),
        email != null && !email.isBlank() ? email : "partner@tripsense.vn",
        b.getDisplayName(),
        destination != null && !destination.isBlank() ? destination : "Đà Nẵng",
        address != null && !address.isBlank() ? address : b.getDisplayName()
    );

    return propId;
  }

  private boolean matchesQuery(PartnerBusiness b, String query) {
    String lowerQ = query.toLowerCase();
    if (b.getDisplayName() != null && b.getDisplayName().toLowerCase().contains(lowerQ)) {
      return true;
    }
    if (b.getDraftProfileJson() != null) {
      String placeId = (String) b.getDraftProfileJson().get("placeId");
      if (placeId != null && placeId.equalsIgnoreCase(query)) return true;
      String dest = (String) b.getDraftProfileJson().get("destination");
      if (dest != null && dest.toLowerCase().contains(lowerQ)) return true;
      String addr = (String) b.getDraftProfileJson().get("address");
      if (addr != null && addr.toLowerCase().contains(lowerQ)) return true;
    }
    return false;
  }
}

